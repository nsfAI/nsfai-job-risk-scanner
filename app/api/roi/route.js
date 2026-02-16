export const runtime = "nodejs"; // keep node (not edge)

function clamp(n, a, b) {
  return Math.max(a, Math.min(b, n));
}

function round2(n) {
  return Math.round(n * 100) / 100;
}

function money(n) {
  if (!Number.isFinite(n)) return 0;
  return Math.round(n);
}

function pct(n) {
  if (!Number.isFinite(n)) return 0;
  return round2(n * 100);
}

/**
 * Convert NSFAI-like exposure score (0..10) into macro dampeners.
 * Higher score => more compression risk => slower growth, higher disruption probability, earlier plateau.
 */
function aiDampeners(aiExposure10) {
  const s = clamp(Number(aiExposure10 ?? 5), 0, 10);

  // Probability of "seat compression event" over a career horizon (modelled as annual hazard)
  // Not "job extinction", but higher chance of forced pivot / stagnation / gaps.
  const annualDisruptionProb = clamp(0.01 + 0.018 * (s / 10), 0.01, 0.04); // 1% to 4%

  // Wage growth haircut
  const growthHaircut = clamp(0.00 + 0.35 * (s / 10), 0.0, 0.35); // up to 35% haircut on growth

  // Plateau effect: high exposure tends to plateau earlier
  const plateauYear = Math.round(12 - 6 * (s / 10)); // 12 yrs -> 6 yrs (earlier plateau)
  const plateauGrowth = clamp(0.015 - 0.01 * (s / 10), 0.003, 0.015); // 1.5% down to 0.3%

  // Chance that entry-level ladder is thinner (affects early earnings)
  const earlySeatFriction = clamp(0.02 + 0.08 * (s / 10), 0.02, 0.10); // 2% to 10% friction haircut in first years

  return { s, annualDisruptionProb, growthHaircut, plateauYear, plateauGrowth, earlySeatFriction };
}

/**
 * Build earnings trajectory with:
 * - starting salary
 * - growth rate, reduced by AI haircut
 * - plateau after plateauYear
 * - annual disruption probability producing expected earnings haircut
 * - early seat friction in first 3 years
 */
function projectEarnings({
  years = 30,
  startSalary,
  baseGrowth,
  aiExposure10,
  scenario = "base", // "bull" | "base" | "compression"
}) {
  const { annualDisruptionProb, growthHaircut, plateauYear, plateauGrowth, earlySeatFriction } =
    aiDampeners(aiExposure10);

  // scenario multipliers
  const scen = scenario === "bull"
    ? { growthBoost: 0.35, disruptionMult: 0.75, earlyFrictionMult: 0.7 }
    : scenario === "compression"
    ? { growthBoost: -0.25, disruptionMult: 1.35, earlyFrictionMult: 1.25 }
    : { growthBoost: 0.0, disruptionMult: 1.0, earlyFrictionMult: 1.0 };

  let salary = Math.max(0, Number(startSalary || 0));
  let g = clamp(Number(baseGrowth || 0.03), 0, 0.2);

  // apply AI haircut + scenario boost
  const effectiveGrowthPrePlateau = clamp(g * (1 - growthHaircut) * (1 + scen.growthBoost), -0.02, 0.18);
  const effectiveGrowthPostPlateau = clamp(plateauGrowth * (1 + scen.growthBoost * 0.4), 0.0, 0.08);

  const pDisrupt = clamp(annualDisruptionProb * scen.disruptionMult, 0.005, 0.08);

  const out = [];
  for (let y = 1; y <= years; y++) {
    const growth = y <= plateauYear ? effectiveGrowthPrePlateau : effectiveGrowthPostPlateau;

    // expected disruption penalty: assume disruption reduces that year's earnings by 18%
    const expectedDisruptionPenalty = pDisrupt * 0.18;

    // early seat friction haircut first 3 yrs (e.g., harder entry, fewer seats, slower ramp)
    const friction = y <= 3 ? (earlySeatFriction * scen.earlyFrictionMult) : 0;

    // Apply growth first (compounding)
    salary = salary * (1 + growth);

    // Apply expected penalties
    const expectedSalary = salary * (1 - expectedDisruptionPenalty) * (1 - friction);

    out.push({
      year: y,
      grossIncome: expectedSalary,
      growthApplied: growth,
      disruptionProb: pDisrupt,
      expectedDisruptionPenalty,
      earlyFriction: friction,
    });
  }
  return out;
}

/**
 * Debt + education cost model
 */
function educationCostModel({
  yearsInSchool,
  tuitionPerYear,
  livingPerYear,
  scholarshipPerYear,
  debtPrincipal,
  debtAPR,
  repayYears,
}) {
  const Y = clamp(parseInt(yearsInSchool || 4, 10), 1, 10);
  const tuition = Math.max(0, Number(tuitionPerYear || 0));
  const living = Math.max(0, Number(livingPerYear || 0));
  const schol = Math.max(0, Number(scholarshipPerYear || 0));

  const totalDirectCost = Y * (tuition + living - schol);

  const principal = Math.max(0, Number(debtPrincipal || 0));
  const apr = clamp(Number(debtAPR || 0.06), 0, 0.25);
  const nYears = clamp(parseInt(repayYears || 10, 10), 1, 40);

  // Standard amortization monthly payment
  const r = apr / 12;
  const n = nYears * 12;
  const paymentMonthly = principal === 0
    ? 0
    : r === 0
    ? principal / n
    : (principal * r) / (1 - Math.pow(1 + r, -n));

  const paymentAnnual = paymentMonthly * 12;
  const totalPaid = paymentMonthly * n;
  const totalInterest = totalPaid - principal;

  return {
    yearsInSchool: Y,
    totalDirectCost,
    debt: {
      principal,
      apr,
      repayYears: nYears,
      paymentMonthly,
      paymentAnnual,
      totalPaid,
      totalInterest,
    },
  };
}

/**
 * NPV of a cashflow series with discount rate.
 */
function npv(cashflows, discountRate) {
  const r = clamp(Number(discountRate || 0.07), 0, 0.3);
  let v = 0;
  for (let t = 0; t < cashflows.length; t++) {
    v += cashflows[t] / Math.pow(1 + r, t + 1);
  }
  return v;
}

/**
 * Simple IRR estimation via binary search (annual).
 */
function irr(cashflows) {
  // If no sign change, IRR is undefined
  let hasPos = cashflows.some((c) => c > 0);
  let hasNeg = cashflows.some((c) => c < 0);
  if (!hasPos || !hasNeg) return null;

  let lo = -0.9;
  let hi = 1.5;
  for (let i = 0; i < 80; i++) {
    const mid = (lo + hi) / 2;
    const v = npv(cashflows, mid);
    if (v > 0) lo = mid;
    else hi = mid;
  }
  return (lo + hi) / 2;
}

/**
 * Full ROI model:
 * - During school: negative cashflows (costs)
 * - After: earnings - taxes - debt payment - living baseline
 * Provide both "raw gross" and "net cashflow" trajectories.
 */
function runModel(input) {
  const yearsCareer = clamp(parseInt(input.yearsCareer || 30, 10), 10, 45);

  const edu = educationCostModel({
    yearsInSchool: input.yearsInSchool,
    tuitionPerYear: input.tuitionPerYear,
    livingPerYear: input.livingPerYear,
    scholarshipPerYear: input.scholarshipPerYear,
    debtPrincipal: input.debtPrincipal,
    debtAPR: input.debtAPR,
    repayYears: input.repayYears,
  });

  const startSalary = Math.max(0, Number(input.startSalary || 70000));
  const baseGrowth = clamp(Number(input.salaryGrowth || 0.04), 0, 0.2);
  const aiExposure10 = clamp(Number(input.aiExposure10 ?? 5), 0, 10);

  const taxRate = clamp(Number(input.taxRate || 0.22), 0, 0.6);
  const livingAfterGrad = Math.max(0, Number(input.livingAfterGrad || 35000));

  // Scenarios
  const scenarios = ["bull", "base", "compression"].map((scenario) => {
    const earnings = projectEarnings({
      years: yearsCareer,
      startSalary,
      baseGrowth,
      aiExposure10,
      scenario,
    });

    // Build annual net cashflow series:
    // Year 1..eduYears are school years -> negative cost cashflows
    // Then career years -> net = gross*(1-tax) - debtPayment - living
    const cashflows = [];
    const detail = [];

    // School years cashflows
    for (let y = 1; y <= edu.yearsInSchool; y++) {
      const schoolCost = (Number(input.tuitionPerYear || 0) + Number(input.livingPerYear || 0) - Number(input.scholarshipPerYear || 0));
      const cf = -Math.max(0, schoolCost);
      cashflows.push(cf);
      detail.push({
        yearIndex: y,
        phase: "school",
        grossIncome: 0,
        netCashflow: cf,
        notes: "Education + living cost (net of scholarships)",
      });
    }

    // Career years cashflows
    for (let y = 1; y <= yearsCareer; y++) {
      const row = earnings[y - 1];
      const gross = row.grossIncome;
      const afterTax = gross * (1 - taxRate);

      // Pay debt only up to repayYears
      const payDebt = y <= edu.debt.repayYears ? edu.debt.paymentAnnual : 0;

      const net = afterTax - payDebt - livingAfterGrad;

      cashflows.push(net);
      detail.push({
        yearIndex: edu.yearsInSchool + y,
        phase: "career",
        grossIncome: gross,
        afterTaxIncome: afterTax,
        debtPayment: payDebt,
        livingCost: livingAfterGrad,
        netCashflow: net,
        growthApplied: row.growthApplied,
        disruptionProb: row.disruptionProb,
        earlyFriction: row.earlyFriction,
      });
    }

    // Payback period: first year cumulative net > 0 (starting from first school year)
    let cum = 0;
    let paybackYear = null;
    for (let i = 0; i < cashflows.length; i++) {
      cum += cashflows[i];
      if (cum >= 0 && paybackYear === null) {
        paybackYear = i + 1; // year index in overall timeline
      }
    }

    const discountRate = clamp(Number(input.discountRate || 0.07), 0, 0.25);
    const v = npv(cashflows, discountRate);
    const r = irr(cashflows);

    const lifetimeGross = earnings.reduce((a, b) => a + b.grossIncome, 0);
    const lifetimeNet = detail
      .filter((d) => d.phase === "career")
      .reduce((a, b) => a + (b.netCashflow || 0), 0);

    // Classification (simple but sharp)
    // We classify using NPV + payback + AI exposure
    let label = "Moderate return";
    if (v > 400000 && paybackYear && paybackYear <= edu.yearsInSchool + 7) label = "Strong return";
    if (v < 0 || (paybackYear && paybackYear > edu.yearsInSchool + 12)) label = "Fragile under compression";
    if (aiExposure10 >= 8 && v < 150000) label = "Structurally mispriced (high compression risk)";

    return {
      scenario,
      label,
      paybackYear,
      npv: v,
      irr: r,
      lifetimeGross,
      lifetimeNet,
      cashflows,
      timeline: detail,
    };
  });

  // Pick “base” as primary
  const base = scenarios.find((s) => s.scenario === "base");

  // Meta explanation for UI
  const damp = aiDampeners(aiExposure10);
  const methodology = {
    discountRate: clamp(Number(input.discountRate || 0.07), 0, 0.25),
    taxRate,
    aiExposure10,
    aiDampeners: {
      annualDisruptionProb: round2(damp.annualDisruptionProb),
      growthHaircutPct: pct(damp.growthHaircut),
      plateauYear: damp.plateauYear,
      plateauGrowthPct: pct(damp.plateauGrowth),
      earlySeatFrictionPct: pct(damp.earlySeatFriction),
    },
    notes: [
      "This models expected cashflows under task compression: slower wage growth, earlier plateau, and mild disruption probability.",
      "It is NOT a prediction of job extinction. It is a capital allocation lens under automation pressure.",
      "Change assumptions (tax rate, growth rate, living costs, discount rate) to match your reality.",
    ],
  };

  return { edu, scenarios, base, methodology };
}

export async function POST(req) {
  try {
    const body = await req.json().catch(() => ({}));

    const result = runModel(body);

    return Response.json(
      {
        ok: true,
        result: {
          edu: {
            yearsInSchool: result.edu.yearsInSchool,
            totalDirectCost: money(result.edu.totalDirectCost),
            debt: {
              principal: money(result.edu.debt.principal),
              apr: round2(result.edu.debt.apr),
              repayYears: result.edu.debt.repayYears,
              paymentMonthly: money(result.edu.debt.paymentMonthly),
              paymentAnnual: money(result.edu.debt.paymentAnnual),
              totalPaid: money(result.edu.debt.totalPaid),
              totalInterest: money(result.edu.debt.totalInterest),
            },
          },
          methodology: result.methodology,
          scenarios: result.scenarios.map((s) => ({
            scenario: s.scenario,
            label: s.label,
            paybackYear: s.paybackYear,
            npv: money(s.npv),
            irrPct: s.irr === null ? null : round2(s.irr * 100),
            lifetimeGross: money(s.lifetimeGross),
            lifetimeNet: money(s.lifetimeNet),
            // keep timeline for charts/UI
            timeline: s.timeline.map((t) => ({
              yearIndex: t.yearIndex,
              phase: t.phase,
              grossIncome: money(t.grossIncome || 0),
              afterTaxIncome: money(t.afterTaxIncome || 0),
              debtPayment: money(t.debtPayment || 0),
              livingCost: money(t.livingCost || 0),
              netCashflow: money(t.netCashflow || 0),
              disruptionProbPct: t.disruptionProb ? round2(t.disruptionProb * 100) : null,
              growthPct: t.growthApplied ? round2(t.growthApplied * 100) : null,
              earlyFrictionPct: t.earlyFriction ? round2(t.earlyFriction * 100) : null,
              notes: t.notes || null,
            })),
          })),
        },
      },
      { status: 200 }
    );
  } catch (e) {
    return Response.json({ ok: false, error: e?.message || "Unknown error" }, { status: 500 });
  }
}
