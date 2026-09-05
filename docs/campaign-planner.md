# Planificador de campañas

Entrada: cabecera **Planificar campaña**, o selector **Comparar circuitos**.
Elige ámbito, fechas, pases diarios, duración y presupuesto. Cada circuito muestra puntos, impresiones estimadas y total; avisa si supera el presupuesto. El target se puede editar desde el selector. Las impresiones son oportunidades estimadas, no personas únicas. Ninguna cifra confirma disponibilidad, reserva o cobro.

**Guardar plan** conserva un plan por navegador y dominio en `cc-campaign-plan-v1`, sin contacto ni creatividad. Al volver se recuperan fechas, presupuesto, target y los IDs exactos: no se amplía la selección automáticamente. Los puntos que hayan desaparecido del catálogo o target se señalan. Se espera al catálogo inicial antes de permitir guardar; tras un fallo de red queda disponible el catálogo de respaldo. Un plan caducado puede consultarse, pero exige actualizar las fechas para usarlo.

**Preparar solicitud** guarda y transfiere el plan al formulario existente. Fechas, pases, duración y presupuesto son editables. **Editar puntos seleccionados** abre la selección conservando los puntos; al editarla se actualiza el último plan válido. El presupuesto acompaña a la solicitud persistente y se muestra en el historial. Guardar está sujeto a la disponibilidad del almacenamiento del navegador; se informa si falla.

`planner-core.js` comparte el cálculo de impresiones y precio entre comparación y checkout, con días inclusivos UTC, CPM ponderado, factores de pases, duración y demanda. `planner-ui.js` usa el catálogo y selector existentes. La estimación sigue siendo orientativa, calculada en cliente.

Validación: `node --test tests/*.test.mjs` (18 pruebas). Pruebas de navegador: comparar/transmitir Xtanco (6 puntos, 32.169 impresiones, 192 EUR); quitar un punto y recuperar el subconjunto tras recarga; presupuesto de 100 EUR con aviso de exceso; enviar solicitud local y recuperar historial. Misión Yokup 1211 (`DCL-1c3c4a778b52f051836b2b9f`).
