const { dbGet } = require("./db");

function toLocalYYYYMMDD(date) {
  const d = date instanceof Date ? date : new Date(date);
  const options = { timeZone: 'Asia/Manila', year: 'numeric', month: '2-digit', day: '2-digit' };
  const formatter = new Intl.DateTimeFormat('en-CA', options);
  return formatter.format(d);
}

function getLocalTodayYYYYMMDD() {
  return toLocalYYYYMMDD(new Date());
}

/**
 * Returns the effective business date for a shop.
 * If the shop is marked as closed, the date is shifted to the next day.
 * 
 * @param {string} shop_id 
 * @param {Date} [baseDate=new Date()] 
 * @returns {Promise<Date>}
 */
async function getEffectiveDate(shop_id, baseDate = new Date()) {
  try {
    const shop = await dbGet("SELECT is_closed FROM shop_master WHERE shop_id = ?", [shop_id]);
    
    // If shop is not found or is_closed is falsy, return the current date
    if (!shop || !shop.is_closed) {
      return baseDate;
    }

    // Shift to the next day
    const shiftedDate = new Date(baseDate);
    shiftedDate.setDate(shiftedDate.getDate() + 1);
    
    return shiftedDate;
  } catch (error) {
    console.error(`Error calculating effective date for shop ${shop_id}:`, error);
    return baseDate;
  }
}

/**
 * Convenience helper to get the effective date as an ISO string.
 */
async function getEffectiveISO(shop_id, baseDate = new Date()) {
  const date = await getEffectiveDate(shop_id, baseDate);
  return date.toISOString();
}

/**
 * Convenience helper to get the effective date as a YYYY-MM-DD string.
 */
async function getEffectiveYYYYMMDD(shop_id, baseDate = new Date()) {
  const date = await getEffectiveDate(shop_id, baseDate);
  return toLocalYYYYMMDD(date);
}

module.exports = {
  getEffectiveDate,
  getEffectiveISO,
  getEffectiveYYYYMMDD,
  toLocalYYYYMMDD,
  getLocalTodayYYYYMMDD
};
