export const runtime = "nodejs"; // keep it node (not edge) for compatibility

function clamp(n, a, b) {
  return Math.max(a, Math.min(b, n));
}

function toBand(score) {
  if (score >= 75) return "Very high compression";
  if (score >= 55) return "High compression";
  if (score >= 35) return "Moderate compression";
  return "Low compression";
}

// Deterministic pseudo-random (so series is stable per sector/skill/range)
function seededRand(seed) {
  let x = 0;
  for (let i = 0; i < seed.length; i++) x = (x * 31 + seed.charCodeAt(i)) >>> 0;
  return () => {
    // xorshift32
    x ^= x << 13;
    x >>>= 0;
    x ^= x >> 17;
    x >>>= 0;
    x ^= x << 5;
    x >>>= 0;
    return (x >>> 0) / 4294967296;
  };
}

function pickOne(rand, arr) {
  return arr[Math.floor(rand() * arr.length)] || arr[0];
}

function scoreToConfidence(scoreDeltaAbs, volatility) {
  // simple deterministic heuristic
  if (scoreDeltaAbs >= 4 && volatility <= 6) return "High";
  if (scoreDeltaAbs >= 2 && volatility <= 10) return "Medium";
  return "Low";
}

function classifySignal(key) {
  // Generally: adoption -> leading, jobs -> coincident/leading-ish, layoffs -> lagging
  if (key === "adoption") return "Leading";
  if (key === "jobs") return "Coincident";
  return "Lagging"; // layoffs
}

function computeVolatility(series, field, window = 21) {
  const slice = series.slice(Math.max(0, series.length - window));
  if (slice.length < 3) return 0;
  const vals = slice.map((d) => d[field]).filter((x) => typeof x === "number");
  const mean = vals.reduce((a, b) => a + b, 0) / Math.max(1, vals.length);
  const variance =
    vals.reduce((a, b) => a + Math.pow(b - mean, 2), 0) / Math.max(1, vals.length);
  return Math.sqrt(variance);
}

/**
 * MOCK generator (MVP):
 * Produces plausible dynamics:
 * - jobs decline leads
 * - layoffs follow with lag
 * - adoption proxy rises steadily
 */
function generateMockSeries({ sector, skill, days }) {
  const seed = `${sector}|${skill}|${days}`;
  const rand = seededRand(seed);

  // Base levels differ by sector/skill to avoid everything looking identical
  const baseJobs = clamp(45 + (rand() * 20 - 10), 20, 70);
  const baseLayoffs = clamp(35 + (rand() * 20 - 10), 10, 65);
  const baseAdopt = clamp(40 + (rand() * 20 - 10), 15, 75);

  const series = [];
  let jobs = baseJobs;
  let layoffs = baseLayoffs;
  let adopt = baseAdopt;

  // Scenario bias: tech + SWE feels more compressed; trades less
  const bias =
    sector === "Tech" ||
    skill === "Software Engineering" ||
    skill === "Data / Analytics"
      ? 0.15
      : skill === "Skilled Trades" || skill === "Healthcare Clinical"
      ? -0.12
      : 0;

  for (let d = days - 1; d >= 0; d--) {
    // Drift + noise
    const t = (days - d) / days;

    // adoption trends up
    adopt += (0.10 + bias) + (rand() - 0.5) * 0.8;

    // jobs decline more volatile; adoption amplifies it
    jobs += (0.02 + bias) + (rand() - 0.5) * 1.6 + (adopt - 50) * 0.01;

    // layoffs respond w/ lag and are spikier
    layoffs += (0.01 + bias) + (rand() - 0.5) * 1.2 + (jobs - 50) * 0.006;

    // clamp to 0..100
    adopt = clamp(adopt, 0, 100);
    jobs = clamp(jobs, 0, 100);
    layoffs = clamp(layoffs, 0, 100);

    // Weighted index
    const index = clamp(Math.round(0.40 * jobs + 0.35 * layoffs + 0.25 * adopt), 0, 100);

    // Create a date label (ISO)
    const date = new Date(Date.now() - d * 24 * 60 * 60 * 1000);
    const dateISO = date.toISOString().slice(0, 10);

    series.push({
      date: dateISO,
      layoffsScore: Math.round(layoffs),
      jobsScore: Math.round(jobs),
      adoptionScore: Math.round(adopt),
      index,
    });
  }

  return series;
}

function buildDrivers({ rand, sector, skill, key, score, delta, vol }) {
  // Deterministic driver templates. These are "analyst-like" without claiming real data.
  const isTechy =
    sector === "Tech" ||
    skill === "Software Engineering" ||
    skill === "Data / Analytics";

  const isHumanMoat =
    skill === "Skilled Trades" || skill === "Healthcare Clinical";

  const dir = delta > 0 ? "up" : delta < 0 ? "down" : "flat";

  const layoffsDrivers = [
    "Concentration: reductions cluster in cost centers with duplicated workflows.",
    "Timing pattern: cuts tend to lag posting slowdowns by 30–90 days.",
    "Operating model shift: consolidation around fewer teams with broader scopes.",
    "Budget posture: finance prioritizes runway and margin over headcount growth.",
    "Vendor substitution: external tooling replaces junior throughput."
  ];

  const jobsDrivers = [
    "Hiring bar rise: fewer postings, higher requirements, fewer 'apprentice' roles.",
    "Backfill suppression: attrition isn’t automatically refilled.",
    "Role collapse: adjacent titles merge into one “hybrid” listing.",
    "Internal mobility bias: firms reallocate internally before opening reqs.",
    "Output-per-head math: productivity gains reduce posting velocity."
  ];

  const adoptionDrivers = [
    "Tooling diffusion: AI workflows become default in docs, analysis, and code.",
    "Procurement reality: enterprise pilots expand from teams → org-wide.",
    "Management mandate: fewer hires + more automation is the quiet KPI.",
    "Work decomposition: tasks become modular and agent-friendly.",
    "Compliance drift: policies formalize after usage becomes unavoidable."
  ];

  // Add flavor based on sector/skill deterministically
  const flavor = [];
  if (isTechy) flavor.push("Automation is being integrated directly into core production workflows.");
  if (isHumanMoat) flavor.push("Physical-world constraints slow displacement, but admin layers still compress.");
  if (sector === "Finance") flavor.push("Cost discipline + risk controls accelerate role consolidation.");
  if (sector === "Healthcare") flavor.push("Clinical work resists faster than billing/admin, which compresses earlier.");
  if (sector === "Retail") flavor.push("Margin pressure pushes automation in ops, support, and forecasting.");
  if (sector === "Public Sector") flavor.push("Adoption is slower, but once standardized it scales broadly.");

  const base =
    key === "layoffs" ? layoffsDrivers :
    key === "jobs" ? jobsDrivers :
    adoptionDrivers;

  // Pick top 3 drivers deterministically (stable order-ish)
  const drivers = [];
  const pool = [...base];
  for (let i = 0; i < 3; i++) {
    const picked = pool.splice(Math.floor(rand() * pool.length), 1)[0];
    if (picked) drivers.push(picked);
  }
  // Add 0–2 flavor lines based on randomness but stable
  if (flavor.length) {
    if (rand() > 0.35) drivers.push(pickOne(rand, flavor));
    if (flavor.length > 1 && rand() > 0.70) drivers.push(pickOne(rand, flavor));
  }

  const counterSignals =
    key === "layoffs"
      ? [
          "Layoffs normalize while postings stabilize or rebound.",
          "Revenue guidance improves without further cost cutting.",
          "Internal transfers rise instead of terminations."
        ]
      : key === "jobs"
      ? [
          "Posting velocity rebounds for junior/mid roles (not just senior).",
          "Req requirements relax (fewer tools, fewer years, fewer 'hybrid' asks).",
          "Time-to-fill rises because demand returns."
        ]
      : [
          "AI requirements stop appearing in listings and internal docs.",
          "Tool mentions plateau while hiring re-accelerates.",
          "Security/compliance blocks broad rollouts."
        ];

  const interpretation =
    key === "layoffs"
      ? "Layoffs are a lagging confirmation signal. When they cluster, firms are executing the headcount side of the productivity equation."
      : key === "jobs"
      ? "Job posting decline is the earliest market-wide throttle. It usually shows up before layoffs and reflects a higher output-per-head target."
      : "AI adoption proxy is a leading signal. It captures workflow substitution before the org chart visibly changes.";

  const confidence = scoreToConfidence(Math.abs(delta), vol);

  return {
    direction: dir,
    drivers,
    counterSignals,
    interpretation,
    confidence,
  };
}

function buildThesis({ sector, skill, latest, prev, vols }) {
  const idx = latest.index ?? 0;
  const band = toBand(idx);

  const dIdx = prev ? latest.index - prev.index : 0;

  const top = [
    { k: "jobs", v: latest.jobsScore ?? 0 },
    { k: "layoffs", v: latest.layoffsScore ?? 0 },
    { k: "adoption", v: latest.adoptionScore ?? 0 },
  ].sort((a, b) => b.v - a.v);

  const topK = top[0]?.k;
  const secondK = top[1]?.k;

  const label = (k) =>
    k === "jobs" ? "job posting decline" : k === "layoffs" ? "layoff clustering" : "AI adoption proxy";

  // A tight, analyst-like note
  const p1 =
    `Current read for ${sector} · ${skill}: ${idx}/100 (${band}). ` +
    `The index is ${dIdx === 0 ? "flat" : dIdx > 0 ? `up ${dIdx}` : `down ${Math.abs(dIdx)}`} vs the prior point. ` +
    `The dominant contributors are ${label(topK)} and ${label(secondK)}.`;

  const p2 =
    `Interpretation: this does not mean “jobs vanish tomorrow.” It means the ` +
    `economics are shifting toward fewer entry points and higher output expectations per hire. ` +
    `If adoption remains elevated while postings stay suppressed, the next adjustment is usually consolidation (role merging, fewer trainees, heavier scope per seat).`;

  return `${p1}\n\n${p2}`;
}

function buildScenarios({ latest }) {
  const a = latest.adoptionScore ?? 0;
  const j = latest.jobsScore ?? 0;
  const l = latest.layoffsScore ?? 0;

  // Scenario map, deterministic rules
  const scenarios = [
    {
      if: "AI adoption ↑ and job postings ↓",
      then: "Compression is likely structural: fewer junior seats + higher bar + role consolidation.",
      watch: ["Entry-level req counts", "Hybrid role descriptions", "Internal tooling mandates"],
    },
    {
      if: "Job postings ↓ but AI adoption ↔",
      then: "Macro/off-cycle slowdown dominates: hiring pauses without deep workflow substitution.",
      watch: ["Time-to-fill", "Sector revenue guidance", "Contractor usage"],
    },
    {
      if: "Layoffs ↑ while postings stabilize",
      then: "Reorg / margin repair: headcount cuts may be episodic rather than a long-run hiring reset.",
      watch: ["Backfill rate", "Internal mobility", "Budget announcements"],
    },
    {
      if: "All three ↑ simultaneously",
      then: "Fast compression regime: firms are both reducing headcount and accelerating substitution.",
      watch: ["Policy updates", "Tool procurement rollouts", "Support/ops automation"],
    },
  ];

  // You can optionally “rank” likely scenario by current scores
  const likely =
    a >= 55 && j >= 50 ? 0 :
    j >= 55 && a < 55 ? 1 :
    l >= 55 && j < 55 ? 2 :
    a >= 60 && j >= 60 && l >= 55 ? 3 :
    0;

  return { likelyScenarioIndex: likely, scenarios };
}

function buildWatchlist({ sector, skill }) {
  const base = [
    "Entry-level posting volume (not just senior roles)",
    "Role requirements: years-of-exp inflation vs skill inflation",
    "Mentions of AI tools in listings and internal enablement docs",
    "Backfill rate after attrition",
    "Cycle time for core workflows (reporting, support, analysis, dev)",
  ];

  const add = [];
  if (sector === "Finance") add.push("Shared services consolidation and offshoring trends");
  if (sector === "Healthcare") add.push("Admin/billing automation adoption vs clinical staffing");
  if (skill === "Software Engineering") add.push("PR review throughput and AI-assisted coding mandates");
  if (skill === "Customer Support") add.push("Deflection rate from AI agents vs human escalation rate");
  if (skill === "Operations") add.push("SOP automation + RPA replacements in recurring workflows");

  return [...base, ...add].slice(0, 7);
}

/**
 * In the future you can replace these with real data ingestion.
 * For now, deterministic + safe + always returns valid JSON.
 */
export async function GET(req) {
  try {
    const { searchParams } = new URL(req.url);
    const sector = (searchParams.get("sector") || "All").slice(0, 60);
    const skill = (searchParams.get("skill") || "All").slice(0, 80);
    const range = clamp(parseInt(searchParams.get("range") || "180", 10), 30, 365);

    const days = range;

    // Data mode: if you later add env vars, switch to real mode.
    // For now, mock. (But the API contract stays identical.)
    const mode = "mock";

    const series = generateMockSeries({ sector, skill, days });

    const latest = series[series.length - 1];
    const prev = series[series.length - 2] || null;

    const latestPayload = {
      asOf: new Date().toISOString().slice(0, 16).replace("T", " "),
      index: latest.index,
      delta: prev ? latest.index - prev.index : 0,
      band: toBand(latest.index),
      layoffsScore: latest.layoffsScore,
      jobsScore: latest.jobsScore,
      adoptionScore: latest.adoptionScore,
    };

    // ---- Advanced analysis (deterministic) ----
    const analysisSeed = `analysis|${sector}|${skill}|${days}`;
    const rand = seededRand(analysisSeed);

    const vols = {
      layoffs: computeVolatility(series, "layoffsScore", 21),
      jobs: computeVolatility(series, "jobsScore", 21),
      adoption: computeVolatility(series, "adoptionScore", 21),
      index: computeVolatility(series, "index", 21),
    };

    const signalDeltas = {
      layoffs: prev ? latest.layoffsScore - prev.layoffsScore : 0,
      jobs: prev ? latest.jobsScore - prev.jobsScore : 0,
      adoption: prev ? latest.adoptionScore - prev.adoptionScore : 0,
    };

    const layoffsAnalysis = buildDrivers({
      rand,
      sector,
      skill,
      key: "layoffs",
      score: latest.layoffsScore,
      delta: signalDeltas.layoffs,
      vol: vols.layoffs,
    });

    const jobsAnalysis = buildDrivers({
      rand,
      sector,
      skill,
      key: "jobs",
      score: latest.jobsScore,
      delta: signalDeltas.jobs,
      vol: vols.jobs,
    });

    const adoptionAnalysis = buildDrivers({
      rand,
      sector,
      skill,
      key: "adoption",
      score: latest.adoptionScore,
      delta: signalDeltas.adoption,
      vol: vols.adoption,
    });

    const thesis = buildThesis({
      sector,
      skill,
      latest: latestPayload,
      prev: prev ? { index: prev.index } : null,
      vols,
    });

    const scenarioPack = buildScenarios({ latest: latestPayload });
    const watchlist = buildWatchlist({ sector, skill });

    // Attach advanced fields to latest (non-breaking)
    latestPayload.signals = {
      layoffs: {
        label: "Layoff clustering",
        classification: classifySignal("layoffs"),
        score: latestPayload.layoffsScore,
        delta: signalDeltas.layoffs,
        volatility_21d: Number(vols.layoffs.toFixed(2)),
        ...layoffsAnalysis,
      },
      jobs: {
        label: "Job posting decline",
        classification: classifySignal("jobs"),
        score: latestPayload.jobsScore,
        delta: signalDeltas.jobs,
        volatility_21d: Number(vols.jobs.toFixed(2)),
        ...jobsAnalysis,
      },
      adoption: {
        label: "AI adoption proxy",
        classification: classifySignal("adoption"),
        score: latestPayload.adoptionScore,
        delta: signalDeltas.adoption,
        volatility_21d: Number(vols.adoption.toFixed(2)),
        ...adoptionAnalysis,
      },
    };

    latestPayload.thesis = thesis;
    latestPayload.scenarios = scenarioPack;
    latestPayload.watchlist = watchlist;

    return Response.json(
      {
        ok: true,
        filters: { sector, skill, range: days },

        // existing keys
        latest: latestPayload,
        series: series.map((d) => ({ date: d.date, index: d.index })), // chart series
        componentsSeries: series, // if you want to chart components later

        meta: {
          mode,
          weights: { jobs: 0.4, layoffs: 0.35, adoption: 0.25 },
          note: "Mock series until you wire real feeds. API contract remains stable.",
          methodology: {
            overview:
              "Compression Index is a weighted composite of (1) job posting decline, (2) layoff clustering, and (3) AI adoption proxy. Values are normalized 0–100 and interpreted directionally.",
            signal_roles: {
              adoption: "Leading (workflow substitution shows up before headcount moves).",
              jobs: "Coincident (posting throttle reflects output-per-head targets).",
              layoffs: "Lagging (execution of cost and productivity decisions).",
            },
            disclaimer:
              "This index estimates labor-market compression signals. It does not predict individual outcomes or guarantee job displacement timelines.",
          },
        },
      },
      { status: 200 }
    );
  } catch (e) {
    return Response.json(
      { ok: false, error: e?.message || "Unknown error" },
      { status: 500 }
    );
  }
}
