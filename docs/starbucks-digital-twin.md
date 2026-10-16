# Starbucks Paseo de Gracia 103


## Starbucks · admira.app → XpaceOS

En admira.app, busca «Starbucks Paseo de Gracia» y abre la ficha de Paseo de Gracia 103, Barcelona. Pulsa «Visita al Digital Twin» junto a «Tour DOOH» para entrar directamente al Starbucks de XpaceOS en Matrix. Tour DOOH conserva su recorrido por el mapa.

In admira.app, search for “Starbucks Paseo de Gracia” and open the profile at Paseo de Gracia 103, Barcelona. Click “Visit the Digital Twin” beside “Tour DOOH” to open the Starbucks in XpaceOS Matrix directly. Tour DOOH keeps its map tour.

Ficha / Profile: https://admira.app/?locationId=alsea-sbux-021&lang=es

Digital Twin: https://www.xpaceos.com/admira-xp/?autostart=xtanco&visual=matrix&loc=alsea-sbux-021

ID: alsea-sbux-021. Asociación curada por ID en xpace-link.js; xpaceUrl explícito del backoffice prevalece, incluido vacío. No se asigna a los demás Starbucks por nombre o circuito. Abrir la visita no publica contenido en players físicos.

Curated association by ID in xpace-link.js; an explicit backoffice xpaceUrl takes precedence, including an empty value. Other Starbucks locations are not matched by name or circuit. Visiting does not publish content to physical players.

## Tour Starbucks España · tres destinos / three destinations

https://admira.biz/?circuit=alsea_starbucks&tour=1&marca=starbucks&lang=es

Orden confirmado por Carlos: laboratorio Gran de Gràcia 51 → Starbucks Paseo de Gracia 103 → Starbucks L’Illa Diagonal 557. El laboratorio conserva su identidad y sus reproductores; no se convierte en una tienda Starbucks. El catálogo nacional sigue disponible, pero el circuito del tour incluye exclusivamente estos tres destinos.

Confirmed route: Gran de Gràcia 51 laboratory → Starbucks Paseo de Gracia 103 → Starbucks L’Illa Diagonal 557. The laboratory retains its identity and player mappings. Only these three destinations enter the tour.

`/demo dooh starbucks espana` / `/demo dooh starbucks spain` launches the shared cinematic tour. Existing Mexico shortcuts remain unchanged. The playback panel stays visible during every flight and checks `/signage/now` every 15 seconds. Green requires a numeric proof-of-play timestamp within 170 seconds for every explicitly mapped player. Missing mappings, failed requests and future timestamps remain unverified. A heartbeat alone does not prove playback. This checks player reports, not physical screen brightness or power.

El panel muestra «Emitiendo», «Revisar», «Sin señal reciente» o «Sin datos». No simula estados. Las superficies sin reproductor vinculado siguen sin datos aunque otra pantalla esté emitiendo. La visión general de España tampoco usa el semáforo simulado de las demos de México/Altadis. Para comprobar encendido físico hace falta evidencia adicional de cámara o del dispositivo.

### Vinculación comprobada de reproductores · 16-oct-2026

- Gran de Gràcia: `GDG51-PAN-07` se vincula a `macbookpro16`, conforme al plano y al objetivo activo del Supervisor. Los otros seis reproductores mantienen las identidades exactas del plano. Una respuesta válida sin señal de reproducción se muestra en rojo como «Sin señal reciente»; no demuestra apagado físico.
- Paseo de Gracia: el registro IoT asocia explícitamente su iPad con `ipad-admin-mupi`. El player publica reproducción, pero la referencia ITIL del iPad está en ciclo `virtual_planned`: el panel avisa que su ubicación física no está verificada. Las otras superficies siguen sin reproductor confirmado.
- Diagonal: Carlos confirma que es solo una ubicación derivada de Google Maps, sin player instalado. Se muestra «Solo ubicación · sin reproductor» y no se incluye como avería ni como pantalla en los totales de emisión.
- La cámara aporta una lectura separada de MBP16 desde el Supervisor existente, con caducidad de 60 s. El tour no mueve la cámara ni inicia otra vigilancia.

The laboratory mapping uses the exact ITIL identity from its plan. The Paseo iPad uses the explicit managed IoT player link, with an unverified physical-location warning. No player is inferred for Diagonal. A valid empty playback report means no recent signal, not proven power-off. Fresh camera evidence is displayed separately from player telemetry.

### Recuperación con pantalla central reservada · 16-oct-2026

Carlos trabaja en la pantalla central del Mac mini: `macmini-starbucks-horizontal` queda detenido y marcado como reservado, sin contarlo como avería ni como emitiendo. Se recuperan los dos laterales del Mac mini y los tres del Mac Studio. Las cinco apps usan su grupo existente con `focusOwner=0`, sin activar la aplicación; el central del Mac Studio pasa de 1 a 0 para respetar el foco. No se relanza el central del Mac mini. La opción de reserva solo neutraliza una señal ausente: si ese player publica reproducción o fallo real, manda esa evidencia.

Carlos works on the Mac mini centre display. Its player remains stopped and explicitly reserved, while both side players and the three Mac Studio players run without owning keyboard focus. The reserved display is never counted as playing. Fresh playback or fault evidence takes precedence over the reservation label.
