# 105 — El guion de aislamiento A/B

**Feature Branch**: `feat/105-guion-de-aislamiento`

**Created**: 2026-10-20

**Status**: Especificada antes de escribir código. Es el **gate** de las specs
101 a 104.

**Input**: paso 9 de la skill `saas-multitenant`.

**Carril**: no toca el modelo de datos ni el código de producto. Añade un guion
de verificación y lo mete en la Definición de Hecho.

## Problema

El aislamiento entre clientes **no falla en una función**. Falla en la
composición: una consulta que olvidó `scoped()`, un cache de proceso que
recuerda la organización anterior, una cookie con un dominio de más, un camino
en segundo plano donde no hay sesión que comprobar.

Las specs 101 a 104 se verificaron a mano, una por una, con comandos escritos
para la ocasión. Eso probó que funcionaban **ese día**. No protege de que el
cambio de la semana que viene rompa uno de los cuatro candados sin que nadie se
entere hasta que un cliente vea los datos de otro.

Hay precedente dentro de este mismo trabajo: la suspensión de la 104 parecía
correcta y la prueba en vivo descubrió que el agente seguía contestando, porque
el candado estaba en la sesión y el turno del agente corre sin sesión. Un test
unitario no lo habría visto nunca: era un camino, no una función.

## Decisiones

### Un guion, no tests sueltos

`scripts/e2e-aislamiento.mjs`, contra la app real, con dos organizaciones vivas
y todas las superficies ejercidas en la misma corrida. Un test unitario prueba
una pieza; aquí el fallo está entre las piezas.

### Pide por hostname real, nunca con cabecera `Host`

El `fetch` de Node **ignora** la cabecera `Host`: es una cabecera prohibida.
Pedir a `127.0.0.1` con `Host: alfa.lvh.me` haría que todo llegara como
`127.0.0.1` —un host que no es de nadie— y el guion declararía aislamiento
perfecto por el motivo equivocado. Es una trampa real: este trabajo cayó en ella
al verificar la 101 a mano.

### Los identificadores los da la app, no el guion

El `organizationId` y la firma del webhook salen de `GET /api/settings/webhook`,
que es la misma pantalla que el cliente copia y pega en Meta. Construirlos a
mano tiene el mismo defecto que la cabecera `Host`: con un id inventado todo
responde 404 y el guion «pasa» sin haber probado nada. La primera versión de
este guion falló exactamente así, y por eso ahora aborta si no obtiene las dos
URLs.

### Identificador de corrida en cada mensaje inyectado

`RUN = Date.now()` en cada `wa_message_id`. Sin él la segunda corrida se
descarta por idempotencia —correctamente— y el guion «probaría» justo lo
contrario de lo que cree.

### Siembra sus propias organizaciones

Con `pnpm provision`, que es idempotente. El guion no depende de que alguien
haya preparado la base a mano, y de paso ejercita el alta real de la 104.

### Se verifica a sí mismo

Un gate que nunca se pone rojo no protege de nada. Se comprobó rompiendo a
propósito el guardián de procedencia: el guion se puso rojo en la comprobación
correcta y volvió a verde al restaurarlo.

## Las comprobaciones

| # | Superficie | Qué comprueba |
|---|---|---|
| — | Preparación | las dos organizaciones se crean, entran y conectan su WhatsApp; cada una ve **su** URL de webhook y son distintas |
| 1 | Marca sin sesión | el login de A muestra la marca de A y **no** la de B, y al revés |
| 2 | Sesión | la cookie de A en el host de B es rechazada; en su host funciona |
| 3-5 | Bandeja, pipeline, contactos | ningún id se cruza, y las dos devuelven datos |
| 6 | Tiempo real (SSE) | el stream de B rechaza la sesión de A |
| 7 | Hosts que no son de nadie | «esta instancia no existe», sin filtrar la marca de nadie |
| 8 | Firmas de webhook | la firma de B no abre la puerta de A; una organización inventada no tiene puerta |
| 9 | **Escritura por webhook** | un evento por la puerta de B con el número de A **no** entra en A ni en B; el mismo por la puerta de A **sí** entra en A y no en B |
| 10 | Cerebro | el secreto del despliegue a secas no vale; la credencial de A vale; la firma de A con el id de B no vale |
| 11 | Suspensión | la suspendida no entra y la otra sí; su WhatsApp **se guarda** y el agente **no** contesta; al reactivar vuelve |

La 9 es la que más importa: las comprobaciones de **escritura** son las que
suelen faltar, y un cruce de escritura corrompe los datos de un cliente sin que
él lo note.

## Criterios de aceptación

1. `pnpm test:e2e:aislamiento` sale con código 0 y todas las comprobaciones en
   verde.
2. Correrlo tres veces seguidas da el mismo resultado: ninguna corrida ensucia
   la siguiente.
3. Romper a propósito un candado pone el guion en rojo, en la comprobación que
   corresponde, y sale con código distinto de 0.
4. La Definición de Hecho de `CLAUDE.md` lo nombra como el gate que manda.

## Fuera de alcance

- **Adjuntos**: un id de media de B pedido desde A. No hay adjuntos sembrados
  todavía; entra cuando los haya.
- **Agenda**: las citas de un rango. Entra cuando el guion siembre citas.
- Correrlo en CI: la CI de upstream no tiene `lvh.me` ni dos organizaciones.
  Entra con el despliegue.

Cada superficie nueva que devuelva datos de una organización entra en este guion
**en el mismo PR que la crea**. Es la lista de verificación viva del Principio
III, no un documento que se escribe una vez.
