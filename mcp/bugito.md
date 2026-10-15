# Bugito · mando físico desde las cinco patas / Physical control across five applications

## Castellano

Disponible en el modo Experto de **Studio, Store, TV, App y Biz**, con sesión en la aplicación. Escribe `/ayuda bugito` o `/help bugito` para ver esta ayuda en la consola; `/bugito ayuda` también muestra la guía sin enviar fallos.

1. Abre ⌘ Experto y escribe la orden completa.
2. Desde otra pata se abre Bugito en admira.biz conservando la orden. Si lo pide, inicia sesión con tu cuenta Google **owner** en Bugito; la orden pendiente se atiende una sola vez. La sesión de la aplicación de origen no concede por sí sola control físico.
3. Comprueba el estado de ejecución y consulta [Supervisor](https://www.admira.app/supervisor) para ver la incidencia y las fotos. «En cola», acuse de ejecución y medida reciente son estados diferentes.

El destino de estos ejemplos es **Starbucks · laboratorio Gran de Gràcia 51 → MBP16**, screenId `macbookpro16`, CI `GDG51-PAN-07`. Es un vínculo explícito de demo; no representa el inventario real de un restaurante. Los destinos sin equipo vinculado se rechazan.

| Acción | Orden completa |
| --- | --- |
| Giro de 90° | `/bugito error starbucks gran de gracia 51 pantalla girada` |
| Popup sobre la emisión | `/bugito error starbucks gran de gracia 51 popup` |
| Contenido en negro | `/bugito error starbucks gran de gracia 51 pantalla negra` |
| Proporción incorrecta | `/bugito error starbucks gran de gracia 51 resolucion` |
| Media pantalla visible | `/bugito error starbucks gran de gracia 51 recorte` |
| Quitar los fallos y recuperar la emisión | `/bugito restaurar starbucks gran de gracia 51` |

`pantalla en negro` también se admite. Negro pone el contenido en espera; **no apaga eléctricamente el portátil**. Restaurar reanuda el contenido y retira los fallos. Los fallos de giro/superficie caducan a los 30 minutos; retíralos con restaurar al terminar. Si el resultado es incierto, consulta el Supervisor antes de repetir una orden.

El Supervisor detecta a partir de medidas del reproductor y cámara, sin considerar el envío como detección. Guarda evidencia óptica cuando hay señal reciente y encuadre libre; una persona o un corte de cámara impide adjuntar esa foto. Registra la recuperación y **mantiene la incidencia abierta para revisión**. No promete detectar cualquier anomalía ni obtener imágenes durante una oclusión.

`/bugito` muestra u oculta la mascota; `/bugito full` abre el banco. Los alias cortos del banco, como `/bugito popup`, no seleccionan el MBP16. Las órdenes para crear una incidencia lógica en un Xpacio registran un ticket; no equivalen a inyectar un fallo físico.

## English

Use Expert mode in **Studio, Store, TV, App or Biz** after signing in. `/help bugito` and `/bugito help` show instructions without sending a fault. Enter a complete command; other applications open Bugito in admira.biz with the original order. Sign in there with a valid Google **owner** account when requested. The pending order is handled once; the source application's session alone does not authorize hardware control.

The configured demo binds Starbucks at the Gran de Gràcia 51 **lab** to **MBP16** (`macbookpro16`, `GDG51-PAN-07`), not to a restaurant's real inventory. Unbound destinations are rejected.

| Action | Complete command |
| --- | --- |
| Rotate 90° | `/bugito fault starbucks gran de gracia 51 rotated screen` |
| Popup | `/bugito fault starbucks gran de gracia 51 popup` |
| Black content | `/bugito fault starbucks gran de gracia 51 black screen` |
| Wrong aspect ratio | `/bugito fault starbucks gran de gracia 51 resolution` |
| Half screen | `/bugito fault starbucks gran de gracia 51 half screen` |
| Restore playback and remove faults | `/bugito restore starbucks gran de gracia 51` |

Black is content standby, not laptop power-off. Restore at the end of the test. Queued, execution acknowledgement and fresh player measurement are separate states; inspect Supervisor before retrying an uncertain result. Supervisor records measured faults and recovery; photos require an available camera and an unobstructed view. Recovery **does not close the incident**. Short bench aliases do not select MBP16; showing the mascot never injects a physical fault.

## MCP / agent contract

- Human guide: https://www.admiranext.com/help/#bugito
- Full guide: https://www.admiranext.com/mcp/BUGITO.md
- MCP endpoint: https://www.admiranext.com/mcp
- Read-only tool call: `help {"tema":"bugito"}` (`tools/call`, tool `help`, arguments `{"tema":"bugito"}`). Public documentation requires no hardware credentials and sends no command.
- Expert engine: `AdmiraExperto.exec(fullCommand, output)` in the signed-in application. Console and avatar share this entry; do not create another parser per domain.
- Browser handoff: POST `https://www.admira.biz/api/bugito/launch?lang=es` with form fields `order` and a fresh UUID `request_id`, from an allowed suite origin. A GET link does not execute a fault.
- Authorized service integration: POST `https://www.admira.biz/api/bugito/commands`, JSON `{order, request_id}`, Bearer credential accepted by the existing owner control authority. Requires a bound device with recent signal; replaying the same request ID returns its recorded result. An uncertain send is not permission to mint a new ID and resend.
- GET `https://www.admira.biz/api/bugito/status?id=<request_id>` separates `queued`, `executed` and `detected`; `detected` here means a fresh player measurement, not a confirmed Supervisor ticket or photo.
- The MCP help tool documents the existing command/API contract; it is **not a new anonymous hardware execution tool**. A fleet login, browser-local role or this public guide grants no owner permission. Never place credentials or control nonces in URLs, code examples or reports.
