"""Pruebas del ejecutor demo_completa.py (sin red: http simulado).  python3 -m unittest discover tools/crear-demo/tests"""
import contextlib, io, json, os, sys, tempfile, unittest
from unittest import mock

AQUI = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.dirname(AQUI))
import demo_completa as dc  # noqa: E402
import crear_demo as cd     # noqa: E402

PLAN = os.path.join(os.path.dirname(AQUI), 'planes', 'demo-365-bcn-plan.json')
SECRETO = 'sk_prueba_NO_DEBE_SALIR_1234567890'
NOMBRES = ['ADMIRANEXT_PRESENTACIONES_MACHINE_KEY', 'ADMIN_TOKEN', 'XPL_TOKEN', 'NOTIFY_KEY', 'GRID_KEY',
           'INSTALLER_ADMIRA_SECRET', 'YOKUP_MCP_CREDENTIAL']


class Mundo:
    """Servicios simulados: catálogo de locations, marcas, XPL, admira.tv, Yokup, Stock."""
    def __init__(self):
        self.locs = [{'id': f'otro-{i}', 'name': f'Otro {i}'} for i in range(150)]
        self.marcas = {}
        self.xpl = [{'id': 'pl_lenovo_xpacio_hilomusical', 'name': 'lenovo.xpacio.hilomusical', 'items': [{'id': 'x'}]}]
        self.tv = {}
        self.yokup_sync = set()
        self.cis = {}
        self.stock = []
        self.llamadas = []

    def __call__(self, method, url, body=None, headers=None, timeout=60, raw=False):
        self.llamadas.append((method, url, body, dict(headers or {})))
        u = url.split('?')[0]
        if u.startswith(dc.NEXT + '/marcablanca/api/marcas/'):
            mid = u.rsplit('/', 1)[1]
            return (200, self.marcas[mid]) if mid in self.marcas else (404, {'error': 'no'})
        if u == dc.NEXT + '/marcablanca/api/analizar':
            return 200, {'propuesta': {'nombre': '365 Obrador', 'colores': {'claro': {'primario': '#C8102E'}}, 'logo': {'imagen': 'https://x/logo.svg'}}}
        if u == dc.NEXT + '/presentaciones/api/marcas':
            mid = body['marca']['id']
            if method == 'POST' and mid in self.marcas:
                return 409, {'error': 'existe'}
            self.marcas[mid] = {**body['marca'], 'catalogo': {'tipo': body['tipo'], 'propuesta': body['propuesta']}}
            return (201 if method == 'POST' else 200), {'ok': True, 'id': mid, 'creada': method == 'POST'}
        if u == dc.OMNIP:
            if method == 'GET':
                return 200, list(self.locs)
            self.locs = body['locations']; return 200, {'ok': True}
        if 'admira.store/admira-xp/' in url or any(h in url for h in ('admira.studio', 'www.admira.store/?', 'admira.tv/?', 'admira.app/?', 'admira.biz/?')):
            return 200, b'<html></html>'
        if u.startswith(dc.YOKUP_DATA):
            sid = u[len(dc.YOKUP_DATA):]
            return (200, {'ok': True}) if sid in self.yokup_sync else (404, {'error': 'xpacio_not_found'})
        if u == dc.YOKUP_MCP:
            p = body['params']; a = p['arguments']
            if p['name'] == 'itil_inventory_get':
                out = {'cis': [{'code': c} for c in self.cis.get(a['admira_store_id'], [])]}
            elif p['name'] == 'itil_ci_upsert':
                self.cis.setdefault(a['admira_store_id'], []).append(a['itil_code']); out = {'ok': True, 'changed': True}
            else:
                out = {}
            return 200, {'jsonrpc': '2.0', 'id': body['id'], 'result': {'structuredContent': out, 'isError': False}}
        if u == dc.XPL:
            if method == 'GET':
                return 200, {'ok': True, 'playlists': list(self.xpl)}
            self.xpl = body['playlists']; return 200, {'ok': True}
        if u == dc.TV_PLAYLIST:
            if method == 'GET':
                scr = url.split('screen=')[1]
                return 200, {'ok': True, 'draft': self.tv.get(scr, {'screen': scr, 'name': 'Por defecto', 'items': [], 'rev': 0})}
            self.tv[body['screen']] = {**body, 'rev': 1}; return 200, {'ok': True}
        if u == dc.API + '/stock/list':
            return 200, {'items': list(self.stock), 'total': len(self.stock)}
        if u == dc.API + '/imagen/generate' and (headers or {}).get('X-Auth-Probe'):
            return 200, {'ok': True, 'via': 'fleet'}
        if u == dc.IMAGEN:
            if 'model=gemini-3-pro-image' in url and not getattr(self, 'pro_ok', True):
                return 404, b'gemini 404: model not found'
            return 200, b'\x89PNG' + b'x' * 600
        raise AssertionError(f'llamada no prevista: {method} {url}')

    def escrituras(self):
        return [(m, u) for m, u, *_ in self.llamadas if m != 'GET' and not u.endswith('/marcablanca/api/analizar')
                and not (u.endswith('/imagen/generate'))]


class Base(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.mundo = Mundo()
        dc._secretos.clear(); cd._secret_cache.clear()
        self.parches = [mock.patch.object(dc, 'http', self.mundo), mock.patch.object(dc, 'VAULT', '/no/existe'),
                        mock.patch.object(dc, 'VAULT_YOKUP', '/no/existe.json'),
                        mock.patch.dict(os.environ, {n: '' for n in NOMBRES})]
        for p in self.parches: p.start()
        self.plan = dc.cargar_plan(PLAN)

    def tearDown(self):
        for p in reversed(self.parches): p.stop()
        dc._secretos.clear(); cd._secret_cache.clear()
        self.tmp.cleanup()

    def ctx(self, real=False, **kw):
        return dc.Ctx(self.plan, real=real, estado_dir=self.tmp.name, **kw)

    def con_secretos(self, *nombres):
        dc._secretos.clear(); cd._secret_cache.clear()
        for n in nombres:
            os.environ[n] = SECRETO + n

    def con_yokup(self):
        f = os.path.join(self.tmp.name, 'yokup.json')
        dc.escribir_json(f, {'endpoint': dc.YOKUP_MCP, 'token': 'ykm_' + 'a' * 43})
        os.environ['YOKUP_MCP_CREDENTIAL'] = f
        dc._secretos.pop('YOKUP_MCP_CREDENTIAL', None)

    def leer(self, nombre):
        with open(os.path.join(self.tmp.name, nombre)) as f:
            return f.read()

    def estado(self):
        return json.loads(self.leer('365-bcn-estado.json'))

    def correr(self, argv):
        out = io.StringIO()
        with contextlib.redirect_stdout(out):
            rc = dc.main(argv + ['--plan', PLAN, '--estado-dir', self.tmp.name])
        return rc, out.getvalue()


class Plan(Base):
    def test_totales_del_plan_v2(self):
        t = dc.totales(self.plan)
        self.assertEqual(t, {'establecimientos': 4, 'gemelos': 4, 'equipos': 12, 'playlists': 16, 'playlists_continuas': 12,
                             'playlists_bajo_demanda': 4, 'huecos_contenido': 48, 'piezas_unicas': 12})
        self.assertEqual(t['playlists'], self.plan['totales']['playlists'])

    def test_piezas_unicas_y_cierre(self):
        pz = dc.piezas_unicas(self.plan)
        kinds = sorted(c['kind'] for c in pz.values())
        self.assertEqual(kinds.count('song'), 3); self.assertEqual(kinds.count('voiceover'), 3); self.assertEqual(kinds.count('visual'), 6)
        self.assertIn('21', dc.textos_locucion(self.plan)['cierre']['es'])
        self.assertIn('9 PM', dc.textos_locucion(self.plan)['cierre']['en'])

    def test_visual_usa_la_ruta_viva(self):
        vis = [c for c in dc.piezas_unicas(self.plan).values() if c['kind'] == 'visual']
        self.assertEqual(len(vis), 6)
        ratios = {dc.prompt_pieza(self.plan, c)['aspectRatio'] for c in vis}
        self.assertEqual(ratios, {'9:16', '16:9'})
        url = dc.url_visual('pan recién hecho', '9:16', 'gemini-3-pro-image')
        self.assertTrue(url.startswith('https://imagen.admira.store/img?'))
        self.assertIn('model=gemini-3-pro-image', url)
        self.assertIn('ar=9%3A16', url)
        self.assertNotIn('imagen-4.0', url)

    def test_visual_cae_a_flash_si_pro_no_responde(self):
        self.mundo.pro_ok = False
        png, model = dc.bajar_visual('pan recién hecho', '9:16')
        self.assertEqual(model, 'gemini-2.5-flash-image')
        self.assertTrue(png.startswith(b'\x89PNG'))
        pro = [u for _, u, *_ in self.mundo.llamadas if 'model=gemini-3-pro-image' in u]
        flash = [u for _, u, *_ in self.mundo.llamadas if 'model=gemini-2.5-flash-image' in u]
        self.assertEqual(len(pro), 1)
        self.assertEqual(len(flash), 1)

    def test_schema_obligatorio(self):
        f = os.path.join(self.tmp.name, 'malo.json')
        dc.escribir_json(f, {'plan': {'schema': 'admiranext.demo-completa/1'}})
        with self.assertRaises(SystemExit):
            dc.cargar_plan(f)

    def test_seleccion_paso_hasta(self):
        self.assertEqual(dc.seleccion(None, None), [1, 2, 3, 4, 5, 6, 7])
        self.assertEqual(dc.seleccion(3, None), [3])
        self.assertEqual(dc.seleccion(None, 3), [1, 2, 3])
        self.assertEqual(dc.seleccion(4, 6), [4, 5, 6])
        with self.assertRaises(SystemExit):
            dc.seleccion(5, 2)

    def test_locations_con_coordenadas_reales(self):
        locs = dc.construir_locations(self.plan)
        self.assertEqual(len(locs), 4)
        for l, e in zip(locs, self.plan['establecimientos']):
            self.assertEqual(l['coords'], [e['lng'], e['lat']])
            self.assertEqual(l['circuit'], 'demo_365_bcn'); self.assertEqual(l['twin'], e['gemelo'])
            self.assertEqual(l['external']['brand'], '365')
            self.assertEqual(l['external']['operator'], '365')
            self.assertEqual(len(l['surfaces']), 3)
            self.assertTrue(all(isinstance(s.get('impr'), int) and s['impr'] > 0 and s.get('cpm') for s in l['surfaces']))
            self.assertEqual(l['circuitLabel']['es'], 'Circuito 365 · Cafetería · Barcelona (4 locales)')
            self.assertNotIn('{', l['circuitLabel']['es'])
            self.assertNotIn('{', l['circuitLabel']['en'])
        self.assertEqual(dc.nombre_ciudad(self.plan), 'Barcelona')
        self.assertEqual(dc.catalogo_stock(self.plan)['nombre'], 'Demo 365 · Barcelona')

    def test_ci_args_validos(self):
        import re
        for e, q in dc.equipos(self.plan):
            a = dc.ci_args(self.plan, e, q)
            self.assertRegex(a['itil_code'], r'^[A-Z0-9]{2,12}(-[A-Z0-9]{2,12}){1,3}$')
            self.assertIn(a['category'], ('audio', 'pantalla'))
            self.assertTrue(2 <= len(a['name']) <= 160)


class Ensayo(Base):
    def test_ensayo_completo_no_escribe_fuera(self):
        rc, out = self.correr([])
        self.assertEqual(rc, 0)
        self.assertEqual(self.mundo.escrituras(), [])
        st = self.estado()
        self.assertEqual(sorted(st['pasos']), ['1', '2', '3', '4', '5', '6', '7'])
        ev = self.leer('365-bcn-evidencias.jsonl').strip().splitlines()
        self.assertEqual(len(ev), 7)
        self.assertTrue(all(json.loads(l)['modo'] == 'ensayo' for l in ev))
        self.assertIn('planificado', out)

    def test_evidencia_solo_se_anade(self):
        self.correr(['--paso', '3']); self.correr(['--paso', '3'])
        ev = self.leer('365-bcn-evidencias.jsonl').strip().splitlines()
        self.assertEqual(len(ev), 2)

    def test_analisis_cacheado(self):
        self.correr(['--paso', '1']); self.correr(['--paso', '1'])
        n = sum(1 for m, u, *_ in self.mundo.llamadas if u.endswith('/analizar'))
        self.assertEqual(n, 1)

    def test_presencia_simulada_por_defecto(self):
        self.correr(['--paso', '7'])
        st = self.estado()
        pres = {k: v for k, v in st['presencia'].items() if not k.startswith('_')}
        self.assertEqual(len(pres), 12)
        self.assertTrue(all(v['estado'] == 'SIMULADO' for v in pres.values()))
        self.assertFalse(any(dc.YOKUP_EVENTS in u for _, u, *_ in self.mundo.llamadas))


class Real(Base):
    def test_real_sin_secretos_se_bloquea_sin_escribir(self):
        rc, out = self.correr(['--paso', '1', '--real'])
        self.assertEqual(rc, 2)
        self.assertEqual(self.mundo.escrituras(), [])
        self.assertIn('ADMIRANEXT_PRESENTACIONES_MACHINE_KEY', out)

    def test_real_se_detiene_en_el_primer_bloqueo(self):
        rc, _ = self.correr(['--hasta', '3', '--real'])
        st = self.estado()
        self.assertEqual(list(st['pasos']), ['1'])

    def test_paso1_real_guarda_marca_real_e_idempotente(self):
        self.con_secretos('ADMIRANEXT_PRESENTACIONES_MACHINE_KEY')
        rc, out = self.correr(['--paso', '1', '--real'])
        self.assertEqual(rc, 0)
        post = [c for c in self.mundo.llamadas if c[0] == 'POST' and c[1].endswith('/presentaciones/api/marcas')]
        self.assertEqual(len(post), 1)
        body = post[0][2]
        self.assertEqual((body['tipo'], body['origen'], body['propuesta']), ('real', 'url', False))
        self.assertEqual(body['marca']['id'], '365')
        self.assertNotIn(SECRETO, out)
        for f in os.listdir(self.tmp.name):
            self.assertNotIn(SECRETO, self.leer(f))
        n = len(self.mundo.escrituras())
        rc, _ = self.correr(['--paso', '1', '--real'])
        self.assertEqual(len(self.mundo.escrituras()), n)   # 2ª vez: ya existe → nada

    def test_paso1_color_fijado(self):
        self.con_secretos('ADMIRANEXT_PRESENTACIONES_MACHINE_KEY')
        self.correr(['--paso', '1', '--real', '--color', '#E30613'])
        self.assertEqual(self.mundo.marcas['365']['colores']['claro']['primario'], '#E30613')

    def test_paso2_union_con_copia_e_idempotente(self):
        self.con_secretos('ADMIN_TOKEN')
        antes = len(self.mundo.locs)
        rc, _ = self.correr(['--paso', '2', '--real'])
        self.assertEqual(rc, 0)
        self.assertEqual(len(self.mundo.locs), antes + 4)
        self.assertTrue(any(f.startswith('backup-omnipublicity-') for f in os.listdir(self.tmp.name)))
        puts = len([c for c in self.mundo.llamadas if c[0] == 'PUT'])
        self.correr(['--paso', '2', '--real'])
        self.assertEqual(len([c for c in self.mundo.llamadas if c[0] == 'PUT']), puts)
        self.correr(['--paso', '3'])
        st = self.estado()
        self.assertEqual(st['pasos']['3']['resultado'], 'ok')

    def test_paso2_catalogo_sospechoso_no_escribe(self):
        self.con_secretos('ADMIN_TOKEN')
        self.mundo.locs = self.mundo.locs[:10]
        rc, _ = self.correr(['--paso', '2', '--real'])
        self.assertEqual(rc, 1)
        self.assertEqual(self.mundo.escrituras(), [])

    def test_paso4_espera_sync_y_luego_upsert_idempotente(self):
        self.con_yokup()
        rc, _ = self.correr(['--paso', '4', '--real'])
        self.assertEqual(rc, 0)
        self.assertFalse(any(c[2] and c[2].get('params', {}).get('name') == 'itil_ci_upsert' for c in self.mundo.llamadas if isinstance(c[2], dict)))
        st = self.estado()
        self.assertEqual(st['pasos']['4']['resultado'], 'pendiente')
        self.mundo.yokup_sync = {e['id'] for e in self.plan['establecimientos']}
        self.correr(['--paso', '4', '--real'])
        self.assertEqual(sum(len(v) for v in self.mundo.cis.values()), 12)
        self.correr(['--paso', '4', '--real'])
        self.assertEqual(sum(len(v) for v in self.mundo.cis.values()), 12)   # sin duplicados

    def test_paso5_union_xpl_y_admira_tv(self):
        self.con_secretos('XPL_TOKEN', 'NOTIFY_KEY')
        rc, _ = self.correr(['--paso', '5', '--real'])
        self.assertEqual(rc, 0)
        ids = {p['id'] for p in self.mundo.xpl}
        self.assertIn('pl_lenovo_xpacio_hilomusical', ids)      # se conservan las demás
        self.assertEqual(len([p for p in self.mundo.xpl if p.get('circuit') == 'demo_365_bcn']), 16)
        bd = [p for p in self.mundo.xpl if p.get('reproduccion') == 'bajo_demanda']
        self.assertEqual(len(bd), 4); self.assertTrue(all(p['disparo']['origen'] == 'tpv' for p in bd))
        self.assertEqual(len(self.mundo.tv), 12)
        n = len(self.mundo.escrituras())
        self.correr(['--paso', '5', '--real'])
        self.assertEqual(len(self.mundo.escrituras()), n)

    def test_paso6_asigna_48_huecos_con_piezas_del_stock(self):
        self.con_secretos('XPL_TOKEN', 'NOTIFY_KEY')
        for i, (pid, c) in enumerate(dc.piezas_unicas(self.plan).items()):
            tipo = {'song': 'music', 'voiceover': 'locucion', 'visual': 'video'}[c['kind']]
            self.mundo.stock.append({'id': f's{i}', 'title': c['titulo'], 'type': tipo, 'url': f'https://api.admira.store/stock/asset/s{i}'})
        rc, _ = self.correr(['--paso', '6', '--real'])
        self.assertEqual(rc, 0)
        mias = [p for p in self.mundo.xpl if p.get('circuit') == 'demo_365_bcn']
        self.assertEqual(sum(len(p['items']) for p in mias), 48)
        self.assertEqual(len({i['id'] for p in mias for i in p['items']}), 12)
        self.assertFalse(any('/lyria3/' in u or '/tts' in u for _, u, *_ in self.mundo.llamadas))  # nada que generar
        alt = self.mundo.tv['365-demo-bcn-tetuan-altavoz']
        self.assertEqual([i['assetType'] for i in alt['items']], ['audio'] * 3)   # solo el hilo en bucle
        rc, _ = self.correr(['--paso', '7'])
        st = self.estado()
        self.assertIn('pendiente', st['pasos']['7']['resultado'])   # marca/circuito/ITIL aún no

    def test_presencia_yokup_en_ensayo_no_envia(self):
        self.con_secretos('INSTALLER_ADMIRA_SECRET')
        self.correr(['--paso', '7', '--presencia', 'yokup'])
        self.assertFalse(any(dc.YOKUP_EVENTS in u for _, u, *_ in self.mundo.llamadas))


class Secretos(Base):
    def test_scrub_y_preflight_solo_nombres(self):
        self.con_secretos('XPL_TOKEN')
        self.assertTrue(dc.hay('XPL_TOKEN'))
        self.assertEqual(dc.scrub({'a': 'x' + SECRETO + 'XPL_TOKEN' + 'y'}), {'a': 'x***y'})
        pf = json.dumps(dc.preflight())
        self.assertNotIn(SECRETO, pf)
        self.assertIn('"XPL_TOKEN": true', pf)

    def test_preflight_cli(self):
        rc, out = self.correr(['--preflight'])
        self.assertEqual(rc, 0)
        d = json.loads(out[out.index('\n{') + 1:])
        self.assertEqual(d['totales']['huecos_contenido'], 48)
        self.assertEqual([p['donde_real'] for p in d['pasos']], ['mac-mini', 'mac-mini', 'aquí', 'mac-mini', 'mac-mini', 'mac-mini', 'aquí'])


if __name__ == '__main__':
    unittest.main()
