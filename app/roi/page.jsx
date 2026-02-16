"use client";

import { useMemo, useState } from "react";

function cx(...classes) {
  return classes.filter(Boolean).join(" ");
}

function fmtMoney(n) {
  const x = Number(n || 0);
  return x.toLocaleString(undefined, { maximumFractionDigits: 0 });
}

function fmtPct(n) {
  if (n === null || n === undefined) return "—";
  return `${Number(n).toFixed(2)}%`;
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
    <span className={cx("inline-flex items-center rounded-full border px-3 py-1 text-xs font-semibold", toneCls)}>
      {children}
    </span>
  );
}

function Sparkline({ values = [] }) {
  const w = 520;
  const h = 120;
  const pad = 10;

  const path = useMemo(() => {
    if (!values.length) return "";
    const minY = Math.min(...values);
    const maxY = Math.max(...values);
    const span = Math.max(1, maxY - minY);

    const toX = (i) => pad + (i * (w - pad * 2)) / Math.max(1, values.length - 1);
    const toY = (y) => h - pad - ((y - minY) * (h - pad * 2)) / span;

    return values.map((y, i) => `${i === 0 ? "M" : "L"} ${toX(i).toFixed(2)} ${toY(y).toFixed(2)}`).join(" ");
  }, [values]);

  return (
    <div className="w-full overflow-hidden rounded-2xl border border-black/5 bg-white">
      <svg viewBox={`0 0 ${w} ${h}`} className="w-full h-[120px]">
        <path d={path} fill="none" stroke="currentColor" strokeWidth="2.5" className="text-black/80" />
      </svg>
    </div>
  );
}

function labelTone(label) {
  if (!label) return "neutral";
  if (label.includes("Strong")) return "good";
  if (label.includes("Fragile")) return "warn";
  if (label.includes("mispriced")) return "bad";
  return "neutral";
}

export default function ROIPage() {
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState("");
  const [result, setResult] = useState(null);

  const [scenario, setScenario] = useState("base");

  // Inputs (good defaults)
  const [inputs, setInputs] = useState({
    yearsInSchool: 4,
    tuitionPerYear: 28000,
    livingPerYear: 20000,
    scholarshipPerYear: 2000,

    debtPrincipal: 60000,
    debtAPR: 0.065,
    repayYears: 10,

    startSalary: 72000,
    salaryGrowth: 0.045,

    taxRate: 0.24,
    livingAfterGrad: 36000,

    discountRate: 0.07,
    yearsCareer: 30,

    aiExposure10: 6, // tie to NSFAI score (0..10)
  });

  function setField(k, v) {
    setInputs((p) => ({ ...p, [k]: v }));
  }

  async function run() {
    setLoading(true);
    setErr("");
    setResult(null);
    try {
      const res = await fetch("/api/roi", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(inputs),
      });
      const json = await res.json();
      if (!res.ok || !json?.ok) throw new Error(json?.error || `Request failed (${res.status})`);
      setResult(json.result);
    } catch (e) {
      setErr(e?.message || "Failed");
    } finally {
      setLoading(false);
    }
  }

  const picked = useMemo(() => {
    if (!result?.scenarios?.length) return null;
    return result.scenarios.find((s) => s.scenario === scenario) || result.scenarios[0];
  }, [result, scenario]);

  const netSeries = useMemo(() => {
    if (!picked?.timeline?.length) return [];
    // sparkline of net cashflow only career years
    return picked.timeline.filter((x) => x.phase === "career").map((x) => x.netCashflow);
  }, [picked]);

  return (
    <div className="min-h-screen bg-[radial-gradient(ellipse_at_top,rgba(0,0,0,0.06),transparent_60%)]">
      {/* Top bar */}
      <div className="sticky top-0 z-50 border-b border-black/5 bg-white/70 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3">
          <div className="flex items-center gap-3">
            <div className="h-9 w-9 rounded-full bg-black text-white grid place-items-center font-semibold">R</div>
            <div className="leading-tight">
              <div className="text-sm font-semibold tracking-tight">Human Capital Model</div>
              <div className="text-xs text-neutral-500">Tuition vs earnings trajectory — compression-adjusted.</div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <a
              href="/"
              className="rounded-xl border border-black/10 bg-white px-3 py-2 text-sm shadow-sm hover:bg-neutral-50"
            >
              ← NSFAI Scanner
            </a>
            <a
              href="/compression"
              className="rounded-xl border border-black/10 bg-white px-3 py-2 text-sm shadow-sm hover:bg-neutral-50"
            >
              Compression Index
            </a>
            <button
              onClick={run}
              className="rounded-xl bg-black px-3 py-2 text-sm font-semibold text-white shadow-sm hover:bg-black/90"
              disabled={loading}
            >
              {loading ? "Running…" : "Run Model"}
            </button>
          </div>
        </div>
      </div>

      <main className="mx-auto max-w-6xl px-4 py-10">
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          {/* Inputs */}
          <section className="rounded-2xl border border-black/5 bg-white p-6 shadow-[0_1px_0_rgba(0,0,0,0.04),0_10px_30px_rgba(0,0,0,0.06)]">
            <div>
              <div className="text-sm font-semibold">Inputs</div>
              <div className="mt-1 text-sm text-neutral-500">
                This models education as a capital allocation decision under AI compression.
              </div>
            </div>

            <div className="mt-6 grid grid-cols-1 gap-4 md:grid-cols-2">
              <Field label="Years in school" value={inputs.yearsInSchool} onChange={(v) => setField("yearsInSchool", Number(v))} />
              <Field label="Career horizon (years)" value={inputs.yearsCareer} onChange={(v) => setField("yearsCareer", Number(v))} />

              <MoneyField label="Tuition per year" value={inputs.tuitionPerYear} onChange={(v) => setField("tuitionPerYear", Number(v))} />
              <MoneyField label="Living per year (school)" value={inputs.livingPerYear} onChange={(v) => setField("livingPerYear", Number(v))} />
              <MoneyField label="Scholarship per year" value={inputs.scholarshipPerYear} onChange={(v) => setField("scholarshipPerYear", Number(v))} />

              <MoneyField label="Debt principal" value={inputs.debtPrincipal} onChange={(v) => setField("debtPrincipal", Number(v))} />
              <Field label="Debt APR (e.g., 0.065)" value={inputs.debtAPR} onChange={(v) => setField("debtAPR", Number(v))} />
              <Field label="Repay years" value={inputs.repayYears} onChange={(v) => setField("repayYears", Number(v))} />

              <MoneyField label="Starting salary" value={inputs.startSalary} onChange={(v) => setField("startSalary", Number(v))} />
              <Field label="Salary growth (e.g., 0.045)" value={inputs.salaryGrowth} onChange={(v) => setField("salaryGrowth", Number(v))} />

              <Field label="Tax rate (e.g., 0.24)" value={inputs.taxRate} onChange={(v) => setField("taxRate", Number(v))} />
              <MoneyField label="Living after grad (annual)" value={inputs.livingAfterGrad} onChange={(v) => setField("livingAfterGrad", Number(v))} />

              <Field label="Discount rate (e.g., 0.07)" value={inputs.discountRate} onChange={(v) => setField("discountRate", Number(v))} />
              <Field label="AI exposure (0–10)" value={inputs.aiExposure10} onChange={(v) => setField("aiExposure10", Number(v))} />
            </div>

            <div className="mt-5 rounded-2xl border border-black/5 bg-neutral-50 p-4 text-sm text-neutral-700">
              <b>Tip:</b> Use your NSFAI Scanner score as <b>AI exposure</b>. Higher score increases expected disruption probability,
              haircuts wage growth, and pulls plateau earlier.
            </div>

            {err ? (
              <div className="mt-4 rounded-2xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700">{err}</div>
            ) : null}
          </section>

          {/* Results */}
          <section className="rounded-2xl border border-black/5 bg-white p-6 shadow-[0_1px_0_rgba(0,0,0,0.04),0_10px_30px_rgba(0,0,0,0.06)]">
            <div className="flex items-start justify-between gap-3">
              <div>
                <div className="text-sm font-semibold">Outputs</div>
                <div className="mt-1 text-sm text-neutral-500">
                  3 scenarios: Bull / Base / Compression-adjusted.
                </div>
              </div>

              <div className="flex items-center gap-2">
                {["bull", "base", "compression"].map((s) => (
                  <button
                    key={s}
                    onClick={() => setScenario(s)}
                    className={cx(
                      "rounded-xl px-3 py-2 text-sm font-semibold border",
                      scenario === s ? "bg-black text-white border-black" : "bg-white text-black border-black/10 hover:bg-black/5"
                    )}
                    disabled={!result}
                  >
                    {s === "bull" ? "Bull" : s === "base" ? "Base" : "Compression"}
                  </button>
                ))}
              </div>
            </div>

            {!result ? (
              <div className="mt-6 rounded-2xl border border-dashed border-black/10 bg-neutral-50 p-6 text-sm text-neutral-500">
                Run the model to generate ROI outputs.
              </div>
            ) : (
              <>
                {/* Headline cards */}
                <div className="mt-6 grid grid-cols-1 gap-4 md:grid-cols-2">
                  <Card label="Education direct cost" value={`$${fmtMoney(result.edu.totalDirectCost)}`} sub="Tuition + living - scholarship" />
                  <Card label="Debt monthly payment" value={`$${fmtMoney(result.edu.debt.paymentMonthly)}`} sub={`APR ${(result.edu.debt.apr * 100).toFixed(2)}% · ${result.edu.debt.repayYears} yrs`} />
                  <Card label="NPV (discounted value)" value={`$${fmtMoney(picked?.npv)}`} sub={`Discount rate ${(result.methodology.discountRate * 100).toFixed(2)}%`} />
                  <Card label="Payback year" value={picked?.paybackYear ? `Year ${picked.paybackYear}` : "No payback"} sub="First year cumulative net ≥ 0" />
                </div>

                <div className="mt-4 rounded-2xl border border-black/5 bg-neutral-50 p-4 text-sm text-neutral-800 flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2">
                    <Pill tone={labelTone(picked?.label)}>{picked?.label}</Pill>
                    <span className="text-sm text-neutral-700">
                      IRR: {picked?.irrPct === null ? "—" : fmtPct(picked.irrPct)}
                    </span>
                  </div>
                  <div className="text-xs text-neutral-500">
                    Lifetime gross: <b>${fmtMoney(picked?.lifetimeGross)}</b> · Lifetime net (career): <b>${fmtMoney(picked?.lifetimeNet)}</b>
                  </div>
                </div>

                {/* Net cashflow sparkline */}
                <div className="mt-5">
                  <div className="text-xs font-semibold text-neutral-600 mb-2">Net cashflow trend (career years)</div>
                  <Sparkline values={netSeries.slice(0, 30)} />
                </div>

                {/* Methodology */}
                <div className="mt-5 rounded-2xl border border-black/5 bg-white p-4">
                  <div className="text-sm font-semibold">Methodology</div>
                  <ul className="mt-2 list-disc pl-5 text-sm text-neutral-700 space-y-1">
                    {(result.methodology.notes || []).map((x, i) => (
                      <li key={i}>{x}</li>
                    ))}
                  </ul>

                  <div className="mt-3 grid grid-cols-1 gap-3 md:grid-cols-2 text-sm">
                    <div className="rounded-2xl border border-black/5 bg-neutral-50 p-3">
                      <div className="text-xs font-semibold text-neutral-700">AI dampeners</div>
                      <div className="mt-2 text-xs text-neutral-700 space-y-1">
                        <div>Annual disruption prob: <b>{result.methodology.aiDampeners.annualDisruptionProb}%</b></div>
                        <div>Growth haircut: <b>{result.methodology.aiDampeners.growthHaircutPct}%</b></div>
                        <div>Plateau year: <b>{result.methodology.aiDampeners.plateauYear}</b></div>
                        <div>Plateau growth: <b>{result.methodology.aiDampeners.plateauGrowthPct}%</b></div>
                        <div>Early seat friction: <b>{result.methodology.aiDampeners.earlySeatFrictionPct}%</b></div>
                      </div>
                    </div>

                    <div className="rounded-2xl border border-black/5 bg-neutral-50 p-3">
                      <div className="text-xs font-semibold text-neutral-700">Assumptions</div>
                      <div className="mt-2 text-xs text-neutral-700 space-y-1">
                        <div>Tax rate: <b>{(result.methodology.taxRate * 100).toFixed(1)}%</b></div>
                        <div>Discount rate: <b>{(result.methodology.discountRate * 100).toFixed(2)}%</b></div>
                        <div>AI exposure: <b>{result.methodology.aiExposure10}/10</b></div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Timeline table */}
                <div className="mt-5 rounded-2xl border border-black/5 bg-white p-4">
                  <div className="text-sm font-semibold">Timeline (net cashflow)</div>
                  <div className="mt-3 overflow-x-auto">
                    <table className="min-w-[820px] w-full text-sm">
                      <thead className="text-xs text-neutral-500">
                        <tr className="border-b border-black/5">
                          <th className="py-2 text-left">Year</th>
                          <th className="py-2 text-left">Phase</th>
                          <th className="py-2 text-right">Gross</th>
                          <th className="py-2 text-right">After tax</th>
                          <th className="py-2 text-right">Debt</th>
                          <th className="py-2 text-right">Living</th>
                          <th className="py-2 text-right">Net</th>
                        </tr>
                      </thead>
                      <tbody>
                        {picked?.timeline?.slice(0, 40).map((r, i) => (
                          <tr key={i} className="border-b border-black/5">
                            <td className="py-2">{r.yearIndex}</td>
                            <td className="py-2">
                              <span className={cx("rounded-full px-2 py-1 text-xs border", r.phase === "school" ? "bg-zinc-50 border-black/10" : "bg-white border-black/10")}>
                                {r.phase}
                              </span>
                            </td>
                            <td className="py-2 text-right">${fmtMoney(r.grossIncome)}</td>
                            <td className="py-2 text-right">${fmtMoney(r.afterTaxIncome)}</td>
                            <td className="py-2 text-right">${fmtMoney(r.debtPayment)}</td>
                            <td className="py-2 text-right">${fmtMoney(r.livingCost)}</td>
                            <td className={cx("py-2 text-right font-semibold", r.netCashflow < 0 ? "text-rose-600" : "text-emerald-700")}>
                              ${fmtMoney(r.netCashflow)}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  <div className="mt-2 text-xs text-neutral-500">
                    Showing first 40 years (school + career). Adjust career horizon in inputs.
                  </div>
                </div>
              </>
            )}
          </section>
        </div>
      </main>
    </div>
  );
}

function Field({ label, value, onChange }) {
  return (
    <div>
      <label className="text-sm font-medium">{label}</label>
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="mt-2 w-full rounded-xl border border-black/10 bg-white px-4 py-3 text-sm outline-none focus:border-black/20 focus:shadow-[0_0_0_3px_rgba(0,0,0,0.06)]"
      />
    </div>
  );
}

function MoneyField({ label, value, onChange }) {
  return (
    <div>
      <label className="text-sm font-medium">{label}</label>
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="mt-2 w-full rounded-xl border border-black/10 bg-white px-4 py-3 text-sm outline-none focus:border-black/20 focus:shadow-[0_0_0_3px_rgba(0,0,0,0.06)]"
      />
      <div className="mt-1 text-xs text-neutral-500">USD annual unless noted.</div>
    </div>
  );
}

function Card({ label, value, sub }) {
  return (
    <div className="rounded-2xl border border-black/5 bg-white p-4">
      <div className="text-xs text-neutral-500">{label}</div>
      <div className="mt-2 text-2xl font-semibold tracking-tight">{value}</div>
      <div className="mt-1 text-xs text-neutral-500">{sub}</div>
    </div>
  );
}
