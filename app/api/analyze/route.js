import { GoogleGenerativeAI } from "@google/generative-ai";

export async function POST(req) {
  try {
    const body = await req.json();

    const {
      jobTitle,
      industry,
      seniority,
      description,
      tasks
    } = body;

    const genAI = new GoogleGenerativeAI(process.env.GOOGLE_API_KEY);

    // ✅ FIXED MODEL (supported + stable)
    const model = genAI.getGenerativeModel({
      model: "gemini-1.5-pro-latest"
    });

    const prompt = `
You are an AI career risk analyst.

Analyze the following role and return STRICT JSON only.

Return this exact JSON structure:

{
  "riskLevel": "Low | Medium | High",
  "safetyScore": number (0-100),
  "timeHorizon": "1-3 years | 3-5 years | 5+ years",
  "automationExposure": number,
  "augmentationPotential": number,
  "humanMoat": number,
  "accountabilityShield": number,
  "toolchainReplaceability": number,
  "adoptionSpeedFactor": number,
  "summary": "string",
  "mostAtRiskTasks": ["string"],
  "mostDefensibleTasks": ["string"]
}

Job Title: ${jobTitle}
Industry: ${industry}
Seniority: ${seniority}

Job Description:
${description}

Tasks Selected:
${tasks.join(", ")}
`;

    const result = await model.generateContent(prompt);
    const response = await result.response;
    const text = response.text();

    // Attempt to safely extract JSON
    const jsonMatch = text.match(/\{[\s\S]*\}/);

    if (!jsonMatch) {
      throw new Error("Model did not return structured JSON.");
    }

    const parsed = JSON.parse(jsonMatch[0]);

    return Response.json(parsed);

  } catch (error) {
    console.error("Analyze Error:", error);
    return Response.json(
      { error: error.message || "Something went wrong." },
      { status: 500 }
    );
  }
}
