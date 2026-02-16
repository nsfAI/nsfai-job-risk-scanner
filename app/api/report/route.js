export const runtime = "nodejs";

/**
 * NSFAI — Report API
 * - Calls Gemini (gemini-2.0-flash)
 * - Forces strict JSON output
 * - Applies "structural dampeners" to prevent unrealistic high scores for
 *   physical / liability / empathy-heavy roles
 */

function bandFromScore(score) {
  if (score <= 2) return "Extremely resistant";
  if (score <= 4) return "Low exposure";
  if (score <= 6) return "Moderate exposure";
  if (score <= 8) return "High task automation exposure";
  return "Very high displacement probability";
}

function clampInt(n, min, max) {
  const x = Number.isFinite(n) ? n : 0;
  return Math.max(min, Math.min(max, Math.round(x)));
}

function stripCodeFences(text) {
  if (!text) return "";
  return text
    .replace(/```json\s*/gi, "")
    .replace(/```/g, "")
    .trim();
}

/**
 * Structural dampener:
 * If user selects tasks that imply strong "human moat", cap score.
 *
 * Example:
 * - 2+ moat indicators => cap at 6
 * - 1 moat indicator  => cap at 7
 */
function applyStructuralDampener(score, selectedTasks = []) {
  const moatIndicators = [
    "Hands-on physical work (field, equipment, lab)",
    "High-stakes decisions / sign-off / liability responsibility",
    "Caregiving / high-empathy human interaction",
  ];

  const hits = selectedTasks.filter((t) => moatIndicators.includes(t)).length;

  const base = clampInt(score, 0, 10);

  if (hits >= 2) return Math.min(base, 6);
  if (hits === 1) return Math.min(base, 7);
  return base;
}

function resilienceFactorsFromTasks(selectedTasks = []) {
  const factors = [];

  if (selectedTasks.includes("Hands-on physical work (field, equipment, lab)")) {
    factors.push("Physical unpredictability / real-world environment");
  }
  if (
    selectedTasks.includes(
      "High-stakes decisions / sign-off / liability responsibility"
    )
  ) {
    factors.push("Legal liability / accountability");
  }
  if (selectedTasks.includes("Caregiving / high-empathy human interaction")) {
    factors.push("Empathy / trust / human relationship requirements");
  }

  return factors;
}

export async function POST(req) {
  try {
    const body = await req.json();

    const jobTitle = (body?.jobTitle || "").toString().slice(0, 120);
    const industry = (body?.industry || "").toString().slice(0, 80);
    const seniority = (body?.seniority || "").toString().slice(0, 80);
    const jobDescription = (body?.jobDescription || "").toString().slice(0, 8000);
    const tasks = Array.isArray(body?.tasks) ? body.tasks.slice(0, 12) : [];

    if (!jobDescription.trim()) {
      return Response.json(
        { ok: false, error: "Missing job description." },
        { status: 400 }
      );
    }

    const apiKey =
      process.env.GEMINI_API_KEY ||
      process.env.GOOGLE_API_KEY ||
      process.env.GOOGLE_GENERATIVE_AI_API_KEY;

    if (!apiKey) {
      return Response.json(
        { ok: false, error: "Missing GEMINI_API_KEY (or GOOGLE_API_KEY) on server." },
        { status: 500 }
      );
    }

    const model = "gemini-2.0-flash";

    // Tell Gemini to ONLY output strict JSON with this schema.
    // (No prose, no markdown, no code fences.)
    const prompt = `
You are an AI labor-market analyst. Output STRICT JSON ONLY.

Goal:
Given the role + tasks, estimate AI automation exposure.

IMPORTANT:
- This is NOT "job extinction certainty".
- It is "task automation exposure".
- Scores are 0–10 (integers only).

Return JSON with EXACT keys:
{
  "risk_score": number,
  "risk_band": string,
  "why": string[],
  "most_automatable": { "task": string, "reason": string, "time_horizon": "0-12m"|"1-3y"|"3-5y"|"5y+" }[],
  "most_human_moat": { "task": string, "reason": string }[],
  "recommendations": string[],
  "assumptions": string[]
}

Constraints:
- risk_score must be an integer 0–10
- why: 2–5 bullets, plain English
- most_automatable: 2–4 items
- most_human_moat: 2–4 items
- recommendations: 3–6 items
- assumptions: 1–3 items

Inputs:
Job title: ${jobTitle || "(none)"}
Industry: ${industry || "(none)"}
Seniority: ${seniority || "(none)"}

Selected tasks:
${tasks.length ? tasks.map((t) => `- ${t}`).join("\n") : "(none)"}

Job description:
${jobDescription}

Now output ONLY the JSON object. No extra text.
`.trim();

    const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${encodeURIComponent(
      apiKey
    )}`;

    const geminiRes = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ role: "user", parts: [{ text: prompt }] }],
        generationConfig: {
          temperature: 0.2,
          maxOutputTokens: 900,
        },
      }),
    });

    const raw = await geminiRes.text();

    if (!geminiRes.ok) {
      // Bubble up info safely
      return Response.json(
        {
          ok: false,
          error: `Gemini API error (${geminiRes.status})`,
          details: raw?.slice(0, 600),
        },
        { status: 502 }
      );
    }

    let data;
    try {
      data = JSON.parse(raw);
    } catch {
      return Response.json(
        {
          ok: false,
          error: "Gemini returned non-JSON API payload (unexpected).",
          details: raw?.slice(0, 600),
        },
        { status: 502 }
      );
    }

    const textOut =
      data?.candidates?.[0]?.content?.parts?.map((p) => p?.text || "").join("") ||
      "";

    const cleaned = stripCodeFences(textOut);

    let report;
    try {
      report = JSON.parse(cleaned);
    } catch (e) {
      return Response.json(
        {
          ok: false,
          error: "Gemini returned invalid JSON.",
          details: cleaned?.slice(0, 900),
        },
        { status: 502 }
      );
    }

    // Normalize + compute band
    const originalScore = clampInt(report?.risk_score, 0, 10);
    const adjustedScore = applyStructuralDampener(originalScore, tasks);
    const finalBand = bandFromScore(adjustedScore);

    const resilience_factors = resilienceFactorsFromTasks(tasks);

    const normalized = {
      risk_score: adjustedScore,
      risk_band: finalBand,
      why: Array.isArray(report?.why) ? report.why.slice(0, 6) : [],
      most_automatable: Array.isArray(report?.most_automatable)
        ? report.most_automatable.slice(0, 6)
        : [],
      most_human_moat: Array.isArray(report?.most_human_moat)
        ? report.most_human_moat.slice(0, 6)
        : [],
      recommendations: Array.isArray(report?.recommendations)
        ? report.recommendations.slice(0, 10)
        : [],
      assumptions: Array.isArray(report?.assumptions) ? report.assumptions.slice(0, 6) : [],
      resilience_factors,
      meta: {
        model,
        original_score: originalScore,
        dampener_applied: adjustedScore !== originalScore,
      },
    };

    return Response.json(
      {
        ok: true,
        usedModel: model,
        report: normalized,
      },
      { status: 200 }
    );
  } catch (err) {
    return Response.json(
      {
        ok: false,
        error: "Server error generating report.",
        details: String(err?.message || err),
      },
      { status: 500 }
    );
  }
}

export async function GET() {
  return Response.json({ ok: false, error: "Method not allowed." }, { status: 405 });
}
