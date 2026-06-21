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

function addCalendarMonthsLocal(date, months) {
  const d = date instanceof Date ? date : new Date(date);
  const options = { timeZone: 'Asia/Manila', year: 'numeric', month: 'numeric', day: 'numeric' };
  const formatter = new Intl.DateTimeFormat('en-US', options);
  const parts = formatter.formatToParts(d);
  const partMap = {};
  for (const part of parts) {
    partMap[part.type] = part.value;
  }
  let year = parseInt(partMap.year, 10);
  let month = parseInt(partMap.month, 10) - 1; // 0-indexed month
  let day = parseInt(partMap.day, 10);

  let targetMonth = month + months;
  let targetYear = year + Math.floor(targetMonth / 12);
  targetMonth = ((targetMonth % 12) + 12) % 12;

  const maxDays = new Date(Date.UTC(targetYear, targetMonth + 1, 0)).getUTCDate();
  let targetDay = Math.min(day, maxDays);

  const yyyy = targetYear.toString().padStart(4, '0');
  const mm = (targetMonth + 1).toString().padStart(2, '0');
  const dd = targetDay.toString().padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

function calculateDueDateFromTerms(terms, baseDate = new Date()) {
  if (!terms || terms <= 0) return null;
  if (terms % 30 === 0) {
    const months = Math.round(terms / 30);
    return addCalendarMonthsLocal(baseDate, months);
  }
  const d = new Date(baseDate);
  d.setDate(d.getDate() + terms);
  return toLocalYYYYMMDD(d);
}

module.exports = {
  getEffectiveDate,
  getEffectiveISO,
  getEffectiveYYYYMMDD,
  toLocalYYYYMMDD,
  getLocalTodayYYYYMMDD,
  addCalendarMonthsLocal,
  calculateDueDateFromTerms
};

