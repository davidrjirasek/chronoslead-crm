# 109 — Tareas

- [x] `src/lib/db/schema.ts` + `drizzle/0024_historico_de_pagos.sql` — tabla `payment`
      con importe en centavos enteros, moneda, periodo cubierto y autor.
- [x] `src/server/platform/padron.ts` — `registrarPago()` en transacción (hecho + estado)
      e `historicoDePagos()`.
- [x] `src/app/admin/actions.ts` — el formulario pide importe, moneda, nota y fecha
      opcional; valida con `parseMoneyToCents` e `isCurrency` de Vocero.
- [x] `src/components/admin/padron.tsx` — columna «Cobrado» visible sin expandir, y el
      histórico completo dentro del panel.
- [x] `src/app/admin/extracto/[organizationId]/` + `src/components/admin/extracto.tsx` —
      el extracto imprimible, protegido como el panel.

## Verificación en vivo (2026-10-20)

| Comprobación | Resultado |
|---|---|
| Registrar un cobro de $1.500 | guardado, y `paid_through` movido a la vez |
| **Segundo cobro** | arranca el 20 dic, donde terminó el primero: **no pierde días** |
| Histórico | 2 cobros, con nota y autor |
| Total | $3.000,00 |
| Columna «Cobrado» en la lista | visible sin expandir |
| Extracto | 200, con logo, total y aviso de que no es factura |
| **Un cliente pidiendo el extracto de otro** | **404** |

Gates: typecheck ✓ · lint ✓ · **1220 tests** ✓ · build ✓.

## Dos cosas que pasaron probando

1. **El extracto «se quedaba cargando».** Dos causas a la vez: corrí `pnpm build` con el
   `pnpm dev` del operador encendido —las dos escriben en `.next` y le rompí el servidor—
   y, además, era una pantalla nueva que el modo desarrollo compila la primera vez (10 s;
   la segunda carga, 0,4 s). Anotado en `docs/desarrollo-local.md`.
2. **El histórico «no aparecía» en mi comprobación.** Estaba bien: solo se dibuja al
   expandir. Pero buscarlo me hizo ver que el total debía estar a la vista sin abrir nada,
   que es lo que más se mira de un cliente. Acabó siendo una mejora.
