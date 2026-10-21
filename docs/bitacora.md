# Bitácora — ChronosLead

Qué se hizo, cómo se probó y dónde vive cada cosa, en la operación real.
**Nunca valores de secretos**: como mucho, sus últimos 4. La bitácora del
upstream, en `bitacora-2.0.md`.

## 2026-10-20 — Fase 5: la plataforma en producción

### Qué quedó corriendo

VPS único, Coolify v4.4.6, proyecto `chronos-lead`, entorno `production`.

| Recurso | Qué es |
|---|---|
| `postgresql-database-rwwdxz…` | `postgres:17-alpine`. Base `postgres`, usuario `postgres`, puerto 5432, red `coolify` |
| `chronoslead-crm:main-fts5…` | La app. Repositorio **público**, rama `main`, build pack `dockerfile`, puerto 3000 |
| Volumen | `…-chronoslead-data` montado en `/data` |

**Postgres 17 y no 16** como fija el compose del upstream: así producción y el
desarrollo local corren la misma versión. Las migraciones son SQL corriente.

| Dirección | Qué sirve |
|---|---|
| `admin.chronoslead.com` | Panel del operador. También es `APP_BASE_URL` mientras dure la prueba |
| `creativo-4d-group.chronoslead.com` | El CRM del primer cliente de la plataforma |
| `chronoslead.com` + `/app/*` | **El sistema anterior, intacto.** No se tocó |

Los `www.` de esos dos subdominios los agregó Coolify solo y se borraron:
`www.admin.chronoslead.com` tiene dos etiquetas antes del dominio y la
resolución lo rechaza a propósito (aceptar `a.b.dominio` dejaría que un host
inventado cayera en un tenant real).

**`nuevo.chronoslead.com` se descartó.** La idea era un subdominio de pruebas,
pero aquí todo subdominio no reservado **es un cliente**: habría sido «el
cliente llamado nuevo» y mostraría «esta instancia no existe». Las reservadas
están en `src/lib/tenant/host.ts`, y solo tres hacen algo: `admin`, `alta` y
`www`.

### Variables

14 en la app, en runtime. Las de plataforma (`EDITION=cloud`,
`BASE_DOMAIN=chronoslead.com`, `PLATFORM_SUPERADMIN_EMAILS`,
`LANDING_ORG_SLUG=creativo-4d-group`, `DIAS_DE_GRACIA=7`) no existen en el
upstream. **Sin `OPENROUTER_API_TOKEN` a propósito**: la decisión de producto
es una llave por organización, guardada cifrada desde Ajustes → IA.

Fuera, también a propósito: `WA_MOCK_ENABLED`, `META_GRAPH_BASE_URL`,
`OPENROUTER_BASE_URL` (simuladores), y `MEDIA_DIR`/`PROVISION_DIR`, que la
imagen ya trae.

### Lo que se encontró en el camino

**Las herramientas de alta no viajaban en la imagen** (arreglado en 110). En
plataforma no hay registro público: la primera cuenta se crea con `provision`,
y ese guion solo existía como código fuente. El despliegue habría quedado sano
y sin forma de que entrara nadie — ni el cliente ni el operador, que necesita
una cuenta de usuario para llegar al panel. El upstream no lo sufre porque ahí
el primer registro crea la organización; esa puerta es justo la que
`EDITION=cloud` cierra.

**La guía de despliegue ya existía** (`INSTALL-IA.md`, escrita para que la siga
una IA) y se estaba redactando otra en paralelo. Lo detectó el dueño
preguntando. La regla quedó en `CLAUDE.md`.

### Cómo se probó

- `GET /api/health` → `{"ok":true,"version":"1.6.0","commit":"b2798aa",…,"mediaWritable":true}`.
  **`mediaWritable:true`** es la comprobación del upstream de que el volumen
  quedó montado: en `false`, los adjuntos y logos se pierden en cada despliegue
- `admin.chronoslead.com` sirve la entrada; con sesión de superadmin, el padrón
- `creativo-4d-group.chronoslead.com` daba «esta instancia no existe» **antes**
  del alta y la pantalla de entrada **después**: el alta es lo único que cambia
- Un subdominio inventado → 503, ni llega a la app
- `chronoslead.com` y `chronoslead.com/app/login` → 200 durante todo el proceso
- Los dos recorridos completos, hechos por el dueño: entrar al CRM del cliente,
  y entrar al panel con el mismo usuario
- `node provision.mjs` dentro del contenedor creó la organización y escribió el
  enlace en `/data/.provision/` — lo que cerró la verificación pendiente de 110
- Ajustes → IA: «Probar conexión» correcta (1525 ms), llave `…33a9` guardada
  cifrada

**El guion de aislamiento NO se corrió contra producción**, y no debe: siembra
sus propias organizaciones —quedarían en la base real— y da por encendidos los
simuladores. Es un gate del código y vive en local.

### Pedido del dueño: manual de alta de un cliente (2026-10-21)

Creativo 4D Group es el **primero** de varios: siguen Student Store, Castel
Muebles y los demás. Cada uno se configura igual, y hoy ese procedimiento solo
existe en esta conversación.

Hace falta un **manual paso a paso** para que cualquiera del equipo pueda dar de
alta una instancia —con Claude Code al lado, pero sin depender de que alguien
recuerde el orden—. Cubre el recorrido completo, desde cero:

1. Alta de la organización (`provision.mjs`) y entrega del enlace de primer
   acceso al cliente
2. Primera entrada del cliente: elegir contraseña, qué ve, los cuatro pasos de
   la guía de inicio
3. Proveedor de IA: llave propia por organización, probar conexión
4. El agente: nombre, tono, instrucciones, escalado, saludo
5. La base de conocimiento: qué va en bloques y qué en preguntas/respuestas, y
   **por qué los datos duros van ahí y no en las instrucciones**
6. La agenda: franjas, duración, respiro, aviso, ventana y **zona horaria**
7. El conector de reunión (Zoom o Google) y cómo crear sus credenciales
8. Canales: WhatsApp, y después Instagram/Facebook
9. El Laboratorio antes de encender el agente
10. Encender, y qué revisar la primera semana

Lo que se aprendió configurando Creativo 4D va en ese manual, no en la memoria
de nadie: el campo Tono es de una línea y se come los saltos; la zona horaria
nace en Ciudad de México; Zoom llama `:admin` a sus permisos; el cuarto permiso
de Zoom es el que rompe «Probar».

El material de Creativo 4D sirve de **ejemplo trabajado** del manual, pero el
contenido comercial de cada cliente vive fuera del repo: este es público.

### Pendiente

- Conectar un número real de WhatsApp y probar en vivo que el agente conteste y
  agende (Ajustes → WhatsApp; el webhook lo registra el CRM solo al guardar)
- **El corte de dominio**, que requiere el OK explícito del dueño. Al mover el
  apex: `APP_BASE_URL` pasa a `https://chronoslead.com` y hay que **volver a
  registrar el webhook en Meta**, porque su URL sale de esa variable. El
  sistema anterior queda **detenido, no borrado**, una semana
- **Coolify está expuesto por HTTP sin cifrar** en el puerto 8000: la
  contraseña del panel —control total del servidor— viaja en claro en cada
  entrada. Ponerlo detrás de HTTPS
- `commitVerified:false` en el health: cosmético, Coolify no pasa
  `SOURCE_COMMIT` como build arg
- Revisión en móvil (375 px) de las pantallas del CRM: **pendiente de
  verificación humana**
