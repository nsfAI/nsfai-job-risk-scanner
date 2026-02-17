// app/jobs/jobScoring.js
function clamp(n, a, b) {
  return Math.max(a, Math.min(b, n));
}

// v1 scoring weights (versioned)
export const SCORE_VERSION = "resilience_v1";

export const WEIGHTS_V1 = {
  // Higher = more resilient
  embodiment: 0.22,
  liability: 0.18,
  autonomy: 0.14,
  revenueProximity: 0.14,
  regulatory: 0.12,
  trustDepth: 0.10,

  // Penalize automation exposure traits
  repeatabilityPenalty: 0.20,
  toolAutomationPenalty: 0.10,
};

// very simple reason label
export function reasonLabel({ embodiment, liability, regulatory, repeatability }) {
  if (embodiment >= 0.75 && liability >= 0.55) return "High Human Constraint Density";
  if (regulatory >= 0.70) return "Regulatory Moat";
  if (repeatability >= 0.70) return "Elevated Automation Exposure";
  return "AI-Augmented Role";
}

/**
 * Inputs are normalized 0..1 attributes
 * Output is 0..100
 */
export function scoreResilience(attrs, weights = WEIGHTS_V1) {
  const a = {
    embodiment: clamp(attrs.embodiment ?? 0.3, 0, 1),
    liability: clamp(attrs.liability ?? 0.3, 0, 1),
    autonomy: clamp(attrs.autonomy ?? 0.4, 0, 1),
    revenueProximity: clamp(attrs.revenueProximity ?? 0.4, 0, 1),
    regulatory: clamp(attrs.regulatory ?? 0.3, 0, 1),
    trustDepth: clamp(attrs.trustDepth ?? 0.35, 0, 1),
    repeatability: clamp(attrs.repeatability ?? 0.45, 0, 1),
    toolAutomation: clamp(attrs.toolAutomation ?? 0.4, 0, 1),
  };

  // positive durability signals
  const durable =
    a.embodiment * weights.embodiment +
    a.liability * weights.liability +
    a.autonomy * weights.autonomy +
    a.revenueProximity * weights.revenueProximity +
    a.regulatory * weights.regulatory +
    a.trustDepth * weights.trustDepth;

  // penalties
  const penalty =
    a.repeatability * weights.repeatabilityPenalty +
    a.toolAutomation * weights.toolAutomationPenalty;

  const raw = clamp(durable - penalty, 0, 1);
  const score = Math.round(raw * 100);

  return {
    score,
    reason: reasonLabel(a),
    scoreVersion: SCORE_VERSION,
    components: { ...a, durable, penalty, raw },
  };
}
