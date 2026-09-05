(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.CampaignPlanner = factory();
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  const KEY = 'cc-campaign-plan-v1';
  const scopes = ['all','global','national','city','local'];
  function day(value) {
    if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
    const n = Date.parse(value + 'T00:00:00Z');
    return Number.isFinite(n) && new Date(n).toISOString().slice(0,10) === value ? n : null;
  }
  function validSettings(s, today) {
    const a = day(s?.start), b = day(s?.end);
    return a !== null && b !== null && b >= a && (b-a)/86400000 <= 366 &&
      (!today || s.start >= today) && [250,500,1000,2500].includes(s.passesDay) &&
      [15,30,45,60].includes(s.durationSec) && Number.isFinite(s.budget) && s.budget >= 0.01 && s.budget <= 1e12;
  }
  // Shared by the comparison and checkout: impressions are opportunities, not unique people.
  function quote(items, s) {
    const start = day(s.start), end = day(s.end);
    const days = start !== null && end !== null && end >= start && (end-start)/86400000 <= 366 ? (end-start)/86400000 + 1 : 0;
    const unique = [...new Map(items.map(item => [item.id,item])).values()];
    let dailyImpr=0, surfaces=0, weighted=0, weight=0, demand=0;
    for (const item of unique) {
      const impr = Number.isFinite(item.impr) ? Math.max(0,item.impr) : 0;
      const cpm = Number.isFinite(item.cpm) && item.cpm >= 0 ? item.cpm : 5;
      dailyImpr += impr; surfaces += Number.isFinite(item.surfaces) ? Math.max(0,item.surfaces) : 0;
      weighted += cpm*Math.max(1,impr); weight += Math.max(1,impr);
    }
    for(let i=0;i<days;i++) {
      const d=new Date(start+i*86400000), dow=d.getUTCDay(), month=d.getUTCMonth()+1;
      demand += 1 + ([5,6].includes(dow)?0.12:0) + ([7,8].includes(month)?0.10:0) + (month===12 && d.getUTCDate()>=10 && d.getUTCDate()<=24?0.25:0);
    }
    demand = days ? demand/days : 1;
    const cpm=weight?weighted/weight:5, passFactor=Math.max(0.15,Math.min(1.5,Number(s.passesDay||0)/1000));
    const durationFactor=Math.max(1,Number(s.durationSec||15)/15);
    const estimatedImpr=Math.round(dailyImpr*days*passFactor);
    const price=Math.max(0,Math.round(estimatedImpr/1000*cpm*demand*durationFactor));
    return {days,dailyImpr,surfaces,cpm,demand,passFactor,durationFactor,estimatedImpr,price,points:unique.length};
  }
  function normalizePlan(raw) {
    if (!raw || raw.version !== 1 || !validSettings(raw) || !scopes.includes(raw.scope) || typeof raw.circuitId !== 'string' || raw.circuitId.length>80) return null;
    if (!Array.isArray(raw.ids) || !raw.ids.length || raw.ids.length>10000 || raw.ids.some(id=>typeof id!=='string'||!id.length||id.length>160)) return null;
    const target={};
    for(const key of ['placements','genders','ages','timeSlots']) {
      const values=raw.target?.[key];
      if(!Array.isArray(values)||!values.length||values.length>20||values.some(v=>typeof v!=='string'||v.length>80))return null;
      target[key]=[...new Set(values)];
    }
    return {version:1,circuitId:raw.circuitId,scope:raw.scope,metroLine:typeof raw.metroLine==='string'?raw.metroLine.slice(0,30):'all',ids:[...new Set(raw.ids)],target,
      start:raw.start,end:raw.end,passesDay:raw.passesDay,durationSec:raw.durationSec,budget:raw.budget};
  }
  function read(storage) { try { return normalizePlan(JSON.parse(storage.getItem(KEY))); } catch { return null; } }
  function save(storage, raw) { const plan=normalizePlan(raw); if(!plan)throw Error('invalid_plan');storage.setItem(KEY,JSON.stringify(plan));return plan; }
  function reconcile(plan, available) {
    const set=new Set(available);return {ids:plan.ids.filter(id=>set.has(id)),missing:plan.ids.filter(id=>!set.has(id))};
  }
  return {KEY,quote,validSettings,normalizePlan,read,save,reconcile};
});
