export const runtime = "nodejs";

function requiredEnv(name) {
  const v = process.env[name];
  if (!v) throw new Error(`Missing ${name} environment variable.`);
  return v;
}

async function geminiJson({ system, user, temperature = 0.2 }) {
  const apiKey = requiredEnv("GEMINI_API_KEY");
  const model = process.env.GEMINI_MODEL || "gemini-2.0-flash";
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;

  const body = {
    contents: [{ role: "user", parts: [{ text: `${system}\n\n${user}` }] }],
    generationConfig: { temperature, responseMimeType: "application/json" }
  };

  const resp = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body)
  });

  const data = await resp.json();
  if (!resp.ok) throw new Error(data?.error?.message || "Gemini request failed.");

  const text = data?.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!text) throw new Error("No model output received.");

  try { return JSON.parse(text); } catch { throw new Error("Model returned non-JSON output."); }
}

const TAXONOMY = {
  categories: [
    { key: "routine_text", label: "Routine writing/summarization", automation_weight: 0.85, moat_weight: 0.10 },
    { key: "structured_admin", label: "Structured admin / processing", automation_weight: 0.90, moat_weight: 0.05 },
    { key: "structured_analysis", label: "Structured analysis / reporting", automation_weight: 0.75, moat_weight: 0.20 },
    { key: "customer_service", label: "FAQ-style customer support", automation_weight: 0.70, moat_weight: 0.25 },
    { key: "process_design", label: "Workflow/SOP design", automation_weight: 0.40, moat_weight: 0.55 },
    { key: "sales_negotiation", label: "Sales/negotiation/persuasion", automation_weight: 0.35, moat_weight: 0.65 },
    { key: "leadership", label: "Leadership/stakeholder mgmt", automation_weight: 0.25, moat_weight: 0.75 },
    { key: "hands_on_physical", label: "Hands-on physical work", automation_weight: 0.15, moat_weight: 0.85 },
    { key: "caregiving_empathy", label: "Caregiving/high-empathy work", automation_weight: 0.20, moat_weight: 0.80 },
    { key: "high_stakes_accountability", label: "High-stakes sign-off / liability", automation_weight: 0.30, moat_weight: 0.75 },
    { key: "creative_strategy", label: "Creative strategy / ambiguous problems", automation_weight: 0.35, moat_weight: 0.70 },
    { key: "build_automation", label: "Building automation/tools", automation_weight: 0.10, moat_weight: 0.80 }
  ]
};

function clamp01(x) {
  const n = Number(x);
  if (Number.isNaN(n)) return 0;
  return Math.max(0, Math.min(1, n));
}
function pct(x01) { return Math.round(clamp01(x01) * 100); }
function band(score) { return score >= 70 ? "Low Risk" : score >= 45 ? "Medium Risk" : "High Risk"; }
function horizon(adoptionSpeedFactor, automationExposurePct) {
  const a = Number(adoptionSpeedFactor) || 3;
  if (a >= 4 && automationExposurePct >= 60) return "6–18 months";
  if (a >= 4) return "18–36 months";
  if (automationExposurePct >= 70) return "18–36 months";
  return "3–7 years";
}

export async function POST(req) {
  try {
    const { title, industry, seniority, job_description, tasks } = await req.json();

    if (!job_description || String(job_description).trim().length < 300) {
      return Response.json({ error: "Paste a job description (300+ characters)." }, { status: 400 });
    }
    if (!Array.isArray(tasks) || tasks.length < 3) {
      return Response.json({ error: "Select at least 3 tasks you actually do." }, { status: 400 });
    }

    const a1 = await geminiJson({
      system: "You are a labor economist + HR analyst. Return ONLY valid JSON.",
      user: `
Input:
- title: ${title || "(not provided)"}
- industry: ${industry}
- seniority: ${seniority}
- self-reported tasks: ${JSON.stringify(tasks)}

Job description:
<<<
${job_description}
>>>

Return JSON schema EXACTLY:
{
  "normalized_role": "string",
  "primary_task_statements": ["string", "... up to 20"],
  "tools_mentioned": ["string", "... up to 12"],
  "evidence_snippets": ["string", "... up to 6"]
}

Rules:
- Evidence snippets must be short quotes/near-quotes from the JD (max ~20 words each).
- Task statements should be atomic.
`
    });

    const a2 = await geminiJson({
      system: "You are an AI-work impact analyst. Return ONLY valid JSON.",
      user: `
Map tasks into taxonomy categories and give shares that sum to 1.0.

Taxonomy:
${JSON.stringify(TAXONOMY.categories.map(c => ({ key: c.key, label: c.label })), null, 2)}

Inputs:
normalized_role: ${a1.normalized_role}
industry: ${industry}
seniority: ${seniority}
task_statements: ${JSON.stringify(a1.primary_task_statements || [], null, 2)}
tools_mentioned: ${JSON.stringify(a1.tools_mentioned || [], null, 2)}

Return JSON schema EXACTLY:
{
  "task_mix": [{"category_key":"string","share": 0.0}],
  "adoption_speed_factor": 1-5,
  "notes": ["string","... up to 8"]
}

Rules:
- Shares sum to 1.0 (+/-0.01).
- adoption_speed_factor: 1 slow, 5 fast.
`
    });

    const weights = new Map(TAXONOMY.categories.map(c => [c.key, c]));
    const mix = Array.isArray(a2.task_mix) ? a2.task_mix : [];

    let automation = 0;
    let moat = 0;
    for (const it of mix) {
      const w = weights.get(it.category_key);
      if (!w) continue;
      const share = clamp01(it.share);
      automation += share * w.automation_weight;
      moat += share * w.moat_weight;
    }

    const adoptionSpeedFactor = Math.max(1, Math.min(5, Number(a2.adoption_speed_factor) || 3));
    const toolchainReplaceability = clamp01(automation * (adoptionSpeedFactor / 5));
    const accountabilityShield = clamp01(moat * 0.6 + (String(seniority).includes("Manager") || String(seniority).includes("Executive") ? 0.25 : 0.1));
    const augmentationPotential = clamp01(0.55 + (automation * 0.25) + (moat * 0.10));

    const automationExposurePct = pct(automation);
    const humanMoatPct = pct(moat);
    const augmentationPotentialPct = pct(augmentationPotential);
    const toolchainReplaceabilityPct = pct(toolchainReplaceability);
    const accountabilityShieldPct = pct(accountabilityShield);

    const safety01 =
      (0.38 * moat) +
      (0.22 * accountabilityShield) +
      (0.18 * augmentationPotential) +
      (0.12 * (1 - toolchainReplaceability)) +
      (0.10 * (1 - (adoptionSpeedFactor / 5))) -
      (0.20 * automation);

    const safetyScore = Math.max(0, Math.min(100, Math.round(safety01 * 100)));

    const a3 = await geminiJson({
      system: "You are a career strategist specializing in AI-era job design. Return ONLY valid JSON.",
      user: `
Inputs:
normalized_role: ${a1.normalized_role}
industry: ${industry}
seniority: ${seniority}
task_statements: ${JSON.stringify(a1.primary_task_statements || [], null, 2)}
tools_mentioned: ${JSON.stringify(a1.tools_mentioned || [], null, 2)}
task_mix: ${JSON.stringify(mix, null, 2)}
scores:
automation_exposure_pct: ${automationExposurePct}
human_moat_pct: ${humanMoatPct}
accountability_shield_pct: ${accountabilityShieldPct}
toolchain_replaceability_pct: ${toolchainReplaceabilityPct}
augmentation_potential_pct: ${augmentationPotentialPct}
adoption_speed_factor: ${adoptionSpeedFactor}

Return JSON schema EXACTLY:
{
  "at_risk_tasks": ["string","... up to 10"],
  "defensible_tasks": ["string","... up to 10"],
  "plan_90_days": ["string","... up to 10"],
  "adjacent_roles": ["string","... up to 10"]
}
`
    });

    const a4 = await geminiJson({
      system: "You write concise risk reports. Return ONLY valid JSON.",
      user: `
Write a 4–6 sentence executive summary. No fearmongering.

Return JSON:
{ "executive_summary": "string" }

Inputs:
normalized_role: ${a1.normalized_role}
industry: ${industry}
seniority: ${seniority}
automation_exposure_pct: ${automationExposurePct}
human_moat_pct: ${humanMoatPct}
accountability_shield_pct: ${accountabilityShieldPct}
augmentation_potential_pct: ${augmentationPotentialPct}
adoption_speed_factor: ${adoptionSpeedFactor}
evidence_snippets: ${JSON.stringify(a1.evidence_snippets || [], null, 2)}
`
    });

    return Response.json({
      normalized_role: a1.normalized_role,
      safety_score: safetyScore,
      overall_band: band(safetyScore),
      time_horizon: horizon(adoptionSpeedFactor, automationExposurePct),
      breakdown: {
        automation_exposure_pct: automationExposurePct,
        augmentation_potential_pct: augmentationPotentialPct,
        human_moat_pct: humanMoatPct,
        accountability_shield_pct: accountabilityShieldPct,
        toolchain_replaceability_pct: toolchainReplaceabilityPct,
        adoption_speed_factor: adoptionSpeedFactor
      },
      evidence_snippets: a1.evidence_snippets || [],
      at_risk_tasks: a3.at_risk_tasks || [],
      defensible_tasks: a3.defensible_tasks || [],
      plan_90_days: a3.plan_90_days || [],
      adjacent_roles: a3.adjacent_roles || [],
      executive_summary: a4.executive_summary
    });
  } catch (e) {
    return Response.json({ error: e?.message || "Server error" }, { status: 500 });
  }
}
