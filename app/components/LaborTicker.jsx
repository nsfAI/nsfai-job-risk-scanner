// components/LaborTicker.jsx
"use client";

import { useEffect, useMemo, useState } from "react";

function cx(...classes) {
  return classes.filter(Boolean).join(" ");
}

export default function LaborTicker() {
  const [data, setData] = useState(null);

  useEffect(() => {
    let alive = true;

    async function load() {
      try {
        const res = await fetch("/api/labor", { cache: "no-store" });
        const json = await res.json();
        if (alive) setData(json);
      } catch {
        if (alive) setData({ ok: false });
      }
    }

    load();
    const id = setInterval(load, 1000 * 60 * 3); // refresh every 3 min
    return () => {
      alive = false;
      clearInterval(id);
    };
  }, []);

  const items = useMemo(() => {
    const out = [];

    if (data?.ok && data?.unemployment) {
      out.push({
        key: "bls",
        text: `Unemployment rate (${data.unemployment.label}) — ${data.unemployment.value.toFixed(1)}% (BLS)`,
        href: "https://www.bls.gov/cps/",
      });
    } else {
      out.push({
        key: "bls",
        text: `Unemployment rate — loading… (BLS)`,
        href: "https://www.bls.gov/cps/",
      });
    }

    // Layoffs (daily-ish proxy)
    if (data?.ok && data?.layoffs?.items?.length) {
      for (let i = 0; i < Math.min(6, data.layoffs.items.length); i++) {
        const it = data.layoffs.items[i];
        out.push({
          key: `layoffs-${i}`,
          text: `Layoff announcement — ${it.title} (Layoffs.fyi)`,
          href: it.link,
        });
      }
    } else {
      out.push({
        key: "layoffs",
        text: `Layoff announcements — loading… (Layoffs.fyi)`,
        href: "https://layoffs.fyi",
      });
    }

    return out;
  }, [data]);

  return (
    <div className="sticky top-0 z-50 border-b border-black/10 bg-white/80 backdrop-blur">
      <div className="mx-auto flex w-full max-w-6xl items-center gap-3 px-4 py-2">
        <div className="hidden shrink-0 rounded-full border border-black/10 bg-white px-3 py-1 text-xs font-semibold sm:block">
          Live labor tape
        </div>

        <div className="relative w-full overflow-hidden">
          <div className="ticker-mask pointer-events-none absolute inset-y-0 left-0 w-8 bg-gradient-to-r from-white to-transparent" />
          <div className="ticker-mask pointer-events-none absolute inset-y-0 right-0 w-8 bg-gradient-to-l from-white to-transparent" />

          <div className="ticker-track flex w-max items-center gap-8">
            {items.concat(items).map((it, idx) => (
              <a
                key={`${it.key}-${idx}`}
                href={it.href}
                target="_blank"
                rel="noreferrer"
                className={cx(
                  "whitespace-nowrap text-xs font-medium text-black/70 hover:text-black",
                  "transition-colors"
                )}
              >
                {it.text}
                <span className="ml-3 text-black/30">•</span>
              </a>
            ))}
          </div>
        </div>
      </div>

      <style jsx>{`
        .ticker-track {
          animation: ticker 38s linear infinite;
        }
        @keyframes ticker {
          0% {
            transform: translateX(0);
          }
          100% {
            transform: translateX(-50%);
          }
        }
      `}</style>
    </div>
  );
}
