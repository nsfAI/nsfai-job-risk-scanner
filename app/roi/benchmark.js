// app/roi/benchmarks.js

// Simple benchmark curves per major (demo-grade).
// You can expand this list later. Keep keys stable.

export const MAJOR_BENCHMARKS = [
  {
    id: "accounting-bs",
    label: "Accounting (BS)",
    startSalary: 65000,
    growth: 0.038,
    plateauYear: 18,
    plateauGrowth: 0.018,
    notes:
      "Stable demand; automation hits junior layers first. Upside is advisory, FP&A, controls ownership.",
  },
  {
    id: "computer-science-bs",
    label: "Computer Science (BS)",
    startSalary: 105000,
    growth: 0.055,
    plateauYear: 14,
    plateauGrowth: 0.02,
    notes:
      "Higher upside + volatility. AI increases output-per-head; competition rises; top performers still win.",
  },
  {
    id: "nursing-bs",
    label: "Nursing (BSN)",
    startSalary: 90000,
    growth: 0.032,
    plateauYear: 20,
    plateauGrowth: 0.02,
    notes:
      "Embodiment + liability = strong moat. Growth steadier; region/shift differentials matter.",
  },
  {
    id: "finance-bs",
    label: "Finance (BS)",
    startSalary: 75000,
    growth: 0.042,
    plateauYear: 16,
    plateauGrowth: 0.018,
    notes:
      "Modeling + reporting compress; relationship + judgment roles hold better. Promotions matter a lot.",
  },
  {
    id: "mechanical-engineering-bs",
    label: "Mechanical Engineering (BS)",
    startSalary: 80000,
    growth: 0.038,
    plateauYear: 18,
    plateauGrowth: 0.018,
    notes:
      "Mixed: simulation + documentation compress; physical constraints + safety slow displacement.",
  },
  {
    id: "psychology-ba",
    label: "Psychology (BA)",
    startSalary: 52000,
    growth: 0.03,
    plateauYear: 18,
    plateauGrowth: 0.015,
    notes:
      "Undergrad alone is often lower ROI; grad specialization can change the curve materially.",
  },
  {
    id: "marketing-ba",
    label: "Marketing (BA)",
    startSalary: 60000,
    growth: 0.035,
    plateauYear: 16,
    plateauGrowth: 0.016,
    notes:
      "Content production compresses; strategy + distribution + performance ownership holds value.",
  },
  {
    id: "economics-ba",
    label: "Economics (BA)",
    startSalary: 70000,
    growth: 0.04,
    plateauYear: 16,
    plateauGrowth: 0.017,
    notes:
      "Generalist base; ROI depends heavily on skill stack (SQL, stats, finance) + brand/network.",
  },
];

// convenience lookup
export function getBenchmarkById(id) {
  return MAJOR_BENCHMARKS.find((b) => b.id === id) || MAJOR_BENCHMARKS[0];
}
