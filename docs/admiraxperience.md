# AdmiraXperience · proyecto de pantallas e hilo musical

Orden de Carlos, 22-oct-2026: AdmiraXperience es un proyecto publicitario de pantallas e hilo musical en
admira.biz, y sus locales se dan de alta como Xpacios. De momento solo hay uno: la Sneaker Store.

## Xpacios

| Xpacio | Id | Superficies |
|---|---|---|
| Sneakers Store · Santa Rosa 19 | `sneakers-store-santa-rosa-19` | LCD horizontal, pantalla vertical de entrada, videowall Jordan, hilo musical |

- Es la misma ficha del catálogo (KV) que usa `/demo global`. En `locations.js` lleva `bundleWins`: su proyecto
  (`project_id: 'admiraxperience'`), su circuito (`circuit: 'admiraxperience'`) y sus superficies mandan sobre la
  copia del KV y de la caché del navegador.
- Las pantallas son las del gemelo (`docs/demo-global.md`): la LCD reproduce la playlist horizontal
  (`playlist-be8a1e99`, Stock 665) y la vertical de entrada la suya (`playlist-cadea3fa`, Stock 990 y 964). No hay
  dispositivo físico, así que van `sched`. El videowall Jordan muestra la captura de la tienda real y va `idle`.
- **Hilo musical:** superficie `audio` dada de alta sin pista (`idle`, sin campo `music`). Se conecta cuando haya
  playlist de música.
- Sin audiencia ni CPM inventados: `impr: null`, `cpm: '—'`.
- El gemelo sigue en `https://www.admira.store/xpacios/sneakerstore/` y las playlists en el registro central bajo
  `sneakers-store` (`/api/demo-global?project=sneakers-store`), que `/demo global` sigue usando igual.

## Lo que no es del proyecto

- **Oficinas** (Santa Rosa 4, Planeta 7, Bretón de los Herreros 9, Aulèstia i Pijoan 23): siguen en el mapa con
  «Recorrer AdmiraXperience», con la etiqueta «Oficina AdmiraXperience». No son Xpacios ni salen en el filtro del
  circuito (`isAdmiraXperienceOffice` en `app.js`).
- **«AdmiraXperience · Store · Santa Rosa 19»** (`admiraxperience-store`) se retira del mapa aunque siga en el KV
  (`RETIRED_LOCATION_IDS` en `locations.js`): era la misma tienda que la Sneaker Store.

## Dar de alta el siguiente Xpacio

Añadir su ficha con `circuit: 'admiraxperience'`, `project_id: 'admiraxperience'`, `network: 'AdmiraXperience'` y
sus superficies (`pantalla` y `audio`). La prueba está en `tests/admiraxperience.test.cjs`.

## Registro central (XpaceOS)

Para que AdmiraXperience aparezca como proyecto en las apps de XpaceOS (admira.store/admira-xp, xpaceos.com), un
administrador lo da de alta en `https://www.admiranext.com/xpace/manage` (ver `help/central-projects.md`):

- Proyecto: `{id: 'admiraxperience', name: 'AdmiraXperience', circuit: 'admiraxperience'}`.
- Local: `{id: 'admiraxperience-sneakers-store', project_id: 'admiraxperience', name: 'Sneakers Store · Santa Rosa 19',
  xpace_url: 'https://www.admira.store/xpacios/sneakerstore/?project=sneakers-store&circuit=sneakerstore&loc=sneakers-store-santa-rosa-19', enabled: true}`.
  El registro no deja mover un id de local entre proyectos, por eso lleva un id propio.
