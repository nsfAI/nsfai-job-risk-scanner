// app/roi/benchmarks.js
// Notes on "accuracy":
// - Undergrad tuition is NOT "by major" in general — it's driven by school type + residency.
// - Majors primarily affect earnings curve + AI exposure assumptions.
// - Professional programs (MD/JD/MBA) are modeled as their own "school type" options.

function clamp(n, a, b) {
  return Math.max(a, Math.min(b, n));
}

function norm(s) {
  return String(s || "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

/**
 * MAJORS: earnings / growth / AI exposure assumptions.
 * These are "benchmarks" (not promises).
 * Users can still override everything via Advanced manual entry.
 */
export const MAJORS = [
  {
    key: "Accounting (BS)",
    startSalary: 65000,
    growth: 0.038,
    plateauYear: 18,
    plateauGrowth: 0.018,
    aiExposure: 6,
    notes:
      "Stable demand, but junior layers are compressible. Upside comes from advisory, FP&A, controls ownership, and domain depth.",
  },
  {
    key: "Finance (BS)",
    startSalary: 75000,
    growth: 0.040,
    plateauYear: 18,
    plateauGrowth: 0.018,
    aiExposure: 6,
    notes:
      "Output-per-head is rising fast. Winners move into judgment-heavy investing, client trust, or niche domain execution.",
  },
  {
    key: "Computer Science (BS)",
    startSalary: 95000,
    growth: 0.045,
    plateauYear: 16,
    plateauGrowth: 0.020,
    aiExposure: 7,
    notes:
      "High leverage field. Routine coding compresses; advantage shifts to architecture, product sense, reliability, and ownership.",
  },
  {
    key: "Data / Analytics (BS/MS)",
    startSalary: 90000,
    growth: 0.045,
    plateauYear: 16,
    plateauGrowth: 0.020,
    aiExposure: 7,
    notes:
      "The tooling improves weekly. Value shifts from dashboards to decision systems, experimentation, and causal thinking.",
  },
  {
    key: "Nursing (BSN)",
    startSalary: 82000,
    growth: 0.040,
    plateauYear: 20,
    plateauGrowth: 0.020,
    aiExposure: 3,
    notes:
      "Embodiment + liability create resistance. AI augments documentation/triage; core work stays physical and trust-heavy.",
  },
  {
    key: "Mechanical Engineering (BS)",
    startSalary: 78000,
    growth: 0.040,
    plateauYear: 18,
    plateauGrowth: 0.018,
    aiExposure: 5,
    notes:
      "Moderate automation. Value remains where constraints meet reality: manufacturing, safety, systems integration.",
  },
  {
    key: "Law (JD)",
    startSalary: 95000,
    growth: 0.035,
    plateauYear: 18,
    plateauGrowth: 0.015,
    aiExposure: 6,
    notes:
      "Research/drafting compresses, but liability + client trust protect higher-end work. Brand + practice area matter a lot.",
  },
  {
    key: "Medicine (MD)",
    startSalary: 240000,
    growth: 0.030,
    plateauYear: 22,
    plateauGrowth: 0.015,
    aiExposure: 2,
    notes:
      "High liability + embodiment = strong moat. AI accelerates admin/diagnostic assistance; reimbursement/regulation shape outcomes.",
  },
  {
    key: "MBA (General)",
    startSalary: 110000,
    growth: 0.035,
    plateauYear: 18,
    plateauGrowth: 0.018,
    aiExposure: 5,
    notes:
      "Depends on role. AI rewards operators who can scope problems, communicate decisions, and execute with leverage.",
  },
  {
    key: "Education (BA/BS)",
    startSalary: 52000,
    growth: 0.030,
    plateauYear: 20,
    plateauGrowth: 0.015,
    aiExposure: 3,
    notes:
      "AI augments lesson planning and admin; in-person trust and classroom management remain resistant.",
  },
  {
    key: "Psychology (BA/BS)",
    startSalary: 50000,
    growth: 0.030,
    plateauYear: 20,
    plateauGrowth: 0.015,
    aiExposure: 5,
    notes:
      "Undergrad alone is often low ROI unless paired with grad pathway. Human work persists; credential gates matter.",
  },
];

/**
 * CITIES: living costs + salary multipliers + rough tax rate.
 * These are coarse, but directionally useful.
 */
export const CITIES = [
  {
    key: "New York, NY",
    salaryMult: 1.15,
    livingSchool: 32000,
    livingAfter: 46000,
    taxRate: 0.30,
    notes:
      "High cost, high opportunity density. Taxes + rent bite hard; comp must clear the bar.",
  },
  {
    key: "San Francisco, CA",
    salaryMult: 1.25,
    livingSchool: 34000,
    livingAfter: 52000,
    taxRate: 0.32,
    notes:
      "Very high housing costs. Strong top-end comp upside; base roles can feel squeezed.",
  },
  {
    key: "Los Angeles, CA",
    salaryMult: 1.10,
    livingSchool: 28000,
    livingAfter: 42000,
    taxRate: 0.30,
    notes:
      "High cost with wide variance by neighborhood. Comp dispersion is large.",
  },
  {
    key: "Dallas, TX",
    salaryMult: 0.95,
    livingSchool: 22000,
    livingAfter: 34000,
    taxRate: 0.22,
    notes:
      "Lower taxes and housing costs. Lower baseline comp; ROI can still be excellent.",
  },
  {
    key: "Chicago, IL",
    salaryMult: 1.00,
    livingSchool: 24000,
    livingAfter: 36000,
    taxRate: 0.25,
    notes:
      "Good middle ground: large market, moderate costs relative to NYC/SF.",
  },
];

/**
 * SCHOOL_TYPES: tuition is driven by program level + institution category.
 * Expanded beyond the old $12k vs $45k binary.
 *
 * IMPORTANT: Undergrad tuition numbers here are *national medians by institution type*.
 * For best accuracy, you'll eventually add "Pick a school" and pull actual tuition.
 */
export const SCHOOL_TYPES = [
  // UNDERGRAD
  { key: "Community College (In-district avg)", tuitionPerYear: 4000 },
  { key: "Public 4-year (In-State avg)", tuitionPerYear: 11250 },
  { key: "Public 4-year (Out-of-State avg)", tuitionPerYear: 29000 },
  { key: "Private Nonprofit 4-year (Avg)", tuitionPerYear: 41000 },
  { key: "Private For-profit 4-year (Avg)", tuitionPerYear: 20000 },

  // GRAD / PROFESSIONAL (program-level)
  { key: "MBA (Public program avg)", tuitionPerYear: 35000 },
  { key: "MBA (Private program avg)", tuitionPerYear: 60000 },

  { key: "Law School (Public resident avg)", tuitionPerYear: 31500 },
  { key: "Law School (Public non-resident avg)", tuitionPerYear: 45000 },
  { key: "Law School (Private avg)", tuitionPerYear: 58000 },

  { key: "Medical School (Public avg)", tuitionPerYear: 44000 },
  { key: "Medical School (Private avg)", tuitionPerYear: 66000 },
];

/**
 * LIFESTYLES: multiplies living cost estimates.
 */
export const LIFESTYLES = [
  { key: "Frugal", livingMult: 0.82 },
  { key: "Normal", livingMult: 1.0 },
  { key: "High", livingMult: 1.25 },
];

export function pickMajor(majorText, majorBenchmarkKey) {
  const bench = MAJORS.find((m) => m.key === majorBenchmarkKey) || MAJORS[0];
  const t = norm(majorText);

  // Lightweight mapping (so “medical school” doesn’t accidentally become Accounting)
  const rules = [
    { match: ["medical", "med school", "doctor", "physician", "md"], key: "Medicine (MD)" },
    { match: ["law", "jd", "attorney"], key: "Law (JD)" },
    { match: ["mba", "business school"], key: "MBA (General)" },
    { match: ["nursing", "bsn", "rn"], key: "Nursing (BSN)" },
    { match: ["computer science", "cs", "software"], key: "Computer Science (BS)" },
    { match: ["data", "analytics", "analyst"], key: "Data / Analytics (BS/MS)" },
    { match: ["finance"], key: "Finance (BS)" },
    { match: ["accounting", "cpa"], key: "Accounting (BS)" },
    { match: ["mechanical", "mech eng"], key: "Mechanical Engineering (BS)" },
    { match: ["education", "teacher"], key: "Education (BA/BS)" },
    { match: ["psychology", "psych"], key: "Psychology (BA/BS)" },
  ];

  const found = rules.find((r) => r.match.some((w) => t.includes(norm(w))));
  if (found) {
    return MAJORS.find((m) => m.key === found.key) || bench;
  }

  return bench;
}

export function pickCity(cityKey) {
  return CITIES.find((c) => c.key === cityKey) || CITIES[0];
}

export function pickSchoolType(schoolTypeKey) {
  return SCHOOL_TYPES.find((s) => s.key === schoolTypeKey) || SCHOOL_TYPES[0];
}

export function pickLifestyle(lifestyleKey) {
  return LIFESTYLES.find((l) => l.key === lifestyleKey) || LIFESTYLES[1];
}

/* ===========================
   ✅ MISSING EXPORTS (FIX)
   =========================== */

/**
 * Resolve tuition intelligently when user picks a major + school type.
 * - Undergrad majors: tuition from school type
 * - Professional majors (MD/JD/MBA): enforce program-level tuition even if user picked undergrad school type
 *
 * Supports flexible calling styles:
 *   resolveAutoTuition(majorKey, schoolTypeKey)
 *   resolveAutoTuition({ majorKey, schoolTypeKey })
 *   resolveAutoTuition({ major, schoolType })
 */
export function resolveAutoTuition(a, b) {
  // Flexible args support
  const majorKey =
    typeof a === "string"
      ? a
      : a?.majorKey || a?.major?.key || a?.major || "";

  const schoolTypeKey =
    typeof b === "string"
      ? b
      : a?.schoolTypeKey || a?.schoolType?.key || a?.schoolType || "";

  const mk = String(majorKey || "");
  const sk = String(schoolTypeKey || "");

  const isMD = mk.includes("(MD)");
  const isJD = mk.includes("(JD)");
  const isMBA = mk.includes("MBA");

  // If user selected a private undergrad school type, map to private program tuition for pro degrees.
  const wantsPrivate =
    sk.toLowerCase().includes("private");

  if (isMD) {
    const key = wantsPrivate ? "Medical School (Private avg)" : "Medical School (Public avg)";
    return pickSchoolType(key).tuitionPerYear;
  }

  if (isJD) {
    // If they chose out-of-state public, assume non-resident. Otherwise resident.
    const nonResident = sk.toLowerCase().includes("out-of-state") || sk.toLowerCase().includes("non-resident");
    if (wantsPrivate) return pickSchoolType("Law School (Private avg)").tuitionPerYear;
    return pickSchoolType(nonResident ? "Law School (Public non-resident avg)" : "Law School (Public resident avg)").tuitionPerYear;
  }

  if (isMBA) {
    const key = wantsPrivate ? "MBA (Private program avg)" : "MBA (Public program avg)";
    return pickSchoolType(key).tuitionPerYear;
  }

  // Default: undergrad tuition determined by selected school type
  return pickSchoolType(sk || SCHOOL_TYPES[0].key).tuitionPerYear;
}
