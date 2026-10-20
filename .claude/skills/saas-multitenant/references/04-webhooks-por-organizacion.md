# 4 · Webhook por organización

## El problema

Con un solo webhook para toda la instancia, el reparto se hace por el
`phone_number_id` que viene dentro del cuerpo. Con un negocio bastaba. Con
muchos no: todos conocen esa URL (la pegan en su app de Meta) y con ella se le
puede meter un mensaje inventado a la bandeja de otro.

## La solución: una puerta por organización + un guardián

```
/api/webhooks/{canal}/{organizationId}/{firma}
```

### La firma se DERIVA, no se guarda

```ts
import { createHmac } from "node:crypto";
const DOMINIO = "miapp:webhook:v1"; // etiqueta propia: no sirve para nada más

export function segmentoDeOrganizacion(orgId: string, version: number): string {
  return createHmac("sha256", env.APP_SECRET)          // la clave maestra de la instancia
    .update(`${DOMINIO}:${orgId}:${version}`)
    .digest("base64url");
}

export function segmentoValido(orgId: string, version: number, candidato: string): boolean {
  return !!candidato && timingSafeEqualStr(candidato, segmentoDeOrganizacion(orgId, version));
}
```

- Derivarla evita guardar un secreto más (que habría que cifrar para mostrarlo
  **y** además indexar un hash para buscarlo).
- `organization.webhook_token_version` (entero) permite **rotar** la URL de una
  organización sin tocar las demás: súbelo y la URL vieja deja de valer.
- La etiqueta de dominio (`miapp:webhook:v1`) evita que ese HMAC valga en otro
  contexto (p. ej. autenticación), aunque salga de la misma clave maestra.
- El `verify_token` del handshake de Meta puede ser el mismo segmento: es lo
  que el cliente ve y lo que la ruta comprueba.

### El guardián de procedencia (el que NO es opcional)

La ingesta enruta por lo que viene DENTRO del cuerpo (`phone_number_id`,
`waba_id`, id de Instagram). Sin comprobar que ese identificador pertenece a la
organización de la puerta, la URL por organización es decorativa: basta entrar
por la puerta propia y escribir el identificador ajeno.

```ts
type Procedencia =
  | { via: "organizacion"; organizationId: string } // entró por la URL de una org
  | { via: "legacy" }                               // URL compartida vieja (solo si la conservas)
  | { via: "interna" };                             // mocks, reprocesos

function puedeEscribirEn(p: Procedencia, orgDelCuerpo: string): boolean {
  if (p.via === "organizacion") return p.organizationId === orgDelCuerpo;
  if (p.via === "legacy") return orgTieneLegacyPermitido(orgDelCuerpo);
  return true; // interna
}
```

- Si no coincide: se descarta y se registra (sin datos personales), y se
  responde 200 a Meta para que no reintente sin fin.
- **La firma de Meta (`X-Hub-Signature-256`) se valida siempre**, además del
  segmento: el segmento dice a qué organización va; la firma dice que viene de
  Meta.
- Si mantienes la URL compartida vieja durante la migración, hazlo con una
  bandera por organización (`webhook_legacy_ok`) y apágala en cuanto cada una
  registre la suya.

## Idempotencia y ritmo

- `wa_message_id` UNIQUE: el reintento de Meta no duplica.
- Acusa recibo rápido (200) y procesa después (en Next.js, `after()`), pero
  **persiste antes de despachar al cerebro**: la caída del cerebro jamás pierde
  el mensaje.

## Qué URL mostrar

La que corresponde al subdominio de la organización (`https://{slug}.tudominio/api/webhooks/wa/{org}/{firma}`),
no la del dominio base: el reparto va por el id de la ruta, pero enseñarle al
cliente una URL con otro subdominio parece un error. Fuera de una petición
(tareas de fondo), usa la URL base de la instancia.
