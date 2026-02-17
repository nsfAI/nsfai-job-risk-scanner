"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

function clamp(n, a, b) {
  return Math.max(a, Math.min(b, n));
}

function cx(...classes) {
  return classes.filter(Boolean).join(" ");
}

function scoreBand(score) {
  const s = Number(score ?? 0);
  if (s >= 80)
    return {
      label: "Very resilient",
      blurb: "Strong human constraints + hard-to-automate surfaces.",
    };
  if (s >= 60)
    return {
      label: "Resilient",
      blurb: "Meaningful human moat signals. Some tasks may still be automated.",
    };
  if (s >= 40)
    return {
      label: "Mixed",
      blurb: "Balanced. Some work is defensible, some is tool-automatable.",
    };
  if (s >= 20)
    return {
      label: "Vulnerable",
      blurb: "Many tasks are repeatable / tool-driven. Likely compression risk.",
    };
  return {
    label: "Highly automatable",
    blurb: "Mostly repeatable work that AI tools can absorb quickly.",
  };
}

function pct(n01) {
  return Math.round(clamp(Number(n01 ?? 0), 0, 1) * 100);
}

/**
 * Mirrors your V1 weights so simulations + breakdown remain consistent with backend intent.
 * If you later version weights, you can update this block safely without touching the UI.
 */
const WEIGHTS_V1 = {
  // Higher = more resilient
  embodiment: 0.22,
  liability: 0.18,
  autonomy: 0.14,
  revenueProximity: 0.14,
  regulatory: 0.12,
  trustDepth: 0.10,

  // Penalize automation exposure traits
  repeatabilityPenalty: 0.20,
  toolAutomationPenalty: 0.10,
};

function computeScoreFromAttrs(attrs = {}) {
  const a = {
    embodiment: clamp(attrs.embodiment ?? 0.3, 0, 1),
    liability: clamp(attrs.liability ?? 0.3, 0, 1),
    autonomy: clamp(attrs.autonomy ?? 0.4, 0, 1),
    revenueProximity: clamp(attrs.revenueProximity ?? 0.4, 0, 1),
    regulatory: clamp(attrs.regulatory ?? 0.3, 0, 1),
    trustDepth: clamp(attrs.trustDepth ?? 0.35, 0, 1),
    repeatability: clamp(attrs.repeatability ?? 0.45, 0, 1),
    toolAutomation: clamp(attrs.toolAutomation ?? 0.4, 0, 1),
  };

  const durable =
    a.embodiment * WEIGHTS_V1.embodiment +
    a.liability * WEIGHTS_V1.liability +
    a.autonomy * WEIGHTS_V1.autonomy +
    a.revenueProximity * WEIGHTS_V1.revenueProximity +
    a.regulatory * WEIGHTS_V1.regulatory +
    a.trustDepth * WEIGHTS_V1.trustDepth;

  const penalty =
    a.repeatability * WEIGHTS_V1.repeatabilityPenalty +
    a.toolAutomation * WEIGHTS_V1.toolAutomationPenalty;

  const raw = clamp(durable - penalty, 0, 1);
  const score = Math.round(raw * 100);

  return { score, components: { ...a, durable, penalty, raw } };
}

function computeSignals(attrs = {}) {
  const { components } = computeScoreFromAttrs(attrs);
  const a = components;

  const positives = [
    {
      key: "embodiment",
      label: "Physical presence",
      value: a.embodiment,
      hint: "Requires hands-on work / real-world execution.",
      weight: WEIGHTS_V1.embodiment,
    },
    {
      key: "liability",
      label: "Liability & sign-off",
      value: a.liability,
      hint: "High-stakes responsibility / accountability.",
      weight: WEIGHTS_V1.liability,
    },
    {
      key: "regulatory",
      label: "Regulatory moat",
      value: a.regulatory,
      hint: "Compliance / licensing / regulated environments.",
      weight: WEIGHTS_V1.regulatory,
    },
    {
      key: "trustDepth",
      label: "Trust depth",
      value: a.trustDepth,
      hint: "High-trust relationships with clients/patients/stakeholders.",
      weight: WEIGHTS_V1.trustDepth,
    },
    {
      key: "autonomy",
      label: "Autonomy",
      value: a.autonomy,
      hint: "End-to-end ownership, ambiguity, decision-making.",
      weight: WEIGHTS_V1.autonomy,
    },
    {
      key: "revenueProximity",
      label: "Revenue proximity",
      value: a.revenueProximity,
      hint: "Closer to revenue / customers / pricing.",
      weight: WEIGHTS_V1.revenueProximity,
    },
  ];

  const penalties = [
    {
      key: "repeatability",
      label: "Repeatability",
      value: a.repeatability,
      hint: "Routine tasks, standardized outputs.",
      weight: WEIGHTS_V1.repeatabilityPenalty,
    },
    {
      key: "toolAutomation",
      label: "Tool automation exposure",
      value: a.toolAutomation,
      hint: "Workflows that map cleanly onto software tools.",
      weight: WEIGHTS_V1.toolAutomationPenalty,
    },
  ];

  const automatable = [
    {
      label: "Documentation / summarization",
      score: a.repeatability * 0.7 + a.toolAutomation * 0.3,
    },
    {
      label: "Reporting / dashboards",
      score: a.toolAutomation * 0.65 + a.repeatability * 0.35,
    },
    {
      label: "Intake / admin coordination",
      score: a.repeatability * 0.6 + (1 - a.autonomy) * 0.4,
    },
  ]
    .sort((x, y) => y.score - x.score)
    .slice(0, 3);

  const humanMoat = [
    { label: "Hands-on execution", score: a.embodiment },
    { label: "Liability / sign-off", score: a.liability },
    { label: "Regulatory compliance", score: a.regulatory },
  ]
    .sort((x, y) => y.score - x.score)
    .slice(0, 3);

  const drivers = [...positives]
    .map((p) => ({
      ...p,
      impact: p.value * p.weight,
    }))
    .sort((x, y) => y.impact - x.impact)
    .slice(0, 3);

  const pressures = [...penalties]
    .map((p) => ({
      ...p,
      impact: p.value * p.weight,
    }))
    .sort((x, y) => y.impact - x.impact)
    .slice(0, 2);

  return { a, positives, penalties, automatable, humanMoat, drivers, pressures };
}

function detectChips(text = "") {
  const t = String(text).toLowerCase();
  const chips = [];
  const add = (label) => chips.push(label);

  if (/on[- ]site|field|clinic|lab|equipment|warehouse|patient/.test(t))
    add("Physical presence");
  if (/license|credential|compliance|audit|liability|risk/.test(t))
    add("Liability / compliance");
  if (/hipaa|fda|sec|finra|sox|gdpr|regulator/.test(t)) add("Regulatory");
  if (/strategy|lead|stakeholder|cross[- ]functional|roadmap/.test(t))
    add("Autonomy / leadership");
  if (/sales|pipeline|quota|revenue|pricing|renewal/.test(t))
    add("Revenue proximity");
  if (/documentation|summariz|routine|data entry|reporting|dashboards/.test(t))
    add("Repeatable tasks");
  if (/excel|sql|tableau|powerbi|jira|notion|zendesk/.test(t))
    add("Tool-driven workflows");

  return Array.from(new Set(chips)).slice(0, 10);
}

function Meter({ label, value, hint, accent = "bg-black" }) {
  const p = pct(value);
  return (
    <div className="rounded-2xl border border-black/10 bg-white p-4 dark:border-white/20 dark:bg-[#141414]">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="text-sm font-semibold text-black dark:text-white">
            {label}
          </div>
          <div className="mt-1 text-xs text-black/60 dark:text-white/60">
            {hint}
          </div>
        </div>
        <div className="text-sm font-semibold text-black dark:text-white">{p}</div>
      </div>
      <div className="mt-3 h-2 w-full rounded-full bg-black/10 dark:bg-white/10">
        <div className={cx("h-2 rounded-full", accent)} style={{ width: `${p}%` }} />
      </div>
    </div>
  );
}

function StatPill({ label, value }) {
  return (
    <div className="rounded-2xl border border-black/10 bg-white px-3 py-2 text-xs text-black/70 dark:border-white/20 dark:bg-[#141414] dark:text-white/70">
      <span className="font-semibold text-black dark:text-white">{value}</span>{" "}
      <span className="text-black/60 dark:text-white/60">{label}</span>
    </div>
  );
}

function Radar({ values }) {
  // values: [{label, value}] each 0..1
  const size = 220;
  const cx0 = size / 2;
  const cy0 = size / 2;
  const r = 78;
  const labelsR = 98;

  const pts = values.map((v, i) => {
    const ang = (-Math.PI / 2) + (i * (2 * Math.PI)) / values.length;
    const rr = r * clamp(v.value, 0, 1);
    return [cx0 + rr * Math.cos(ang), cy0 + rr * Math.sin(ang)];
  });

  const labelPts = values.map((v, i) => {
    const ang = (-Math.PI / 2) + (i * (2 * Math.PI)) / values.length;
    return [cx0 + labelsR * Math.cos(ang), cy0 + labelsR * Math.sin(ang)];
  });

  const poly = pts.map((p) => p.join(",")).join(" ");

  return (
    <div className="rounded-2xl border border-black/10 bg-white p-4 dark:border-white/20 dark:bg-[#141414]">
      <div className="text-sm font-semibold text-black dark:text-white">
        Resilience surface map
      </div>
      <div className="mt-1 text-xs text-black/60 dark:text-white/60">
        Higher area = stronger human constraint density across key dimensions.
      </div>

      <div className="mt-4 flex items-center justify-center">
        <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
          {/* rings */}
          {[0.25, 0.5, 0.75, 1].map((k) => (
            <circle
              key={k}
              cx={cx0}
              cy={cy0}
              r={r * k}
              fill="none"
              stroke="rgba(0,0,0,0.12)"
              strokeWidth="1"
            />
          ))}

          {/* axes */}
          {values.map((_, i) => {
            const ang = (-Math.PI / 2) + (i * (2 * Math.PI)) / values.length;
            const x = cx0 + r * Math.cos(ang);
            const y = cy0 + r * Math.sin(ang);
            return (
              <line
                key={i}
                x1={cx0}
                y1={cy0}
                x2={x}
                y2={y}
                stroke="rgba(0,0,0,0.12)"
                strokeWidth="1"
              />
            );
          })}

          {/* polygon */}
          <polygon
            points={poly}
            fill="rgba(34,197,94,0.18)"
            stroke="rgba(34,197,94,0.9)"
            strokeWidth="2"
          />

          {/* nodes */}
          {pts.map((p, i) => (
            <circle key={i} cx={p[0]} cy={p[1]} r="3.2" fill="rgba(34,197,94,0.95)" />
          ))}

          {/* labels */}
          {values.map((v, i) => {
            const [lx, ly] = labelPts[i];
            const anchor = lx < cx0 - 10 ? "end" : lx > cx0 + 10 ? "start" : "middle";
            return (
              <text
                key={v.label}
                x={lx}
                y={ly}
                fontSize="10"
                fill="rgba(0,0,0,0.7)"
                textAnchor={anchor}
                dominantBaseline="middle"
              >
                {v.label}
              </text>
            );
          })}
        </svg>
      </div>
    </div>
  );
}

function buildActionPlan(signals) {
  const a = signals?.a || {};
  const recs = [];
  const ai = [];

  // Defensive moat recommendations
  if (a.trustDepth < 0.5) recs.push("Move closer to high-trust stakeholders: client-facing ownership, patient interaction, or executive coordination.");
  if (a.autonomy < 0.5) recs.push("Increase end-to-end ownership: define KPIs, own a roadmap, and drive decisions instead of only executing tickets.");
  if (a.liability < 0.45) recs.push("Seek responsibility surfaces: compliance sign-off, QA, audit trails, approvals, or regulated workflow ownership.");
  if (a.revenueProximity < 0.5) recs.push("Get closer to revenue: pricing, renewals, pipeline, onboarding, or post-sale outcomes tied to retention.");
  if (a.regulatory < 0.5 && a.embodiment < 0.5) recs.push("Add a moat layer: credentialed workflows, regulated environments, or domain specialization where mistakes are costly.");

  // AI-augmentation recommendations
  if (a.repeatability > 0.55) ai.push("Automate routine loops: templates + checklists + AI drafts (docs, summaries, status updates) with human QA.");
  if (a.toolAutomation > 0.5) ai.push("Build a lightweight ‘copilot’ workflow: saved prompts + structured inputs + one-click outputs for the tools you already use.");
  if (a.repeatability > 0.55 || a.toolAutomation > 0.5) ai.push("Turn work into systems: define SOPs + measurable outputs so you’re managing the machine, not doing the keystrokes.");

  if (recs.length < 3) recs.push("Build a specialty: become the person who understands edge-cases, constraints, and real-world consequences.");
  if (ai.length < 3) ai.push("Use AI for first drafts, then spend your human time on constraints, judgment, and stakeholder alignment.");

  return { recs: recs.slice(0, 5), ai: ai.slice(0, 5) };
}

export default function JobDetailsPage({ params }) {
  const id = decodeURIComponent(params?.id || "");

  const [loading, setLoading] = useState(true);
  const [job, setJob] = useState(null);
  const [error, setError] = useState("");

  // Simulator toggles (pure UI)
  const [sim, setSim] = useState({
    moreRemote: false,
    moreStakeholders: false,
    moreCompliance: false,
    moreReporting: false,
  });

  useEffect(() => {
    async function load() {
      setLoading(true);
      setError("");
      try {
        const res = await fetch(`/api/jobs/${encodeURIComponent(id)}`, {
          cache: "no-store",
        });
        const data = await res.json().catch(() => null);
        if (!data?.ok) throw new Error(data?.error || "Failed to load job.");
        setJob(data.job || null);
      } catch (e) {
        setError(e?.message || "Failed to load job.");
        setJob(null);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [id]);

  const score = Number(job?.resilience_score ?? 0);
  const band = useMemo(() => scoreBand(score), [score]);

  const baseAttrs = useMemo(() => job?.attributes_v1 || {}, [job?.attributes_v1]);
  const signals = useMemo(() => computeSignals(baseAttrs), [baseAttrs]);
  const chips = useMemo(
    () => detectChips(`${job?.title || ""}\n${job?.description || ""}`),
    [job]
  );

  const radarValues = useMemo(() => {
    const a = signals?.a || {};
    return [
      { label: "Embodiment", value: a.embodiment ?? 0 },
      { label: "Liability", value: a.liability ?? 0 },
      { label: "Regulatory", value: a.regulatory ?? 0 },
      { label: "Trust", value: a.trustDepth ?? 0 },
      { label: "Autonomy", value: a.autonomy ?? 0 },
      { label: "Revenue", value: a.revenueProximity ?? 0 },
    ];
  }, [signals]);

  const simulated = useMemo(() => {
    // Make small, reasonable adjustments to attrs to show directional deltas (NOT claiming truth, just guidance)
    const a = { ...baseAttrs };

    if (sim.moreRemote) {
      a.embodiment = clamp((a.embodiment ?? 0.3) - 0.2, 0, 1);
      a.repeatability = clamp((a.repeatability ?? 0.45) + 0.12, 0, 1);
      a.toolAutomation = clamp((a.toolAutomation ?? 0.4) + 0.12, 0, 1);
    }
    if (sim.moreStakeholders) {
      a.trustDepth = clamp((a.trustDepth ?? 0.35) + 0.18, 0, 1);
      a.autonomy = clamp((a.autonomy ?? 0.4) + 0.12, 0, 1);
    }
    if (sim.moreCompliance) {
      a.regulatory = clamp((a.regulatory ?? 0.3) + 0.22, 0, 1);
      a.liability = clamp((a.liability ?? 0.3) + 0.14, 0, 1);
    }
    if (sim.moreReporting) {
      a.repeatability = clamp((a.repeatability ?? 0.45) + 0.18, 0, 1);
      a.toolAutomation = clamp((a.toolAutomation ?? 0.4) + 0.15, 0, 1);
    }

    const { score: simScore } = computeScoreFromAttrs(a);
    const delta = simScore - score;

    return { simScore, delta };
  }, [sim, baseAttrs, score]);

  const plan = useMemo(() => buildActionPlan(signals), [signals]);

  if (loading) {
    return (
      <div className="mx-auto max-w-5xl px-6 py-10">
        <div className="text-sm text-black/60 dark:text-white/60">Loading…</div>
      </div>
    );
  }

  if (error || !job) {
    return (
      <div className="mx-auto max-w-5xl px-6 py-10">
        <Link href="/jobs" className="text-sm font-semibold underline underline-offset-4">
          ← Back to search
        </Link>
        <div className="mt-6 rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          {error || "Job not found."}
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-5xl px-6 py-10">
      <div className="flex items-center justify-between gap-3">
        <Link href="/jobs" className="text-sm font-semibold underline underline-offset-4">
          ← Back to search
        </Link>
        <Link
          href="/"
          className="rounded-xl border border-black/10 bg-white px-3 py-2 text-sm shadow-sm hover:bg-neutral-50 dark:border-white/20 dark:bg-[#141414] dark:hover:bg-white/10"
        >
          Home
        </Link>
      </div>

      <div className="mt-6 rounded-3xl border border-black/10 bg-white p-8 dark:border-white/20 dark:bg-[#141414]">
        <div className="flex items-start justify-between gap-6">
          <div>
            <div className="text-3xl font-extrabold text-black dark:text-white">
              {job.title || "Untitled role"}
            </div>
            <div className="mt-2 text-sm text-black/60 dark:text-white/60">
              {(job.company || "Unknown company") + (job.location ? ` — ${job.location}` : "")}
            </div>

            {chips.length > 0 && (
              <div className="mt-4 flex flex-wrap gap-2">
                {chips.map((c) => (
                  <span
                    key={c}
                    className="rounded-full border border-black/10 bg-white px-3 py-1 text-xs text-black/70 dark:border-white/20 dark:bg-[#141414] dark:text-white/70"
                  >
                    {c}
                  </span>
                ))}
              </div>
            )}

            <div className="mt-4 flex flex-wrap gap-2">
              <StatPill label="Durable signal" value={`${Math.round((signals?.a?.durable ?? 0) * 100)}`} />
              <StatPill label="Penalty pressure" value={`${Math.round((signals?.a?.penalty ?? 0) * 100)}`} />
              <StatPill label="Raw margin" value={`${Math.round((signals?.a?.raw ?? 0) * 100)}`} />
            </div>
          </div>

          <div className="text-right">
            <div className="text-xs text-black/50 dark:text-white/50">Resilience score</div>
            <div className="mt-1 text-5xl font-extrabold text-green-600">{score}</div>
            <div className="mt-2 text-sm font-semibold text-black dark:text-white">{band.label}</div>
            <div className="mt-1 max-w-[260px] text-xs text-black/60 dark:text-white/60">
              {band.blurb}
            </div>
          </div>
        </div>

        {/* Explanation + Drivers/Pressures */}
        <div className="mt-6 grid grid-cols-1 gap-4 lg:grid-cols-3">
          <div className="rounded-2xl border border-black/10 bg-neutral-50 p-5 text-sm text-black/80 dark:border-white/20 dark:bg-black/20 dark:text-white/80 lg:col-span-2">
            <div className="font-semibold">What this score means</div>
            <div className="mt-2 text-sm">
              You’re measuring <span className="font-semibold">task-surface resilience</span>: how much of this role
              depends on physical reality, accountability, regulation, trust, and judgment — versus repeatable/tool-driven work.
            </div>
            <div className="mt-3 grid grid-cols-1 gap-3 md:grid-cols-3">
              <div className="rounded-2xl border border-black/10 bg-white p-4 dark:border-white/20 dark:bg-[#141414]">
                <div className="text-xs text-black/60 dark:text-white/60">0–30</div>
                <div className="mt-1 text-sm font-semibold text-black dark:text-white">Tool-absorbable</div>
                <div className="mt-1 text-xs text-black/60 dark:text-white/60">
                  Mostly repeatable work. Compression risk is higher.
                </div>
              </div>
              <div className="rounded-2xl border border-black/10 bg-white p-4 dark:border-white/20 dark:bg-[#141414]">
                <div className="text-xs text-black/60 dark:text-white/60">40–60</div>
                <div className="mt-1 text-sm font-semibold text-black dark:text-white">Mixed surface</div>
                <div className="mt-1 text-xs text-black/60 dark:text-white/60">
                  Some durable work + some automatable work.
                </div>
              </div>
              <div className="rounded-2xl border border-black/10 bg-white p-4 dark:border-white/20 dark:bg-[#141414]">
                <div className="text-xs text-black/60 dark:text-white/60">70–100</div>
                <div className="mt-1 text-sm font-semibold text-black dark:text-white">Human moat</div>
                <div className="mt-1 text-xs text-black/60 dark:text-white/60">
                  High constraint density (hard to automate).
                </div>
              </div>
            </div>
            <div className="mt-3 text-xs text-black/60 dark:text-white/60">
              Note: this is not “job extinction prediction.” High-resilience roles still get AI-augmented — they just compress slower.
            </div>
          </div>

          <div className="rounded-2xl border border-black/10 bg-white p-5 dark:border-white/20 dark:bg-[#141414]">
            <div className="text-sm font-semibold text-black dark:text-white">Top score drivers</div>
            <div className="mt-3 space-y-2">
              {(signals?.drivers || []).map((d) => (
                <div key={d.key} className="flex items-start justify-between gap-3">
                  <div>
                    <div className="text-sm font-semibold text-black dark:text-white">{d.label}</div>
                    <div className="text-xs text-black/60 dark:text-white/60">{d.hint}</div>
                  </div>
                  <div className="text-sm font-semibold text-black dark:text-white">{pct(d.value)}</div>
                </div>
              ))}
            </div>

            <div className="mt-4 border-t border-black/10 pt-4 dark:border-white/10">
              <div className="text-sm font-semibold text-black dark:text-white">Top pressures</div>
              <div className="mt-3 space-y-2">
                {(signals?.pressures || []).map((p) => (
                  <div key={p.key} className="flex items-start justify-between gap-3">
                    <div>
                      <div className="text-sm font-semibold text-black dark:text-white">{p.label}</div>
                      <div className="text-xs text-black/60 dark:text-white/60">{p.hint}</div>
                    </div>
                    <div className="text-sm font-semibold text-black dark:text-white">{pct(p.value)}</div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Radar + Simulator */}
        <div className="mt-6 grid grid-cols-1 gap-4 lg:grid-cols-3">
          <div className="lg:col-span-2">
            <Radar values={radarValues} />
          </div>

          <div className="rounded-2xl border border-black/10 bg-white p-5 dark:border-white/20 dark:bg-[#141414]">
            <div className="text-sm font-semibold text-black dark:text-white">
              What would change the score?
            </div>
            <div className="mt-1 text-xs text-black/60 dark:text-white/60">
              This is a directional simulator to show which levers matter most.
            </div>

            <div className="mt-4 space-y-2">
              {[
                { key: "moreRemote", label: "Role becomes more remote" },
                { key: "moreStakeholders", label: "More stakeholder ownership" },
                { key: "moreCompliance", label: "More compliance / sign-off" },
                { key: "moreReporting", label: "More reporting / dashboards" },
              ].map((x) => (
                <button
                  key={x.key}
                  onClick={() => setSim((s) => ({ ...s, [x.key]: !s[x.key] }))}
                  className={cx(
                    "w-full rounded-xl border px-3 py-2 text-left text-sm transition",
                    sim[x.key]
                      ? "border-black bg-black text-white dark:border-white dark:bg-white dark:text-black"
                      : "border-black/10 bg-white hover:bg-neutral-50 dark:border-white/20 dark:bg-[#141414] dark:hover:bg-white/10"
                  )}
                >
                  {sim[x.key] ? "✓ " : ""}{x.label}
                </button>
              ))}
            </div>

            <div className="mt-4 rounded-2xl border border-black/10 bg-neutral-50 p-4 dark:border-white/20 dark:bg-black/20">
              <div className="text-xs text-black/60 dark:text-white/60">Simulated score</div>
              <div className="mt-1 flex items-end justify-between gap-3">
                <div className="text-3xl font-extrabold text-black dark:text-white">
                  {simulated.simScore}
                </div>
                <div
                  className={cx(
                    "rounded-full px-2 py-1 text-xs font-semibold",
                    simulated.delta >= 0
                      ? "bg-green-600/15 text-green-700 dark:text-green-400"
                      : "bg-red-500/15 text-red-700 dark:text-red-400"
                  )}
                >
                  {simulated.delta >= 0 ? `+${simulated.delta}` : `${simulated.delta}`} vs current
                </div>
              </div>
              <div className="mt-2 text-xs text-black/60 dark:text-white/60">
                Use this as guidance: the levers that move the score are the levers that move resilience.
              </div>
            </div>
          </div>
        </div>

        {/* Deep breakdown meters */}
        <div className="mt-6 grid grid-cols-1 gap-4 lg:grid-cols-2">
          <div>
            <div className="mb-3 text-sm font-semibold text-black dark:text-white">
              Positive resilience signals
            </div>
            <div className="space-y-3">
              {signals.positives.map((x) => (
                <Meter
                  key={x.key}
                  label={x.label}
                  value={x.value}
                  hint={x.hint}
                  accent="bg-green-600"
                />
              ))}
            </div>
          </div>

          <div>
            <div className="mb-3 text-sm font-semibold text-black dark:text-white">
              Automation exposure (penalties)
            </div>
            <div className="space-y-3">
              {signals.penalties.map((x) => (
                <Meter
                  key={x.key}
                  label={x.label}
                  value={x.value}
                  hint={x.hint}
                  accent="bg-red-500"
                />
              ))}
            </div>

            <div
