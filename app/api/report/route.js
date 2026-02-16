import { NextResponse } from "next/server";

export async function POST(req) {
  try {
    const body = await req.json().catch(() => null);

    const jobTitle = (body?.jobTitle || "").toString();
    const industry = (body?.industry || "").toString();
    const seniority = (body?.seniority || "").toString();
    const jobDesc = (body?.jobDesc || "").toString();
    const tasks = Array.isArray(body?.tasks) ? body.tasks : [];

    // Validate input
    if (!jobDesc.trim()) {
      return NextResponse.json({ error: "Job description is required." }, { status: 400 });
    }
    if (tasks.length < 3 || tasks.length > 8) {
      return NextResponse.json({ error: "Select between 3 and 8 tasks." }, { status: 400 });
    }

    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      return NextResponse.json(
        { error: "Missing GEMINI_API_KEY in environment variables." },
        { status: 500 }
      );
    }

    // Prompt: force JSON-only output
    const prompt = `
Return ONLY valid JSON (no markdown, no commentary).
Assess AI displacement risk for this role using the job description + selected tasks.

Output JSON with this exact shape:
{
  "risk_score": number,
  "risk_band": "Low" | "Medium" | "High",
  "why": [string, string, string],
  "most_automatable": [{"task": string, "reason": string, "time_horizon": "0-12m"|"1-3y"|"3-5y"}],
  "most_human_moat": [{"task": string, "reason": string}],
  "recommendations": [string, string, string, string, string],
  "assumptions": [string, string]
}

Role context:
- jobTitle: ${jobTitle || "(not provided)"}
- industry: ${industry || "(not provided)"}
- seniority: ${seniority || "(not provided)"}

Job description:
${jobDesc}

Selected tasks:
${tasks.map((t) => `- ${t}`).join("\n")}
`.trim();

    const endpoint =
      "https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=" +
      encodeURIComponent(apiKey);

    const geminiRes = await fetch(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ role: "user", parts: [{ text: prompt }] }],
        generationConfig: { temperature: 0.3, maxOutputTokens: 1200 },
      }),
    });

    const geminiText = await geminiRes.text();

    if (!geminiRes.ok) {
      return NextResponse.json(
        { error: `Gemini API error (${geminiRes.status})`, details: geminiText },
        { status: 502 }
      );
    }

    // Parse Gemini response wrapper
    let rawModelText = "";
    try {
      const parsed = JSON.parse(geminiText);
      rawModelText =
        parsed?.candidates?.[0]?.content?.parts?.map((p) => p.text).join("") || "";
    } catch {
      return NextResponse.json(
        { error: "Gemini returned non-JSON wrapper.", raw: geminiText },
        { status: 502 }
      );
    }

    // Parse model output JSON
    let report = null;
    try {
      report = JSON.parse(rawModelText);
    } catch {
      return NextResponse.json(
        {
          error: "Gemini returned invalid JSON. Try again or adjust prompt.",
          rawModelText,
        },
        { status: 502 }
      );
    }

    return NextResponse.json(
      {
        ok: true,
        input: { jobTitle, industry, seniority, tasksCount: tasks.length },
        report,
      },
      { status: 200 }
    );
  } catch (err) {
    return NextResponse.json({ error: err?.message || "Server error" }, { status: 500 });
  }
}
