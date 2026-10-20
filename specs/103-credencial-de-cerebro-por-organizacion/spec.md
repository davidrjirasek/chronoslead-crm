# 103 — Una credencial de cerebro por organización

**Feature Branch**: `feat/103-credencial-de-cerebro-por-organizacion`

**Created**: 2026-10-20

**Status**: Especificada antes de escribir código. Depende de la
[101](../101-resolucion-tenant-por-host/spec.md) (`EDITION=cloud`).

**Input**: paso 5 de la skill `saas-multitenant`. Cierra el atajo **#3** del
[inventario](../../docs/inventario-single-tenant.md).

**Carril**: ciclo completo. No toca el modelo de datos. Cambia la autenticación
de un contrato público (`/api/bot/*`), pero solo con `EDITION=cloud`: sin la
bandera, el contrato de upstream queda byte a byte igual.

## Problema

`/api/bot/*` es la puerta por la que un cerebro externo conduce las
conversaciones sin que el token de WhatsApp salga del CRM. Se autentica con
`X-API-Key` contra **una sola** `BOT_API_KEY` de la instancia.

Con un negocio por instancia es correcto. En plataforma es una **llave
maestra**: quien tenga la de un cliente puede leer y escribir las conversaciones
de todos.

Y hay un segundo defecto, más silencioso, que el inventario no detallaba:
`resolveInstanceOrg()` devolvía **«la primera organización de la tabla»**,
cacheada en memoria. Es el mismo patrón que cerró la 101, en otro sitio: con
muchos clientes, todo lo que hiciera cualquier cerebro externo —leer fichas,
responder, escalar a un humano— caía en **la misma bandeja**, la de quien
estuviera primero.

## Decisiones

### `BOT_API_KEY` pasa a ser el secreto del despliegue

Nadie lo ve. De él se deriva una credencial por organización:

```
{organizationId}.{HMAC-SHA256(BOT_API_KEY, "chronoslead:cerebro:v1:{orgId}")}
```

La alternativa —darle a cada organización un secreto guardado— obliga a
cifrarlo, indexarlo para poder buscarlo y gestionar su caducidad. Derivarlo no
guarda nada: rotar `BOT_API_KEY` revoca todas a la vez, y la organización se
resuelve en O(1) porque viaja delante, sin probar una por una.

La trampa que esto evita, y que la skill marca explícitamente: **poner el mismo
secreto a todas las organizaciones**. Cada cliente ve su credencial; con una
común, el cerebro de A se presenta como B y escribe en la bandeja de B.

### La organización sale de la credencial, no de la tabla

`resolveInstanceOrg(req)` recibe la petición. En plataforma devuelve la
organización que la credencial declara —y solo si esa organización existe—.
Sin `EDITION=cloud`, sigue devolviendo la única organización de la instancia,
cacheada, exactamente como hoy.

### El secreto del despliegue no vale como credencial

Presentarlo tal cual responde **401** en plataforma. Si valiera, seguiría siendo
una llave maestra.

### La etiqueta de dominio es propia

`chronoslead:cerebro:v1` — distinta de la del webhook (`chronoslead:webhook:v1`),
para que un HMAC derivado de una clave no valga en el otro contexto.

## Comportamiento esperado

| `X-API-Key` | Resultado en plataforma |
|---|---|
| Credencial de la organización A | autenticado, y escribe **en A** |
| Credencial de la organización B | autenticado, y escribe **en B** |
| `BOT_API_KEY` a secas | 401 |
| Firma de A presentada con el id de B | 401 |
| Credencial de otro despliegue | 401 |
| Credencial de una organización que ya no existe | 409 `no_org` |
| Cualquier credencial, con `EDITION` apagada | el comportamiento de upstream, sin cambios |

## Criterios de aceptación

1. Con `EDITION` apagada, `/api/bot/*` se comporta igual que hoy y los 1181
   tests siguen verdes.
2. El secreto del despliegue presentado como credencial responde 401.
3. Dos credenciales distintas sobre la misma instancia devuelven **datos
   distintos**: la de A ve el agente de A; la de B ve el suyo, no el de A.
4. Una credencial falsificada (id cambiado a mano, firma de otra organización,
   otro despliegue) responde 401.
5. Formas rotas (`.`, `org.`, sin punto, con dos puntos) responden 401 sin
   lanzar.
6. La derivación está cubierta por tests, con comparación en tiempo constante.

## Fuera de alcance

- **Enseñarle la credencial al dueño en la interfaz.** Hoy no hay cerebros
  externos en uso y `BOT_API_KEY` ni siquiera está definida en producción;
  añadir ahora un campo a una pantalla que nadie mira es construir para un
  futuro hipotético. Entra cuando exista el primer cerebro externo, en la
  pantalla «Quién responde a tus clientes».
- **Revocar una organización sin rotar el secreto del despliegue.** Hoy se
  revoca borrando o suspendiendo la organización (la credencial deja de
  resolver). El estado de organización llega con la spec 104.
- El endpoint compatible con OpenAI para que el cerebro piense sin ver la llave
  de IA (`/api/brains/llm` de la skill): es otra feature, no un atajo a cerrar.
