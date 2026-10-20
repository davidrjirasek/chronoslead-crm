# 105 — Tareas

- [x] `scripts/e2e-aislamiento.mjs` — 34 comprobaciones sobre la app real con dos
      organizaciones vivas.
- [x] `pnpm test:e2e:aislamiento` en `package.json`.
- [x] `CLAUDE.md` — el guion nombrado en la Definición de Hecho, con lo que necesita
      para correr.

## Verificación (2026-10-20)

| Comprobación del propio guion | Resultado |
|---|---|
| Corrida completa | **34/34**, código de salida 0 |
| Tres corridas seguidas | 34/34 las tres: ninguna ensucia a la siguiente |
| **Sabotaje deliberado** del guardián de procedencia | **rojo en «un evento por la puerta de B con el número de A NO entra en A»**, 33/34, código 1 |
| Tras restaurar el guardián | verde otra vez, 34/34 |

La fila del sabotaje es la que importa: un gate que nunca se pone rojo no protege de
nada, y hasta no verlo fallar por el motivo correcto no se sabe si mide algo.

## Dos fallos del propio guion, encontrados al escribirlo

Los dos son la misma trampa con distinta cara: **comprobar que algo falla cuando todo
falla no prueba nada.**

1. La primera versión sacaba el `organizationId` de `/api/onboarding/status`, que no lo
   devuelve. Con el id vacío, «la firma de B no abre la puerta de A» salía en verde —
   porque **todas** las peticiones daban 404. Ahora los identificadores los da
   `GET /api/settings/webhook`, la misma pantalla que el cliente copia en Meta, y el
   guion aborta si no los obtiene.
2. La receta avisa de la otra, y este trabajo ya había caído en ella al verificar la 101
   a mano: el `fetch` de Node ignora la cabecera `Host`. Pedir a `127.0.0.1` con
   `Host: alfa.lvh.me` hace que todo llegue como un host de nadie. El guion pide siempre
   por hostname real.

## Pendiente

- Adjuntos y agenda: entran en el guion cuando el sembrado los cree.
- Correrlo en CI: necesita `lvh.me` y dos organizaciones; entra con el despliegue.
