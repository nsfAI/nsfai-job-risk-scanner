"use client";

import { useEffect, useMemo, useState } from "react";

function cx(...classes) {
  return classes.filter(Boolean).join(" ");
}

export default function JobsPage() {
  const [query, setQuery] = useState("");
  const [scenario, setScenario] = useState("moderate");
  const [loading, setLoading] = useState(false);
  const [meta, setMeta] = useState({ total: 0 });
  const [results, setResults] = useState([]);

  async function runSearch(nextQ = query, nextScenario = scenario) {
    setLoading(true);
    try {
      const res = await fetch(
        `/api/jobs/search?q=${encodeURIComponent(nextQ)}&scenario=${encodeURIComponent(
          nextScenario
        )}&limit=25`,
        { cache: "no-store" }
      );

      const data = await res.json();

      setMeta({ total: data?.total ?? 0 });
      setResults(Array.isArray(data?.results) ? data.results : []);
    } catch {
      setMeta({ total: 0 });
      setResults([]);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    // initial load
    runSearch("", scenario);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const subtitle = useMemo(() => {
    if (loading) return "Searching…";
    return `Showing top ${results.length} of ${meta.total || 0} • Scenario: ${scenario}`;
  }, [loading, results.length, meta.total, scenario]);

  return (
    <div className="mx-auto max-w-5xl px-6 py-10">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">AI-Resilient Job Finder</h1>
          <p className="mt-1 text-sm text-black/60 dark:text-white/60">
            Search roles. Results are ranked by relevance × resilience signals. (V1 = seeded data + OpenSearch)
          </p>
        </div>

        <div className="flex items-center gap-2">
          <span className="text-xs text-black/60 dark:text-white/60">Scenario</span>
          <select
            value={scenario}
            onChange={(e) => {
              const next = e.target.value;
              setScenario(next);
              runSearch(query, next);
            }}
            className="rounded-xl border border-black/10 bg-white px-3 py-2 text-sm dark:border-white/20 dark:bg-[#141414]"
          >
            <option value="conservative">Conservative</option>
            <option value="moderate">Moderate</option>
            <option value="aggressive">Aggressive</option>
          </select>
        </div>
      </div>

      <div className="mt-8 flex gap-3">
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search jobs… (finance, nurse, teacher, engineer, etc.)"
          className="flex-1 rounded-xl border border-black/10 bg-white px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-black/10 dark:border-white/20 dark:bg-[#141414] dark:text-white"
          onKeyDown={(e) => {
            if (e.key === "Enter") runSearch();
          }}
        />
        <button
          onClick={() => runSearch()}
          className={cx(
            "rounded-xl px-6 py-3 text-sm font-semibold",
            "bg-black text-white hover:bg-black/90",
            "dark:bg-white dark:text-black dark:hover:bg-white/90"
          )}
        >
          {loading ? "…" : "Search"}
        </button>
      </div>

      <div className="mt-3 text-xs text-black/50 dark:text-white/50">{subtitle}</div>

      <div className="mt-8 space-y-4">
        {!loading && results.length === 0 && (
          <div className="rounded-2xl border border-black/10 bg-white p-6 text-sm text-black/70 dark:border-white/20 dark:bg-[#141414] dark:text-white/70">
            No results yet. Try broader terms (example: “finance” instead of “controller”) or clear the search and hit Search.
          </div>
        )}

        {results.map((r) => (
          <div
            key={r.id || `${r.title}-${r.company}-${r.location}`}
            className="rounded-2xl border border-black/10 bg-white p-6 dark:border-white/20 dark:bg-[#141414]"
          >
            <div className="flex items-start justify-between gap-4">
              <div>
                <div className="text-lg font-bold text-black dark:text-white">
                  {r.title || "Untitled role"}
                </div>
                <div className="mt-1 text-sm text-black/60 dark:text-white/60">
                  {(r.company || "Unknown company") + (r.location ? ` — ${r.location}` : "")}
                </div>

                <div className="mt-3 text-sm text-black/80 dark:text-white/80">
                  {r.resilience_reason || "Resilience signal pending."}
                </div>

                <a
                  href={`/jobs/${encodeURIComponent(r.id)}`}
                  className="mt-4 inline-flex text-sm font-semibold underline underline-offset-4"
                >
                  View details →
                </a>
              </div>

              <div className="text-right">
                <div className="text-xs text-black/50 dark:text-white/50">Resilience</div>
                <div className="text-2xl font-bold text-green-600">
                  {Number(r.resilience_score ?? 0)}
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
