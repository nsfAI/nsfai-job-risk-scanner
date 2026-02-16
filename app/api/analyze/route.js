import { GoogleGenAI } from "@google/genai";

export async function POST(req) {
  try {
    const body = await req.json();
    const { title, industry, seniority, description, tasks } = body;

    if (!process.env.GEMINI_API_KEY) {
      return new Response(
        JSON.stringify({ error: "Missing GEMINI_API_KEY" }),
        { status: 500 }
      );
    }

    const ai = new GoogleGenAI({
      apiKey: process.env.GEMINI_API_KEY,
    });

    const prompt = `
You are an AI labor economist.

Analyze the following job and estimate AI displacement risk (0–100%).

Return structured output with:
- Risk Score
- Risk Level (Low/Medium/High)
- Explanation
- Automation Breakdown

Job Title: ${title}
Industry: ${industry}
Seniority: ${seniority}
Description: ${description}
Tasks: ${tasks.join(", ")}
`;

    const result = await ai.models.generateContent({
      model: "gemini-1.5-pro-latest",
      contents: prompt,
    });

    return new Response(
      JSON.stringify({ result: result.text }),
      { status: 200 }
    );
  } catch (error) {
    console.error(error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500 }
    );
  }
}
