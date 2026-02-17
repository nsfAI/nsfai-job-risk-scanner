// app/api/jobs/ingest/route.js
import { osFetch } from "@/lib/opensearch";
import { scoreResilience } from "@/app/jobs/jobScoring";

export const dynamic = "force-dynamic";

// ---------- Connectors (API-compliant ATS feeds) ----------
// Greenhouse job board JSON
async function fetchGreenhouse(board) {
  const url = `https://boards-api.greenhouse.io/v1/boards/${board}/jobs?content=true`;
  const res = await fetch(url, { cache: "no-store" });
  if (!res.ok) throw new Error(`Greenhouse ${board} failed ${res.status}`);
  const json = await res.json();
  return (json.jobs || []).map((j) => ({
    id: `gh_${board}_${j.id}`,
    title: j.title,
    company: board,
    location: j.location?.name || "",
    url: j.absolute_url,
    description: (j.content || "").slice(0, 50000),
    posted_ts: Date.parse(j.updated_at || j.created_at || "") || Date.now(),
    posted_label: j.updated_at || j.created_at || "",
  }));
}

// Lever postings
async function fetchLever(company) {
  const url = `https://api.lever.co/v0/postings/${company}?mode=json`;
  const res = await fetch(url, { cache: "no-store" });
  if (!res.ok) throw new Error(`Lever ${company} failed ${res.status}`);
  const json = await res.json();
  return (json || []).map((j) => ({
    id: `lv_${company}_${j.id}`,
    title: j.text,
    company,
    location: j.categories?.location || "",
    url: j.hostedUrl,
    description: (j.descriptionPlain || j.description || "").slice(0, 50000),
    posted_ts: Date.parse(j.createdAt || "") || Date.now(),
    posted_label: j.createdAt ? new Date(j.createdAt).toISOString() : "",
  }));
}

// ---------- Basic NLP-ish extraction (deterministic V1) ----------
function extractAttributes(job) {
  const text = `${job.title}\n${job.description}`.toLowerCase();

  // crude signals (V1) — replace later with LLM extraction service
  const embodiment = /field|on[- ]site|patient|lab|equipment|warehouse|manufactur|clinic/.test(text) ? 0.75 : 0.25;
  const liability = /license|compliance|audit|regulatory|clinical|legal|risk|hipaa|sox/.test(text) ? 0.65 : 0.30;
  const regulatory = /hipaa|fda|sec|finra|sox|gdpr|regulator/.test(text) ? 0.75 : 0.25;
  const autonomy = /own|lead|strategy|stakeholder|cross[- ]functional|roadmap/.test(text) ? 0.65 : 0.35;
  const revenueProximity = /sales|quota|pipeline|revenue|customer|renewal|pricing/.test(text) ? 0.70 : 0.35;
  const trustDepth = /client|patients|stakeholders|executive|board/.test(text) ? 0.60 : 0.30;
  const repeatability = /data entry|reporting|dashboards|documentation|summariz|routine/.test(text) ? 0.70 : 0.35;
  const toolAutomation = /sql|excel|powerbi|tableau|jira|docs|notion|zendesk/.test(text) ? 0.55 : 0.30;

  return { embodiment, liability, regulatory, autonomy, revenueProximity, trustDepth, repeatability, toolAutomation };
}

async function upsertJobs(jobs) {
  // bulk API
  const body = [];
  for (const job of jobs) {
    body.push({ index: { _index: "jobs_v1", _id: job.id } });
    body.push(job);
  }

  const res = await osFetch(`/_bulk`, {
    method: "POST",
    body,
  });

  if (!res.ok) throw new Error(`OpenSearch bulk failed ${res.status}`);
  return res.json();
}

export async function POST(req) {
  try {
    // You can pass boards via body for testing
    const { greenhouseBoards = ["stripe"], leverCompanies = ["netlify"] } = await req.json().catch(() => ({}));

    const pulls = await Promise.allSettled([
      ...greenhouseBoards.map((b) => fetchGreenhouse(b)),
      ...leverCompanies.map((c) => fetchLever(c)),
    ]);

    let jobs = [];
    for (const p of pulls) if (p.status === "fulfilled") jobs = jobs.concat(p.value);

    // Enrich with resilience attributes + score
    const enriched = jobs.map((job) => {
      const attrs = extractAttributes(job);
      const scored = scoreResilience(attrs);

      return {
        ...job,
        // stored feature store (v1)
        attributes_v1: attrs,

        // score fields (reproducible)
        resilience_score: scored.score,
        resilience_reason: scored.reason,
        resilience_explain: scored.reason,
        score_version: scored.scoreVersion,

        // placeholders for ranking engine (v1)
        compression_stability: 0.7,
        employer_ai_risk: 0.4,
        skillMatch: 0.55,
      };
    });

    await upsertJobs(enriched);

    return Response.json({ ok: true, ingested: enriched.length });
  } catch (e) {
    return Response.json({ ok: false, error: e?.message || "Unknown error" }, { status: 200 });
  }
}
