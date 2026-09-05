const text = (value, max = 160) => typeof value === 'string' ? value.trim().slice(0, max) : '';
const date = value => /^\d{4}-\d{2}-\d{2}$/.test(value) && Number.isFinite(Date.parse(value)) && new Date(value).toISOString().slice(0, 10) === value;
const number = (value, min, max) => typeof value === 'number' && Number.isFinite(value) && value >= min && value <= max;

export function normalizeOrder(input) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) throw Error('invalid_order');
  // Reject payment data, including legacy clients, rather than retaining it.
  if (Object.keys(input).some(k => /card|cvc|cvv|pan|expiry/i.test(k) && k !== 'campaign')) throw Error('payment_data_not_accepted');
  const ids = Array.isArray(input.ids) ? [...new Set(input.ids)] : [];
  if (!ids.length || ids.length > 10000 || ids.some(id => typeof id !== 'string' || !id.length || id.length > 160)) throw Error('invalid_points');
  if (![input.start, input.end, input.passDate].every(date) || input.end < input.start || input.passDate < input.start || input.passDate > input.end || (Date.parse(input.end) - Date.parse(input.start)) / 86400000 > 366) throw Error('invalid_dates');
  if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(input.passTime)) throw Error('invalid_time');
  if (![250,500,1000,2500].includes(input.passesDay) || ![15,30,45,60].includes(input.durationSec)) throw Error('invalid_schedule');
  const brand = text(input.brand), campaign = text(input.campaign), email = text(input.email, 254).toLowerCase();
  if (!brand || !campaign || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw Error('invalid_contact');
  if (!number(input.price, 0, 1e12)) throw Error('invalid_estimate');
  const target = {};
  for (const key of ['placements','genders','ages','timeSlots']) {
    const values = input.target?.[key] || [];
    if (!Array.isArray(values) || values.length > 20 || values.some(v => typeof v !== 'string' || v.length > 80)) throw Error('invalid_target');
    target[key] = [...new Set(values)].sort();
  }
  let creative = null;
  if (input.creative?.assetUrl) {
    let url; try { url = new URL(input.creative.assetUrl); } catch { throw Error('invalid_creative'); }
    if (url.protocol !== 'https:' || url.username || url.password || url.href.length > 2048) throw Error('invalid_creative');
    creative = { assetUrl: url.href, assetType: text(input.creative.assetType, 30), campaignId: text(input.creative.campaignId), source: 'pixeria' };
  }
  return { ids: ids.sort(), circuit: text(input.circuit), circuitScope: text(input.circuitScope?.value, 30),
    start: input.start, end: input.end, passDate: input.passDate, passTime: input.passTime,
    passesDay: input.passesDay, durationSec: input.durationSec, brand, campaign, email, target, creative,
    // The browser quote is indicative. It cannot confirm inventory or charge money.
    estimatedPrice: Math.round(input.price * 100) / 100, currency: 'EUR' };
}
