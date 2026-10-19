# Arquitecto · «video» desde SuperSplat: objetos separados con su ITIL

Orden de Carlos del 19-oct-2026: «tengo un nuevo vídeo 360 con mucho más detalle, pásaselo al arquitecto para que lo pase a 3D con todos los objetos separados en el ITIL». La escena era https://superspl.at/scene/8f6bd2f6 (Starbucks Paseo de Gràcia 103, zona de barra).

## Qué entra

- Un **splat gaussiano** de SuperSplat (superspl.at/scene/`<id>`), no un vídeo. SuperSplat lo publica en formato **SOG** (splat-transform v3) en su CDN (`d28zzqy0iyovbz.cloudfront.net/<id>/v2/`): `lod-meta.json` con el árbol de trozos y, por trozo, `meta.json` más WebP sin pérdida (`means_l`/`means_u` = posición a 16 bits por eje con transformación logarítmica; `sh0` = color base por libro de códigos y opacidad en el alfa).
- El CDN responde con CORS; superspl.at no, así que el id del enlace se traduce a la URL del CDN (`urlSuperSplat`). Si SuperSplat cambia la ruta, vale pegar la URL del `lod-meta.json`.
- Los escaneos del móvil vienen **en metros**: referencia `metrica` (1 unidad = 1 m). No hay que tomar medida en el local.

## Qué hace (`/arquitecto video`, admira.biz)

1. `arquitecto-splat.mjs`: `cargarSuperSplat` lee el nivel de detalle más fino que quepa en 1,5 millones de gaussianas, decodifica los WebP en el navegador (`createImageBitmap` sin premultiplicar) y deja fuera las gaussianas con opacidad < 0,3 (brumas).
2. `arquitecto-video.mjs`: `levantar` saca la vertical, el suelo, el techo y las paredes como con XpaceScan; `leerPLY` ahora conserva color y alfa; `escala` admite `metrica`.
3. `arquitecto-objetos.mjs`:
   - `aSala`: todos los puntos en coordenadas de sala.
   - `ampliarSala`: en un escaneo desde el lado del cliente, la cara de la barra es el plano vertical más fuerte y hace de «pared»; la sala crece hasta la envolvente (1 %–99 %) de los puntos bajos para que entre lo que hay delante.
   - `objetosDetectados`: vóxeles de 5 cm. Por columna, lo que arranca del suelo es **cuerpo** (muebles; huecos de hasta 30 cm no lo cortan), lo que queda por encima con hueco es **encima** y lo que no toca el suelo es **flotante**. Los cuerpos se separan por la altura de su tapa (barra a 0,95 m y vitrina a 1,30 m son dos piezas aunque se toquen); lo flotante que toca un cuerpo se le une hasta su tapa (+ 8 cm) y lo que asoma por encima se separa como «encima»; un cuerpo pequeño y más alto pegado a otro mayor y más bajo es algo posado (la cafetera sobre la barra); lo flotante casi a ras de suelo es un mueble con los pies tapados (la trasbarra).
   - `clasificar`: tipo del plano por medidas (barra, caja, vitrina, estantería, pilar, mesa, silla, cesta, iPad, lámpara, posible pantalla, mueble). Lo de menos de 30 cm de largo y de alto es «objeto pequeño»: se separa, no se inventaría.
   - `cruzarConInventario`: códigos ITIL ya dados de alta (inventario público de xpaceos, `INVENTARIOS` de «detallar») repartidos por familia (BAR, MOS, VIT, EST, PIL, MES, SIL, CES, IPAD, LUM, OBJ) de mayor a menor; el resto, el siguiente libre `<PREFIJO>-<FAMILIA>-NN` como **propuesto**. Las posibles pantallas no reciben código.
   - `cisDeObjetos`: las altas propuestas con los campos de `itil_ci_upsert` (`parent_itil_code` = el mueble de debajo). **Nada se escribe en Yokup desde el navegador**: el titular confirma.
4. El plano `admira.xpacio-plano/1` sale con cada objeto en `mobiliario` (`tipo`, `base`, `alto`, `itil`, `itilEstado`, `apoyadoEn`, `color`, `clase`, `detectado`), `version: splat-<fecha>-1` y `fuente.objetos` con el recuento. Se guarda en el navegador («Usar este plano») y pasa a «modelar» como cualquier otro. «Descargar objetos e ITIL (JSON)» da `admira.arquitecto-objetos/1` con los objetos, los CI propuestos y los códigos del ITIL no vistos.

## Límites (19-oct-2026)

- Un escaneo cubre lo que se grabó: en PG103, la zona de barra (unos 10 × 4 m), no el local entero; el plano público del gemelo (14 × 8 m, 6 pantallas, 360) no se sustituye.
- La clasificación es por medidas: una mesa alta y un mostrador se parecen; los nombres son propuestas.
- La separación une lo que se toca a la misma altura (dos cestas pegadas) y puede partir un mueble con la tapa a dos alturas.
- Las pantallas no se cruzan con las del plano (ya tienen código); salen como «posible pantalla» sin código.
- Pruebas: `tests/arquitecto-splat.test.mjs` y `tests/arquitecto-objetos.test.mjs` (SOG sintético y sala densa sintética).
