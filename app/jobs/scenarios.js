// app/jobs/scenarios.js
export const SCENARIOS = [
  {
    key: "moderate",
    label: "Moderate AI Adoption",
    multipliers: {
      resilience: 1.0,
      employerAiRiskPenalty: 1.0,
      compressionPenalty: 1.0,
    },
  },
  {
    key: "aggressive",
    label: "Aggressive Autonomy Expansion",
    multipliers: {
      resilience: 0.92,
      employerAiRiskPenalty: 1.25,
      compressionPenalty: 1.18,
    },
  },
  {
    key: "slow",
    label: "Slow Adoption / Regulation Drag",
    multipliers: {
      resilience: 1.06,
      employerAiRiskPenalty: 0.85,
      compressionPenalty: 0.85,
    },
  },
];

export function getScenario(key) {
  return SCENARIOS.find((s) => s.key === key) || SCENARIOS[0];
}
