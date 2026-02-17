"use client";

import { useEffect, useState } from "react";

export default function JobDetailPage({ params }) {
  const id = decodeURIComponent(params.id);
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let alive = true;

    async function load() {
      try {
        const res = await fetch(`/api/jobs/get?id=${encodeURIComponent(id)}`, {
          cache: "no-store",
        });
        const json = await res.json();
        if (alive) setData(json);
      } catch {
        if (alive) setData({ ok: false });
      } finally {
        if (alive) setLoading(false);
      }
    }

    load();
    return () => {
      alive = false;
    };
  }, [id]);

  if (loading) {
    return (
      <div className="mx-auto max-w-3xl px-6 py-10">
        <p className="text-sm text-black/60 dark:text-white/60">Loading…</p>
      </div>
    );
  }

  if (!data?.ok) {
    return (
      <div className="mx-auto max-w-3xl px-6 py-10">
        <h1 className="text-xl font-bold">Job not found</h1>
        <p className="mt-2 text-sm text-black/60 dark:text-white/60">
          That listing id doesn’t exist in your index yet.
        </p>
        <a href="/jobs" className="mt-6 inline-flex text-sm font-semibold underline underline-offset-4">
          Back to search →
        </a>
      </div>
    );
  }

  const job = data.job;

  return (
    <div className="mx-auto max-w-3xl px-6 py-10">
      <a href="/jobs" className="text-sm font-semibold underline underline-offset-4">
        ← Back to search
      </a>

      <div className="mt-6 rounded-2xl border border-black/10 bg-white p-6 dark:border-white/20 dark:bg-[#141414]">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-black dark:text-white">
              {job.title || "Untitled role"}
            </h1>
            <p className="mt-1 text-sm text-black/60 dark:text-white/60">
              {job.company || "Unknown company"}
              {job.location ? ` — ${job.location}` : ""}
            </p>
          </div>

          <div className="text-right">
            <div className="text-xs text-black/50 dark:text-white/50">Resilience</div>
            <div className="text-2xl font-bold text-green-600">
              {Number(job.resilience_score ?? 0)}
            </div>
          </div>
        </div>

        <div className="mt-4 text-sm text-black/80 dark:text-white/80">
          <div className="font-semibold">Why it ranked</div>
          <div className="mt-1">{job.resilience_reason || "—"}</div>
        </div>

        <div className="mt-4 text-sm text-black/70 dark:text-white/70">
          <div className="font-semibold">Description</div>
          <p className="mt-1 whitespace-pre-wrap">{job.description || "—"}</p>
        </div>
      </div>
    </div>
  );
}
