// app/api/jobs/seed/route.js
import client from "../../../../lib/opensearch";
import { scoreResilience } from "../../../jobs/jobScoring";

export const dynamic = "force-dynamic";

const INDEX = "jobs_v1";

function pick(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

function randInt(a, b) {
  return Math.floor(a + Math.random() * (b - a + 1));
}

function makeJob(i) {
  const titles = [
    "Financial Analyst",
    "Accountant",
    "Registered Nurse",
    "Teacher",
    "Software Engineer",
    "Electrician",
    "Pharmacist",
    "Dentist",
    "Real Estate Agent",
    "Bank Teller",
    "Data Analyst",
    "Operations Manager",
    "Sales Representative",
    "Customer Support Specialist",
    "Project Manager",
    "Marketing Manager",
    "Mechanical Technician",
    "Clinical Lab Technician",
  ];

  const companies = ["Atlas Group", "Crown Dental", "HarborTech", "NorthBridge", "Cedar Health", "Sunrise Labs"];
  const locations = ["New York, NY", "Austin, TX", "Denver, CO", "San Jose, CA", "Miami, FL", "Chicago, IL"];

  const title = pick(titles);
  const company = pick(companies);
  const location = pick(locations);

  const description = `Role: ${title}. Company: ${company}. Location: ${location}.
Responsibilities include analysis, coordination, documentation, tools usage, stakeholder communication, and hands-on execution depending on role.`;

  // simple deterministic-ish attributes from title
  const lower = title.toLowerCase();
  const attrs = {
    embodiment: /nurse|dentist|electrician|technician|lab/.test(lower) ? 0.8 : 0.25,
    liability: /nurse|dentist|pharmacist|accountant/.test(lower) ? 0.65 : 0.3,
    regulatory: /nurse|dentist|pharmacist|accountant/.test(lower) ? 0.65 : 0.25,
    autonomy: /manager|project/.test(lower) ? 0.65 : 0.35,
    revenueProximity: /sales|real estate/.test(lower) ? 0.7 : 0.35,
    trustDepth: /manager|nurse|dentist|pharmacist/.test(lower) ? 0.6 : 0.3,
    repeatability: /support|analyst|accountant/.test(lower) ? 0.65 : 0.35,
    toolAutomation: /engineer|analyst|accountant|manager/.test(lower) ? 0.55 : 0.3,
  };

  const scored = scoreResilience(attrs);

  return {
    id: `seed_${i}_${Date.now()}`,
    title,
    company,
    location,
    description,
    url: "",

    posted_ts: Date.now() - randInt(0, 1000 * 60 * 60 * 24 * 30),

    attributes_v1: attrs,
    resilience_score: scored.score,
    resilience_reason: scored.reason,
    score_version: scored.scoreVersion,

    compression_stability: 0.7,
    employer_ai_risk: 0.4,
  };
}

async function ensureIndex() {
  // Works across client return shapes
  const existsResp = await client.indices.exists({ index: INDEX });
  const exists = existsResp?.body ?? existsResp;

  if (exists) return;

  await client.indices.create({
    index: INDEX,
    body: {
      settings: { index: { number_of_shards: 1, number_of_replicas: 0 } },
      mappings: {
        properties: {
          id: { type: "keyword" },
          title: { type: "text" },
          company: { type: "text" },
          location: { type: "text" },
          description: { type: "text" },
          url: { type: "keyword" },
          posted_ts: { type: "date" },
          resilience_score: { type: "integer" },
          resilience_reason: { type: "keyword" },
          score_version: { type: "keyword" },
          compression_stability: { type: "float" },
          employer_ai_risk: { type: "float" },
        },
      },
    },
  });
}

export async function GET(req) {
  try {
    const { searchParams } = new URL(req.url);
    const n = Math.min(Number(searchParams.get("n") || 5000), 10000);

    await ensureIndex();

    const docs = Array.from({ length: n }, (_, i) => makeJob(i + 1));

    const body = [];
    for (const d of docs) {
      body.push({ index: { _index: INDEX, _id: d.id } });
      body.push(d);
    }

    const bulkResp = await client.bulk({ body, refresh: true });
    const out = bulkResp?.body || bulkResp;

    return Response.json({
      ok: true,
      indexed: n,
      errors: Boolean(out?.errors),
    });
  } catch (e) {
    return Response.json(
      { ok: false, error: e?.message || "Unknown error" },
      { status: 200 }
    );
  }
}
