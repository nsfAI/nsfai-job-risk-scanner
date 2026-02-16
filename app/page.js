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
  "Building software / automation / scripting"
];

function Card({ title, children }) {
  return (
    <div style={{ padding: 14, border: "1px solid #eee", borderRadius: 14 }}>
      <div style={{ fontWeight: 900, marginBottom: 8 }}>{title}</div>
      {children}
    </div>
  );
}

function KV({ label, value }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", padding: "6px 0", borderBottom: "1px solid #f0f0f0" }}>
      <div>{label}</div>
      <div style={{ fontWeight: 900 }}>{value}</div>
    </div>
  );
}

export default function Home() {
  const [title, setTitle] = useState("");
  const [industry, setIndustry] = useState("General");
  const [seniority, setSeniority] = useState("Entry / New Grad");
  const [jd, setJd] = useState("");
  const [selected, setSelected] = useState(() => new Set());
  const [loading, setLoading] = useState(false);
  const [out, setOut] = useState(null);
  const [err, setErr] = useState("");

  const canRun = useMemo(() => jd.trim().length >= 300 && selected.size >= 3, [jd, selected]);

  function toggle(task) {
    setSelected(prev => {
      const next = new Set(prev);
      next.has(task) ? next.delete(task) : next.add(task);
      return next;
    });
  }

  async function analyze() {
    setErr("");
    setOut(null);

    if (!canRun) {
      setErr("Paste a job description (300+ chars) and select at least 3 tasks you actually do.");
      return;
    }

    setLoading(true);
    try {
      const res = await fetch("/api/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title,
          industry,
          seniority,
          job_description: jd,
          tasks: Array.from(selected)
        })
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || "Analysis failed.");
      setOut(data);
    } catch (e) {
      setErr(e?.message || "Something went wrong.");
    } finally {
      setLoading(false);
    }
  }

  const badgeColor =
    out?.overall_band === "Low Risk" ? "#0a7a2f" :
    out?.overall_band === "Medium Risk" ? "#8a6a00" :
    out?.overall_band === "High Risk" ? "#9b1c1c" : "#333";

  return (
    <main style={{ maxWidth: 1100, margin: "0 auto", padding: 24, fontFamily: "system-ui, -apple-system, Segoe UI, Roboto, Arial" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 12, flexWrap: "wrap" }}>
        <h1 style={{ margin: 0 }}>NSFAI — Not Safe From AI</h1>
        <div style={{ color: "#666" }}>AI displacement risk for any role</div>
      </div>

      <div style={{ marginTop: 16, padding: 16, border: "1px solid #eee", borderRadius: 14 }}>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12 }}>
          <div>
            <div style={{ fontWeight: 800, marginBottom: 6 }}>Job title (optional)</div>
            <input
              value={title}
              onChange={e => setTitle(e.target.value)}
              placeholder="e.g., Financial Analyst"
              style={{ width: "100%", padding: 10, borderRadius: 12, border: "1px solid #ddd" }}
            />
          </div>

          <div>
            <div style={{ fontWeight: 800, marginBottom: 6 }}>Industry</div>
            <select
              value={industry}
              onChange={e => setIndustry(e.target.value)}
              style={{ width: "100%", padding: 10, borderRadius: 12, border: "1px solid #ddd" }}
            >
              {["General","Finance","Healthcare","Education","Law","Construction","Retail","Tech","Manufacturing","Government","Media / Marketing"].map(x => (
                <option key={x}>{x}</option>
              ))}
            </select>
          </div>

          <div>
            <div style={{ fontWeight: 800, marginBottom: 6 }}>Seniority</div>
            <select
              value={seniority}
              onChange={e => setSeniority(e.target.value)}
              style={{ width: "100%", padding: 10, borderRadius: 12, border: "1px solid #ddd" }}
            >
              {["Entry / New Grad","Mid-level","Senior / Lead","Manager","Executive"].map(x => (
                <option key={x}>{x}</option>
              ))}
            </select>
          </div>
        </div>

        <div style={{ height: 12 }} />

        <div style={{ fontWeight: 800, marginBottom: 6 }}>Paste job description (required)</div>
        <textarea
          value={jd}
          onChange={e => setJd(e.target.value)}
          rows={10}
          placeholder="Paste the job description or your day-to-day responsibilities."
          style={{ width: "100%", padding: 12, borderRadius: 12, border: "1px solid #ddd", resize: "vertical" }}
        />

        <div style={{ height: 14 }} />

        <div style={{ fontWeight: 800, marginBottom: 6 }}>
          Tasks you actually do (pick 3–8) — selected: {selected.size}
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
          {TASKS.map(t => (
            <label key={t} style={{ display: "flex", gap: 10, alignItems: "center", padding: 10, border: "1px solid #eee", borderRadius: 12 }}>
              <input type="checkbox" checked={selected.has(t)} onChange={() => toggle(t)} />
              <span>{t}</span>
            </label>
          ))}
        </div>

        <div style={{ height: 14 }} />

        <button
          onClick={analyze}
          disabled={loading}
          style={{
            padding: "12px 16px",
            borderRadius: 12,
            border: "1px solid #111",
            background: loading ? "#f3f3f3" : "#111",
            color: loading ? "#333" : "#fff",
            fontWeight: 900,
            cursor: loading ? "not-allowed" : "pointer"
          }}
        >
          {loading ? "Analyzing…" : "Generate NSFAI Report"}
        </button>

        {err ? <div style={{ marginTop: 12, color: "#9b1c1c", fontWeight: 800 }}>{err}</div> : null}
      </div>

      {out ? (
        <div style={{ marginTop: 18, padding: 16, border: "1px solid #eee", borderRadius: 14 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
            <div style={{ fontSize: 18, fontWeight: 900 }}>Result</div>
            <div style={{ padding: "6px 10px", borderRadius: 999, background: badgeColor, color: "white", fontWeight: 900 }}>
              {out.overall_band}
            </div>
            <div style={{ color: "#666" }}>
              Safety score: <b>{out.safety_score}/100</b> • Time horizon: <b>{out.time_horizon}</b>
            </div>
          </div>

          <p style={{ marginTop: 10, lineHeight: 1.6 }}>{out.executive_summary}</p>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
            <Card title="Score Breakdown">
              <KV label="Automation exposure %" value={out.breakdown.automation_exposure_pct} />
              <KV label="Augmentation potential %" value={out.breakdown.augmentation_potential_pct} />
              <KV label="Human moat %" value={out.breakdown.human_moat_pct} />
              <KV label="Accountability shield %" value={out.breakdown.accountability_shield_pct} />
              <KV label="Toolchain replaceability %" value={out.breakdown.toolchain_replaceability_pct} />
              <KV label="Adoption speed factor" value={out.breakdown.adoption_speed_factor} />
            </Card>

            <Card title="Evidence Snippets (from your JD)">
              <ul style={{ margin: 0, paddingLeft: 18, lineHeight: 1.6 }}>
                {(out.evidence_snippets || []).map((x, i) => <li key={i}>{x}</li>)}
              </ul>
            </Card>

            <Card title="Most at-risk tasks">
              <ul style={{ margin: 0, paddingLeft: 18, lineHeight: 1.6 }}>
                {(out.at_risk_tasks || []).map((x, i) => <li key={i}>{x}</li>)}
              </ul>
            </Card>

            <Card title="Most defensible tasks">
              <ul style={{ margin: 0, paddingLeft: 18, lineHeight: 1.6 }}>
                {(out.defensible_tasks || []).map((x, i) => <li key={i}>{x}</li>)}
              </ul>
            </Card>
          </div>

          <div style={{ marginTop: 12, color: "#777", fontSize: 12, lineHeight: 1.5 }}>
            This is a probabilistic forecast based on task bundles + likely AI adoption patterns. It’s not a guarantee.
          </div>
        </div>
      ) : null}
    </main>
  );
}
