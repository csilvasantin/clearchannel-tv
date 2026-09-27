// «El euro que entra» (encargo #4505 · FLT-101121): una solicitud recibida se
// programa en la parrilla real del Xpacio gemelo Xtanco Valencia. Pantalla A
// emite la cápsula publicitaria (admira.tv/canal.html) y el hilo musical del
// gemelo la cápsula sonora. /grid/sales cuenta lo vendido; no hay cobro.
// Pantallas y creativos los fija el servidor: el comprador no elige a dónde se emite.
const GRID = 'https://api.admira.store';
export const EMIT_TARGETS = [
  { screen: 'xtanco-valencia-a', role: 'capsula_publicitaria', category: 'publicidad', paid: true,
    creative: origin => ({ type: 'image', url: origin + '/assets/demo/capsula-clearchannel-xtanco.png', name: 'Cápsula Clear Channel × Xtanco' }),
    watch: 'https://admira.tv/canal.html?screen=xtanco-valencia-a' },
  { screen: 'xtanco-valencia-musica', role: 'capsula_sonora', category: 'publicidad', paid: false,
    creative: () => ({ type: 'music', url: 'https://api.admira.store/stock/asset/1788556467836-r1j7ic?v=1685901', name: 'Vida mía (versión Admira)' }),
    watch: 'https://www.xpaceos.com/xpacios/xtanco-valencia/' },
];
const madridDate = (d = new Date()) => new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Madrid', year: 'numeric', month: '2-digit', day: '2-digit' }).format(d);

// Franja en antena ahora; fuera de horario, la siguiente de hoy o la última.
function pickBand(day) {
  const bands = Array.isArray(day?.bands) ? day.bands : [];
  return bands.find(b => b.isNow) || bands.find(b => (b.from || '') > new Intl.DateTimeFormat('en-GB', { timeZone: 'Europe/Madrid', hour: '2-digit', minute: '2-digit' }).format(new Date())) || bands.at(-1) || null;
}

export async function emitOrder(order, { gridKey, origin, fetchImpl = fetch }) {
  const date = madridDate();
  const tag = order.id;
  const out = [];
  for (const t of EMIT_TARGETS) {
    const day = await (await fetchImpl(`${GRID}/grid/day?screen=${t.screen}&date=${date}&_=${Date.now()}`, { cache: 'no-store' })).json();
    const already = (day?.bands || []).flatMap(b => (b.slots || []).map(s => ({ b, s }))).find(({ s }) => String(s.title || '').includes(tag));
    if (already) { out.push({ screen: t.screen, role: t.role, date, bandId: already.b.id, bookingId: already.s.bookingId || null, replayed: true, watch: t.watch }); continue; }
    const band = pickBand(day);
    if (!band) throw Error('grid_unavailable');
    const price = t.paid ? Number(order.estimatedPrice) || 0 : 0;
    const r = await fetchImpl(`${GRID}/grid/book`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({
      key: gridKey, screen: t.screen, date, bandId: band.id, slots: 1, status: 'sold',
      advertiser: order.brand, title: `${order.campaign} · ${tag}`.slice(0, 120), category: t.category,
      creative: t.creative(origin), price }) });
    const d = await r.json().catch(() => ({}));
    if (!r.ok || !d.ok) throw Error('grid_book_failed');
    out.push({ screen: t.screen, role: t.role, date, bandId: band.id, bookingId: d.id, price, replayed: false, watch: t.watch });
  }
  return out;
}
