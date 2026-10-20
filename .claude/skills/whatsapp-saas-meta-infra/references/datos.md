# Esquema mínimo multi-tenant

Independiente del motor. En Postgres/Drizzle/Prisma/Supabase cambia la sintaxis, no el modelo. La regla que no se negocia: **toda** tabla lleva `tenant_id` y **toda** consulta lo filtra.

```sql
-- Un negocio cliente del SaaS
create table tenant (
  id            text primary key,
  slug          text unique not null,          -- subdominio o ruta
  nombre        text not null,
  creado_en     timestamptz not null default now()
);

-- Conexión de WhatsApp del tenant (una activa por tenant)
create table conexion_whatsapp (
  id                   text primary key,
  tenant_id            text not null references tenant(id) on delete cascade,
  waba_id              text not null,
  phone_number_id      text not null,
  numero_visible       text,
  nombre_verificado    text,
  token_cifrado        bytea not null,          -- AES-256-GCM
  token_iv             bytea not null,
  token_tag            bytea not null,
  meta_user_id         text,                    -- app-scoped, para la desautorización
  webhook_token        text not null,           -- último segmento de la URL del tenant
  estado               text not null default 'activa',   -- activa | reconectar
  coexistencia         boolean not null default false,   -- el número sigue viviendo en la app WhatsApp Business: nunca /register ni /deregister
  creado_en            timestamptz not null default now(),
  unique (tenant_id, phone_number_id)
);
create index on conexion_whatsapp (phone_number_id);   -- resolver el tenant desde el webhook

create table contacto (
  id          text primary key,
  tenant_id   text not null references tenant(id) on delete cascade,
  wa_id       text not null,                    -- teléfono o BSUID
  telefono    text,                             -- null si llegó por BSUID
  nombre      text,
  unique (tenant_id, wa_id)
);

create table mensaje (
  id            text primary key,
  tenant_id     text not null references tenant(id) on delete cascade,
  contacto_id   text references contacto(id) on delete set null,
  wa_message_id text not null,
  direccion     text not null,                  -- entrante | saliente
  tipo          text not null default 'text',
  texto         text,
  media_id      text,
  estado        text not null default 'accepted',
  error_codigo  text,
  creado_en     timestamptz not null default now(),
  unique (tenant_id, wa_message_id)             -- idempotencia del webhook
);

create table plantilla (
  tenant_id   text not null references tenant(id) on delete cascade,
  nombre      text not null,
  idioma      text not null,
  categoria   text,
  estado      text not null,
  meta_id     text,
  sincronizada_en timestamptz not null default now(),
  primary key (tenant_id, nombre, idioma)
);
```

Notas:

- **Un índice por `phone_number_id`**: el webhook trae ese ID y con él resuelves el tenant si no usas URL por tenant.
- **Idempotencia**: `unique (tenant_id, wa_message_id)` + upsert. Meta reintenta los webhooks.
- **Supabase**: además de filtrar en la app, activa RLS con políticas por `tenant_id`; usa la *service role key* solo en el servidor.
- **Aislamiento probado**: una prueba automática debe demostrar que el tenant A no lee ni escribe nada del tenant B (ver `verificacion.md`).
