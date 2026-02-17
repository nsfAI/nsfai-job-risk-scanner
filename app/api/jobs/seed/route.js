// app/api/jobs/seed/route.js
export const dynamic = "force-dynamic";

import client from "../../../../lib/opensearch";

const INDEX = "jobs_v1";
const SCORE_VERSION = "seed_v1";

function pick(arr, i) {
  return arr[i % arr.length];
}

function clamp(n, a, b) {
  return Math.max(a, Math.min(b, n));
}

function makeJob(i) {
  const titles = [
    "Accountant", "Staff Accountant", "Senior Accountant", "Tax Associate", "Audit Associate",
    "Financial Analyst", "FP&A Analyst", "Treasury Analyst", "Credit Analyst", "Underwriter",
    "Software Engineer", "Backend Engineer", "Frontend Engineer", "Full Stack Engineer", "DevOps Engineer", "SRE",
    "Data Analyst", "Business Analyst", "Operations Analyst",
    "Registered Nurse (RN)", "Licensed Practical Nurse (LPN)", "Nurse Practitioner",
    "Teacher", "Elementary Teacher", "Special Education Teacher",
    "Electrician", "Plumber", "HVAC Technician", "Welder", "Mechanic",
    "Dentist", "Dental Hygienist", "Pharmacist", "Pharmacy Technician",
    "Real Estate Agent", "Property Manager", "Leasing Specialist",
    "Project Manager", "Product Manager", "Customer Success Manager", "Sales Representative",
    "Paralegal", "Legal Assistant",
  ];

  const companies = [
    "Northbridge", "BluePeak", "CedarWorks", "Atlas Group", "NovaHealth", "Sunrise Schools",
    "Fairview Partners", "Ironclad Electric", "Pioneer Plumbing", "Crown Dental", "City Pharmacy",
    "Keystone Realty", "HarborTech", "Summit Bank", "Orchid Labs",
  ];

  const locations = [
    "New York, NY", "Los Angeles, CA", "Chicago, IL", "Dallas, TX", "Miami, FL",
    "Seattle, WA", "Austin, TX", "Denver, CO", "Atlanta, GA", "Boston, MA",
    "Phoenix, AZ", "San Diego, CA", "Philadelphia, PA", "San Jose, CA",
  ];

  const reasons = [
    "High Human Constraint Density",
    "AI-Augmented Role",
    "Elevated Automation Exposure",
    "Regulatory/Compliance Moat",
    "Physical Presence Required",
    "Revenue-Proximate Work",
  ];

  const title = pick(titles, i);
  const company = pick(companies, i * 3);
  const location = pick(locations, i * 7);

  // heuristic-ish scoring
  const isPhysical = /Electrician|Plumber|HVAC|Welder|Mechanic|Dental|Dentist/i.test(title);
  const isCare = /Nurse|Hygienist|Pharmac/i.test(title);
  const isSW = /Engineer|DevOps|SRE|Software|Backend|Frontend|Full Stack/i.test(title);
  const isAcct = /Account|Audit|Tax/i.test(title);

  let resilience = 55;
  if (isPhysical) resilience += 25;
  if (isCare) resilience += 18;
  if (isSW) resilience -= 10;
  if (isAcct) resilience -= 6;

  // slight variation
  resilience = clamp(Math.round(resilience + ((i % 9) - 4)), 5, 95);

  const compression_stability = clamp((0.35 + (resilience / 140) + ((i % 11) / 50)), 0, 1);
  const employer_ai_risk = clamp((0.65 - (resilience / 160) + ((i % 13) / 60)), 0, 1);

  const description = [
    `Role: ${title}.`,
    `You will own core workflows, collaborate cross-functionally, and deliver measurable outcomes.`,
    `Day-to-day includes analysis, execution, communication, and operational follow-through.`,
    `Tools vary by role; autonomy and responsibility scale with performance.`,
  ].join(" ");

  // make URL unique + deterministic
  const url = `https://example.com/jobs/${encodeURIComponent(company.toLowerCase())}/${i}`;

  // posted dates spread over last ~30 days
  const now = Date.now();
  const ts = new Date(now - (i % 30) * 24 * 60 * 60 * 1000).toISOString();

  return {
    title,
    company,
    location,
    description,
    url,
    posted_ts: ts,
    resilience_score: resilience,
    resilience_reason: pick(reasons, i * 5),
    score_version: SCORE_VERSION,
    compression_stability: Number(compression_stability.toFixed(2)),
    employer_ai_risk: Number(employer_ai_risk.toFixed(2)),
  };
}

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const n = clamp(Number(searchParams.get("n") || 5000), 1, 20000);

    // build bulk payload
    const lines = [];
    for (let i = 0; i < n; i++) {
      lines.push(JSON.stringify({ index: { _index: INDEX } }));
      lines.push(JSON.stringify(makeJob(i)));
    }
    const body = lines.join("\n") + "\n";

    const resp = await client.bulk({ body });

    // bulk response differs between clients; expose minimal success info
    const rBody = resp?.body || resp;
    const errors = !!rBody?.errors;

    return Response.json({
      ok: true,
      indexed: n,
      errors,
      note: "Seeded jobs_v1. Re-run anytime; it will add more docs.",
    });
  } catch (err) {
    return Response.json(
      { ok: false, error: err?.message || "Seed failed" },
      { status: 200 }
    );
  }
}
