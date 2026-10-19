// QC Final sampling: single sampling, normal inspection, general level II
// (ANSI Z1.4 / ISO 2859-1). Check these values against the buyer's own AQL
// table before real use; change them here only, no other file needs editing.

// [largest lot size in this row, sample size]
const LEVEL_II = [
  [8, 2], [15, 3], [25, 5], [50, 8], [90, 13], [150, 20], [280, 32],
  [500, 50], [1200, 80], [3200, 125], [10000, 200], [35000, 315],
  [150000, 500], [500000, 800], [Infinity, 1250],
];

// [sample size, accept (Ac), reject (Re)]
const PLANS = {
  "2.5": [[20, 1, 2], [32, 2, 3], [50, 3, 4], [80, 5, 6], [125, 7, 8], [200, 10, 11], [315, 14, 15], [500, 21, 22]],
  "4.0": [[13, 1, 2], [20, 2, 3], [32, 3, 4], [50, 5, 6], [80, 7, 8], [125, 10, 11], [200, 14, 15], [315, 21, 22]],
};

export const AQL_OPTIONS = Object.keys(PLANS); // ["2.5", "4.0"]
export const DEFAULT_AQL = { major: "2.5", minor: "4.0" };

// Plan for one defect class. Lots smaller than the sample are inspected 100%.
export function aqlPlan(lotQty, aql) {
  const lot = Number(lotQty);
  if (!lot || lot < 1) return null;
  const base = LEVEL_II.find(([max]) => lot <= max)[1];
  const list = PLANS[aql];
  const plan =
    list.find(([n]) => n >= base) ?? list[list.length - 1]; // arrows in the standard: use the nearest plan
  return { sample: Math.min(plan[0], lot), accept: plan[1], reject: plan[2] };
}

// Both classes are checked on one sample (the larger one).
export function finalPlan(lotQty, aql = DEFAULT_AQL) {
  const major = aqlPlan(lotQty, aql.major);
  const minor = aqlPlan(lotQty, aql.minor);
  if (!major || !minor) return null;
  return { sample: Math.max(major.sample, minor.sample), major, minor };
}

export function finalResult(plan, counts) {
  const reasons = [];
  if (counts.critical > 0) reasons.push(`Critical defects found (${counts.critical}), none allowed`);
  if (counts.major > plan.major.accept) reasons.push(`Major ${counts.major} is above the limit of ${plan.major.accept}`);
  if (counts.minor > plan.minor.accept) reasons.push(`Minor ${counts.minor} is above the limit of ${plan.minor.accept}`);
  return { pass: reasons.length === 0, reasons };
}