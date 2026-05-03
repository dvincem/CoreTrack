const { dbGet } = require("./db");

/**
 * Returns the current date string (YYYY-MM-DD) in Asia/Manila timezone.
 * Used to ensure consistency when the server is in UTC.
 */
function getPHDateStr() {
  const options = { timeZone: "Asia/Manila", year: "numeric", month: "2-digit", day: "2-digit" };
  const formatter = new Intl.DateTimeFormat("en-US", options);
  const parts = formatter.formatToParts(new Date());
  const year = parts.find(p => p.type === "year").value;
  const month = parts.find(p => p.type === "month").value;
  const day = parts.find(p => p.type === "day").value;
  return `${year}-${month}-${day}`;
}

/**
 * Returns the effective business date for a shop.
 * If the shop is marked as closed, the date is shifted to the next day.
 * 
 * @param {string} shop_id 
 * @param {Date} [baseDate=null] Optional base date. If null, uses current PH time.
 * @returns {Promise<Date>}
 */
async function getEffectiveDate(shop_id, baseDate = null) {
  try {
    const shop = await dbGet("SELECT is_closed FROM shop_master WHERE shop_id = ?", [shop_id]);
    
    // Default to current date in Asia/Manila if no baseDate is provided
    let date = baseDate;
    if (!date) {
      const phStr = getPHDateStr();
      // Use local date for the beginning of the day in PH
      date = new Date(phStr + "T00:00:00+08:00");
    }

    // If shop is not found or is_closed is falsy, return the date
    if (!shop || !shop.is_closed) {
      return date;
    }

    // Shift to the next day
    const shiftedDate = new Date(date);
    shiftedDate.setDate(shiftedDate.getDate() + 1);
    
    return shiftedDate;
  } catch (error) {
    console.error(`Error calculating effective date for shop ${shop_id}:`, error);
    return baseDate || new Date();
  }
}

/**
 * Convenience helper to get the effective date as an ISO string.
 */
async function getEffectiveISO(shop_id, baseDate = null) {
  const date = await getEffectiveDate(shop_id, baseDate);
  return date.toISOString();
}

/**
 * Convenience helper to get the effective date as a YYYY-MM-DD string.
 */
async function getEffectiveYYYYMMDD(shop_id, baseDate = null) {
  const date = await getEffectiveDate(shop_id, baseDate);
  // Manual format to avoid timezone shifts
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

module.exports = {
  getPHDateStr,
  getEffectiveDate,
  getEffectiveISO,
  getEffectiveYYYYMMDD
};
