import { GoogleGenerativeAI } from "@google/generative-ai";

export const runtime = "nodejs";

export async function POST(req) {
  try {
    const body = await req.json();

    if (!process.env.GEMINI_API_KEY) {
      return new Response(
        JSON.stringify({ error: "Missing GEMINI_API_KEY" }),
        { status: 500 }
      );
    }

    const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

    // ⚠️ THIS MODEL IS CORRECT AND CURRENT
    const model = genAI.getGenerativeModel({
      model: "gemini-1.5-pro"
    });

    const prompt = `
Return ONLY valid JSON.

Analyze this job:

Title: ${body.jobTitle}
Industry: ${body.industry}
Seniority: ${body.seniority}

Description:
${body.jobDescription}

Tasks:
${body.tasks?.join(", ")}

Return:

{
  "riskLevel": "Low | Moderate | High",
  "safetyScore": number,
  "automationExposure": number,
  "augmentationPotential": number,
  "humanMoat": number,
  "accountabilityShield": number,
  "toolchainReplaceability": number,
  "adoptionSpeed": number,
  "summary": "short explanation"
}
`;

    const result = await model.generateContent(prompt);

    const text = result.response.text();

    const parsed = JSON.parse(text);

    return new Response(JSON.stringify(parsed), {
      headers: { "Content-Type": "application/json" }
    });

  } catch (err) {
    return new Response(
      JSON.stringify({ error: err.message }),
      { status: 500 }
    );
  }
}
