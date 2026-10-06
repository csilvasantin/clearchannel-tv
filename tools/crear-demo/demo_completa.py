#!/usr/bin/env python3
"""
demo_completa.py · ejecutor paso a paso de la DEMO COMPLETA v2 (plan admiranext.demo-completa/2).
«preparalo y aprendemos a medida que hacemos» (Carlos, 06-10-2026).

Lee el plan JSON que genera www.admiranext.com/demo (v2) y ejecuta sus 7 pasos de uno en uno:

  1 marca      Marca blanca REAL en el catálogo único (analizar la web + guardar) → /marca <id>.
  2 circuito   Circuito demo_<…> en admira.biz/admira.app con los locales reales (coords exactas).
  3 gemelos    Gemelos admira.store (escena del Xpacio, ?marca=<id>) → comprobación HTTP + catálogo.
  4 itil       CIs ITIL en Yokup (MCP de flota, itil_ci_upsert idempotente por itil_code).
  5 playlists  Playlists con nombre en xpl.admira.store + borrador por pantalla en admira.tv.
  6 piezas     Piezas compartidas (canciones, locuciones, visuales 9:16/16:9) en el Stock de
               Pixeria y su asignación a todos los huecos (playlist × contenido).
  7 checker    Comprobación de punta a punta (solo lecturas públicas) + presencia SIMULADA.

Reglas
  · Por defecto es un ENSAYO (dry-run): solo lecturas públicas; no escribe nada fuera.
    Las escrituras reales exigen --real.
  · Idempotente: cada paso comprueba antes de crear; re-ejecutar no duplica.
  · Cada ejecución deja estado (<estado-dir>/<id>-estado.json) y una línea de evidencia
    (<estado-dir>/<id>-evidencias.jsonl, solo se añade).
  · Secretos: variable de entorno con el mismo nombre o la bóveda (~/Claude/admira-vault/vault-get.sh).
    Nunca se imprimen ni se guardan (scrub de todo lo que sale).

Uso
  python3 tools/crear-demo/demo_completa.py --preflight
  python3 tools/crear-demo/demo_completa.py                       # ensayo de los 7 pasos
  python3 tools/crear-demo/demo_completa.py --paso 1 --real       # paso 1 de verdad
  python3 tools/crear-demo/demo_completa.py --hasta 3 --real      # pasos 1..3
  python3 tools/crear-demo/demo_completa.py --paso 4 --hasta 6    # ensayo de 4..6
"""
import argparse, base64, datetime, hashlib, hmac, json, os, subprocess, sys, tempfile, time, urllib.parse, uuid

AQUI = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, AQUI)
import crear_demo as cd  # noqa: E402  (http, UA, endpoints y utilidades de la casa)

NEXT, OMNIP, API, XPL = cd.NEXT, cd.OMNIP, cd.API, cd.XPL
TV_PLAYLIST = 'https://admira.tv/api/playlist'
YOKUP_DATA = 'https://data.yokup.com/api/itil/xpacios/'
YOKUP_MCP = 'https://yokup.com/mcp'
YOKUP_EVENTS = 'https://api.yokup.com/api/installer/events'
PIXERIA = 'https://www.pixeria.com'
# Imagen 4 (generate y ultra) responde 404 en la API de Gemini desde el 17-ago-2026.
# La ruta viva de Pixeria es GET imagen.admira.store/img. Pro releva a Ultra; Flash es el modelo por defecto.
IMAGEN = 'https://imagen.admira.store/img'
IMAGEN_MODELOS = ('gemini-3-pro-image', 'gemini-2.5-flash-image')
PLAN_DEFECTO = os.path.join(AQUI, 'planes', 'demo-365-bcn-plan.json')
VOCES = {'es': 'EXAVITQu4vr4xnSDxMaL', 'en': 'ErXwobaYiN019PkySvjV'}
VAULT = cd.VAULT
VAULT_YOKUP = os.path.expanduser('~/Claude/admira-vault/yokup-mcp-itil.json')

PASOS = {1: 'marca', 2: 'circuito', 3: 'gemelos', 4: 'itil', 5: 'playlists', 6: 'piezas', 7: 'checker'}

# Qué necesita cada paso para escribir (nombres, nunca valores). «lecturas» = lo que se puede
# hacer desde cualquier máquina sin credenciales (el ensayo).
NECESITA = {
    1: {'secretos': ['ADMIRANEXT_PRESENTACIONES_MACHINE_KEY'],
        'lecturas': ['GET /marcablanca/api/marcas/<id>', 'POST /marcablanca/api/analizar (no guarda; 12/10 min por IP)'],
        'escrituras': ['POST|PUT /presentaciones/api/marcas (X-Admira-Machine-Key)']},
    2: {'secretos': ['ADMIN_TOKEN'],
        'lecturas': ['GET brain.digitalavatar.ai/locations'],
        'escrituras': ['PUT brain.digitalavatar.ai/locations (unión por id + copia previa)']},
    3: {'secretos': [],
        'lecturas': ['GET gemelo admira.store', 'GET brain.digitalavatar.ai/locations/<id>'],
        'escrituras': ['ninguna: el gemelo es el campo twin del Xpacio (lo escribe el paso 2)']},
    4: {'secretos': ['YOKUP_MCP_CREDENTIAL'],
        'lecturas': ['GET data.yokup.com/api/itil/xpacios/<id>'],
        'escrituras': ['MCP yokup.com/mcp · itil_ci_upsert (scopes read,itil,itil:write)']},
    5: {'secretos': ['XPL_TOKEN', 'NOTIFY_KEY'],
        'lecturas': ['GET xpl.admira.store/playlists', 'GET admira.tv/api/playlist?screen='],
        'escrituras': ['POST xpl.admira.store/playlists (lista completa, unión)', 'POST admira.tv/api/playlist (X-Notify-Key = STOCK_NOTIFY_KEY)']},
    6: {'secretos': ['NOTIFY_KEY', 'XPL_TOKEN'],
        'lecturas': ['GET api.admira.store/stock/list?catalogo=', 'POST /imagen/generate con X-Auth-Probe (no genera; la ruta de Imagen 4 está en 404)'],
        'escrituras': ['POST /lyria3/generate, /tts (X-Notify-Key)', 'GET imagen.admira.store/img (Gemini, Referer pixeria.com)',
                       'POST /stock/publish (catálogo de la demo)', 'POST xpl + admira.tv (asignación de huecos)']},
    7: {'secretos': [],
        'lecturas': ['todas las anteriores'],
        'escrituras': ['ninguna (presencia SIMULADA local). Opcional --presencia yokup: INSTALLER_ADMIRA_SECRET']},
}

# ─── credenciales (solo nombres hacia fuera) ─────────────────────────────────
_secretos = {}

def secreto(nombre, entorno=None, vault=None):
    """Valor de un secreto o None. Entorno con el mismo nombre → bóveda. Nunca se imprime."""
    if nombre in _secretos:
        return _secretos[nombre]
    entorno = os.environ if entorno is None else entorno
    v = (entorno.get(nombre) or '').strip()
    vault = VAULT if vault is None else vault
    if not v and vault and os.path.exists(vault):
        try:
            v = subprocess.run(['bash', vault, nombre], capture_output=True, text=True, timeout=30).stdout.strip()
        except Exception:
            v = ''
    _secretos[nombre] = v or None
    if v:
        cd._secret_cache[nombre] = v   # para que cd.scrub también lo tape
    return _secretos[nombre]

def credencial_yokup(entorno=None):
    """{endpoint, token} del MCP de Yokup (fichero 0600 que emite mcp-credential.mjs) o None."""
    if 'YOKUP_MCP_CREDENTIAL' in _secretos:
        return _secretos['YOKUP_MCP_CREDENTIAL']
    entorno = os.environ if entorno is None else entorno
    ruta = (entorno.get('YOKUP_MCP_CREDENTIAL') or '').strip() or VAULT_YOKUP
    cred = None
    if os.path.exists(ruta):
        try:
            d = leer_json(ruta)
            if str(d.get('token', '')).startswith('ykm_'):
                cred = {'endpoint': d.get('endpoint') or YOKUP_MCP, 'token': d['token']}
                cd._secret_cache['YOKUP_MCP_CREDENTIAL'] = d['token']
        except Exception:
            cred = None
    _secretos['YOKUP_MCP_CREDENTIAL'] = cred
    return cred

def hay(nombre):
    return bool(credencial_yokup() if nombre == 'YOKUP_MCP_CREDENTIAL' else secreto(nombre))

def scrub(obj):
    s = json.dumps(obj, ensure_ascii=False, default=str)
    vals = [v for v in cd._secret_cache.values() if v and len(v) > 6]
    for v in sorted(vals, key=len, reverse=True):
        s = s.replace(v, '***')
    return json.loads(s)

def log(*a):
    print('·', *[scrub(x) if isinstance(x, (dict, list)) else x for x in a], flush=True)

def leer_json(ruta):
    with open(ruta) as f:
        return json.load(f)

def escribir_json(ruta, obj, indent=None):
    with open(ruta, 'w') as f:
        json.dump(obj, f, ensure_ascii=False, indent=indent)

# ─── HTTP ────────────────────────────────────────────────────────────────────
def http(method, url, body=None, headers=None, timeout=60, raw=False):
    """cd.http sin excepciones de red: (0, {'_error': …}) si no hay respuesta."""
    try:
        return cd.http(method, url, body, headers, timeout=timeout, raw=raw)
    except Exception as e:  # URLError, timeout…
        return 0, {'_error': f'{type(e).__name__}: {str(e)[:160]}'}

# ─── plan ────────────────────────────────────────────────────────────────────
def cargar_plan(ruta):
    d = leer_json(ruta)
    plan = d.get('plan', d)
    if plan.get('schema') != 'admiranext.demo-completa/2':
        raise SystemExit(f"✗ el plan no es admiranext.demo-completa/2 (es {plan.get('schema')!r})")
    if not plan.get('establecimientos'):
        raise SystemExit('✗ el plan no trae establecimientos')
    return plan

def equipos(plan):
    for e in plan['establecimientos']:
        for q in e['equipos']:
            yield e, q

def playlists(plan):
    for e, q in equipos(plan):
        for p in q['playlists']:
            yield e, q, p

def pieza_id(c):
    return cd.slug(c['titulo'])[:60]

def piezas_unicas(plan):
    vistas = {}
    for _, _, p in playlists(plan):
        for c in p['contenidos']:
            vistas.setdefault(pieza_id(c), dict(c))
    return vistas

def totales(plan):
    eqs = list(equipos(plan)); pls = list(playlists(plan))
    return {
        'establecimientos': len(plan['establecimientos']),
        'gemelos': sum(1 for e in plan['establecimientos'] if e.get('gemelo')),
        'equipos': len(eqs),
        'playlists': len(pls),
        'playlists_continuas': sum(1 for *_, p in pls if p.get('reproduccion') == 'continua'),
        'playlists_bajo_demanda': sum(1 for *_, p in pls if p.get('reproduccion') == 'bajo_demanda'),
        'huecos_contenido': sum(len(p['contenidos']) for *_, p in pls),
        'piezas_unicas': len(piezas_unicas(plan)),
    }

def nombre_ciudad(plan):
    """La ciudad del plan es un texto o {nombre, pais, corta}. Nunca se imprime el diccionario."""
    ciudad = plan.get('ciudad') or ''
    if isinstance(ciudad, dict):
        ciudad = ciudad.get('nombre') or ciudad.get('corta') or ''
    elif not isinstance(ciudad, str):
        ciudad = ''
    ciudad = str(ciudad).strip()
    if ciudad:
        return ciudad
    for est in plan.get('establecimientos') or []:
        local = est.get('ciudad')
        if isinstance(local, str) and local.strip():
            return local.strip()
    return ''

def catalogo_stock(plan):
    return {'id': cd.slug(plan['circuito']), 'cliente': cd.slug(plan['marca_blanca']['id']),
            'nombre': f"Demo {plan['marca_blanca']['nombre']} · {nombre_ciudad(plan) or 'circuito'}",
            'proyecto': cd.slug(plan['circuito'])}

# ─── contexto, estado y evidencia ────────────────────────────────────────────
class Ctx:
    def __init__(self, plan, real=False, estado_dir=None, rehacer=False, analizar=True, presencia='simulada', color=''):
        self.plan, self.real, self.rehacer, self.analizar, self.presencia = plan, real, rehacer, analizar, presencia
        self.color = color
        self.id = cd.slug(plan['circuito'].replace('demo_', '')) or 'demo'
        self.dir = os.path.expanduser(estado_dir or f'~/Claude/demos/{self.id}')
        os.makedirs(self.dir, exist_ok=True)
        self.f_estado = os.path.join(self.dir, f'{self.id}-estado.json')
        self.f_evid = os.path.join(self.dir, f'{self.id}-evidencias.jsonl')
        self.st = leer_json(self.f_estado) if os.path.exists(self.f_estado) else {}
        self.st.setdefault('pasos', {})
        self.modo = 'real' if real else 'ensayo'

    def guardar(self):
        self.st.update({'plan_schema': self.plan['schema'], 'circuito': self.plan['circuito'],
                        'actualizado': ahora()})
        tmp = self.f_estado + '.tmp'
        with open(tmp, 'w') as f:
            json.dump(scrub(self.st), f, ensure_ascii=False, indent=1)
        os.replace(tmp, self.f_estado)

    def evidencia(self, entrada):
        with open(self.f_evid, 'a') as f:
            f.write(json.dumps(scrub(entrada), ensure_ascii=False) + '\n')

def ahora():
    return datetime.datetime.now().astimezone().isoformat(timespec='seconds')

class Bloqueado(Exception):
    def __init__(self, faltan, motivo=''):
        super().__init__(motivo or ('faltan: ' + ', '.join(faltan)))
        self.faltan, self.motivo = faltan, motivo

def exigir(ctx, nombres):
    """En --real, corta el paso ANTES de escribir si falta alguna credencial."""
    faltan = [n for n in nombres if not hay(n)]
    if faltan and ctx.real:
        raise Bloqueado(faltan)
    return faltan

# ─── 1 · marca blanca real ───────────────────────────────────────────────────
def marca_body(plan, propuesta, color=''):
    mb = plan['marca_blanca']
    m = json.loads(json.dumps(propuesta))
    if color:   # el análisis automático propone un color; Carlos puede fijar el de la marca
        for modo in ('claro', 'oscuro'):
            m.setdefault('colores', {}).setdefault(modo, {})['primario'] = color
    m['id'] = mb['id']; m['nombre'] = mb['nombre']; m['nombreCorto'] = mb['nombre']
    m['sector'] = 'Panadería · cafetería' if plan['xpacio'].get('tipo') == 'cafeteria' else (m.get('sector') or 'Retail')
    m['descripcion'] = (f"{mb['nombre']} · marca real ({mb['web']}) como marca blanca de la demo Admira: "
                        f"circuito {plan['circuito']} con {len(plan['establecimientos'])} locales en {nombre_ciudad(plan) or 'la ciudad'}.")
    demo = m.setdefault('demo', {})
    demo.update({'titular': f"{mb['nombre']}, también en pantalla", 'cta': 'Descúbrelo',
                 'circuito': circuit_label(plan)['es'], 'puntos': len(plan['establecimientos']),
                 'superficies': totales(plan)['equipos'], 'tipoEspacio': plan['xpacio'].get('kind', 'Cafetería'),
                 'tiendas': [{'nombre': e['nombre'], 'dir': f"{e['direccion']} · {e['cp']} {e['ciudad']}"} for e in plan['establecimientos']][:6]})
    # propuesta:false → el catálogo no le pone el aviso «no es la marca oficial»: es la marca real.
    return {'marca': m, 'origen': 'url', 'tipo': 'real', 'web': mb['web'], 'propuesta': False}

def paso_marca(ctx):
    mb = ctx.plan['marca_blanca']; mid = mb['id']
    r = {'comprobaciones': {}, 'acciones': [], 'urls': {'catalogo': f'{NEXT}/marcablanca/api/marcas/{mid}',
         'marcablanca': f'{NEXT}/marcablanca/?marca={mid}', 'plataformas': [p['url'] for p in mb['plataformas']]},
         'comando': mb.get('comando')}
    code, cur = http('GET', f'{NEXT}/marcablanca/api/marcas/{mid}')
    existe = code == 200 and isinstance(cur, dict)
    cat = (cur or {}).get('catalogo') or ((cur or {}).get('marca') or {}).get('catalogo') or {} if existe else {}
    r['comprobaciones']['catalogo'] = {'http': code, 'existe': existe, 'tipo': cat.get('tipo'), 'propuesta': cat.get('propuesta')}
    if existe and cat.get('propuesta') is not True and not ctx.rehacer:
        r['acciones'].append(f'marca «{mid}» ya en el catálogo → nada que hacer')
        return 'ok', r
    faltan = exigir(ctx, NECESITA[1]['secretos'])
    # Análisis: se reutiliza el de las últimas 24 h (límite 12/10 min por IP y no guarda nada).
    an = ctx.st.get('cache', {}).get('analisis')
    fresco = an and time.time() - an.get('ts', 0) < 86400 and an.get('web') == mb['web']
    if not fresco and (ctx.analizar or ctx.real):
        c2, d = http('POST', f'{NEXT}/marcablanca/api/analizar', {'url': mb['web']}, {'Origin': NEXT}, timeout=90)
        if c2 == 200 and isinstance(d, dict) and d.get('propuesta'):
            an = {'ts': time.time(), 'web': mb['web'], 'propuesta': d['propuesta']}
            ctx.st.setdefault('cache', {})['analisis'] = an; fresco = True
        r['comprobaciones']['analizar'] = {'http': c2, 'ok': bool(fresco)}
    if fresco:
        p = an['propuesta']; col = (p.get('colores') or {}).get('claro') or {}
        r['comprobaciones']['propuesta'] = {'nombre': p.get('nombre'), 'primario': col.get('primario'), 'primario_fijado': ctx.color or None,
                                            'logo': bool((p.get('logo') or {}).get('imagen') or (p.get('logo') or {}).get('svg'))}
    metodo = 'PUT' if existe else 'POST'
    r['acciones'].append(f'{metodo} /presentaciones/api/marcas · marca «{mid}» tipo real, origen url, propuesta:false')
    r['acciones'].append(f"aplicar {mb.get('comando')} en el CLI Experto (5 plataformas) y comprobar el catálogo")
    if not ctx.real:
        r['faltan'] = faltan
        return 'planificado', r
    if not fresco:
        raise RuntimeError(f"analizar {mb['web']} no devolvió propuesta: {r['comprobaciones'].get('analizar')}")
    body = marca_body(ctx.plan, an['propuesta'], ctx.color)
    hdr = {'X-Admira-Machine-Key': secreto('ADMIRANEXT_PRESENTACIONES_MACHINE_KEY'), 'Origin': NEXT}
    c3, res = http(metodo, f'{NEXT}/presentaciones/api/marcas', body, hdr, timeout=90)
    if c3 == 409 and metodo == 'POST':
        c3, res = http('PUT', f'{NEXT}/presentaciones/api/marcas', body, hdr, timeout=90)
    if c3 not in (200, 201):
        raise RuntimeError(f'guardar marca → HTTP {c3} {str(scrub(res))[:200]}')
    c4, ver = http('GET', f'{NEXT}/marcablanca/api/marcas/{mid}')
    r['comprobaciones']['tras_guardar'] = {'http': c4, 'creada': (res or {}).get('creada')}
    if c4 != 200:
        raise RuntimeError(f'la marca no aparece en el catálogo tras guardarla (HTTP {c4})')
    return 'ok', r

# ─── 2 · circuito admira.biz ─────────────────────────────────────────────────
def circuit_label(plan):
    mb, n = plan['marca_blanca']['nombre'], len(plan['establecimientos'])
    ciudad = nombre_ciudad(plan)
    kind = plan['xpacio'].get('kind', 'Cafetería')
    return {'es': f'Circuito {mb} · {kind} · {ciudad} ({n} locales)', 'en': f'{mb} café circuit · {ciudad} ({n} stores)'}

def audiencia_equipo(q):
    """Impactos al día y CPM de la ficha. Sin número, el mapa pintaba NaN y undefined."""
    if q.get('categoria') == 'audio':
        return 1200, '€3'
    if q.get('orientacion') == 'vertical':
        return 1800, '€9'
    return 900, '€7'

def construir_locations(plan):
    mb = plan['marca_blanca']; cont = plan.get('contenido') or {}
    out = []
    for e in plan['establecimientos']:
        pls = {p['canal']: p for _, q in [(e, q) for q in e['equipos']] for p in q['playlists']}
        surf = []
        for q in e['equipos']:
            audio = q['categoria'] == 'audio'
            impr, cpm = audiencia_equipo(q)
            surf.append({'name': q['nombre'].split(' · ')[0], 'desc': q['nombre'], 'status': 'sched',
                         'impr': impr, 'cpm': cpm,
                         'surface': 'audio' if audio else 'pantalla', 'device': q['pantalla_id'], 'itil_code': q['itil_code'],
                         **({'orientation': q['orientacion']} if q.get('orientacion') else {}),
                         'playlists': [p['playlist'] for p in q['playlists']]})
        out.append({
            'id': e['id'], 'name': e['nombre'],
            'kind': f"{plan['xpacio'].get('kind', 'Cafetería')} · {mb['nombre']} · Circuito demo Admira",
            'addr': f"{e['direccion']} · {e.get('barrio', '')} · {e['cp']} {e['ciudad']} · España".replace(' ·  · ', ' · '),
            'coords': [e['lng'], e['lat']], 'city': e['ciudad'], 'country': e.get('pais', 'ES'), 'tz': 'Europe/Madrid',
            'music': 'lounge', 'cameras': False,
            'circuit': plan['circuito'], 'circuitLabel': circuit_label(plan),
            'client': mb['id'], 'demo': True, 'tourOrder': e['n'],
            'external': {'brand': mb['nombre'], 'network': f"{mb['nombre']} demo", 'operator': mb['nombre'],
                         'source': f"demo-completa v2 · dirección real ({e.get('fuente', 'localizador oficial')})",
                         'url': e.get('fuente_url') or mb['web'], 'ref': e.get('ref')},
            'twin': e['gemelo'], 'xpaceUrl': e['gemelo'],
            'hilomusical': {'store': e['id'], 'playlist': pls.get('hilomusical', {}).get('playlist'), 'langs': cont.get('idiomas') or ['en', 'es']},
            'megafonia': {'store': e['id'], 'playlist': pls.get('locuciones', {}).get('playlist'), 'disparo': 'tpv',
                          'eventos': [x['id'] for x in cont.get('eventos_tpv', [])]},
            'surfaces': surf,
            'segmentation': {'required': False, 'schedule': {'start': '07:00', 'end': cont.get('cierre', '21:00')},
                             'typologies': ['interior'], 'genders': ['hombre', 'mujer'],
                             'ages': ['joven', 'adulto', 'senior'], 'timeSlots': ['manana', 'mediodia', 'tarde']},
        })
    return out

CAMPOS_CLAVE = ('coords', 'circuit', 'twin', 'client', 'name', 'surfaces', 'hilomusical', 'megafonia')

def leer_catalogo():
    code, d = http('GET', OMNIP, timeout=90)
    cur = d if isinstance(d, list) else ((d or {}).get('items') or (d or {}).get('locations') or []) if isinstance(d, dict) else []
    return code, cur

def paso_circuito(ctx):
    locs = construir_locations(ctx.plan)
    seed = os.path.join(ctx.dir, f'circuito-{ctx.id}.seed.json')
    escribir_json(seed, locs, indent=1)
    r = {'comprobaciones': {}, 'acciones': [], 'semilla': seed,
         'urls': {'biz': f"https://www.admira.biz/?marca={ctx.plan['marca_blanca']['id']}&circuit={ctx.plan['circuito']}"}}
    code, cur = leer_catalogo()
    r['comprobaciones']['catalogo'] = {'http': code, 'puntos': len(cur)}
    if code != 200 or len(cur) < 100:
        raise RuntimeError(f'catálogo omnipublicity sospechoso (HTTP {code}, {len(cur)} puntos): no se toca')
    porid = {l.get('id'): l for l in cur}
    nuevos = [l for l in locs if l['id'] not in porid]
    distintos = [l for l in locs if l['id'] in porid and any(porid[l['id']].get(k) != l.get(k) for k in CAMPOS_CLAVE)]
    r['comprobaciones'].update({'nuevos': [l['id'] for l in nuevos], 'a_actualizar': [l['id'] for l in distintos],
                                'iguales': len(locs) - len(nuevos) - len(distintos),
                                'coords': {l['id']: l['coords'] for l in locs}})
    if not nuevos and not distintos:
        r['acciones'].append(f"circuito {ctx.plan['circuito']} ya publicado con sus {len(locs)} Xpacios → nada que hacer")
        return 'ok', r
    faltan = exigir(ctx, NECESITA[2]['secretos'])
    r['acciones'].append(f"PUT catálogo: {len(cur)} → {len(cur) + len(nuevos)} puntos (+{len(nuevos)} nuevos, {len(distintos)} actualizados), copia previa en {ctx.dir}")
    if not ctx.real:
        r['faltan'] = faltan
        return 'planificado', r
    bk = os.path.join(ctx.dir, f"backup-omnipublicity-{time.strftime('%Y%m%d-%H%M%S')}.json")
    escribir_json(bk, cur)
    mios = {l['id']: l for l in locs}
    union = [{**l, **mios[l['id']]} if l.get('id') in mios else l for l in cur] + nuevos
    if len(union) < len(cur):
        raise RuntimeError('la unión perdería puntos: abortado')
    c2, res = http('PUT', OMNIP, {'locations': union}, {'Authorization': 'Bearer ' + secreto('ADMIN_TOKEN')}, timeout=180)
    if c2 >= 300 or c2 == 0:
        raise RuntimeError(f'PUT catálogo → HTTP {c2} {str(scrub(res))[:200]}')
    r['backup'] = bk
    r['comprobaciones']['despues'] = {'antes': len(cur), 'despues': len(union)}
    return 'ok', r

# ─── 3 · gemelos admira.store ────────────────────────────────────────────────
def paso_gemelos(ctx):
    r = {'comprobaciones': {}, 'acciones': []}
    _, cur = leer_catalogo()
    porid = {l.get('id'): l for l in cur}
    ok = True
    for e in ctx.plan['establecimientos']:
        url = e['gemelo']
        c, _ = http('GET', url, raw=True, headers={'Accept': 'text/html'})
        loc = porid.get(e['id']) or {}
        en_cat = loc.get('twin') == url
        marca_ok = f"marca={ctx.plan['marca_blanca']['id']}" in url and f"autostart={ctx.plan['xpacio'].get('autostart')}" in url
        r['comprobaciones'][e['id']] = {'http': c, 'en_catalogo': en_cat, 'escena_y_marca': marca_ok, 'url': url}
        ok = ok and c == 200 and en_cat and marca_ok
        if not en_cat:
            r['acciones'].append(f"{e['id']}: el gemelo aún no está en el catálogo → lo publica el paso 2")
    if ok:
        r['acciones'].append(f"{len(ctx.plan['establecimientos'])} gemelos responden y están en el catálogo")
        return 'ok', r
    return ('pendiente' if ctx.real else 'planificado'), r

# ─── 4 · ITIL (Yokup, MCP de flota) ──────────────────────────────────────────
def mcp_call(cred, tool, args, rid=1):
    body = {'jsonrpc': '2.0', 'id': rid, 'method': 'tools/call', 'params': {'name': tool, 'arguments': args}}
    hdr = {'Authorization': 'Bearer ' + cred['token'], 'Accept': 'application/json, text/event-stream',
           'MCP-Protocol-Version': '2025-06-18'}
    code, d = http('POST', cred.get('endpoint') or YOKUP_MCP, body, hdr, timeout=40)
    if code != 200 or not isinstance(d, dict):
        return code, {'error': f'HTTP {code}', 'detalle': scrub(d)}
    if d.get('error'):
        return code, {'error': d['error'].get('message')}
    res = d.get('result') or {}
    out = res.get('structuredContent')
    if out is None:
        try: out = json.loads(((res.get('content') or [{}])[0]).get('text') or 'null')
        except Exception: out = {'texto': ((res.get('content') or [{}])[0]).get('text')}
    if res.get('isError'):
        return code, {'error': out if isinstance(out, (str, dict)) else str(out)}
    return code, out

def ci_args(plan, e, q):
    args = {'admira_store_id': e['id'], 'itil_code': q['itil_code'], 'name': q['nombre'][:160],
            'category': q['categoria'], 'role': q.get('rol') or '', 'group_name': plan['circuito'][:80],
            'position': f"{q['dispositivo']} · {e['direccion']}"[:160]}
    if q.get('orientacion') in ('horizontal', 'vertical'):
        args['orientation'] = q['orientacion']
    return args

def paso_itil(ctx):
    r = {'comprobaciones': {}, 'acciones': []}
    cred = credencial_yokup()
    faltan = exigir(ctx, NECESITA[4]['secretos'])
    hechos = pend_sync = 0
    for e in ctx.plan['establecimientos']:
        c, d = http('GET', YOKUP_DATA + e['id'])   # sin Origin: el CORS de Yokup rechaza orígenes desconocidos
        sync = c == 200
        info = {'xpacio_en_yokup': sync, 'http': c}
        codigos_previos = set()
        if sync and cred:
            _, inv = mcp_call(cred, 'itil_inventory_get', {'admira_store_id': e['id']})
            cis = (inv or {}).get('cis') or (inv or {}).get('items') or []
            codigos_previos = {x.get('code') or x.get('itil_code') for x in cis if isinstance(x, dict)}
            info['cis_itil'] = sorted(c_ for c_ in codigos_previos if c_)
        r['comprobaciones'][e['id']] = info
        for q in e['equipos']:
            if q['itil_code'] in codigos_previos and not ctx.rehacer:
                hechos += 1; continue
            if not sync:
                pend_sync += 1
                r['acciones'].append(f"{q['itil_code']}: esperar a que Yokup sincronice {e['id']} (cron 2 min, tanda ≤15 min, solo Xpacios con gemelo)")
                continue
            r['acciones'].append(f"itil_ci_upsert {q['itil_code']} ({q['categoria']}{' · ' + q['orientacion'] if q.get('orientacion') else ''})")
            if not ctx.real:
                continue
            _, out = mcp_call(cred, 'itil_ci_upsert', ci_args(ctx.plan, e, q))
            if isinstance(out, dict) and out.get('error'):
                raise RuntimeError(f"itil_ci_upsert {q['itil_code']} → {str(scrub(out))[:200]}")
            hechos += 1
            info.setdefault('upserts', []).append({'itil_code': q['itil_code'], 'changed': (out or {}).get('changed')})
    total = totales(ctx.plan)['equipos']
    r['comprobaciones']['resumen'] = {'cis_listos': hechos, 'esperando_sync': pend_sync, 'total': total}
    if hechos == total:
        return 'ok', r
    if not ctx.real:
        r['faltan'] = faltan
        return 'planificado', r
    return 'pendiente', r   # real pero Yokup aún no ha sincronizado algún Xpacio: re-ejecutar luego

# ─── 5 · playlists (xpl.admira.store + admira.tv) ────────────────────────────
def items_de(ctx, p):
    piezas = ctx.st.get('piezas') or {}
    items = []
    for c in p['contenidos']:
        pz = piezas.get(pieza_id(c))
        if not pz or not pz.get('id'):
            continue
        it = {'id': pz['id'], 'stockId': pz['id'], 'title': c['titulo'], 'url': pz['url'], 'type': pz['tipo'],
              'kind': c.get('kind'), **({'lang': c['lang']} if c.get('lang') else {}),
              **({'ratio': c['ratio']} if c.get('ratio') else {})}
        if c.get('evento_tpv'):
            it.update({'evento_tpv': c['evento_tpv'], 'disparo': 'tpv', 'text': pz.get('texto')})
        items.append(it)
    return items

def construir_xpl(ctx, previas):
    now = int(time.time() * 1000)
    porid = {x.get('id'): x for x in previas}
    out = []
    for e, q, p in playlists(ctx.plan):
        prev = porid.get(p['playlist_id']) or {}
        items = items_de(ctx, p) or prev.get('items') or []
        out.append({'id': p['playlist_id'], 'name': p['playlist'], 'createdAt': prev.get('createdAt', now), 'updatedAt': now,
                    'tags': [p['canal'], ctx.plan['marca_blanca']['id'], ctx.plan['circuito'], 'demo'],
                    'activeLang': 'en', 'marca': ctx.plan['marca_blanca']['id'], 'circuit': ctx.plan['circuito'],
                    'xpacio': e['id'], 'device': q['pantalla_id'], 'itil_code': q['itil_code'], 'canal': p['canal'],
                    'reproduccion': p['reproduccion'], 'bucle': p['bucle'], 'disparo': p.get('disparo'),
                    **({'prioridad': p['prioridad']} if p.get('prioridad') else {}), 'items': items})
    return out

def tv_items(ctx, q):
    """Borrador admira.tv por equipo: la playlist continua (bucle). Las locuciones van bajo demanda (TPV)."""
    out = []
    for p in q['playlists']:
        if p.get('reproduccion') != 'continua':
            continue
        for it in items_de(ctx, p):
            out.append({'id': it['id'], 'stockId': it['stockId'], 'title': it['title'], 'asset': it['url'],
                        'assetType': 'audio' if it['type'] in ('music', 'locucion', 'audio') else ('video' if it['type'] == 'video' else 'image'),
                        'seconds': 180 if it['type'] == 'music' else 10, 'tags': [ctx.plan['marca_blanca']['id'], p['canal']]})
    return out

def tv_nombre(q):
    p = next((p for p in q['playlists'] if p.get('reproduccion') == 'continua'), q['playlists'][0])
    return p['playlist']

def sincronizar_playlists(ctx, r, exigir_items=False):
    """Comprueba y (en --real) escribe las 16 playlists XPL + los borradores admira.tv por equipo."""
    code, cur = http('GET', XPL)
    if code != 200 or not isinstance(cur, dict):
        raise RuntimeError(f'GET xpl → HTTP {code}')
    previas = list(cur.get('playlists') or [])
    mias = construir_xpl(ctx, previas)
    ids = {p['id'] for p in mias}
    porid = {p.get('id'): p for p in previas}
    def igual(a, b):
        return b and all(a.get(k) == b.get(k) for k in ('name', 'reproduccion', 'bucle', 'disparo', 'xpacio', 'device')) and \
            [i.get('id') for i in a['items']] == [i.get('id') for i in b.get('items') or []]
    xpl_falta = [p for p in mias if not igual(p, porid.get(p['id']))]
    huecos = sum(len(p['items']) for p in mias)
    r['comprobaciones']['xpl'] = {'http': code, 'existentes': len(previas), 'mias_ya': len(mias) - len(xpl_falta),
                                  'a_escribir': len(xpl_falta), 'huecos_con_pieza': huecos}
    tv_falta = []
    for e, q in equipos(ctx.plan):
        c, d = http('GET', f"{TV_PLAYLIST}?screen={q['pantalla_id']}")
        dr = (d or {}).get('draft') or {}
        want = tv_items(ctx, q)
        same = dr.get('name') == tv_nombre(q) and [i.get('id') for i in dr.get('items') or []] == [i['id'] for i in want]
        if not same:
            tv_falta.append((q, dr, want))
    r['comprobaciones']['admira_tv'] = {'pantallas': totales(ctx.plan)['equipos'], 'a_escribir': len(tv_falta)}
    if exigir_items and huecos < totales(ctx.plan)['huecos_contenido']:
        r['acciones'].append(f"huecos con pieza {huecos}/{totales(ctx.plan)['huecos_contenido']}: faltan piezas del Stock")
    if not xpl_falta and not tv_falta:
        return True
    if xpl_falta:
        r['acciones'].append(f"POST xpl: {len(xpl_falta)} playlists de la demo (se conservan las otras {len(previas) - len(ids & set(porid))})")
    if tv_falta:
        r['acciones'].append(f"POST admira.tv: {len(tv_falta)} borradores por pantalla/altavoz")
    necesita = (['XPL_TOKEN'] if xpl_falta else []) + (['NOTIFY_KEY'] if tv_falta else [])
    r['faltan'] = sorted(set(r.get('faltan') or []) | set(exigir(ctx, necesita)))   # en --real corta ANTES de escribir
    if not ctx.real:
        return False
    if xpl_falta:
        out = [next(m for m in mias if m['id'] == p.get('id')) if p.get('id') in ids else p for p in previas]
        out = [m for m in mias if m['id'] not in porid] + out
        c2, res = http('POST', XPL, {'key': secreto('XPL_TOKEN'), 'playlists': out}, timeout=60)
        if c2 >= 300 or not (res or {}).get('ok'):
            raise RuntimeError(f'POST xpl → HTTP {c2} {str(scrub(res))[:200]}')
    for q, dr, want in tv_falta:
        body = {'screen': q['pantalla_id'], 'name': tv_nombre(q), 'items': want, 'source': f"demo-completa {ctx.plan['circuito']}"}
        if dr.get('rev'):
            body['rev'] = dr['rev']
        c3, res = http('POST', TV_PLAYLIST, body, {'X-Notify-Key': secreto('NOTIFY_KEY')}, timeout=60)
        if c3 >= 300 or not (res or {}).get('ok'):
            raise RuntimeError(f"admira.tv {q['pantalla_id']} → HTTP {c3} {str(scrub(res))[:200]}")
    return True

def paso_playlists(ctx):
    r = {'comprobaciones': {}, 'acciones': [], 'urls': {'xpl': XPL, 'tv': 'https://admira.tv/?marca=' + ctx.plan['marca_blanca']['id']}}
    t = totales(ctx.plan)
    r['comprobaciones']['plan'] = {k: t[k] for k in ('playlists', 'playlists_continuas', 'playlists_bajo_demanda')}
    hecho = sincronizar_playlists(ctx, r)
    return ('ok' if hecho else 'planificado'), r

# ─── 6 · piezas compartidas (Pixeria/Stock) y asignación a los huecos ────────
def textos_locucion(plan):
    mb = plan['marca_blanca']['nombre']; cierre = (plan.get('contenido') or {}).get('cierre', '21:00')
    hh = int(cierre.split(':')[0]); h12 = (hh % 12) or 12
    return {
        'cierre': {'en': f"Dear customers, {mb} closes today at {h12} {'PM' if hh >= 12 else 'AM'}. Thank you for your visit, see you tomorrow for freshly baked bread.",
                   'es': f"Estimados clientes, {mb} cierra hoy a las {cierre.replace(':00', '')} horas. Gracias por su visita; mañana les esperamos con pan recién hecho."},
        'emergencia': {'es': f"Atención, por favor. Por motivos de seguridad, les rogamos que abandonen el local con calma por la salida más cercana y sigan las indicaciones del personal de {mb}.",
                       'en': f"Attention, please. For safety reasons, please leave the premises calmly through the nearest exit and follow the instructions of the {mb} team."},
        'puntual': {'en': f"Fresh from our oven: a new batch is ready at {mb}. Ask our team for today's recommendation.",
                    'es': f"Recién salido del horno: hay una nueva hornada en {mb}. Pregunte a nuestro equipo por la recomendación de hoy."},
    }

def prompt_pieza(plan, c):
    mb = plan['marca_blanca']['nombre']
    if c.get('kind') == 'song':
        es = c.get('lang') == 'es'
        estilo = ('Acústico cálido para panadería-cafetería de barrio, guitarra, piano suave y voz cercana en español, 96 BPM'
                  if es else 'Warm acoustic café pop for a neighbourhood bakery, guitar, soft piano and friendly vocal, 96 BPM')
        letra = (f"[Verso]\nHuele a pan y a café, la mañana empieza aquí\n{mb}, una mesa para ti\n[Estribillo]\nCafé y conversación, el barrio se queda\n{mb}, cada día de la semana"
                 if es else f"[Verse]\nMorning smells like fresh bread, the city says hello\n{mb} keeps the oven warm and slow\n[Chorus]\nSweet afternoons and coffee, stay a little more\n{mb}, every day, right next door")
        return {'prompt': estilo, 'lyrics': letra, 'model': 'lyria-3-clip-preview'}
    if c.get('kind') == 'visual':
        tema = c['titulo'].split(' · ')[1] if ' · ' in c['titulo'] else c['titulo']
        return {'prompt': (f"Fotografía publicitaria premium para digital signage de la panadería-cafetería {mb} (Barcelona): {tema}. "
                           'Luz natural cálida, obrador artesano, producto protagonista, mucho espacio negativo, sin texto ni logotipos.'),
                'aspectRatio': c.get('ratio', '9:16')}
    return {}

def url_visual(prompt, ratio, model):
    q = urllib.parse.urlencode({'prompt': (prompt or '')[:1200], 'ar': ratio or '9:16', 'model': model})
    return f'{IMAGEN}?{q}'

def bajar_visual(prompt, ratio):
    """Bytes de la imagen por la ruta viva. Prueba Pro y, si no hay imagen, Flash."""
    fallo = 'sin respuesta'
    for model in IMAGEN_MODELOS:
        code, data = http('GET', url_visual(prompt, ratio, model),
                          headers={'Referer': PIXERIA + '/', 'Origin': PIXERIA}, timeout=180, raw=True)
        if code == 200 and isinstance(data, (bytes, bytearray)) and len(data) > 500:
            return bytes(data), model
        txt = data.decode('utf-8', 'replace')[:160] if isinstance(data, (bytes, bytearray)) else str(data)[:160]
        fallo = f'{model} HTTP {code} {txt}'
        if code in (401, 403):
            break
    raise RuntimeError(fallo)

def a_mp4(png, segundos=10):
    """Adaptador imagen fija → MP4 (ffmpeg). None si no hay ffmpeg."""
    try:
        with tempfile.TemporaryDirectory() as td:
            src, dst = os.path.join(td, 'in.png'), os.path.join(td, 'out.mp4')
            with open(src, 'wb') as f:
                f.write(png)
            subprocess.run(['ffmpeg', '-y', '-loglevel', 'error', '-loop', '1', '-i', src, '-t', str(segundos), '-r', '25',
                            '-vf', 'scale=trunc(iw/2)*2:trunc(ih/2)*2,format=yuv420p', '-c:v', 'libx264', '-movflags', '+faststart', dst],
                           check=True, timeout=180)
            with open(dst, 'rb') as f:
                return f.read()
    except Exception:
        return None

def generar_pieza(ctx, pid, c):
    """Genera (de pago) y publica una pieza en el Stock. Devuelve el registro de estado."""
    hdr = {'X-Notify-Key': secreto('NOTIFY_KEY')}
    kind, extra = c.get('kind'), {}
    if kind == 'song':
        body = prompt_pieza(ctx.plan, c); audio = None
        for _ in range(3):
            code, d = http('POST', f'{API}/lyria3/generate', body, hdr, timeout=240)
            if code == 200 and (d or {}).get('audio'):
                audio = cd.to_mp3(base64.b64decode(d['audio']), d.get('mimeType', 'audio/mpeg')); break
            time.sleep(4)
        if not audio:
            raise RuntimeError(f'lyria3 no generó «{c["titulo"]}»')
        tipo, mime, data, prompt = 'music', 'audio/mpeg', audio, body['prompt']
    elif kind == 'voiceover':
        texto = textos_locucion(ctx.plan)[c['evento_tpv']][c.get('lang', 'es')]
        code, data = http('POST', f'{API}/tts', {'text': texto, 'voice_id': VOCES.get(c.get('lang'), VOCES['es'])}, hdr, timeout=120, raw=True)
        if code != 200 or not data:
            raise RuntimeError(f'tts «{c["titulo"]}» → HTTP {code}')
        tipo, mime, prompt = 'locucion', 'audio/mpeg', texto
        extra = {'texto': texto, 'evento_tpv': c['evento_tpv']}
    else:
        body = prompt_pieza(ctx.plan, c)
        try:
            png, modelo = bajar_visual(body['prompt'], c.get('ratio', '9:16'))
        except RuntimeError as e:
            raise RuntimeError(f'imagen «{c["titulo"]}» → {e}') from e
        mp4 = a_mp4(png)
        tipo, mime, data = ('video', 'video/mp4', mp4) if mp4 else ('image', 'image/png', png)
        prompt = body['prompt']
        extra = {'modelo': modelo}
    pub = {'type': tipo, 'motor': f"{c.get('motor', kind)} · demo-completa", 'title': c['titulo'][:80], 'mime': mime,
           'base64': base64.b64encode(data).decode(), 'prompt': prompt[:900], 'quality': 'better',
           'tags': [ctx.plan['marca_blanca']['id'], 'demo', kind][:3], 'catalogo': catalogo_stock(ctx.plan)}
    code, d = http('POST', f'{API}/stock/publish', pub, {'Origin': PIXERIA}, timeout=240)
    if code >= 300 or not (d or {}).get('id'):
        raise RuntimeError(f'stock/publish «{c["titulo"]}» → HTTP {code} {str(scrub(d))[:200]}')
    return {'id': d['id'], 'url': d.get('url') or f"{API}/stock/asset/{d['id']}", 'tipo': tipo, 'titulo': c['titulo'],
            'kind': kind, 'sha256': hashlib.sha256(data).hexdigest(), **extra}

def paso_piezas(ctx):
    r = {'comprobaciones': {}, 'acciones': [], 'urls': {'stock': f"{API}/stock/list?catalogo={catalogo_stock(ctx.plan)['id']}&limit=200"}}
    unicas = piezas_unicas(ctx.plan)
    piezas = ctx.st.setdefault('piezas', {})
    code, d = http('GET', f"{API}/stock/list?catalogo={catalogo_stock(ctx.plan)['id']}&limit=200", timeout=120)
    en_stock = {}
    for it in ((d or {}).get('items') or (d or {}).get('assets') or (d if isinstance(d, list) else [])):
        if isinstance(it, dict) and it.get('title'):
            en_stock[cd.slug(it['title'])[:60]] = it
    # Recupera del Stock lo que ya existe aunque el estado local no lo tenga (otra máquina, estado borrado).
    for pid, it in en_stock.items():
        if pid in unicas and not (piezas.get(pid) or {}).get('id'):
            piezas[pid] = {'id': it.get('id'), 'url': it.get('url') or f"{API}/stock/asset/{it.get('id')}",
                           'tipo': it.get('type'), 'titulo': it.get('title'), 'kind': unicas[pid].get('kind'), 'recuperada': True}
    faltan_piezas = [pid for pid in unicas if not (piezas.get(pid) or {}).get('id') or ctx.rehacer]
    r['comprobaciones']['stock'] = {'http': code, 'en_catalogo': len([p for p in unicas if p in en_stock]),
                                    'unicas': len(unicas), 'por_generar': len(faltan_piezas)}
    if hay('NOTIFY_KEY'):   # sonda de autorización sin generar nada (X-Auth-Probe)
        c2, pr = http('POST', f'{API}/imagen/generate', {'prompt': 'probe'}, {'X-Notify-Key': secreto('NOTIFY_KEY'), 'X-Auth-Probe': '1'})
        r['comprobaciones']['sonda_pago'] = {'http': c2, 'ok': bool((pr or {}).get('ok'))}
    coste = {'song': 'Lyria 3', 'voiceover': 'ElevenLabs', 'visual': 'Gemini imagen'}
    for pid in faltan_piezas:
        c = unicas[pid]
        r['acciones'].append(f"generar {c.get('kind')} «{c['titulo']}» ({coste.get(c.get('kind'), '?')}, de pago) → stock/publish")
    r['faltan'] = exigir(ctx, ['NOTIFY_KEY']) if faltan_piezas else []
    if ctx.real:
        for pid in faltan_piezas:
            piezas[pid] = generar_pieza(ctx, pid, unicas[pid])
            ctx.guardar()
    hecho = sincronizar_playlists(ctx, r, exigir_items=True)
    completo = r['comprobaciones']['xpl']['huecos_con_pieza'] == totales(ctx.plan)['huecos_contenido']
    if ctx.real:
        return ('ok' if hecho and completo else 'pendiente'), r
    if faltan_piezas:   # el ensayo no genera: la asignación real necesitará también XPL_TOKEN
        r['faltan'] = sorted(set(r['faltan']) | {s for s in NECESITA[6]['secretos'] if not hay(s)})
    return ('ok' if hecho and completo and not faltan_piezas else 'planificado'), r

# ─── disparo manual de locución (sustituto del evento TPV, que aún no existe) ─
def disparar(ctx, evento, sitio, lang):
    e = next((x for x in ctx.plan['establecimientos'] if sitio in (x['id'], x['slug'])), None)
    if not e:
        raise SystemExit(f'✗ sitio desconocido: {sitio}')
    texto = textos_locucion(ctx.plan)[evento][lang]
    body = {'store': e['id'], 'text': texto, 'voice_id': VOCES[lang], 'lang': lang}
    if not ctx.real:
        log(f'[ensayo] POST {API}/megafonia/push', {'store': e['id'], 'evento': evento, 'lang': lang})
        return 'planificado', {'acciones': [f'megafonia/push {evento} → {e["id"]}']}
    code, d = http('POST', f'{API}/megafonia/push', body, timeout=120)
    if code >= 300 or not (d or {}).get('url'):
        raise RuntimeError(f'megafonia/push → HTTP {code} {str(scrub(d))[:200]}')
    return 'ok', {'acciones': [f'locución {evento} encolada en {e["id"]}'], 'url': d['url']}

# ─── 7 · checker de punta a punta + presencia simulada ───────────────────────
def presencia_yokup(ctx, e, q):
    sec = secreto('INSTALLER_ADMIRA_SECRET')
    payload = {'event_id': f"{q['itil_code']}-{int(time.time())}", 'type': 'heartbeat',
               'device': {'id': q['itil_code'], 'name': q['nombre'][:160], 'address': f"{e['direccion']}, {e['cp']} {e['ciudad']}",
                          'latitude': e['lat'], 'longitude': e['lng'], 'skill': 'audio' if q['categoria'] == 'audio' else 'screen',
                          'timeout_seconds': 86400},
               'occurred_at': datetime.datetime.now(datetime.timezone.utc).isoformat()}
    raw = json.dumps(payload, separators=(',', ':')).encode()
    ts = str(int(time.time()))
    firma = hmac.new(sec.encode(), ts.encode() + b'.' + raw, hashlib.sha256).hexdigest()
    return http('POST', YOKUP_EVENTS, raw, {'X-Admira-Timestamp': ts, 'X-Admira-Signature': firma, 'Content-Type': 'application/json'})

def paso_checker(ctx):
    plan = ctx.plan; t = totales(plan); mid = plan['marca_blanca']['id']
    chk = {}
    c, _ = http('GET', f'{NEXT}/marcablanca/api/marcas/{mid}')
    chk['1_marca_en_catalogo'] = c == 200
    plats = {}
    for p in plan['marca_blanca']['plataformas']:
        c2, _ = http('GET', p['url'], raw=True, headers={'Accept': 'text/html'})
        plats[p['id']] = c2
    # admira.studio y admira.store están tras la puerta de acceso (401 sin sesión): cuenta como «responde».
    chk['1_plataformas_responden'] = all(v in (200, 401, 403) for v in plats.values())
    code, cur = leer_catalogo()
    porid = {l.get('id'): l for l in cur}
    mios = [porid.get(e['id']) for e in plan['establecimientos']]
    chk['2_circuito_xpacios'] = all(m and m.get('circuit') == plan['circuito'] for m in mios)
    chk['2_coords_reales'] = all(m and [round(float(x), 6) for x in m.get('coords', [])] == [round(e['lng'], 6), round(e['lat'], 6)]
                                 for m, e in zip(mios, plan['establecimientos']))
    tw = []
    for e in plan['establecimientos']:
        c3, _ = http('GET', e['gemelo'], raw=True, headers={'Accept': 'text/html'})
        tw.append(c3 == 200 and (porid.get(e['id']) or {}).get('twin') == e['gemelo'])
    chk['3_gemelos'] = all(tw)
    sync = [http('GET', YOKUP_DATA + e['id'])[0] == 200 for e in plan['establecimientos']]
    chk['4_xpacios_en_yokup'] = all(sync)
    cred = credencial_yokup()
    if cred and all(sync):
        codes = set()
        for e in plan['establecimientos']:
            _, inv = mcp_call(cred, 'itil_inventory_get', {'admira_store_id': e['id']})
            codes |= {x.get('code') or x.get('itil_code') for x in ((inv or {}).get('cis') or []) if isinstance(x, dict)}
        chk['4_cis_itil'] = all(q['itil_code'] in codes for _, q in equipos(plan))
    else:
        chk['4_cis_itil'] = None   # sin credencial ITIL de lectura no se puede afirmar
    c4, xp = http('GET', XPL)
    pl = {p.get('id'): p for p in (xp or {}).get('playlists') or []} if c4 == 200 else {}
    mias = [pl.get(p['playlist_id']) for *_, p in playlists(plan)]
    chk['5_playlists_xpl'] = all(mias)
    huecos = sum(len((m or {}).get('items') or []) for m in mias)
    chk['6_huecos_asignados'] = huecos == t['huecos_contenido']
    tv = 0
    for _, q in equipos(plan):
        _, d = http('GET', f"{TV_PLAYLIST}?screen={q['pantalla_id']}")
        tv += 1 if ((d or {}).get('draft') or {}).get('items') else 0
    chk['5_admira_tv_borradores'] = tv == t['equipos']
    ids = {i.get('id') for m in mias for i in ((m or {}).get('items') or [])}
    chk['6_piezas_unicas'] = len(ids) == t['piezas_unicas']
    # Presencia: SIMULADA (local) por defecto. Yokup solo con --presencia yokup --real (ver riesgos).
    pres = {}
    for e, q in equipos(plan):
        pres[q['itil_code']] = {'estado': 'SIMULADO', 'visto': ahora(), 'xpacio': e['id'], 'equipo': q['pantalla_id']}
    if ctx.presencia == 'yokup':
        if not ctx.real:
            pres['_nota'] = 'ensayo: no se envían latidos a Yokup'
        else:
            exigir(ctx, ['INSTALLER_ADMIRA_SECRET'])
            for e, q in equipos(plan):
                c5, _ = presencia_yokup(ctx, e, q)
                pres[q['itil_code']].update({'estado': 'YOKUP' if c5 == 200 else f'YOKUP_HTTP_{c5}'})
    ctx.st['presencia'] = pres
    chk['7_presencia'] = all(v.get('estado') in ('SIMULADO', 'YOKUP') for k, v in pres.items() if not k.startswith('_'))
    r = {'comprobaciones': {'checks': chk, 'plataformas': plats, 'huecos': f"{huecos}/{t['huecos_contenido']}",
                            'admira_tv': f"{tv}/{t['equipos']}", 'presencia': f"{len([k for k in pres if not k.startswith('_')])} equipos · {ctx.presencia}"},
         'acciones': []}
    malos = [k for k, v in chk.items() if v is False]
    r['acciones'].append('todo verde' if not malos else 'pendiente: ' + ', '.join(malos))
    return ('ok' if not malos and None not in chk.values() else 'pendiente'), r

FUNCIONES = {1: paso_marca, 2: paso_circuito, 3: paso_gemelos, 4: paso_itil, 5: paso_playlists, 6: paso_piezas, 7: paso_checker}

# ─── preflight y orquestación ────────────────────────────────────────────────
def donde(n):
    """caja = se puede hacer --real aquí · mac-mini = faltan secretos que viven en la bóveda · bloqueado."""
    sec = NECESITA[n]['secretos']
    faltan = [s for s in sec if not hay(s)]
    return ('aquí', []) if not faltan else ('mac-mini', faltan)

def preflight():
    filas = []
    for n, nombre in PASOS.items():
        d, faltan = donde(n)
        filas.append({'paso': n, 'nombre': nombre, 'donde_real': d, 'faltan': faltan, 'secretos': NECESITA[n]['secretos']})
    return {'boveda': os.path.exists(VAULT), 'credenciales': {s: hay(s) for n in NECESITA for s in NECESITA[n]['secretos']} |
            {'INSTALLER_ADMIRA_SECRET': hay('INSTALLER_ADMIRA_SECRET')}, 'pasos': filas}

def seleccion(paso, hasta):
    if paso and hasta:
        if hasta < paso: raise SystemExit('✗ --hasta debe ser ≥ --paso')
        return list(range(paso, hasta + 1))
    if paso:
        return [paso]
    return list(range(1, (hasta or 7) + 1))

def ejecutar(ctx, pasos):
    resumen = []
    for n in pasos:
        nombre = PASOS[n]
        log(f'── paso {n} · {nombre} · {ctx.modo} ──')
        t0 = time.time()
        try:
            estado, det = FUNCIONES[n](ctx)
        except Bloqueado as b:
            estado, det = 'bloqueado', {'faltan': b.faltan, 'acciones': [f'no se escribe nada: faltan {", ".join(b.faltan)}']}
        except RuntimeError as e:
            estado, det = 'error', {'error': str(e)}
        d, _ = donde(n)
        ent = {'ts': ahora(), 'paso': n, 'nombre': nombre, 'modo': ctx.modo, 'resultado': estado,
               'donde_real': d, 'segundos': round(time.time() - t0, 1), **det}
        ctx.st['pasos'][str(n)] = {'nombre': nombre, 'resultado': estado, 'modo': ctx.modo, 'ts': ent['ts'],
                                   **({'ultimo_real': ent['ts']} if ctx.real else {}),
                                   **{k: det[k] for k in ('urls', 'backup', 'semilla', 'faltan') if k in det}}
        ctx.guardar(); ctx.evidencia(ent)
        for a in det.get('acciones', []):
            log(('[ensayo] ' if not ctx.real and estado == 'planificado' else '') + a)
        if det.get('faltan'):
            log(f"faltan para --real: {', '.join(det['faltan'])}")
        if det.get('error'):
            log('✗', det['error'])
        log(f'paso {n} → {estado}')
        resumen.append({'paso': n, 'nombre': nombre, 'resultado': estado, 'donde_real': d})
        if ctx.real and estado in ('error', 'bloqueado'):
            log('se detiene la cadena: corrige y vuelve a lanzar desde este paso (--paso N)')
            break
    return resumen

def main(argv=None):
    ap = argparse.ArgumentParser(description='Ejecutor paso a paso de la demo completa v2')
    ap.add_argument('--plan', default=PLAN_DEFECTO)
    ap.add_argument('--paso', type=int, choices=range(1, 8))
    ap.add_argument('--hasta', type=int, choices=range(1, 8))
    ap.add_argument('--real', action='store_true', help='escrituras reales (sin esto: ensayo, solo lecturas)')
    ap.add_argument('--estado-dir', default=None, help='por defecto ~/Claude/demos/<id del circuito>')
    ap.add_argument('--rehacer', action='store_true', help='reescribe aunque ya exista (marca, CIs, piezas)')
    ap.add_argument('--sin-analizar', action='store_true', help='el ensayo no llama a /marcablanca/api/analizar')
    ap.add_argument('--presencia', choices=['simulada', 'yokup'], default='simulada')
    ap.add_argument('--color', default='', help='paso 1: color primario #RRGGBB de la marca (si no, el del análisis)')
    ap.add_argument('--preflight', action='store_true', help='solo la tabla de credenciales y dónde corre cada paso')
    ap.add_argument('--disparar', choices=['cierre', 'emergencia', 'puntual'], help='locución bajo demanda (sustituto del TPV)')
    ap.add_argument('--sitio', help='id o slug del local para --disparar')
    ap.add_argument('--lang', choices=['es', 'en'], default='es')
    a = ap.parse_args(argv)
    plan = cargar_plan(a.plan)
    pf = preflight()
    log('credenciales (solo nombres):', {k: ('sí' if v else 'no') for k, v in pf['credenciales'].items()}, '· bóveda:', 'sí' if pf['boveda'] else 'no')
    if a.preflight:
        print(json.dumps({'totales': totales(plan), **pf}, ensure_ascii=False, indent=1))
        return 0
    ctx = Ctx(plan, real=a.real, estado_dir=a.estado_dir, rehacer=a.rehacer, analizar=not a.sin_analizar, presencia=a.presencia,
              color=a.color)
    if a.color and not __import__('re').fullmatch(r'#[0-9A-Fa-f]{6}', a.color):
        raise SystemExit('✗ --color debe ser #RRGGBB')
    if a.disparar:
        if not a.sitio: raise SystemExit('✗ --disparar necesita --sitio')
        est, det = disparar(ctx, a.disparar, a.sitio, a.lang)
        ctx.evidencia({'ts': ahora(), 'paso': 'disparo', 'modo': ctx.modo, 'resultado': est, **det})
        return 0
    if a.real and a.presencia == 'yokup':
        log('⚠ --presencia yokup: los equipos quedan VIGILADOS en Yokup; si dejan de latir se abre «Equipo sin conexión» y se avisa a instaladores')
    res = ejecutar(ctx, seleccion(a.paso, a.hasta))
    log('estado →', ctx.f_estado); log('evidencias →', ctx.f_evid)
    print(json.dumps({'modo': ctx.modo, 'totales': totales(plan), 'pasos': res}, ensure_ascii=False, indent=1))
    malos = [x for x in res if x['resultado'] in ('error', 'bloqueado')]
    return 1 if any(x['resultado'] == 'error' for x in malos) else (2 if malos else 0)

if __name__ == '__main__':
    sys.exit(main())
