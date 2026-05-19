/**
 * Pricing utility for "butal" rounding logic.
 */

const ROUNDED_CATEGORIES = [
  'PCR', 'SUV', 'TBR', 'LT', 'LTB', 'RECAP', 'RECAPPING', 'BATTERY', 'USED TIRE', 'MOTORCYCLE', 'TUBE'
];

function isRoundedCategory(cat) {
  if (!cat) return false;
  return ROUNDED_CATEGORIES.includes(cat.toUpperCase());
}

/**
 * "Minimal butal" threshold is 29. 
 */
function getEffectiveCost(cost) {
  if (cost == null || isNaN(cost)) return 0;
  const c = parseFloat(cost);
  const base = Math.floor(c / 100) * 100;
  const butal = c % 100;
  return butal <= 29 ? base : base + 100;
}

/**
 * Calculates new selling price based on cost change.
 * 
 * For Tires & Batteries: Uses "butal" rounding (nearest hundreds with 30-threshold).
 * For Others: Uses "constant increase" (simple delta, no rounding).
 */
function calculateAutoAdjustedPrice(oldPrice, oldCost, newCost, category) {
  const p = parseFloat(oldPrice) || 0;
  const oc = parseFloat(oldCost) || 0;
  const nc = parseFloat(newCost) || 0;

  if (isRoundedCategory(category)) {
    // Rounding logic for Tires & Batteries
    const effOld = getEffectiveCost(oc);
    const effNew = getEffectiveCost(nc);
    const rawNewPrice = p + (effNew - effOld);
    return Math.round(rawNewPrice / 100) * 100;
  } else {
    // "Constant increase" (simple delta) for others
    const delta = nc - oc;
    return p + delta;
  }
}

module.exports = {
  getEffectiveCost,
  calculateAutoAdjustedPrice,
  isRoundedCategory
};
