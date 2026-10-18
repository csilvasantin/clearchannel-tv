# Comercial · campañas para anunciantes

Comercial es Admirito con corbata y maletín. Se abre en admira.biz desde `/comercial` o `/admirito comercial` en el motor Experto compartido. Pasos: `brief`, `audiencias`, `ubicaciones`, `propuesta`. `/admirito` o `/default` cierra el asistente y vuelve al verde estándar.

Recoge anunciante, objetivo, audiencia solicitada, fechas, presupuesto, pases y duración. «Elegir audiencias» y «Elegir ubicaciones» abren los selectores existentes. «Usar la selección del mapa» incorpora expresamente los IDs actuales. La propuesta reutiliza `CampaignPlanner.quote`, indica oportunidades estimadas y disponibilidad sin confirmar. Si falta CPM o impresiones, los deja pendientes. Si cambia la selección o el target, exige incorporarlos de nuevo. «Revisar en el planificador» transfiere la selección actual y el brief validado al planificador existente; no envía solicitudes ni publica campañas. El texto se puede descargar.

El brief vive en memoria de la pestaña; no se envía por URL ni se guarda en localStorage. No se añade una segunda API de precios, catálogo o publicación. No se modifican las autorizaciones de proyecto.

## English

Commercial is Admirito with a tie and briefcase, focused on advertiser campaigns. `/comercial` and `/admirito comercial` use the shared Expert engine. The assistant collects a brief, opens existing audience/location selectors and adopts the exact selected IDs. Proposals use the existing planner's quote and clearly distinguish estimated opportunities from unique people and confirmed availability. Missing price/audience inputs remain unknown. Selection changes require explicit re-adoption. Planner review transfers the validated brief and exact current selection; it does not submit, book or publish a campaign. Brief data stays in tab memory and downloadable text, outside URLs and persistent browser storage.
