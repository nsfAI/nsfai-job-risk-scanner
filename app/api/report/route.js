import { NextResponse } from "next/server";

export const runtime = "nodejs";

const MODEL = "gemini-2.0-flash";

const SYSTEM_PROMPT = `
You are an AI labor automation analyst.

You evaluate automation exposure of tasks, NOT full job extinction.

Return JSON ONLY. No markdown, no backticks, no extra commentary.

You MUST output BOTH:
(A) "new_schema" (task scores + structural dampeners), AND
(B) "legacy_schema" (fields expected by an older UI).

Follow this process:

1) Score each selected task for automation exposure (0–10) with a brief reason.
2) Compute base exposure (average of task scores).
3) Detect structural resistance factors:
   - physical_unpredictability
   - real_time_embodied_decision_making
   - legal_liability_life_safety
   - heavy_empathy_trust
   - environmental_chaos
4) Apply caps:
   - If 2+ of (physical_unpredictability, legal_liability_life_safety, heavy_empathy_trust) are true => cap at 5
   - Else if legal_liability_life_safety is true => cap at 6
   - Else if heavy_empathy_trust is true => cap at 6
   - Else if physical_unpredictability is true => cap at 7
   - Else cap = null (no cap)
5) Final score = min(base exposure, cap) if cap exists else base exposure.
6) Derive a risk band from final score:
   0–2 Extremely resistant
   3–4 Low exposure
   5–6 Moderate exposure
   7–8 High task automation exposure
   9–10 Very high displacement probability

Output EXACT JSON shape:

{
  "new_schema": {
    "task_scores": [{"task":"...","score":0-10,"reason":"..."}],
    "base_exposure": 0-10,
    "structural_resistance": "Low|Medium|High",
    "structural_factors": {
      "physical_unpredictability": true|false,
      "real_time_embodied_decision_making": true|false,
      "legal_liability_life_safety": true|false,
      "heavy_empathy_trust": true|false,
      "environmental_chaos": true|false
    },
    "dampener_applied": true|false,
    "cap_applied": 5|6|7|null,
    "final_replacement_score": 0-10,
    "explanation": "...",
    "confidence": "Low|Medium|High"
  },
  "legacy_schema": {
    "risk_score": 0-10,
    "risk_band": "Extremely resistant|Low exposure|Moderate exposure|High task automation exposure|Very high displacement probability",
    "why": ["...","...","..."],
    "most_automatable": [{"task":"...","reason":"...","time_horizon":"0-12m|1-3y|3-5y|5y+"}],
    "most_human_moat": [{"task":"...","reason":"..."}],
    "recommendations": ["...","...","..."],
    "assumptions": ["...","..."]
  }
}
`;

function jsonFromText(text) {
  try {
    return JSON.parse(text);
  } catch (_) {}

  const firstBrace = text.indexOf("{");
  const lastBrace = text.lastIndexOf("}");
  if (firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace) {
    const candidate = text.slice(firstBrace, lastBrace + 1);
    try {
      return JSON.parse(candidate);
    } catch (_) {}
  }
  return null;
}

function clamp(n, min, max) {
  const num = Number(n);
  if (!Number.isFinite(num)) return min;
  return Math.max(min, Math.min(max, num));
}

function asArrayStrings(x) {
  if (!Array.isArray(x)) return [];
  return x.map((v) => String(v ?? "")).filter(Boolean);
}

function normalizeOutput(parsed) {
  const ns = parsed?.new_schema ?? {};
  const ls = parsed?.legacy_schema ?? {};

  // --- new schema normalization ---
  const task_scores = Array.isArray(ns.task_scores) ? ns.task_scores : [];
  const normalizedTaskScores = task_scores
    .map((t) => ({
      task: String(t?.task ?? ""),
      score: clamp(t?.score ?? 0, 0, 10),
      reason: String(t?.reason ?? ""),
    }))
    .filter((t) => t.task.length > 0);

  const base_exposure = clamp(ns.base_exposure ?? 0, 0, 10);

  const f = ns.structural_factors ?? {};
  const structural_factors = {
    physical_unpredictability: Boolean(f.physical_unpredictability),
    real_time_embodied_decision_making: Boolean(f.real_time_embodied_decision_making),
    legal_liability_life_safety: Boolean(f.legal_liability_life_safety),
    heavy_empathy_trust: Boolean(f.heavy_empathy_trust),
    environmental_chaos: Boolean(f.environmental_chaos),
  };

  const sr = String(ns.structural_resistance ?? "Medium");
  const structural_resistance = ["Low", "Medium", "High"].includes(sr) ? sr : "Medium";

  const dampener_applied = Boolean(ns.dampener_applied);
  const capVal = ns.cap_applied;
  const cap_applied = capVal === 5 || capVal === 6 || capVal === 7 ? capVal : null;

  const final_replacement_score = clamp(ns.final_replacement_score ?? base_exposure, 0, 10);

  const conf = String(ns.confidence ?? "Medium");
  const confidence = ["Low", "Medium", "High"].includes(conf) ? conf : "Medium";

  const explanation = String(ns.explanation ?? "");

  const new_schema = {
    task_scores: normalizedTaskScores,
    base_exposure,
    structural_resistance,
    structural_factors,
    dampener_applied,
    cap_applied,
    final_replacement_score,
    explanation,
    confidence,
  };

  // --- legacy schema normalization (what your UI expects) ---
  const risk_score = clamp(ls.risk_score ?? final_replacement_score, 0, 10);

  const rb = String(ls.risk_band ?? "");
  const allowedBands = [
    "Extremely resistant",
    "Low exposure",
    "Moderate exposure",
    "High task automation exposure",
    "Very high displacement probability",
  ];
  const risk_band = allowedBands.includes(rb)
    ? rb
    : risk_score <= 2
      ? "Extremely resistant"
      : risk_score <= 4
        ? "Low exposure"
        : risk_score <= 6
          ? "Moderate exposure"
          : risk_score <= 8
            ? "High task automation exposure"
            : "Very high displacement probability";

  const why = asArrayStrings(ls.why);
  const recommendations = asArrayStrings(ls.recommendations);
  const assumptions = asArrayStrings(ls.assumptions);

  const most_automatable = Array.isArray(ls.most_automatable) ? ls.most_automatable : [];
  const most_human_moat = Array.isArray(ls.most_human_moat) ? ls.most_human_moat : [];

  const legacy_schema = {
    risk_score,
    risk_band,
    why: why.length ? why : explanation ? [explanation] : [],
    most_automatable: most_automatable
      .map((x) => ({
        task: String(x?.task ?? ""),
        reason: String(x?.reason ?? ""),
        time_horizon: String(x?.time_horizon ?? "1-3y"),
      }))
      .filter((x) => x.task),
    most_human_moat: most_human_moat
      .map((x) => ({
        task: String(x?.task ?? ""),
        reason: String(x?.reason ?? ""),
      }))
      .filter((x) => x.task),
    recommendations,
    assumptions,
  };

  return { new_schema, legacy_schema };
}

export async function POST(req) {
  try {
    const apiKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY;
    if (!apiKey) {
      return NextResponse.json(
        { ok: false, error: "Missing GEMINI_API_KEY (or GOOGLE_API_KEY) in env vars." },
        { status: 500 }
      );
    }

    const body = await req.json().catch(() => null);
    if (!body) return NextResponse.json({ ok: false, error: "Invalid JSON body." }, { status: 400 });

    const jobTitle = String(body.jobTitle ?? "");
    const industry = String(body.industry ?? "");
    const seniority = String(body.seniority ?? "");
    const jobDescription = String(body.jobDescription ?? "");
    const tasks = Array.isArray(body.tasks) ? body.tasks.map(String) : [];

    if (!jobDescription || tasks.length < 3) {
      return NextResponse.json(
        { ok: false, error: "Provide a job description and select 3–8 tasks." },
        { status: 400 }
      );
    }

    const userPrompt = `
ROLE INPUTS:
- Job title: ${jobTitle || "(not provided)"}
- Industry: ${industry || "(not provided)"}
- Seniority: ${seniority || "(not provided)"}

JOB DESCRIPTION:
${jobDescription}

SELECTED TASKS (3–8):
${tasks.map((t, i) => `${i + 1}. ${t}`).join("\n")}
`.trim();

    const url = `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent?key=${apiKey}`;

    const payload = {
      contents: [
        {
          role: "user",
          parts: [{ text: SYSTEM_PROMPT + "\n\n" + userPrompt }],
        },
      ],
      generationConfig: {
        temperature: 0.2,
        topP: 0.9,
        maxOutputTokens: 1600,
      },
    };

    const resp = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    if (!resp.ok) {
      const errText = await resp.text().catch(() => "");
      return NextResponse.json(
        { ok: false, error: `Gemini API error (${resp.status})`, details: errText.slice(0, 1200) },
        { status: 502 }
      );
    }

    const data = await resp.json();
    const text = data?.candidates?.[0]?.content?.parts?.map((p) => p.text).join("")?.trim() || "";

    const parsed = jsonFromText(text);
    if (!parsed) {
      return NextResponse.json(
        { ok: false, error: "Gemini returned invalid JSON.", raw: text.slice(0, 1500) },
        { status: 502 }
      );
    }

    const { new_schema, legacy_schema } = normalizeOutput(parsed);

    // ✅ IMPORTANT: Return legacy fields at top-level "report" for your existing UI
    return NextResponse.json({
      ok: true,
      usedModel: MODEL,

      // New structured stuff (for later UI upgrade)
      new_report: new_schema,

      // OLD UI expects: data.report.risk_score etc.
      report: legacy_schema,

      meta: {
        received: { jobTitle, industry, seniority, tasksCount: tasks.length, chars: jobDescription.length },
      },
    });
  } catch (e) {
    return NextResponse.json(
      { ok: false, error: "Server error", details: String(e?.message || e) },
      { status: 500 }
    );
  }
}

export async function GET() {
  return NextResponse.json({ ok: false, error: "Method Not Allowed" }, { status: 405 });
}
