#!/usr/bin/env python3
"""Lee solicitudes pendientes de admiranext.com/api/demo y lanza crear_demo.py.
Clave de máquina: bóveda DEMO_QUEUE_KEY o ADMIRANEXT_PRESENTACIONES_MACHINE_KEY (nunca se imprime).
"""
import argparse, json, os, subprocess, sys, tempfile, urllib.request

NEXT = os.environ.get('ADMIRANEXT_URL', 'https://www.admiranext.com')
VAULT = os.path.expanduser('~/Claude/admira-vault/vault-get.sh')
CREAR = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'crear_demo.py')

def secreto(nombre):
    try:
        v = subprocess.run(['bash', VAULT, nombre], capture_output=True, text=True, timeout=30).stdout.strip()
    except Exception:
        v = ''
    return v

def http(method, url, body=None, headers=None):
    h = {'Accept': 'application/json', 'User-Agent': 'AdmiraCrearDemoCola/1.0'}
    h.update(headers or {})
    data = None if body is None else json.dumps(body).encode()
    if data is not None:
        h['Content-Type'] = 'application/json'
    req = urllib.request.Request(url, data=data, method=method, headers=h)
    with urllib.request.urlopen(req, timeout=60) as r:
        return r.status, json.loads(r.read().decode() or 'null')

def main():
    ap = argparse.ArgumentParser(description='Procesa cola /api/demo → crear_demo.py')
    ap.add_argument('--dry-run', action='store_true')
    ap.add_argument('--id', default='', help='procesar solo este id de solicitud')
    a = ap.parse_args()
    key = secreto('DEMO_QUEUE_KEY') or secreto('ADMIRANEXT_PRESENTACIONES_MACHINE_KEY')
    if not key:
        sys.exit('✗ falta DEMO_QUEUE_KEY o ADMIRANEXT_PRESENTACIONES_MACHINE_KEY en la bóveda')
    hdr = {'Authorization': 'Bearer ' + key}
    code, data = http('GET', f'{NEXT}/api/demo?estado=pendiente', headers=hdr)
    if code != 200 or not isinstance(data, dict):
        sys.exit(f'✗ cola HTTP {code}')
    items = data.get('solicitudes') or []
    if a.id:
        items = [x for x in items if x.get('id') == a.id]
    if not items:
        print('· cola vacía'); return
    s = items[0]
    print('· solicitud', s.get('id'), s.get('cliente'), 'tipo=', s.get('xpacio_tipo'))
    cmd = [
        sys.executable, CREAR,
        '--cliente', s['cliente'],
        '--web', s['website'],
        '--xpacio-tipo', s.get('xpacio_tipo') or 'demostore',
        '--ciudades', ','.join(s.get('ciudades') or ['london','newyork','barcelona','madrid']),
        '--cierre', s.get('cierre') or '20:00',
        '--idiomas', ','.join(s.get('idiomas') or ['en','es']),
    ]
    if s.get('color'):
        cmd += ['--color', s['color']]
    if s.get('xpacio_otro'):
        cmd += ['--xpacio-otro', s['xpacio_otro']]
    if s.get('id_marca'):
        cmd += ['--id', s['id_marca']]
    logo_tmp = None
    if s.get('logo_data_url') and s['logo_data_url'].startswith('data:'):
        import base64, re
        m = re.match(r'data:([^;]+);base64,(.+)', s['logo_data_url'], re.S)
        if m:
            ext = 'png' if 'png' in m.group(1) else 'jpg'
            logo_tmp = tempfile.NamedTemporaryFile(suffix='.'+ext, delete=False)
            logo_tmp.write(base64.b64decode(m.group(2)))
            logo_tmp.close()
            cmd += ['--logo', logo_tmp.name]
    if a.dry_run:
        cmd.append('--dry-run')
        print('·', ' '.join(cmd[:6]), '…')
    r = subprocess.run(cmd)
    if r.returncode == 0 and not a.dry_run:
        http('PATCH', f"{NEXT}/api/demo", {'id': s['id'], 'estado': 'hecha'}, hdr)
        print('· marcada hecha', s['id'])
    if logo_tmp:
        try: os.unlink(logo_tmp.name)
        except Exception: pass
    sys.exit(r.returncode)

if __name__ == '__main__':
    main()
