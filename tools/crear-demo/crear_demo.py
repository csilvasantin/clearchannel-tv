#!/usr/bin/env python3
"""
crear_demo.py · «créame demo de <cliente>» de punta a punta (Carlos, 05-10-2026).

Una sola orden crea, para un cliente nuevo:
  1. marca     Marca blanca en el catálogo único (admiranext.com/marcablanca): analiza la web,
               fija id/nombre/color/wordmark y la guarda (POST|PUT /presentaciones/api/marcas,
               clave de máquina de la flota ADMIRANEXT_PRESENTACIONES_MACHINE_KEY).
  2. circuito  Circuito demo_<id> con N Xpacios céntricos (por defecto London, New York,
               Barcelona, Madrid) en el catálogo de admira.biz/admira.app (KV omnipublicity:
               GET → copia de seguridad → unión por id → PUT, ADMIN_TOKEN). El desplegable lo
               pinta app.js solo (circuitos demo genéricos, sin tocar código).
  3. grid      Una pantalla por Xpacio en la parrilla (POST api.admira.store/grid/config, GRID_KEY).
  4. audio     2 canciones de hilo musical EN+ES (Lyria 3 vía api.admira.store, X-Notify-Key)
               publicadas en Stock y en el hilo del cliente (POST /hilomusical/push) +
               2 locuciones ES+EN de cierre (POST /megafonia/push, ElevenLabs).
  5. xpl       Playlist exacta <id>.xpacio.hilomusical en xpl.admira.store (XPL_TOKEN), patrón
               Starbucks (activeLang, items con lang EN/ES).
  6. book      Asignación en GRID (POST /grid/book) de canciones + locuciones a cada Xpacio, banda actual.
  7. twins     Gemelos digitales en admira.store (campo twin de cada Xpacio, ?marca=<id>&store=<id>)
               y comprobación HTTP.
  8. resumen   JSON + Markdown con URLs (demo-<id>-RESUMEN.{json,md}).

Secretos: SOLO se leen con ~/Claude/admira-vault/vault-get.sh y nunca se imprimen ni se guardan.
Idempotente: re-ejecutar no duplica Xpacios, pantallas ni playlist; el audio se reutiliza si
ya está en el estado (--estado). Usa --pasos para repetir solo una parte, --dry-run para ver el plan.

Uso (Mac Mini):
  python3 tools/crear-demo/crear_demo.py --cliente "Lenovo" --web https://www.lenovo.com/ \
      --color '#E2231A' --ciudades london,newyork,barcelona,madrid --cierre 20:00
"""
import argparse, base64, datetime, json, os, re, subprocess, sys, time, unicodedata, urllib.error, urllib.request

UA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36 AdmiraCrearDemo/1.0'
VAULT = os.path.expanduser('~/Claude/admira-vault/vault-get.sh')
NEXT = 'https://www.admiranext.com'
OMNIP = 'https://brain.digitalavatar.ai/locations'
API = 'https://api.admira.store'
XPL = 'https://xpl.admira.store/playlists'
STORE_TWIN = 'https://www.admira.store/admira-xp/'
BIZ = 'https://www.admira.biz/'
PASOS = ['marca', 'circuito', 'grid', 'audio', 'xpl', 'book', 'twins', 'resumen']

CIUDADES = {
    'london':    {'city': 'London',    'country': 'UK', 'tz': 'Europe/London',     'zona': 'Oxford Circus',     'addr': 'Oxford Circus · Regent Street · London W1B · United Kingdom', 'coords': [-0.1419, 51.5154]},
    'newyork':   {'city': 'New York',  'country': 'US', 'tz': 'America/New_York',  'zona': 'Fifth Avenue',      'addr': 'Fifth Avenue & W 53rd St · Manhattan · New York, NY 10019 · USA', 'coords': [-73.9757, 40.7606]},
    'barcelona': {'city': 'Barcelona', 'country': 'ES', 'tz': 'Europe/Madrid',     'zona': 'Passeig de Gràcia', 'addr': 'Passeig de Gràcia · Eixample · 08008 Barcelona · España', 'coords': [2.1649, 41.3925]},
    'madrid':    {'city': 'Madrid',    'country': 'ES', 'tz': 'Europe/Madrid',     'zona': 'Gran Vía',          'addr': 'Gran Vía · Centro · 28013 Madrid · España', 'coords': [-3.7038, 40.4203]},
    'paris':     {'city': 'Paris',     'country': 'FR', 'tz': 'Europe/Paris',      'zona': 'Champs-Élysées',    'addr': 'Avenue des Champs-Élysées · 75008 Paris · France', 'coords': [2.3050, 48.8698]},
    'milano':    {'city': 'Milano',    'country': 'IT', 'tz': 'Europe/Rome',       'zona': 'Corso Vittorio Emanuele', 'addr': 'Corso Vittorio Emanuele II · 20122 Milano · Italia', 'coords': [9.1938, 45.4655]},
    'lisboa':    {'city': 'Lisboa',    'country': 'PT', 'tz': 'Europe/Lisbon',     'zona': 'Chiado',            'addr': 'Rua Garrett · Chiado · 1200 Lisboa · Portugal', 'coords': [-9.1420, 38.7107]},
    'valencia':  {'city': 'València',  'country': 'ES', 'tz': 'Europe/Madrid',     'zona': 'Carrer de Colón',   'addr': 'Carrer de Colón · 46004 València · España', 'coords': [-0.3723, 39.4699]},
    'mexico':    {'city': 'Ciudad de México', 'country': 'MX', 'tz': 'America/Mexico_City', 'zona': 'Paseo de la Reforma', 'addr': 'Paseo de la Reforma · Juárez · 06600 CDMX · México', 'coords': [-99.1676, 19.4270]},
}

# ─── utilidades ──────────────────────────────────────────────────────────────
def log(*a):
    print('·', *a, flush=True)

def slug(texto, sep='-'):
    t = unicodedata.normalize('NFD', str(texto)).encode('ascii', 'ignore').decode().lower()
    return re.sub(r'[^a-z0-9]+', sep, t).strip(sep)

_secret_cache = {}
def secreto(nombre):
    """Lee un secreto de la bóveda. Nunca lo imprime."""
    if nombre in _secret_cache:
        return _secret_cache[nombre]
    try:
        v = subprocess.run(['bash', VAULT, nombre], capture_output=True, text=True, timeout=30).stdout.strip()
    except Exception:
        v = ''
    if not v:
        raise SystemExit(f'✗ falta el secreto {nombre} en la bóveda (no se imprime nada)')
    _secret_cache[nombre] = v
    return v

def http(method, url, body=None, headers=None, timeout=60, raw=False):
    h = {'User-Agent': UA, 'Accept': 'application/json'}
    h.update(headers or {})
    data = None
    if body is not None:
        data = body if isinstance(body, bytes) else json.dumps(body).encode()
        h.setdefault('Content-Type', 'application/json')
    req = urllib.request.Request(url, data=data, method=method, headers=h)
    try:
        with urllib.request.urlopen(req, timeout=timeout) as r:
            b = r.read()
            return r.status, (b if raw else _j(b))
    except urllib.error.HTTPError as e:
        b = e.read()
        return e.code, (b if raw else _j(b))

def _j(b):
    try:
        return json.loads(b.decode() or 'null')
    except Exception:
        return {'_texto': b[:300].decode('utf-8', 'replace')}

def scrub(obj):
    """Quita cualquier secreto conocido de lo que se vaya a imprimir o guardar."""
    s = json.dumps(obj, ensure_ascii=False)
    for v in _secret_cache.values():
        if v and len(v) > 6:
            s = s.replace(v, '***')
    return json.loads(s)

# ─── 1 · marca blanca ────────────────────────────────────────────────────────
def wordmark_svg(nombre, color, texto='#FFFFFF'):
    n = re.sub(r'[<>&"]', '', nombre)[:18]
    w = max(200, 36 + 26 * len(n))
    return (f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {w} 80" width="{w}" height="80">'
            f'<rect width="{w}" height="80" fill="{color}"/>'
            f'<text x="{w/2:.0f}" y="54" text-anchor="middle" font-family="Helvetica, Arial, sans-serif" '
            f'font-size="40" font-weight="700" fill="{texto}" letter-spacing="-1">{n}</text></svg>')

def paso_marca(cfg, st):
    st_m = st.setdefault('marca', {})
    code, cur = http('GET', f"{NEXT}/marcablanca/api/marcas/{cfg['id']}")
    if code == 200 and st_m.get('ok') and not cfg['rehacer']:
        log(f"marca «{cfg['id']}» ya existe en el catálogo → se reutiliza")
        return
    code, an = http('POST', f'{NEXT}/marcablanca/api/analizar', {'url': cfg['web']}, {'Origin': NEXT}, timeout=90)
    if code != 200 or not isinstance(an, dict) or not an.get('propuesta'):
        raise SystemExit(f"✗ analizar {cfg['web']} → HTTP {code} {str(an)[:200]}")
    m = an['propuesta']
    m['id'] = cfg['id']; m['nombre'] = cfg['nombre']; m['nombreCorto'] = cfg['nombre']
    m['sector'] = cfg['sector']
    m['descripcion'] = f"Propuesta de marca blanca para la demo Admira de {cfg['nombre']} (a partir de {cfg['web']}). No es la marca oficial de {cfg['nombre']}."
    if cfg['color']:
        logo = 'data:image/svg+xml;base64,' + base64.b64encode(wordmark_svg(cfg['nombre'], cfg['color']).encode()).decode()
        m['logo'] = {'alt': f"{cfg['nombre']} (wordmark de demo)", 'imagen': logo}
        m['favicon'] = logo
        cl = m.setdefault('colores', {}).setdefault('claro', {})
        acento_web = cl.get('primario') if cl.get('primario', '').upper() != cfg['color'].upper() else cl.get('acento')
        cl.update({'primario': cfg['color'], 'primarioTexto': '#FFFFFF', 'secundario': '#1A1A1A', 'secundarioTexto': '#FFFFFF'})
        if acento_web:
            cl.update({'acento': acento_web, 'acentoTexto': '#FFFFFF'})
        osc = m['colores'].setdefault('oscuro', {})
        osc.update({'primario': cfg['color'], 'primarioTexto': '#FFFFFF'})
    if isinstance(m.get('tono'), dict):
        m['tono']['voz'] = f"Claro, cercano y propio de {cfg['nombre']}."
    demo = m.setdefault('demo', {})
    demo.update({'titular': f"{cfg['nombre']}, también en pantalla", 'cta': 'Descúbrelo',
                 'circuito': f"{cfg['circuit_label_es']}", 'puntos': len(cfg['ciudades']), 'superficies': 3 * len(cfg['ciudades']),
                 'tipoEspacio': cfg['sector'],
                 'tiendas': [{'nombre': f"{cfg['nombre']} · {CIUDADES[c]['city']}", 'dir': CIUDADES[c]['addr']} for c in cfg['ciudades']][:6]})
    body = {'marca': m, 'origen': 'url', 'tipo': 'real', 'web': cfg['web']}
    if cfg['dry']:
        log('[dry] guardaría marca', cfg['id']); return
    hdr = {'X-Admira-Machine-Key': secreto('ADMIRANEXT_PRESENTACIONES_MACHINE_KEY'), 'Origin': NEXT}
    metodo = 'PUT' if code == 200 else 'POST'
    code2, r = http(metodo, f'{NEXT}/presentaciones/api/marcas', body, hdr, timeout=90)
    if code2 == 409 and metodo == 'POST':
        code2, r = http('PUT', f'{NEXT}/presentaciones/api/marcas', body, hdr, timeout=90)
    if code2 not in (200, 201):
        raise SystemExit(f"✗ guardar marca → HTTP {code2} {scrub(r)}")
    st_m.update({'ok': True, 'id': r.get('id'), 'creada': r.get('creada'),
                 'url': f"{NEXT}/marcablanca/?marca={cfg['id']}", 'api': f"{NEXT}/marcablanca/api/marcas/{cfg['id']}"})
    log(f"marca «{cfg['id']}» {'creada' if r.get('creada') else 'actualizada'} → {st_m['url']}")

# ─── 2 · circuito (admira.biz / admira.app) ──────────────────────────────────
def twin_url(cfg, loc_id):
    return f"{STORE_TWIN}?autostart=xtanco&visual=better&marca={cfg['id']}&loc={loc_id}&store={cfg['store']}"

def construir_locations(cfg):
    out = []
    for i, c in enumerate(cfg['ciudades'], 1):
        p = CIUDADES[c]
        lid = f"{cfg['id']}-demo-{c}"
        out.append({
            'id': lid,
            'name': f"{cfg['nombre']} · {p['city']} {p['zona']}",
            'kind': f"{cfg['sector']} · {cfg['nombre']} · Circuito demo Admira",
            'addr': p['addr'], 'coords': p['coords'], 'city': p['city'], 'country': p['country'], 'tz': p['tz'],
            'music': 'lounge', 'cameras': False,
            'circuit': cfg['circuit'], 'circuitLabel': {'es': cfg['circuit_label_es'], 'en': cfg['circuit_label_en']},
            'client': cfg['id'], 'demo': True, 'tourOrder': i,
            'external': {'brand': cfg['nombre'], 'network': f"{cfg['id']} demo", 'operator': 'Admira (demo)',
                         'source': 'crear-demo · Xpacio céntrico de demostración, no es una tienda oficial', 'url': cfg['web']},
            'twin': twin_url(cfg, lid),
            'hilomusical': {'store': cfg['store'], 'playlist': cfg['playlist'], 'langs': ['en', 'es']},
            'surfaces': [
                {'name': 'Videowall escaparate', 'desc': 'LED de escaparate a pie de calle', 'status': 'sched', 'impr': 1800, 'cpm': '€9', 'surface': 'escaparate'},
                {'name': 'Pantalla producto', 'desc': 'Pantalla junto a la mesa de producto', 'status': 'sched', 'impr': 900, 'cpm': '€7', 'surface': 'pantalla'},
                {'name': 'Hilo musical + megafonía', 'desc': f"Playlist {cfg['playlist']} y avisos EN/ES", 'status': 'sched', 'impr': 1200, 'cpm': '€3', 'surface': 'audio'},
            ],
            'segmentation': {'required': False, 'schedule': {'start': '10:00', 'end': cfg['cierre']},
                             'typologies': ['exterior', 'interior'], 'genders': ['hombre', 'mujer'],
                             'ages': ['joven', 'adulto', 'senior'], 'timeSlots': ['manana', 'mediodia', 'tarde']},
        })
    return out

def paso_circuito(cfg, st):
    locs = construir_locations(cfg)
    st['circuito'] = {'id': cfg['circuit'], 'label': cfg['circuit_label_es'], 'xpacios': [l['id'] for l in locs],
                      'url': f"{BIZ}?marca={cfg['id']}&circuit={cfg['circuit']}"}
    json.dump(locs, open(os.path.join(cfg['out'], f"circuito-{cfg['id']}.seed.json"), 'w'), ensure_ascii=False, indent=1)
    code, d = http('GET', OMNIP, timeout=60)
    cur = d if isinstance(d, list) else (d.get('items') or d.get('locations') or [])
    if code != 200 or len(cur) < 100:
        raise SystemExit(f'✗ catálogo omnipublicity sospechoso (HTTP {code}, {len(cur)} puntos): no se escribe')
    ids = {l.get('id') for l in cur}
    nuevos = [l for l in locs if l['id'] not in ids]
    cambiados = [l for l in locs if l['id'] in ids]
    log(f'catálogo={len(cur)} · nuevos={len(nuevos)} · ya existían={len(cambiados)}')
    if cfg['dry']:
        log('[dry] uniría', [l['id'] for l in nuevos]); return
    bk = os.path.join(cfg['out'], f"backup-omnipublicity-{time.strftime('%Y%m%d-%H%M%S')}.json")
    json.dump(cur, open(bk, 'w'), ensure_ascii=False)
    st['circuito']['backup'] = bk
    porid = {l['id']: l for l in locs}
    union = [porid.get(l.get('id'), l) for l in cur] + nuevos   # actualiza los nuestros, conserva el resto
    if len(union) < len(cur):
        raise SystemExit('✗ la unión perdería puntos: abortado')
    code, r = http('PUT', OMNIP, {'locations': union}, {'Authorization': 'Bearer ' + secreto('ADMIN_TOKEN')}, timeout=120)
    if code >= 300:
        raise SystemExit(f'✗ PUT catálogo → HTTP {code} {scrub(r)}')
    st['circuito'].update({'ok': True, 'catalogo_antes': len(cur), 'catalogo_despues': len(union)})
    log(f"circuito {cfg['circuit']} publicado ({len(locs)} Xpacios) · copia en {bk}")

# ─── 3 · parrilla ────────────────────────────────────────────────────────────
BANDAS = [{'id': 'manana', 'label': 'Mañana', 'from': '08:00', 'to': '12:00', 'capacity': 6},
          {'id': 'mediodia', 'label': 'Mediodía', 'from': '12:00', 'to': '16:00', 'capacity': 6},
          {'id': 'tarde', 'label': 'Tarde', 'from': '16:00', 'to': '20:00', 'capacity': 6},
          {'id': 'noche', 'label': 'Noche', 'from': '20:00', 'to': '23:59', 'capacity': 6}]

def paso_grid(cfg, st):
    code, d = http('GET', f'{API}/grid/screens')
    existing = {s.get('screen') for s in (d or {}).get('screens', [])} if code == 200 else set()
    hechas = []
    for c in cfg['ciudades']:
        sid = f"{cfg['id']}-demo-{c}"
        if sid in existing:
            hechas.append(sid); continue
        if cfg['dry']:
            log('[dry] grid/config', sid); continue
        body = {'key': secreto('GRID_KEY'), 'screen': sid, 'name': f"{cfg['nombre']} · {CIUDADES[c]['city']}"[:80],
                'circuit': cfg['circuit'], 'policy': 'manual', 'slotSeconds': 15, 'pixerScreens': [], 'bands': BANDAS}
        code, r = http('POST', f'{API}/grid/config', body)
        if code >= 300 or not (r or {}).get('ok'):
            raise SystemExit(f'✗ grid/config {sid} → HTTP {code} {scrub(r)}')
        hechas.append(sid)
    st['grid'] = {'ok': True, 'pantallas': hechas, 'url': f'{API}/grid/screens'}
    log(f'parrilla: {len(hechas)} pantallas del circuito {cfg["circuit"]}')

# ─── 4 · audio: 2 canciones EN/ES + 2 locuciones ES/EN ───────────────────────
def letras(cfg, lang):
    n = cfg['nombre']
    if lang == 'en':
        return (f"[Verse]\nCity lights are glowing, the doors are open wide\n{n} is where ideas come alive\n"
                f"[Chorus]\nPower up your day, feel the future flow\nSmarter every moment, let your vision grow\n{n}, {n}, ready when you go")
    return (f"[Verso]\nLas luces de la ciudad, la puerta abierta está\n{n} es el lugar donde todo empieza ya\n"
            f"[Estribillo]\nEnciende tu día, siente el futuro llegar\nMás listo cada instante, tu idea va a volar\n{n}, {n}, contigo a cualquier lugar")

def to_mp3(raw, mime):
    if 'mpeg' in (mime or '') or 'mp3' in (mime or ''):
        return raw
    import tempfile
    with tempfile.TemporaryDirectory() as td:
        src = os.path.join(td, 'in.' + ('wav' if 'wav' in mime else 'bin')); dst = os.path.join(td, 'out.mp3')
        open(src, 'wb').write(raw)
        subprocess.run(['ffmpeg', '-y', '-loglevel', 'error', '-i', src, '-codec:a', 'libmp3lame', '-b:a', '192k', dst], check=True)
        return open(dst, 'rb').read()

def paso_audio(cfg, st):
    au = st.setdefault('audio', {'canciones': {}, 'locuciones': {}})
    for lang in ['en', 'es']:
        if au['canciones'].get(lang, {}).get('id') and not cfg['rehacer']:
            log(f'canción {lang} ya publicada → {au["canciones"][lang]["id"]}'); continue
        estilo = ('Upbeat modern electronic pop for a premium technology flagship store, bright synths, warm female vocal, 112 BPM'
                  if lang == 'en' else
                  'Pop electrónico moderno y luminoso para tienda tecnológica premium, sintetizadores brillantes, voz femenina cálida en español, 112 BPM')
        titulo = f"{lang.upper()} · {cfg['nombre']} Hilo · {'Power Up Your Day' if lang == 'en' else 'Enciende tu día'}"
        if cfg['dry']:
            log('[dry] lyria3 + hilomusical/push', titulo); continue
        hdr = {'X-Notify-Key': secreto('NOTIFY_KEY')}
        audio = None
        for intento in range(3):
            code, r = http('POST', f'{API}/lyria3/generate', {'prompt': estilo, 'lyrics': letras(cfg, lang), 'model': 'lyria-3-clip-preview'}, hdr, timeout=240)
            if code == 200 and (r or {}).get('audio'):
                audio = to_mp3(base64.b64decode(r['audio']), r.get('mimeType', 'audio/mpeg')); break
            log(f'lyria3 {lang} intento {intento+1} → HTTP {code} {str(scrub(r))[:160]}'); time.sleep(4)
        if not audio:
            raise SystemExit(f'✗ no se pudo generar la canción {lang}')
        open(os.path.join(cfg['out'], f"demo-{cfg['id']}-hilo-{lang}.mp3"), 'wb').write(audio)
        code, p = http('POST', f'{API}/hilomusical/push', {'store': cfg['store'], 'title': titulo, 'motor': 'Lyria 3 · crear-demo',
                        'base64': base64.b64encode(audio).decode(), 'mime': 'audio/mpeg', 'tags': [cfg['id'], 'lang-' + lang],
                        'prompt': estilo}, timeout=180)
        if code >= 300 or not (p or {}).get('id'):
            raise SystemExit(f'✗ hilomusical/push {lang} → HTTP {code} {scrub(p)}')
        au['canciones'][lang] = {'id': p['id'], 'url': p.get('url') or f"{API}/stock/asset/{p['id']}", 'title': titulo, 'lang': lang,
                                 'stock': f"{API}/stock/asset/{p['id']}"}
        log(f'canción {lang} → Stock {p["id"]}')
        guardar_estado(cfg, st)
    hora = cfg['cierre']
    hh = int(hora.split(':')[0]); h12 = (hh % 12) or 12; ampm = 'PM' if hh >= 12 else 'AM'
    if not hora.endswith(':00'): h12 = f"{h12}:{hora.split(':')[1]}"
    textos = {
        'es': f"Atención, clientes de {cfg['nombre']}: hoy cerramos antes de las {hora.replace(':00', '')} horas. Gracias por su visita.",
        'en': f"Attention {cfg['nombre']} shoppers: today we close before {h12} {ampm}. Thank you for visiting.",
    }
    voces = {'es': 'EXAVITQu4vr4xnSDxMaL', 'en': 'ErXwobaYiN019PkySvjV'}
    for lang in ['es', 'en']:
        if au['locuciones'].get(lang, {}).get('url') and not cfg['rehacer']:
            log(f'locución {lang} ya generada'); continue
        if cfg['dry']:
            log('[dry] megafonia/push', textos[lang]); continue
        code, r = http('POST', f'{API}/megafonia/push', {'store': cfg['store'], 'text': textos[lang], 'voice_id': voces[lang], 'lang': lang}, timeout=120)
        if code >= 300 or not (r or {}).get('url'):
            raise SystemExit(f'✗ megafonia/push {lang} → HTTP {code} {scrub(r)}')
        au['locuciones'][lang] = {'id': r['id'], 'url': r['url'], 'text': textos[lang], 'lang': lang}
        try:
            c2, b = http('GET', r['url'], raw=True, timeout=60)
            if c2 == 200: open(os.path.join(cfg['out'], f"demo-{cfg['id']}-locucion-{lang}.mp3"), 'wb').write(b)
        except Exception:
            pass
        log(f'locución {lang} → {r["url"]}')
        guardar_estado(cfg, st)
    au['feed'] = f"{API}/hilomusical/next?store={cfg['store']}&since=0"
    au['megafonia'] = f"{API}/megafonia/next?store={cfg['store']}&since=0"

# ─── 5 · playlist XPL ────────────────────────────────────────────────────────
def items_playlist(st):
    au = st.get('audio') or {}
    items = []
    for lang in ['en', 'es']:
        c = (au.get('canciones') or {}).get(lang)
        if c: items.append({'id': c['id'], 'stockId': c['id'], 'title': c['title'], 'url': c['stock'], 'type': 'audio', 'kind': 'song', 'lang': lang})
    for lang in ['es', 'en']:
        v = (au.get('locuciones') or {}).get(lang)
        if v: items.append({'id': v['id'], 'title': f"{lang.upper()} · Locución cierre", 'url': v['url'], 'type': 'audio', 'kind': 'voiceover', 'lang': lang, 'text': v['text']})
    return items

def paso_xpl(cfg, st):
    items = items_playlist(st)
    if len(items) < 4 and not cfg['dry']:
        raise SystemExit(f'✗ playlist incompleta ({len(items)} items): ejecuta antes el paso audio')
    now = int(time.time() * 1000)
    code, cur = http('GET', XPL)
    if code != 200 or not isinstance(cur, dict):
        raise SystemExit(f'✗ GET xpl → HTTP {code}')
    playlists = list(cur.get('playlists') or [])
    pid = 'pl_' + cfg['playlist'].replace('.', '_')
    previa = next((p for p in playlists if p.get('name') == cfg['playlist'] or p.get('id') == pid), None)
    pl = {'id': pid, 'name': cfg['playlist'], 'createdAt': (previa or {}).get('createdAt', now), 'updatedAt': now,
          'tags': ['hilomusical', cfg['id'], 'cliente.xpacio.hilomusical', 'demo'], 'activeLang': 'en',
          'marca': cfg['id'], 'circuit': cfg['circuit'], 'items': items}
    out = [pl if (p.get('name') == cfg['playlist'] or p.get('id') == pid) else p for p in playlists]
    if not previa: out.insert(0, pl)
    if cfg['dry']:
        log('[dry] xpl', cfg['playlist'], len(items)); return
    code, r = http('POST', XPL, {'key': secreto('XPL_TOKEN'), 'playlists': out}, timeout=60)
    if code >= 300 or not (r or {}).get('ok'):
        raise SystemExit(f'✗ POST xpl → HTTP {code} {scrub(r)}')
    _, ver = http('GET', XPL)
    hits = [p for p in (ver or {}).get('playlists', []) if p.get('name') == cfg['playlist']]
    st['xpl'] = {'ok': bool(hits), 'name': cfg['playlist'], 'items': len(hits[0]['items']) if hits else 0, 'url': XPL,
                 'conservadas': len(out) - 1}
    log(f"XPL «{cfg['playlist']}» items={st['xpl']['items']} (otras playlists conservadas: {len(out)-1})")

# ─── 6 · asignar en GRID ─────────────────────────────────────────────────────
def paso_book(cfg, st):
    items = items_playlist(st)
    from zoneinfo import ZoneInfo
    fecha = datetime.datetime.now(ZoneInfo('Europe/Madrid')).strftime('%Y-%m-%d')
    res = {'fecha': fecha, 'reservas': 0, 'ya': 0, 'fallos': 0, 'por_pantalla': {}}
    for c in cfg['ciudades']:
        sid = f"{cfg['id']}-demo-{c}"
        code, day = http('GET', f'{API}/grid/day?screen={sid}&date={fecha}')
        bands = (day or {}).get('bands') or []
        target = [b for b in bands if b.get('isNow')] or [b for b in bands if b.get('id') == 'tarde'] or bands[:1]
        n = 0
        for b in target:
            ya = json.dumps(b, ensure_ascii=False)
            for it in items:
                if it['url'] in ya:
                    res['ya'] += 1; n += 1; continue
                if cfg['dry']:
                    log('[dry] book', sid, b.get('id'), it['title']); continue
                body = {'key': secreto('GRID_KEY'), 'screen': sid, 'date': fecha, 'bandId': b['id'], 'status': 'own',
                        'advertiser': f"Playlist · {cfg['playlist']}", 'title': it['title'],
                        'creative': {'type': 'audio', 'url': it['url'], 'name': it['title']}}
                code, r = http('POST', f'{API}/grid/book', body)
                if code < 300 and (r or {}).get('ok'):
                    res['reservas'] += 1; n += 1
                else:
                    res['fallos'] += 1; log(f'book {sid} → HTTP {code} {str(scrub(r))[:160]}')
            res['por_pantalla'][sid] = {'banda': b.get('id'), 'items': n, 'verificar': f'{API}/grid/day?screen={sid}&date={fecha}'}
    res['ok'] = res['fallos'] == 0
    st['book'] = res
    log(f"GRID: {res['reservas']} reservas nuevas, {res['ya']} ya estaban, {res['fallos']} fallos")

# ─── 7 · gemelos admira.store ────────────────────────────────────────────────
def paso_twins(cfg, st):
    tw = {}
    for c in cfg['ciudades']:
        lid = f"{cfg['id']}-demo-{c}"
        url = twin_url(cfg, lid)
        code, _ = http('GET', url, raw=True, headers={'Accept': 'text/html'})
        c2, loc = http('GET', f'{OMNIP}/{lid}')
        tw[lid] = {'url': url, 'http': code, 'en_catalogo': c2 == 200 and isinstance(loc, dict) and (loc.get('id') == lid or (loc.get('location') or {}).get('id') == lid)}
    st['twins'] = {'ok': all(v['http'] == 200 for v in tw.values()), 'gemelos': tw}
    log('gemelos:', {k: (v['http'], v['en_catalogo']) for k, v in tw.items()})

# ─── 8 · resumen ─────────────────────────────────────────────────────────────
def paso_resumen(cfg, st):
    i = cfg['id']
    st['urls'] = {
        'marca': f'{NEXT}/marcablanca/?marca={i}', 'marca_api': f'{NEXT}/marcablanca/api/marcas/{i}',
        'biz_circuito': f"{BIZ}?marca={i}&circuit={cfg['circuit']}", 'biz_tour': f"{BIZ}?marca={i}&circuit={cfg['circuit']}&tour=1",
        'studio_hilo': f"https://www.admira.studio/hilomusical.html?marca={i}&store={cfg['store']}",
        'studio_megafonia': f"https://www.admira.studio/megafonia.html?marca={i}&store={cfg['store']}",
        'store_twin': twin_url(cfg, f"{i}-demo-{cfg['ciudades'][-1]}"),
        'tv_playlists': f'https://www.admira.tv/playlists/?marca={i}',
        'xpl': XPL, 'feed': f"{API}/hilomusical/next?store={cfg['store']}&since=0",
        'megafonia_feed': f"{API}/megafonia/next?store={cfg['store']}&since=0",
    }
    guardar_estado(cfg, st)
    md = [f"# Demo {cfg['nombre']} · {time.strftime('%Y-%m-%d %H:%M')} (Madrid)", '']
    for k, v in st['urls'].items(): md.append(f'- **{k}**: {v}')
    md.append(''); md.append('```json'); md.append(json.dumps(scrub({k: v for k, v in st.items() if k != 'urls'}), ensure_ascii=False, indent=1)[:6000]); md.append('```')
    open(os.path.join(cfg['out'], f'demo-{i}-RESUMEN.md'), 'w').write('\n'.join(md))
    log('resumen →', os.path.join(cfg['out'], f'demo-{i}-RESUMEN.md'))

def guardar_estado(cfg, st):
    json.dump(scrub(st), open(cfg['estado'], 'w'), ensure_ascii=False, indent=1)

def main():
    ap = argparse.ArgumentParser(description='«créame demo de <cliente>»')
    ap.add_argument('--cliente', required=True)
    ap.add_argument('--web', required=True)
    ap.add_argument('--id', help='id de marca/circuito (por defecto slug del cliente)')
    ap.add_argument('--color', default='', help='color primario #RRGGBB (wordmark y marca)')
    ap.add_argument('--sector', default='Retail físico')
    ap.add_argument('--ciudades', default='london,newyork,barcelona,madrid')
    ap.add_argument('--cierre', default='20:00', help='hora de cierre de la locución (HH:MM)')
    ap.add_argument('--pasos', default=','.join(PASOS))
    ap.add_argument('--out', default=os.path.expanduser('~/Claude/demos'))
    ap.add_argument('--rehacer', action='store_true', help='regenera marca y audio aunque existan')
    ap.add_argument('--dry-run', action='store_true')
    a = ap.parse_args()
    i = a.id or slug(a.cliente)
    ciudades = [slug(c, '') for c in a.ciudades.split(',') if c.strip()]
    for c in ciudades:
        if c not in CIUDADES: raise SystemExit(f'✗ ciudad sin preset: {c} (hay: {", ".join(CIUDADES)})')
    out = os.path.join(a.out, i); os.makedirs(out, exist_ok=True)
    cfg = {'id': i, 'nombre': a.cliente.strip(), 'web': a.web, 'color': a.color, 'sector': a.sector, 'ciudades': ciudades,
           'cierre': a.cierre, 'store': re.sub(r'[^a-z0-9_-]', '', i), 'playlist': f'{i}.xpacio.hilomusical',
           'circuit': 'demo_' + slug(i, '_'), 'out': out, 'estado': os.path.join(out, f'demo-{i}-estado.json'),
           'dry': a.dry_run, 'rehacer': a.rehacer,
           'circuit_label_es': f"Circuito {a.cliente.strip()} · Demo {len(ciudades)} ciudades",
           'circuit_label_en': f"{a.cliente.strip()} circuit · {len(ciudades)}-city demo"}
    st = json.load(open(cfg['estado'])) if os.path.exists(cfg['estado']) else {}
    st.update({'cliente': cfg['nombre'], 'id': i, 'circuit': cfg['circuit'], 'playlist': cfg['playlist'], 'store': cfg['store'],
               'ciudades': ciudades, 'ultima_ejecucion': time.strftime('%Y-%m-%dT%H:%M:%S%z')})
    fn = {'marca': paso_marca, 'circuito': paso_circuito, 'grid': paso_grid, 'audio': paso_audio,
          'xpl': paso_xpl, 'book': paso_book, 'twins': paso_twins, 'resumen': paso_resumen}
    for p in [x.strip() for x in a.pasos.split(',') if x.strip()]:
        log(f'── paso {p} ──')
        fn[p](cfg, st)
        guardar_estado(cfg, st)
    print(json.dumps(scrub(st.get('urls') or {}), ensure_ascii=False, indent=1))

if __name__ == '__main__':
    main()
