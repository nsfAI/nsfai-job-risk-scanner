"use client";

import { useMemo, useState } from "react";

export default function Home() {
  const tasks = useMemo(
    () => [
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
    ],
    []
  );

  const [jobTitle, setJobTitle] = useState("");
  const [industry, setIndustry] = useState("");
  const [seniority, setSeniority] = useState("");
  const [jobDesc, setJobDesc] = useState("");
  const [selectedTasks, setSelectedTasks] = useState([]);
  const [loading, setLoading] = useState(false);
  const [report, setReport] = useState(null);
  const [error, setError] = useState("");

  const toggleTask = (t) => {
    setSelectedTasks((prev) =>
      prev.includes(t) ? prev.filter((x) => x !== t) : [...prev, t]
    );
  };

  const canGenerate =
    jobDesc.trim().length > 0 &&
    selectedTasks.length >= 3 &&
    selectedTasks.length <= 8 &&
    !loading;

  const handleGenerate = async () => {
    setError("");
    setLoading(true);
    setReport(null);

    try {
      const res = await fetch("/api/report", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          jobTitle,
          industry,
          seniority,
          jobDesc,
          tasks: selectedTasks,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data?.error || "Failed to generate report");
      }

      setReport(data);
      document.getElementById("report")?.scrollIntoView({ behavior: "smooth" });
    } catch (e) {
      setError(e?.message || "Something went wrong");
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="min-h-screen bg-red-600 text-white p-10">
      {/* Top bar */}
      <header className="border-b bg-white">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-4">
          <div>
            <h1 className="text-xl font-semibold tracking-tight">NSFAI</h1>
            <p className="text-sm text-zinc-500">
              AI displacement risk for a role — based on tasks, not titles.
            </p>
          </div>

          <div className="flex gap-2">
            <a
              href="#report"
              className="rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm hover:bg-zinc-50"
            >
              Jump to report
            </a>
            <button
              type="button"
              className="rounded-lg bg-zinc-900 px-3 py-2 text-sm text-white hover:bg-zinc-800"
              onClick={() => window.location.reload()}
            >
              Reset
            </button>
          </div>
        </div>
      </header>

      {/* Content */}
      <div className="mx-auto grid max-w-5xl gap-6 px-4 py-8 md:grid-cols-5">
        {/* Form card */}
        <section className="md:col-span-3">
          <div className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm">
            <h2 className="text-base font-semibold">Role inputs</h2>
            <p className="mt-1 text-sm text-zinc-500">
              Add a title if you want, but the task selection matters most.
            </p>

            <div className="mt-5 grid gap-4">
              {/* Job Title */}
              <div>
                <label className="text-sm font-medium">Job title (optional)</label>
                <input
                  className="mt-1 w-full rounded-xl border border-zinc-200 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-zinc-900/10"
                  placeholder="e.g., Investment Banker"
                  value={jobTitle}
                  onChange={(e) => setJobTitle(e.target.value)}
                />
              </div>

              {/* Industry + Seniority */}
              <div className="grid gap-4 md:grid-cols-2">
                <div>
                  <label className="text-sm font-medium">Industry</label>
                  <select
                    className="mt-1 w-full rounded-xl border border-zinc-200 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-zinc-900/10"
                    value={industry}
                    onChange={(e) => setIndustry(e.target.value)}
                  >
                    <option value="">Select…</option>
                    <option value="Finance">Finance</option>
                    <option value="Healthcare">Healthcare</option>
                    <option value="Tech">Tech</option>
                    <option value="Education">Education</option>
                    <option value="Operations">Operations</option>
                    <option value="Other">Other</option>
                  </select>
                </div>

                <div>
                  <label className="text-sm font-medium">Seniority</label>
                  <select
                    className="mt-1 w-full rounded-xl border border-zinc-200 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-zinc-900/10"
                    value={seniority}
                    onChange={(e) => setSeniority(e.target.value)}
                  >
                    <option value="">Select…</option>
                    <option value="Entry">Entry</option>
                    <option value="Mid">Mid</option>
                    <option value="Senior">Senior</option>
                    <option value="Manager">Manager</option>
                    <option value="Executive">Executive</option>
                  </select>
                </div>
              </div>

              {/* Job description */}
              <div>
                <div className="flex items-end justify-between">
                  <label className="text-sm font-medium">
                    Job description (required)
                  </label>
                  <span className="text-xs text-zinc-500">{jobDesc.length} chars</span>
                </div>

                <textarea
                  className="mt-1 min-h-[140px] w-full rounded-xl border border-zinc-200 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-zinc-900/10"
                  placeholder="Paste the full job description here…"
                  value={jobDesc}
                  onChange={(e) => setJobDesc(e.target.value)}
                />
              </div>
            </div>
          </div>
        </section>

        {/* Tasks + action */}
        <aside className="md:col-span-2">
          <div className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm">
            <h2 className="text-base font-semibold">Tasks you actually do</h2>
            <p className="mt-1 text-sm text-zinc-500">
              Pick 3–8 weekly tasks.
            </p>

            <div className="mt-4 flex flex-wrap gap-2">
              {tasks.map((t) => (
                <label
                  key={t}
                  className={`cursor-pointer rounded-full border px-3 py-2 text-xs hover:bg-zinc-50 ${
                    selectedTasks.includes(t)
                      ? "border-zinc-900 bg-zinc-900 text-white"
                      : "border-zinc-200 bg-white text-zinc-900"
                  }`}
                >
                  <input
                    type="checkbox"
                    className="mr-2 align-middle"
                    checked={selectedTasks.includes(t)}
                    onChange={() => toggleTask(t)}
                  />
                  {t}
                </label>
              ))}
            </div>

            <div className="mt-4 text-xs text-zinc-500">
              Selected: {selectedTasks.length} / 8
            </div>

            <button
              className="mt-5 w-full rounded-xl bg-zinc-900 px-4 py-3 text-sm font-medium text-white hover:bg-zinc-800 disabled:opacity-50"
              disabled={!canGenerate}
              onClick={handleGenerate}
            >
              {loading ? "Generating..." : "Generate NSFAI Report"}
            </button>

            <p className="mt-3 text-xs text-zinc-500">
              Tip: if you hit a rate limit, wait ~30–60 seconds and try again.
            </p>
          </div>
        </aside>

        {/* Report */}
        <section id="report" className="md:col-span-5">
          <div className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm">
            <h2 className="text-base font-semibold">Report</h2>
            <p className="mt-1 text-sm text-zinc-500">
              Your report will show up here after you generate one.
            </p>

            {error && (
              <div className="mt-4 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
                {error}
              </div>
            )}

            {report ? (
              <pre className="mt-4 whitespace-pre-wrap rounded-xl border border-zinc-200 bg-zinc-50 p-4 text-sm text-zinc-800">
                {JSON.stringify(report, null, 2)}
              </pre>
            ) : (
              <div className="mt-4 rounded-xl border border-dashed border-zinc-200 p-6 text-sm text-zinc-500">
                No report yet.
              </div>
            )}
          </div>
        </section>
      </div>
    </main>
  );
}
