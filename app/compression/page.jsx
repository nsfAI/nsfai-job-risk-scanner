"use client";

import { useEffect, useMemo, useState } from "react";

function cx(...classes) {
  return classes.filter(Boolean).join(" ");
}

function Sparkline({ points = [] }) {
  const w = 520;
  const h = 120;
  const pad = 10;

  const path = useMemo(() => {
    if (!points.length) return "";
    const ys = points.map((p) => p.y);
    const minY = Math.min(...ys);
    const maxY = Math.max(...ys);
    const span = Math.max(1, maxY - minY);

    const toX = (i) => pad + (i * (w - pad * 2)) / Math.max(1, points.length - 1);
    const toY = (y) => h - pad - ((y - minY) * (h - pad * 2)) / span;

    return points
      .map((p, i) => `${i === 0 ? "M" : "L"} ${toX(i).toFixed(2)} ${toY(p.y).toFixed(2)}`)
      .join(" ");
  }, [points]);

  return (
    <div className="w-full overflow-hidden rounded-2xl border border-black/5 bg-white">
      <svg viewBox={`0 0 ${w} ${h}`} className="w-full h-[120px]">
        <path d={path} fill="none" stroke="currentColor" strokeWidth="2.5" className="text-black/80" />
      </svg>
    </div>
  );
}

function Pill({ children, tone = "neutral" }) {
  const toneCls =
    tone === "good"
      ? "bg-emerald-50 text-emerald-700 border-emerald-200"
      : tone === "warn"
      ? "bg-amber-50 text-amber-700 border-amber-200"
      : tone === "bad"
      ? "bg-rose-50 text-rose-700 border-rose-200"
      : "bg-zinc-50 text-zinc-700 border-zinc-200";

  return (
    <span
      className={cx(
        "inline-flex items-center gap-2 rounded-full border px-3 py-1 text-xs font-semibold",
        toneCls
      )}
    >
      {children}
    </span>
  );
}

function formatDelta(n) {
  if (n === null || n === undefined || Number.isNaN(n)) return "—";
  const sign = n > 0 ? "+" : "";
  return `${sign}${n.toFixed(1)}`;
}

function toneFromScore(score) {
  if (score >= 75) return "bad";
  if (score >= 55) return "warn";
  if (score >= 35) return "neutral";
  return "good";
}

function dirLabel(direction) {
  if (direction === "up") return "Rising";
  if (direction === "down") return "Falling";
  if (direction === "flat") return "Flat";
  return "—";
}

export default function CompressionPage() {
  const [sector, setSector] = useState("All");
  const [skill, setSkill] = useState("All");
  const [range, setRange] = useState("180");
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState(null);
  const [err, setErr] = useState("");

  async function load() {
    setLoading(true);
    setErr("");
    try {
      const qs = new URLSearchParams({ sector, skill, range });
      const res = await fetch(`/api/compression?${qs.toString()}`, { cache: "no-store" });
      const json = await res.json();
      if (!res.ok || !json?.ok) throw new Error(json?.error || `Request failed (${res.status})`);
      setData(json);
    } catch (e) {
      setErr(e?.message || "Failed to load");
      setData(null);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sector, skill, range]);

  const latest = data?.latest;
  const series = data?.series || [];

  const signals = latest?.signals || null; // new advanced payload (safe if missing)
  const thesis = latest?.thesis || "";
  const scenarios = latest?.scenarios || null;
  const watchlist = latest?.watchlist || [];

  const scoreTone = toneFromScore(latest?.index ?? 0);

  // Build a deterministic ordering for deep dives
  const signalCards = useMemo(() => {
    if (!signals) return [];
    const order = ["adoption", "jobs", "layoffs"];
    return order
      .filter((k) => signals[k])
      .map((k) => ({ key: k, ...signals[k] }));
  }, [signals]);

  return (
    <main className="mx-auto w-full max-w-6xl px-4 pb-16 pt-10">
      {/* Header */}
      <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Compression Index</h1>
          <p className="mt-1 text-sm text-black/60">
            Live enterprise signals that correlate with AI-driven labor compression (not just “bad economy” vibes).
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <select
            className="h-10 rounded-xl border border-black/10 bg-white px-3 text-sm"
            value={sector}
            onChange={(e) => setSector(e.target.value)}
          >
            {["All", "Tech", "Finance", "Healthcare", "Retail", "Manufacturing", "Energy", "Public Sector", "Other"].map(
              (s) => (
                <option key={s} value={s}>
                  Sector: {s}
                </option>
              )
            )}
          </select>

          <select
            className="h-10 rounded-xl border border-black/10 bg-white px-3 text-sm"
            value={skill}
            onChange={(e) => setSkill(e.target.value)}
          >
            {[
              "All",
              "Software Engineering",
              "Data / Analytics",
              "Finance / Accounting",
              "Sales",
              "Customer Support",
              "Marketing",
              "Operations",
              "Legal",
              "Healthcare Clinical",
              "Skilled Trades",
            ].map((s) => (
              <option key={s} value={s}>
                Skill: {s}
              </option>
            ))}
          </select>

          <select
            className="h-10 rounded-xl border border-black/10 bg-white px-3 text-sm"
            value={range}
            onChange={(e) => setRange(e.target.value)}
          >
            {[
              { label: "90d", value: "90" },
              { label: "180d", value: "180" },
              { label: "365d", value: "365" },
            ].map((r) => (
              <option key={r.value} value={r.value}>
                Range: {r.label}
              </option>
            ))}
          </select>

          {/* Navigation */}
          <a
            href="/"
            className="h-10 rounded-xl border border-black/10 bg-white px-3 text-sm font-semibold hover:bg-black/5"
          >
            ← NSFAI Scanner
          </a>

          <a
            href="/#report"
            className="h-10 rounded-xl border border-black/10 bg-white px-3 text-sm font-semibold hover:bg-black/5"
          >
            Jump to report
          </a>

          <button
            onClick={load}
            className="h-10 rounded-xl bg-black px-4 text-sm font-semibold text-white hover:bg-black/90"
          >
            Refresh
          </button>
        </div>
      </div>

      {/* KPI Row */}
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="rounded-3xl border border-black/5 bg-white p-6 shadow-[0_8px_30px_rgba(0,0,0,0.05)]">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-sm font-semibold text-black/70">Compression Index</p>
              <p className="mt-2 text-4xl font-semibold tracking-tight">
                {loading ? "—" : `${latest?.index ?? "—"}`}
                <span className="text-lg font-semibold text-black/50"> / 100</span>
              </p>
              <div className="mt-3 flex items-center gap-2">
                <Pill tone={scoreTone}>{latest?.band || "—"}</Pill>
                <span className="text-xs text-black/60">Δ {formatDelta(latest?.delta)} (vs prev)</span>
              </div>
            </div>

            <div className="text-right">
              <p className="text-xs text-black/50">Scope</p>
              <p className="mt-1 text-sm font-semibold">
                {sector} · {skill}
              </p>
              <p className="mt-1 text-xs text-black/50">Updated: {latest?.asOf || "—"}</p>
            </div>
          </div>

          <div className="mt-5">
            <Sparkline points={series.map((d, i) => ({ x: i, y: d.index }))} />
          </div>

          {data?.meta?.mode === "mock" && (
            <div className="mt-4 rounded-2xl border border-amber-200 bg-amber-50 p-3 text-xs text-amber-800">
              Using <b>mock</b> data (no data source env vars detected). This is expected until you wire real feeds.
            </div>
          )}
        </div>

        <div className="rounded-3xl border border-black/5 bg-white p-6 shadow-[0_8px_30px_rgba(0,0,0,0.05)]">
          <p className="text-sm font-semibold text-black/70">Signal breakdown</p>

          <div className="mt-4 grid gap-3">
            {[
              {
                key: "layoffs",
                title: "Layoff clustering",
                desc: "Disproportionate layoffs vs baseline",
                val: latest?.layoffsScore,
              },
              { key: "jobs", title: "Job posting decline", desc: "Posting velocity vs median baseline", val: latest?.jobsScore },
              { key: "adoption", title: "AI adoption proxy", desc: "AI requirements / tool mentions trend", val: latest?.adoptionScore },
            ].map((s) => (
              <div key={s.key} className="rounded-2xl border border-black/5 p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-semibold">{s.title}</p>
                    <p className="mt-1 text-xs text-black/55">{s.desc}</p>
                  </div>
                  <Pill tone={toneFromScore(s.val ?? 0)}>{loading ? "—" : `${s.val ?? "—"}`}</Pill>
                </div>
              </div>
            ))}
          </div>

          <div className="mt-4 rounded-2xl border border-black/5 bg-zinc-50 p-4 text-sm text-black/70">
            <b>Interpretation:</b> high score = labor is compressing faster in this sector/skill. It does <i>not</i> mean
            “job extinct tomorrow.”
          </div>

          {err && (
            <div className="mt-4 rounded-2xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700">{err}</div>
          )}
        </div>
      </div>

      {/* Advanced section (safe if API not updated yet) */}
      <div className="mt-6 grid gap-4">
        <div className="rounded-3xl border border-black/5 bg-white p-6 shadow-[0_8px_30px_rgba(0,0,0,0.05)]">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-sm font-semibold text-black/70">Analyst Notes</p>
              <p className="mt-1 text-sm text-black/55">
                A structured interpretation layer on top of the index (drivers, counter-signals, scenarios).
              </p>
            </div>

            <Pill tone={scoreTone}>{loading ? "—" : `Index: ${latest?.index ?? "—"}/100`}</Pill>
          </div>

          {!thesis ? (
            <div className="mt-4 rounded-2xl border border-dashed border-black/10 bg-zinc-50 p-4 text-sm text-black/60">
              No analyst notes yet. (Deploy the updated <code>/api/compression</code> route to enable this layer.)
            </div>
          ) : (
            <div className="mt-4 whitespace-pre-line text-sm leading-relaxed text-black/75">
              {thesis}
            </div>
          )}
        </div>

        {/* Deep dives */}
        <div className="grid gap-4 md:grid-cols-3">
          {signalCards.map((s) => (
            <div
              key={s.key}
              className="rounded-3xl border border-black/5 bg-white p-6 shadow-[0_8px_30px_rgba(0,0,0,0.05)]"
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-sm font-semibold">{s.label || s.key}</p>
                  <p className="mt-1 text-xs text-black/55">
                    {s.classification ? `${s.classification} signal` : "Signal"}
                    {" · "}
                    {typeof s.volatility_21d === "number" ? `Vol (21d): ${s.volatility_21d}` : "Vol (21d): —"}
                  </p>
                </div>

                <div className="text-right">
                  <Pill tone={toneFromScore(s.score ?? 0)}>{loading ? "—" : `${s.score ?? "—"}`}</Pill>
                  <p className="mt-2 text-xs text-black/55">
                    {dirLabel(s.direction)}{" "}
                    {typeof s.delta === "number" ? `(${formatDelta(s.delta)})` : "(—)"}
                  </p>
                </div>
              </div>

              <div className="mt-4 rounded-2xl border border-black/5 bg-zinc-50 p-4 text-sm text-black/70">
                <b>Read:</b> {s.interpretation || "—"}
              </div>

              <div className="mt-4">
                <p className="text-xs font-semibold text-black/60">Primary drivers</p>
                <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-black/75">
                  {(s.drivers || []).slice(0, 5).map((x, i) => (
                    <li key={i}>{x}</li>
                  ))}
                </ul>
              </div>

              <div className="mt-4">
                <p className="text-xs font-semibold text-black/60">Counter-signals</p>
                <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-black/70">
                  {(s.counterSignals || []).slice(0, 4).map((x, i) => (
                    <li key={i}>{x}</li>
                  ))}
                </ul>
              </div>

              <div className="mt-4 flex items-center justify-between">
                <span className="text-xs text-black/55">Confidence</span>
                <Pill tone={s.confidence === "High" ? "good" : s.confidence === "Medium" ? "warn" : "neutral"}>
                  {s.confidence || "—"}
                </Pill>
              </div>
            </div>
          ))}
        </div>

        {/* Scenarios + Watchlist */}
        <div className="grid gap-4 md:grid-cols-2">
          <div className="rounded-3xl border border-black/5 bg-white p-6 shadow-[0_8px_30px_rgba(0,0,0,0.05)]">
            <p className="text-sm font-semibold text-black/70">Scenario map</p>
            <p className="mt-1 text-sm text-black/55">
              If/then logic to interpret which regime you’re in.
            </p>

            {!scenarios?.scenarios?.length ? (
              <div className="mt-4 rounded-2xl border border-dashed border-black/10 bg-zinc-50 p-4 text-sm text-black/60">
                No scenarios yet. (Deploy updated API to populate.)
              </div>
            ) : (
              <div className="mt-4 space-y-3">
                {scenarios.scenarios.map((x, i) => {
                  const isLikely = scenarios.likelyScenarioIndex === i;
                  return (
                    <div
                      key={i}
                      className={cx(
                        "rounded-2xl border p-4",
                        isLikely ? "border-black/15 bg-zinc-50" : "border-black/5 bg-white"
                      )}
                    >
                      <div className="flex items-center justify-between gap-3">
                        <p className="text-sm font-semibold">
                          {x.if}
                        </p>
                        {isLikely ? <Pill tone="warn">Likely</Pill> : <Pill>Possible</Pill>}
                      </div>
                      <p className="mt-2 text-sm text-black/70">{x.then}</p>
                      {(x.watch || []).length ? (
                        <ul className="mt-3 list-disc space-y-1 pl-5 text-sm text-black/65">
                          {x.watch.slice(0, 4).map((w, j) => (
                            <li key={j}>{w}</li>
                          ))}
                        </ul>
                      ) : null}
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          <div className="rounded-3xl border border-black/5 bg-white p-6 shadow-[0_8px_30px_rgba(0,0,0,0.05)]">
            <p className="text-sm font-semibold text-black/70">Watchlist</p>
            <p className="mt-1 text-sm text-black/55">
              What to monitor next to confirm or falsify the read.
            </p>

            {!watchlist?.length ? (
              <div className="mt-4 rounded-2xl border border-dashed border-black/10 bg-zinc-50 p-4 text-sm text-black/60">
                No watchlist yet. (Deploy updated API to populate.)
              </div>
            ) : (
              <ul className="mt-4 list-disc space-y-2 pl-5 text-sm text-black/75">
                {watchlist.slice(0, 8).map((x, i) => (
                  <li key={i}>{x}</li>
                ))}
              </ul>
            )}
          </div>
        </div>
      </div>
    </main>
  );
}
