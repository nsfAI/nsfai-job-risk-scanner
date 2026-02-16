"use client";

import { useMemo, useState } from "react";

const TASKS = [
  "Writing emails, documentation, or reports",
  "Summarizing information / research",
  "Data entry / form processing",
  "Spreadsheet reporting / dashboards",
  "Basic analysis (KPIs, trends) with structured data",
  "Customer support / answering FAQs",
  "Scheduling / coordination / operations admin",
  "Designing workflows / SOPs / process improvement",
  "Negotiation / persuasion / sales conversations",
  "Leading meetings / stakeholder management",
  "Hands-on physical work (field, equipment, lab)",
  "Caregiving / high-empathy human interaction",
  "High-stakes decisions / sign-off / liability responsibility",
  "Creative strategy / brand / ambiguous problem solving",
  "Building software / automation / scripting",
];

const INDUSTRIES = [
  "Tech",
  "Healthcare",
  "Finance",
  "Education",
  "Manufacturing",
  "Retail",
  "Government",
  "Legal",
  "Construction",
  "Hospitality",
  "Other",
];

const SENIORITY = ["Entry", "Mid", "Senior", "Manager", "Director", "Executive"];

function classNames(...xs) {
  return xs.filter(Boolean).join(" ");
}

function scorePill(score) {
  if (score <= 2) return "Extremely resistant";
  if (score <= 4) return "Low exposure";
  if (score <= 6) return "Moderate exposure";
  if (score <= 8) return "High task automation exposure";
  return "Very high displacement probability";
}

export default function Page() {
  const [jobTitle, setJobTitle] = useState("");
  const [industry, setIndustry] = useState("Tech");
  const [seniority, setSeniority] = useState("Executive");
  const [jobDescription, setJobDescription] = useState("");

  const [selected, setSelected] = useState([]);
  const [loading, setLoading] = useState(false);
  const [report, setReport] = useState(null);
  const [error, setError] = useState("");

  const chars = jobDescription.length;
  const selectedCount = selected.length;

  const canGenerate = useMemo(() => {
    return (
      jobDescription.trim().length > 20 &&
      selectedCount >= 3 &&
      selectedCount <= 8 &&
      !loading
    );
  }, [jobDescription, selectedCount, loading]);

  function toggleTask(task) {
    setReport(null);
    setError("");

    setSelected((prev) => {
      const has = prev.includes(task);
      if (has) return prev.filter((t) => t !== task);
      if (prev.length >= 8) return prev; // cap at 8
      return [...prev, task];
    });
  }

  function resetAll() {
    setJobTitle("");
    setIndustry("Tech");
    setSeniority("Executive");
    setJobDescription("");
    setSelected([]);
    setReport(null);
    setError("");
  }

  async function generate() {
    setLoading(true);
    setError("");
    setReport(null);

    try {
      const res = await fetch("/api/report", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          jobTitle,
          industry,
          seniority,
          jobDescription,
          tasks: selected,
        }),
      });

      const data = await res.json().catch(() => null);

      if (!res.ok || !data?.ok) {
        setError(data?.error || `Request failed (${res.status})`);
        setLoading(false);
        return;
      }

      setReport(data.report);
      setLoading(false);
    } catch (e) {
      setError("Network error. Try again.");
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-[radial-gradient(ellipse_at_top,rgba(0,0,0,0.06),transparent_60%)]">
      {/* Top bar */}
      <div className="sticky top-0 z-50 border-b border-black/5 bg-white/70 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3">
          <div className="flex items-center gap-3">
            <div className="grid h-9 w-9 place-items-center rounded-full bg-black font-semibold text-white">
              N
            </div>

            <div className="leading-tight">
              <div className="text-sm font-semibold tracking-tight">NSFAI</div>
              <div className="text-xs text-neutral-500">
                AI displacement risk — based on tasks, not titles.
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <a
              href="#report"
              className="rounded-xl border border-black/10 bg-white px-3 py-2 text-sm shadow-sm hover:bg-neutral-50"
            >
              Jump to report
            </a>

            <a
              href="/compression"
              className="rounded-xl border border-black/10 bg-white px-3 py-2 text-sm shadow-sm hover:bg-neutral-50"
            >
              Compression Index
            </a>

            {/* ROI (new) */}
            <a
              href="/roi"
              className="rounded-xl border border-black/10 bg-white px-3 py-2 text-sm shadow-sm hover:bg-neutral-50"
            >
              ROI Model
            </a>

            <button
              onClick={resetAll}
              className="rounded-xl bg-black px-3 py-2 text-sm font-semibold text-white shadow-sm hover:bg-black/90"
            >
              Reset
            </button>
          </div>
        </div>
      </div>

      <main className="mx-auto max-w-6xl px-4 py-10">
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          {/* Left: Role inputs */}
          <section className="rounded-2xl border border-black/5 bg-white p-6 shadow-[0_1px_0_rgba(0,0,0,0.04),0_10px_30px_rgba(0,0,0,0.06)]">
            <div className="flex items-start justify-between gap-4">
              <div>
                <div className="text-sm font-semibold">Role inputs</div>
                <div className="mt-1 text-sm text-neutral-500">
                  Paste a real job description. Titles help, tasks drive the score.
                </div>
              </div>
              <div className="rounded-full bg-black px-3 py-1 text-xs font-semibold text-white">
                {chars} chars
              </div>
            </div>

            <div className="mt-6 space-y-4">
              <div>
                <label className="text-sm font-medium">Job title (optional)</label>
                <input
                  value={jobTitle}
                  onChange={(e) => setJobTitle(e.target.value)}
                  placeholder="e.g., Director of Strategic Operations"
                  className="mt-2 w-full rounded-xl border border-black/10 bg-white px-4 py-3 text-sm outline-none ring-0 focus:border-black/20 focus:shadow-[0_0_0_3px_rgba(0,0,0,0.06)]"
                />
              </div>

              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <div>
                  <label className="text-sm font-medium">Industry</label>
                  <select
                    value={industry}
                    onChange={(e) => setIndustry(e.target.value)}
                    className="mt-2 w-full rounded-xl border border-black/10 bg-white px-4 py-3 text-sm outline-none focus:border-black/20 focus:shadow-[0_0_0_3px_rgba(0,0,0,0.06)]"
                  >
                    {INDUSTRIES.map((x) => (
                      <option key={x} value={x}>
                        {x}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="text-sm font-medium">Seniority</label>
                  <select
                    value={seniority}
                    onChange={(e) => setSeniority(e.target.value)}
                    className="mt-2 w-full rounded-xl border border-black/10 bg-white px-4 py-3 text-sm outline-none focus:border-black/20 focus:shadow-[0_0_0_3px_rgba(0,0,0,0.06)]"
                  >
                    {SENIORITY.map((x) => (
                      <option key={x} value={x}>
                        {x}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="text-sm font-medium">Job description (required)</label>
                <textarea
                  value={jobDescription}
                  onChange={(e) => setJobDescription(e.target.value)}
                  placeholder="Paste the full job description here..."
                  rows={8}
                  className="mt-2 w-full resize-y rounded-xl border border-black/10 bg-white px-4 py-3 text-sm outline-none focus:border-black/20 focus:shadow-[0_0_0_3px_rgba(0,0,0,0.06)]"
                />
                <div className="mt-2 text-xs text-neutral-500">
                  More specific description → better report.
                </div>
              </div>
            </div>
          </section>

          {/* Right: Tasks */}
          <section className="rounded-2xl border border-black/5 bg-white p-6 shadow-[0_1px_0_rgba(0,0,0,0.04),0_10px_30px_rgba(0,0,0,0.06)]">
            <div className="flex items-start justify-between gap-4">
              <div>
                <div className="text-sm font-semibold">Tasks you actually do</div>
                <div className="mt-1 text-sm text-neutral-500">Pick 3–8 weekly tasks.</div>
              </div>
              <div className="rounded-full bg-black px-3 py-1 text-xs font-semibold text-white">
                {selectedCount}/8
              </div>
            </div>

            <div className="mt-5 flex flex-wrap gap-2">
              {TASKS.map((t) => {
                const on = selected.includes(t);
                const disabled = !on && selected.length >= 8;
                return (
                  <button
                    key={t}
                    onClick={() => toggleTask(t)}
                    disabled={disabled}
                    className={classNames(
                      "rounded-full px-3 py-2 text-xs transition",
                      on
                        ? "bg-black text-white shadow-sm"
                        : "border border-black/10 bg-white text-neutral-700 hover:bg-neutral-50",
                      disabled ? "cursor-not-allowed opacity-40" : ""
                    )}
                  >
                    {t}
                  </button>
                );
              })}
            </div>

            <button
              onClick={generate}
              disabled={!canGenerate}
              className={classNames(
                "mt-6 w-full rounded-2xl px-4 py-3 text-sm font-semibold shadow-sm transition",
                canGenerate
                  ? "bg-black text-white hover:bg-black/90"
                  : "cursor-not-allowed bg-neutral-200 text-neutral-500"
              )}
            >
              {loading ? "Generating..." : "Generate NSFAI Report"}
            </button>

            <div className="mt-3 text-xs text-neutral-500">
              If you hit a rate limit, wait ~30–60 seconds and try again.
            </div>
          </section>
        </div>

        {/* Report */}
        <section
          id="report"
          className="mt-8 rounded-2xl border border-black/5 bg-white p-6 shadow-[0_1px_0_rgba(0,0,0,0.04),0_10px_30px_rgba(0,0,0,0.06)]"
        >
          <div className="flex items-start justify-between gap-4">
            <div>
              <div className="text-sm font-semibold">Report</div>
              <div className="mt-1 text-sm text-neutral-500">
                Generated from your job description + tasks.
              </div>
            </div>

            <div className="flex items-center gap-2">
              <span className="rounded-full border border-black/10 bg-white px-3 py-1 text-xs text-neutral-700">
                {report ? "Generated" : "Empty"}
              </span>
            </div>
          </div>

          {/* Clear disclaimer */}
          <div className="mt-3 text-sm text-neutral-600">
            <span className="font-medium text-neutral-900">Important:</span>{" "}
            This score reflects{" "}
            <span className="font-medium">automation exposure of tasks</span>, not full job extinction.
          </div>

          {error ? (
            <div className="mt-5 rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
              {error}
            </div>
          ) : null}

          {!report ? (
            <div className="mt-5 rounded-2xl border border-dashed border-black/10 bg-neutral-50 p-6 text-sm text-neutral-500">
              No report yet.
            </div>
          ) : (
            <>
              {/* Score row */}
              <div className="mt-5 grid grid-cols-1 gap-4 md:grid-cols-3">
                <div className="rounded-2xl border border-black/5 bg-white p-4">
                  <div className="text-xs text-neutral-500">Score</div>
                  <div className="mt-2 flex items-end gap-2">
                    <div className="text-3xl font-semibold">{report.risk_score}/10</div>
                    <div className="text-sm text-neutral-500">{scorePill(report.risk_score)}</div>
                  </div>
                  <div className="mt-2 text-xs text-neutral-500">
                    {report?.meta?.dampener_applied
                      ? `Adjusted from ${report.meta.original_score}/10 due to strong human-moat signals in tasks.`
                      : "No structural dampener applied."}
                  </div>
                </div>

                <div className="rounded-2xl border border-black/5 bg-white p-4 md:col-span-2">
                  <div className="text-xs text-neutral-500">Why this score</div>
                  <ul className="mt-3 list-disc space-y-2 pl-5 text-sm text-neutral-800">
                    {(report.why || []).map((x, i) => (
                      <li key={i}>{x}</li>
                    ))}
                  </ul>
                </div>
              </div>

              {/* Two columns */}
              <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-2">
                {/* Automatable */}
                <div className="rounded-2xl border border-black/5 bg-white p-4">
                  <div className="text-sm font-semibold">Most automatable</div>
                  <div className="mt-1 text-sm text-neutral-500">Tasks AI can help automate first.</div>

                  <div className="mt-4 space-y-3">
                    {(report.most_automatable || []).map((item, i) => (
                      <div key={i} className="rounded-2xl border border-black/5 bg-neutral-50 p-4">
                        <div className="flex items-center justify-between gap-3">
                          <div className="text-sm font-medium">{item.task}</div>
                          <span className="rounded-full border border-black/10 bg-white px-2 py-1 text-xs text-neutral-700">
                            {item.time_horizon}
                          </span>
                        </div>
                        <div className="mt-2 text-sm text-neutral-700">{item.reason}</div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Human moat */}
                <div className="rounded-2xl border border-black/5 bg-white p-4">
                  <div className="text-sm font-semibold">Human moat</div>
                  <div className="mt-1 text-sm text-neutral-500">
                    The parts that stay human for longer.
                  </div>

                  <div className="mt-4 space-y-3">
                    {(report.most_human_moat || []).map((item, i) => (
                      <div key={i} className="rounded-2xl border border-black/5 bg-white p-4">
                        <div className="flex items-center justify-between gap-3">
                          <div className="text-sm font-medium">{item.task}</div>
                          <span className="rounded-full bg-black px-2 py-1 text-xs font-semibold text-white">
                            Hard to automate
                          </span>
                        </div>
                        <div className="mt-2 text-sm text-neutral-700">{item.reason}</div>
                      </div>
                    ))}
                  </div>

                  {(report.resilience_factors || []).length ? (
                    <div className="mt-4 rounded-2xl border border-black/5 bg-neutral-50 p-4">
                      <div className="text-xs font-semibold text-neutral-800">
                        Resilience factors detected
                      </div>
                      <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-neutral-700">
                        {report.resilience_factors.map((x, i) => (
                          <li key={i}>{x}</li>
                        ))}
                      </ul>
                    </div>
                  ) : null}
                </div>
              </div>

              {/* Recommendations + Assumptions */}
              <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-2">
                <div className="rounded-2xl border border-black/5 bg-white p-4">
                  <div className="text-sm font-semibold">What to do next</div>
                  <ul className="mt-3 list-disc space-y-2 pl-5 text-sm text-neutral-800">
                    {(report.recommendations || []).map((x, i) => (
                      <li key={i}>{x}</li>
                    ))}
                  </ul>
                </div>

                <div className="rounded-2xl border border-black/5 bg-white p-4">
                  <div className="text-sm font-semibold">Assumptions</div>
                  <ul className="mt-3 list-disc space-y-2 pl-5 text-sm text-neutral-800">
                    {(report.assumptions || []).map((x, i) => (
                      <li key={i}>{x}</li>
                    ))}
                  </ul>
                </div>
              </div>
            </>
          )}
        </section>
      </main>
    </div>
  );
}
