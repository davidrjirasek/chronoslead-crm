# 109 — Histórico de cobros y extracto

**Feature Branch**: `feat/108-panel-de-superadmin` (entra con el panel)

**Created**: 2026-10-20

**Input**: petición del operador mientras probaba el panel — poder ver el
histórico de pagos de un cliente y exportarlo como PDF.

## Problema

`organization.paid_through` es un **estado**: hasta cuándo está al día. Se
sobrescribe en cada cobro, así que no queda rastro de cuándo cobraste, de qué
periodo cubrió ni de cuánto fue. No hay extracto que mandarle a nadie, ni forma
de ver cuánto te ha pagado un cliente en el año.

## Decisiones

### El pago es un hecho; la fecha, un estado

Tabla `payment` con el hecho (cuándo, qué periodo, cuánto, quién lo anotó) y
`paid_through` sigue siendo el estado derivado. Las dos cosas se escriben **en
una transacción**: guardar el pago sin mover la fecha dejaría al cliente
suspendido con el dinero cobrado; mover la fecha sin guardar el pago haría que
el extracto mintiera.

### El periodo arranca donde terminaba el anterior

Un cliente que paga con tres días de retraso **no pierde esos tres días**. Si
venía sin fecha o vencida hace mucho, arranca hoy.

### Centavos enteros y el catálogo de monedas de Vocero

Se reutiliza `src/lib/money.ts` tal cual. Vocero ya lo usa para el valor de los
tratos del pipeline y los números de Resultados; aquí se usa para lo que el
operador cobra. Mismo formato, mismo código probado, y el día que entre un
proveedor de cobro el importe ya tiene dónde ir.

**Los totales van por moneda.** Sumar pesos y dólares da un número que no existe
en ninguna contabilidad.

### El PDF lo hace el navegador

Una página de extracto maquetada para papel y `window.print()`. Meter una
librería de PDF en el servidor habría sido una dependencia nueva —de las que la
constitución mira con lupa— para producir peor lo que el navegador ya hace
nativo, y en Mac y Windows sale «Guardar como PDF» sin instalar nada.

### El extracto no es una factura, y lo dice

Lleva al pie que es informativo y que no sustituye a un comprobante fiscal. Un
documento con logo que parece una factura y no lo es, causa problemas.

### Solo lo ve quien administra

Un extracto es información de facturación: un cliente pidiendo el de otro
—incluso el suyo— recibe 404.

## Criterios de aceptación

1. Registrar un cobro guarda el hecho **y** mueve la fecha, o no hace ninguna
   de las dos.
2. El segundo cobro arranca donde terminó el primero.
3. El panel muestra el total cobrado por cliente **sin tener que expandir**.
4. El extracto lleva el logo, el detalle, el total por moneda y el aviso de que
   no es factura.
5. Un cliente que no es superadmin recibe 404 en el extracto de cualquiera.
6. Con `EDITION` apagada nada de esto existe.

## Fuera de alcance

- **Facturación fiscal**: esto es un registro de cobros, no un sistema de
  facturación. Lo dice el propio documento.
- **Cobro automático**: cuando entre, escribirá en esta misma tabla.
- **Recordatorios de impago por fuera de la app**: van con el cobro.
