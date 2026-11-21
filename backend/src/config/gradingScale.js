// Override with EDUSPHERE_GRADING_SCALE JSON, for example:
// [{"label":"A","minPercentage":90},{"label":"B","minPercentage":80},{"label":"C","minPercentage":70},{"label":"D","minPercentage":60},{"label":"F","minPercentage":0}]
// This documented default is global to this backend deployment because the existing
// project has no per-tenant grading policy model or configuration convention.
const DEFAULT_GRADE_SCALE = [
  { label: "A", minPercentage: 90 },
  { label: "B", minPercentage: 80 },
  { label: "C", minPercentage: 70 },
  { label: "D", minPercentage: 60 },
  { label: "F", minPercentage: 0 },
];

const validateGradeScale = (scale) => {
  if (!Array.isArray(scale) || scale.length < 1 || scale.length > 12) {
    throw new Error("EDUSPHERE_GRADING_SCALE must be an array with 1 to 12 grade bands");
  }
  const labels = new Set();
  const thresholds = new Set();
  for (const band of scale) {
    if (!band || typeof band.label !== "string" || !band.label.trim() || band.label.length > 10) {
      throw new Error("Each grading band requires a label of 1 to 10 characters");
    }
    if (typeof band.minPercentage !== "number" || !Number.isFinite(band.minPercentage) || band.minPercentage < 0 || band.minPercentage > 100) {
      throw new Error("Each grading band minPercentage must be between 0 and 100");
    }
    if (labels.has(band.label) || thresholds.has(band.minPercentage)) {
      throw new Error("Grading band labels and thresholds must be unique");
    }
    labels.add(band.label);
    thresholds.add(band.minPercentage);
  }
  if (!thresholds.has(0)) throw new Error("The grading scale must include a 0 percent fallback band");
  return [...scale].sort((a, b) => b.minPercentage - a.minPercentage);
};

let configuredScale = DEFAULT_GRADE_SCALE;
if (process.env.EDUSPHERE_GRADING_SCALE) {
  let parsed;
  try {
    parsed = JSON.parse(process.env.EDUSPHERE_GRADING_SCALE);
  } catch {
    throw new Error("EDUSPHERE_GRADING_SCALE must be valid JSON");
  }
  configuredScale = validateGradeScale(parsed);
}

const getGradeLabel = (percentage) => {
  const band = configuredScale.find((item) => percentage >= item.minPercentage);
  return band ? band.label : configuredScale[configuredScale.length - 1].label;
};

module.exports = { configuredScale, getGradeLabel };
