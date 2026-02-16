import { NextResponse } from "next/server";
import { GoogleGenerativeAI } from "@google/generative-ai";

function stripCodeFences(s) {
  if (!s) return "";
  return s.replace(/```json\s*/gi, "").replace(/```/g, "").trim();
}

function extractFirstJson(text) {
  const s = stripCodeFences(text);
  const startObj = s.indexOf("{");
  const startArr = s.indexOf("[");
  let start = -1;

  if (startObj === -1 && startArr === -1) return null;
  if (startObj === -1) start = startArr;
  else if (startArr === -1) start = startObj;
  else start = Math.min(startObj, startArr);

  let inString = false;
  let escape = false;
  let depthObj = 0;
  let depthArr = 0;

  for (let i = start; i < s.length; i++) {
    const ch = s[i];

    if (escape) {
      escape = false;
      continue;
    }
    if (ch === "\\") {
      if (inString) escape = true;
      continue;
    }
    if (ch === '"') {
      inString = !inString;
      continue;
    }
    if (inString) continue;

    if (ch === "{") depthObj++;
    if (ch === "}") depthObj--;
    if (ch === "[") depthArr++;
    if (ch === "]") depthArr--;

    if (depthObj === 0 && depthArr === 0 && i > start) {
      return s.slice(start, i + 1);
    }
  }
  return null;
}

export async function POST(req) {
  try {
    const body = await req.json().catch(() => null);

    const jobTitle = (body?.jobTitle || "").toString();
    const industry = (body?.industry || "").toString();
    const seniority = (body?.seniority || "").toString();
    const jobDesc = (body?.jobDesc || "").toString();
    const tasks = Array.isArray(body?.tasks) ? body.tasks : [];

    if (!jobDesc.trim()) {
      return NextResponse.json({ error: "Job description is required." }, { status: 400 });
    }
    if (tasks.length < 3 || tasks.length > 8) {
      return NextResponse.json({ error: "Select between 3 and 8 tasks." }, { status: 400 });
    }

    // ✅ Accept either env var name (so you can't brick it again)
    const apiKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY;
    if (!apiKey) {
      return NextResponse.json(
        { error: "Missing API key. Set GEMINI_API_KEY (recommended) or GOOGLE_API_KEY." },
        { status: 500 }
      );
    }

    const prompt = `
Return ONLY valid JSON (no markdown, no extra text).
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

Role:
- jobTitle: ${jobTitle || "(not provided)"}
- industry: ${industry || "(not provided)"}
- seniority: ${seniority || "(not provided)"}

Job description:
${jobDesc}

Selected tasks:
${tasks.map((t) => `- ${t}`).join("\n")}
`.trim();

    const genAI = new GoogleGenerativeAI(apiKey);

    const modelOrder = ["gemini-2.0-flash", "gemini-1.5-flash", "gemini-1.5-pro"];

    let rawText = null;
    let usedModel = null;
    let lastErr = null;

    for (const modelName of modelOrder) {
      try {
        const model = genAI.getGenerativeModel({ model: modelName });
        const result = await model.generateContent({
          contents: [{ role: "user", parts: [{ text: prompt }] }],
          generationConfig: { temperature: 0.2, maxOutputTokens: 1400 },
        });

        rawText = result?.response?.text?.() ?? null;
        usedModel = modelName;
        if (rawText) break;
      } catch (e) {
        lastErr = e;
      }
    }

    if (!rawText) {
      return NextResponse.json(
        {
          error: "Gemini failed to generate a response.",
          details: lastErr?.message || String(lastErr),
          hint:
            "Common causes: wrong/rotated key, billing not enabled, model not available for this key/project, quota exceeded.",
        },
        { status: 502 }
      );
    }

    let report = null;

    try {
      report = JSON.parse(stripCodeFences(rawText));
    } catch {
      const extracted = extractFirstJson(rawText);
      if (extracted) {
        try {
          report = JSON.parse(extracted);
        } catch {
          report = null;
        }
      }
    }

    if (!report) {
      return NextResponse.json(
        { error: "Gemini returned invalid JSON.", usedModel, rawModelText: rawText },
        { status: 502 }
      );
    }

    return NextResponse.json({ ok: true, usedModel, report }, { status: 200 });
  } catch (err) {
    return NextResponse.json({ error: err?.message || "Server error" }, { status: 500 });
  }
}
