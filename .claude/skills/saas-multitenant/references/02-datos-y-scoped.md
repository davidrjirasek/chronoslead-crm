# 2 · Datos: `organization_id` + `scoped()`

## Reglas del esquema

- Toda tabla de **dominio** (contactos, conversaciones, mensajes, leads,
  plantillas, credenciales, adjuntos, agenda…) lleva `organization_id` **NOT
  NULL** con llave foránea a `organization`.
- Índices con la organización **primero**: `(organization_id, created_at)`,
  `(organization_id, phone)`. Así cada consulta por tenant es un rango del índice.
- Los únicos también se vuelven compuestos: `UNIQUE(organization_id, phone)` en
  vez de `UNIQUE(phone)`. La misma persona puede escribirle a dos negocios.
- Excepción que se mantiene global: identificadores de eventos del proveedor
  (`wa_message_id`) para la idempotencia, porque son únicos en Meta.
- Las tablas **de plataforma** (planes, concesiones, auditoría) usan un ámbito
  explícito y documentado; nunca se mezclan con las de negocio.

## El helper que vuelve incómodo olvidar el tenant

```ts
import { and, eq, type SQL } from "drizzle-orm";
import type { PgColumn } from "drizzle-orm/pg-core";

export function scoped(orgColumn: PgColumn, organizationId: string, ...conds: (SQL | undefined)[]): SQL {
  if (!organizationId) throw new Error("scoped(): organizationId vacío — query sin tenant");
  const base = eq(orgColumn, organizationId);
  const rest = conds.filter((c): c is SQL => c !== undefined);
  return rest.length ? and(base, ...rest)! : base;
}

// Uso
db.select().from(conversation)
  .where(scoped(conversation.organizationId, orgId, eq(conversation.status, "abierta")));
```

- Lanza con `organizationId` vacío: un bug de resolución se convierte en error
  ruidoso, no en una consulta que devuelve todo.
- En revisión, cualquier `where` de dominio sin `scoped()` requiere una
  justificación escrita (constitución, frontera de tenant).
- Los `update` y `delete` también van por `scoped()`: el cruce de datos más caro
  es el de escritura.

## Migrar desde single-tenant

1. Agrega `organization_id` nullable, rellénalo con la organización existente,
   luego vuélvelo NOT NULL (tres pasos, migraciones re-ejecutables).
2. Cambia los únicos globales por compuestos antes de crear la segunda
   organización.
3. Siembra **dos** organizaciones en desarrollo desde el primer día; con una sola
   no hay forma de ver un cruce.

## Opcional: RLS de PostgreSQL

Row Level Security es una segunda red (la base rechaza filas de otro tenant aunque
el código se equivoque). Si la usas, fija el tenant por transacción
(`set local app.org_id = …`) y no la conviertas en la única defensa: el guion de
aislamiento sigue siendo el gate.
