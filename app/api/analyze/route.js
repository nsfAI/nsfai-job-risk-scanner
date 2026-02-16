export const runtime = "nodejs";

function requiredEnv(name) {
  const v = process.env[name];
  if (!v) throw new Error(`Missing ${name} environment variable.`);
  return v;
}

function clamp(n, min, max) {
  const x = Number(n);
  if (Number.isNaN(x)) return min;
  return Math.max(min, Math.min(max, x));
}

async function geminiJson({ prompt, temperature = 0.2 }) {
  const apiKey = requiredEnv("GEMINI_API_KEY");
  const model = process.env.GEMINI_MODEL || "gemini-flash-latest";

  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;

  const body = {
    contents: [{ role: "user", parts: [{ text: prompt }] }],
    generationConfig: {
      temperature,
      maxOutputTokens: 800
    },
    safetySettings: [],
    tools: [{
      functionDeclarations: [{
        name: "nsfai_result",
        parameters: {
          type: "object",
          properties: {
            normalized_role: { type: "string" },
            safety_score: { type: "number" },
            overall_band: { type: "string" },
            time_horizon: { type: "string" },
            executive_summary: { type: "string" },
            breakdown: {
              type: "object",
              properties: {
                automation_exposure_pct: { type: "number" },
                augmentation_potential_pct: { type: "number" },
                human_moat_pct: { type: "number" },
                accountability_shield_pct: { type: "number" },
                toolchain_replaceability_pct: { type: "number" },
                adoption_speed_factor: { type: "number" }
              }
            },
            evidence_snippets: { type: "array", items: { type: "string" } },
            at_risk_tasks: { type: "array", items: { type: "string" } },
            defensible_tasks: { type: "array", items: { type: "string" } },
            plan_90_days: { type: "array", items: { type: "string" } },
            adjacent_roles: { type: "array", items: { type: "string" } }
          }
        }
      }]
    }],
    toolConfig: {
      functionCallingConfig: { mode: "ANY" }
    }
  };

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 20000);

  try {
    const resp = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
      signal: controller.signal
    });

    const data = await resp.json();
    if (!resp.ok) {
      throw new Error(data?.error?.message || "Gemini request failed.");
    }

    const call = data?.candidates?.[0]?.content?.parts?.find(p => p.functionCall);
    if (!call?.functionCall?.args) {
      throw new Error("Model did not return structured JSON.");
    }

    return call.functionCall.args;

  } catch (e) {
    if (String(e?.name) === "AbortError") {
      throw new Error("AI request timed out. Please try again.");
    }
    throw e;
  } finally {
    clearTimeout(timeout);
  }
}

export async function POST(req) {
  try {
    const { title, industry, seniority, job_description, tasks } = await req.json();

    if (!job_description || job_description.length < 300) {
      return Response.json(
        { error: "Paste a job description (300+ characters)." },
        { status: 400 }
      );
    }

    if (!Array.isArray(tasks) || tasks.length < 3) {
      return Response.json(
        { error: "Select at least 3 tasks you actually do." },
        { status: 400 }
      );
    }

    const prompt = `
You are NSFAI (Not Safe From AI), an advanced job risk scoring engine.

Return structured JSON only.

Inputs:
title: ${title || "(not provided)"}
industry: ${industry}
seniority: ${seniority}
tasks: ${JSON.stringify(tasks)}

Job description:
${job_description}
`;

    const result = await geminiJson({ prompt });

    result.safety_score = clamp(result.safety_score, 0, 100);

    return Response.json(result);

  } catch (e) {
    return Response.json(
      { error: e.message || "Server error" },
      { status: 500 }
    );
  }
}
