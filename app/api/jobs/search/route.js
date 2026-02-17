// app/api/jobs/search/route.js
import client from "../../../../lib/opensearch";

const INDEX = "jobs_v1";

function expandQuery(q) {
  const raw = String(q || "").trim();
  if (!raw) return { raw: "", expanded: [] };

  const lower = raw.toLowerCase();

  const expansions = {
    finance: ["financial", "financing", "fp&a", "accounting", "analyst"],
    financial: ["finance", "fp&a", "analyst"],
    accounting: ["accountant", "cpa", "audit", "bookkeeper", "controller"],
    accountant: ["accounting", "cpa", "audit", "bookkeeper", "controller"],
    nurse: ["nursing", "rn", "bsn", "lpn"],
    nursing: ["nurse", "rn", "bsn", "lpn"],
    doctor: ["physician", "medicine", "md", "clinical"],
    dentist: ["dental", "dds", "dmd"],
    pharmacist: ["pharmacy", "pharmd"],
    software: ["developer", "programmer", "engineer", "swe"],
    developer: ["software", "programmer", "engineer", "swe"],
    programmer: ["software", "developer", "engineer"],
    engineer: ["engineering", "developer", "software"],
    banking: ["bank", "finance", "credit", "loan"],
    real: ["real estate", "realtor", "property"],
    teacher: ["education", "instructor", "school"],
  };

  const tokens = lower.split(/\s+/g).filter(Boolean);
  const expandedSet = new Set();

  for (const t of tokens) {
    const hits = expansions[t];
    if (hits) hits.forEach((x) => expandedSet.add(x));
  }
  if (expansions[lower]) expansions[lower].forEach((x) => expandedSet.add(x));

  return { raw, expanded: Array.from(expandedSet).slice(0, 12) };
}

export async function GET(request) {
  const { searchParams } = new URL(request.url);

  const q = searchParams.get("q") || "";
  const limit = Math.min(Number(searchParams.get("limit") || 25), 50);
  const scenario = searchParams.get("scenario") || "moderate";

  const { raw, expanded } = expandQuery(q);
  const hasQuery = raw.trim().length > 0;

  const scenarioWeight =
    scenario === "aggressive" ? 1.15 : scenario === "conservative" ? 0.9 : 1.0;

  const should = [];

  if (hasQuery) {
    should.push({
      multi_match: {
        query: raw,
        fields: ["title^5", "company^2", "location^2", "description"],
        type: "best_fields",
        operator: "or",
        fuzziness: "AUTO",
        prefix_length: 1,
        max_expansions: 50,
      },
    });

    should.push({
      multi_match: {
        query: raw,
        fields: ["title^5", "company^2", "location^2", "description"],
        type: "bool_prefix",
      },
    });

    for (const e of expanded) {
      should.push({
        multi_match: {
          query: e,
          fields: ["title^5", "company^2", "location^2", "description"],
          type: "best_fields",
          operator: "or",
        },
      });
    }
  }

  const body = {
    size: limit,
    track_total_hits: true,
    query: hasQuery
      ? {
          function_score: {
            query: { bool: { should, minimum_should_match: 1 } },
            functions: [
              {
                field_value_factor: {
                  field: "resilience_score",
                  factor: 0.06 * scenarioWeight,
                  missing: 0,
                },
              },
              {
                field_value_factor: {
                  field: "compression_stability",
                  factor: 0.8,
                  missing: 0,
                },
              },
              {
                script_score: {
                  script: {
                    source:
                      "double r = (doc.containsKey('employer_ai_risk') && !doc['employer_ai_risk'].empty) ? doc['employer_ai_risk'].value : 0.0; return 1.0 - Math.min(0.85, r);",
                  },
                },
              },
            ],
            score_mode: "sum",
            boost_mode: "multiply",
          },
        }
      : { match_all: {} },
    sort: hasQuery
      ? ["_score"]
      : [{ resilience_score: "desc" }, { posted_ts: "desc" }],
  };

  const resp = await client.search({ index: INDEX, body });

  // ✅ Compatible across client versions
  const hits = resp?.body?.hits?.hits || resp?.hits?.hits || [];
  const total =
    resp?.body?.hits?.total?.value ??
    resp?.hits?.total?.value ??
    hits.length;

  // ✅ THIS IS THE CRITICAL FIX:
  // Always return flat job objects, never raw OpenSearch hits
  const results = hits.map((h) => {
    const src = h?._source || {};
    return {
      id: h?._id,
      title: src.title ?? null,
      company: src.company ?? null,
      location: src.location ?? null,
      description: src.description ?? null,
      url: src.url ?? null,
      posted_ts: src.posted_ts ?? null,
      resilience_score: src.resilience_score ?? 0,
      resilience_reason: src.resilience_reason ?? "Resilience signal pending.",
      score_version: src.score_version ?? "v1",
      compression_stability: src.compression_stability ?? 0,
      employer_ai_risk: src.employer_ai_risk ?? 0,
    };
  });

  return Response.json({
    ok: true,
    query: raw,
    expanded,
    scenario,
    total,
    results,
  });
}
