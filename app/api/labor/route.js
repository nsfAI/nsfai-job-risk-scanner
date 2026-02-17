// app/api/labor/route.js
// Pulls (1) BLS unemployment rate (monthly) and (2) layoff headlines (multi-source, daily-ish)

export const dynamic = "force-dynamic";

function safeText(s) {
  return String(s ?? "").replace(/\s+/g, " ").trim();
}

function parseDate(d) {
  const t = Date.parse(d || "");
  return Number.isFinite(t) ? t : 0;
}

function normalizeTitle(t) {
  return safeText(t)
    .toLowerCase()
    .replace(/\b(inc|llc|ltd|corp|corporation|company)\b/g, "")
    .replace(/[^a-z0-9\s]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function addCacheBust(url) {
  const u = new URL(url);
  u.searchParams.set("_cb", String(Date.now()));
  return u.toString();
}

// -------------------- BLS: U-3 Unemployment Rate (LNS14000000) --------------------
async function fetchUnemploymentRate() {
  const now = new Date();
  const endYear = now.getFullYear();
  const startYear = endYear - 1;

  const res = await fetch("https://api.bls.gov/publicAPI/v2/timeseries/data/", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      seriesid: ["LNS14000000"],
      startyear: String(startYear),
      endyear: String(endYear),
    }),
    // BLS is stable monthly — caching is fine
    cache: "force-cache",
  });

  if (!res.ok) throw new Error(`BLS fetch failed: ${res.status}`);

  const json = await res.json();
  const series = json?.Results?.series?.[0];
  const data = series?.data || [];

  const latest = data[0];
  if (!latest) throw new Error("BLS returned no data");

  return {
    value: Number(latest.value), // percent
    label: `${latest.periodName} ${latest.year}`,
    seriesId: "LNS14000000",
  };
}

// -------------------- RSS parsing (simple + robust enough) --------------------
// Tries RSS (<item>) and Atom (<entry>) patterns.
function parseRssOrAtom(xml, { sourceLabel }) {
  const items = [];

  // RSS <item>
  const rssItems = [...xml.matchAll(/<item>([\s\S]*?)<\/item>/gi)].map((m) => m[1]);
  for (const block of rssItems) {
    const title =
      block.match(/<title><!\[CDATA\[([\s\S]*?)\]\]><\/title>/i)?.[1] ||
      block.match(/<title>([\s\S]*?)<\/title>/i)?.[1] ||
      "";
    const link =
      block.match(/<link>([\s\S]*?)<\/link>/i)?.[1] ||
      block.match(/<guid[^>]*>([\s\S]*?)<\/guid>/i)?.[1] ||
      "";
    const pubDate = block.match(/<pubDate>([\s\S]*?)<\/pubDate>/i)?.[1] || "";

    const t = safeText(title);
    const l = safeText(link);
    if (!t || !l) continue;

    const ts = parseDate(pubDate);

    items.push({
      title: t,
      link: l,
      pubDate: safeText(pubDate),
      ts,
      source: sourceLabel,
    });
  }

  // Atom <entry>
  if (!items.length) {
    const entries = [...xml.matchAll(/<entry>([\s\S]*?)<\/entry>/gi)].map((m) => m[1]);
    for (const block of entries) {
      const title =
        block.match(/<title[^>]*><!\[CDATA\[([\s\S]*?)\]\]><\/title>/i)?.[1] ||
        block.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1] ||
        "";
      const link =
        block.match(/<link[^>]+href="([^"]+)"/i)?.[1] ||
        block.match(/<id>([\s\S]*?)<\/id>/i)?.[1] ||
        "";
      const pubDate =
        block.match(/<updated>([\s\S]*?)<\/updated>/i)?.[1] ||
        block.match(/<published>([\s\S]*?)<\/published>/i)?.[1] ||
        "";

      const t = safeText(title);
      const l = safeText(link);
      if (!t || !l) continue;

      const ts = parseDate(pubDate);

      items.push({
        title: t,
        link: l,
        pubDate: safeText(pubDate),
        ts,
        source: sourceLabel,
      });
    }
  }

  return items;
}

async function fetchFeed(url, sourceLabel) {
  // cache-bust to avoid stale “stuck yesterday” behavior
  const busted = addCacheBust(url);

  const res = await fetch(busted, {
    cache: "no-store",
    headers: {
      "User-Agent": "nsfAI-labor-ticker/1.0 (+https://nsf-ai.com)",
      Accept: "application/rss+xml, application/atom+xml, text/xml, application/xml;q=0.9,*/*;q=0.8",
    },
  });

  if (!res.ok) throw new Error(`Feed failed ${res.status} for ${sourceLabel}`);

  const xml = await res.text();
  return parseRssOrAtom(xml, { sourceLabel });
}

// -------------------- Layoff headlines (multi-source) --------------------
async function fetchLayoffHeadlines() {
  // Keep mostly RSS/Atom to avoid scraping bans.
  // Google News is used as a “flood” aggregator; add topical queries for volume.
  const FEEDS = [
    { label: "Layoffs.fyi", url: "https://layoffs.fyi/feed/" },

    // Google News — recency filters via when:Xd
    {
      label: "Google News",
      url: "https://news.google.com/rss/search?q=layoffs+OR+%22job+cuts%22+OR+%22laid+off%22+when:7d&hl=en-US&gl=US&ceid=US:en",
    },
    {
      label: "Google News (Tech)",
      url: "https://news.google.com/rss/search?q=tech+layoffs+OR+startup+layoffs+OR+%22company+cuts%22+when:14d&hl=en-US&gl=US&ceid=US:en",
    },
    {
      label: "Google News (Finance)",
      url: "https://news.google.com/rss/search?q=bank+layoffs+OR+finance+job+cuts+OR+wall+street+layoffs+when:14d&hl=en-US&gl=US&ceid=US:en",
    },
    {
      label: "Google News (Retail)",
      url: "https://news.google.com/rss/search?q=retail+layoffs+OR+store+closures+job+cuts+when:14d&hl=en-US&gl=US&ceid=US:en",
    },

    // “Curated” outlets via Google query (keeps it RSS-based but higher signal)
    {
      label: "Google (TechCrunch)",
      url: "https://news.google.com/rss/search?q=site:techcrunch.com+layoffs+when:30d&hl=en-US&gl=US&ceid=US:en",
    },
    {
      label: "Google (Business Insider)",
      url: "https://news.google.com/rss/search?q=site:businessinsider.com+layoffs+when:30d&hl=en-US&gl=US&ceid=US:en",
    },
    {
      label: "Google (CNBC)",
      url: "https://news.google.com/rss/search?q=site:cnbc.com+layoffs+when:30d&hl=en-US&gl=US&ceid=US:en",
    },
  ];

  const results = await Promise.allSettled(FEEDS.map((f) => fetchFeed(f.url, f.label)));

  let merged = [];
  for (const r of results) {
    if (r.status === "fulfilled") merged = merged.concat(r.value);
  }

  if (!merged.length) return { items: [] };

  // ---- Freshness filter ----
  // Drop ancient items. You can tighten this to 14d if you want it *very* live.
  const MAX_AGE_DAYS = 30;
  const now = Date.now();
  const cutoff = now - MAX_AGE_DAYS * 24 * 60 * 60 * 1000;

  merged = merged.filter((it) => {
    // keep items with a real timestamp and within window
    // if ts is missing (0), we keep it but it will sort lower
    if (!it.ts) return true;
    return it.ts >= cutoff;
  });

  // ---- Dedupe strategy ----
  // 1) Dedupe by link first (best)
  // 2) Then by normalized title (helps remove repeats across sources)
  const seenLink = new Set();
  const seenTitle = new Set();
  const deduped = [];

  for (const it of merged) {
    const linkKey = safeText(it.link).split("#")[0];
    if (linkKey && seenLink.has(linkKey)) continue;

    const titleKey = normalizeTitle(it.title);
    // only title-dedupe if we already have link-dedupe failovers
    if (titleKey && seenTitle.has(titleKey)) continue;

    if (linkKey) seenLink.add(linkKey);
    if (titleKey) seenTitle.add(titleKey);

    deduped.push(it);
  }

  // Sort newest first; ts=0 goes to bottom
  deduped.sort((a, b) => (b.ts || 0) - (a.ts || 0));

  // Keep payload light
  const items = deduped.slice(0, 24).map(({ ts, ...rest }) => rest);

  return { items };
}

export async function GET() {
  try {
    const [unemployment, layoffs] = await Promise.all([
      fetchUnemploymentRate(),
      fetchLayoffHeadlines(),
    ]);

    return Response.json({
      ok: true,
      unemployment,
      layoffs,
      updatedAt: new Date().toISOString(),
    });
  } catch (err) {
    return Response.json(
      {
        ok: false,
        error: err?.message || "Unknown error",
        updatedAt: new Date().toISOString(),
      },
      { status: 200 }
    );
  }
}
