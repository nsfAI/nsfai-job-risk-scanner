import { NextResponse } from "next/server";

// If your Gemini calls sometimes take longer, you can uncomment these:
// export const maxDuration = 60; // Vercel Pro/Enterprise needed for long durations sometimes
// export const runtime = "nodejs";

export async function POST(req) {
  try {
    const body = await req.json().catch(() => null);

    const jobTitle = (body?.jobTitle || "").toString();
    const industry = (body?.industry || "").toString();
    const seniority = (body?.seniority || "").toString();
    const jobDesc = (body?.jobDesc || "").toString();
    const tasks = Array.isArray(body?.tasks) ? body.tasks : [];

    // Basic validation
    if (!jobDesc.trim()) {
      return NextResponse.json({ error: "Job description is required." }, { status: 400 });
    }
    if (!Array.isArray(tasks) || tasks.length < 3 || tasks.length > 8) {
      return NextResponse.json({ error: "Select between 3 and 8 tasks." }, { status: 400 });
    }

    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      return NextResponse.json(
        { error: "Missing GEMINI_API_KEY in server environment." },
        { status: 500 }
      );
    }

    // ---- Gemini Request (REST) ----
    // This uses Google Generative Language API style endpoint.
    // If your project uses a different Gemini endpoint/library, keep the JSON response pattern the same.
    const prompt = `
You are an analyst. Produce a JSON object ONLY (no markdown).
Assess AI displacement risk for the role based on job description and selected tasks.

Return JSON with this shape:
{
  "risk_score": number, // 0-100
  "risk_band": "Low" | "Medium" | "High",
  "why": [string, ...], // 3-6 bullets
  "most_automatable": [{"task": string, "reason": string, "time_horizon": "0-12m"|"1-3y"|"3-5y"}],
  "most_human_moat": [{"task": string, "reason": string}],
  "recommendations": [string, ...], // 5-8 concrete actions
  "assumptions": [string, ...]
}

Role:
- jobTitle: ${jobTitle || "(not provided)"}
- industry: ${industry || "(not provided)"}
- seniority: ${seniority || "(not provided)"}

Job description:
${jobDesc}

Tasks:
${tasks.map((t) => `- ${t}`).join("\n")}
`.trim();

    const endpoint =
      "https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=" +
      encodeURIComponent(apiKey);

    const geminiRes = await fetch(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [
          {
            role: "user",
            parts: [{ text: prompt }],
          },
        ],
        generationConfig: {
          temperature: 0.3,
          maxOutputTokens: 1200,
        },
      }),
    });

    const geminiText = await geminiRes.text();

    if (!geminiRes.ok) {
      // Return Gemini’s raw error text to help debugging
      return NextResponse.json(
        { error: `Gemini API error (${geminiRes.status})`, details: geminiText },
        { status: 502 }
      );
    }

    // Try to parse Gemini JSON output safely
    let geminiJson = null;
    try {
      const parsed = JSON.parse(geminiText);

      // Typical Gemini response shape: { candidates:[{content:{parts:[{text:"..."}]}}] }
      const modelText =
        parsed?.candidates?.[0]?.content?.parts?.map((p) => p.text).join("") || "";

      // The modelText SHOULD be JSON-only per our prompt
      geminiJson = modelText ? JSON.parse(modelText) : null;
    } catch {
      geminiJson = null;
    }

    // If parsing failed, still return something valid
    if (!geminiJson) {
      return NextResponse.json(
        {
          error: "Model returned non-JSON output. Check prompt / model response.",
          raw: geminiText,
        },
        { status: 502 }
      );
    }

    // ✅ Always return JSON
    return NextResponse.json(
      {
        ok: true,
        input: { jobTitle, industry, seniority, tasksCount: tasks.length },
        report: geminiJson,
      },
      { status: 200 }
    );
  } catch (err) {
    return NextResponse.json(
      { error: err?.message || "Server error" },
      { status: 500 }
    );
  }
}
