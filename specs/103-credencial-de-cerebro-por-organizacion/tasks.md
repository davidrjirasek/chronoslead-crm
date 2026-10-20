# 103 — Tareas

- [x] `src/server/bot/credencial.ts` — derivación y resolución, puras, con
      comparación en tiempo constante.
- [x] `src/server/bot/auth.ts` — `validBotKey` rechaza el secreto del despliegue en
      plataforma; `resolveInstanceOrg(req)` saca la organización de la credencial y
      comprueba que existe. El camino single-tenant (cache de «la única organización»)
      queda intacto.
- [x] Las 10 rutas de `/api/bot/*` pasan la petición. TypeScript las señaló todas: el
      cambio de firma no se puede olvidar en ninguna.
- [x] `tests/unit/bot-credencial-por-organizacion.test.ts` — 11 casos.

## Plan en una línea

`BOT_API_KEY` deja de ser la credencial y pasa a ser el secreto del despliegue; cada
organización usa `{orgId}.{HMAC}` derivado de él. Sin `EDITION=cloud` no cambia nada.

## Verificación en vivo (2026-10-20)

`BOT_API_KEY` de prueba en el `.env` local, dos organizaciones (`alfa` con el agente
«Martillito» de la ferretería, `beta` vacía), todas las llamadas contra el mismo host.

| Comprobación | Resultado |
|---|---|
| `GET /api/bot/profile` con el **secreto del despliegue a secas** | 401 — ya no es llave maestra |
| Con la credencial de **alfa** | 200 · agente «Martillito» |
| Con la credencial de **beta** | 404 — ve **lo suyo** (no tiene agente), no la ferretería |
| Firma de alfa presentada con el id de beta | 401 |
| Credencial inventada | 401 |

La tercera fila es la prueba: antes de este cambio, esa misma credencial habría devuelto
«Martillito», porque la organización salía de «la primera de la tabla» y no de quien
llamaba.

Gates: typecheck ✓ · lint ✓ · **1192 tests** (1181 + 11) ✓ · build ✓.

## Pendiente de verificación humana

Nada en esta spec. No hay ningún cerebro externo conectado todavía: cuando lo haya, su
primera conexión real es la que confirma el contrato de punta a punta.
