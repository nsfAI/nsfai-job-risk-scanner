import { NextResponse } from "next/server";
import { GoogleGenAI } from "@google/genai";

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

    if (!description) {
      return NextResponse.json(
        { error: "Job description is required." },
        { status: 400 }
      );
    }

    const ai = new GoogleGenAI({
      apiKey: process.env.GOOGLE_API_KEY
    });

    const prompt = `
You are an AI labor displacement risk analyst.

Analyze the following job and estimate AI automation risk.

Return:
1. Risk Score (0–100%)
2. Explanation (concise but detailed)
3. Which tasks are most automatable
4. Which tasks are hardest to automate

Job Title: ${jobTitle || "N/A"}
Industry: ${industry || "N/A"}
Seniority: ${seniority || "N/A"}

Job Description:
${description}

Primary Tasks:
${tasks?.join(", ") || "Not provided"}
`;

    const response = await ai.models.generateContent({
      model: "gemini-2.0-flash",
      contents: prompt,
      config: {
        temperature: 0.7,
        maxOutputTokens: 700
      }
    });

    return NextResponse.json({
      result: response.text
    });

  } catch (error) {
    console.error("AI ERROR:", error);

    if (error.status === 429) {
      return NextResponse.json(
        { error: "Rate limit hit. Wait 30–60 seconds and try again." },
        { status: 429 }
      );
    }

    return NextResponse.json(
      { error: "AI request failed." },
      { status: 500 }
    );
  }
}
