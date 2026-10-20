# 7 · La capa de plataforma

Lo que convierte "código multitenant" en un negocio operable: quién entra, qué
pasa cuando deja de pagar, cuánto puede usar y cómo lo administras tú.

## Alta (aprovisionamiento)

- Vive en `alta.tudominio` (subdominio reservado), **no en el apex**: el apex
  suele servirlo tu landing, y un `/alta` ahí puede devolver 200… de otra
  aplicación. Un 200 del sitio equivocado es peor que un 404: parece que funciona.
- Flujo mínimo: correo → código de un solo uso por correo (verifica que el buzón
  es suyo) → nombre del negocio y slug (valida con la función del paso 1; rechaza
  reservados y ocupados) → crea organización + dueño + credenciales vacías →
  redirige a `https://{slug}.tudominio`.
- Solo el alta y el superadmin crean organizaciones. Ningún endpoint genérico.
- Idempotente: reintentar el alta con el mismo correo no crea dos organizaciones.

## Elegibilidad en TRES estados

Si el alta depende de algo externo (membresía de una comunidad, lista blanca,
suscripción activa), la consulta devuelve:

| Estado | Significado | Qué hace la plataforma |
|---|---|---|
| `activo` | Puede | Alta permitida / sigue activa |
| `inactivo` o `no_es_miembro` | Estuvo y ya no / nunca estuvo | Alta negada / inicia la gracia |
| `indisponible` | No se pudo saber (red, 5xx, JSON raro, sin configurar) | **Nada cambia**: no hay altas nuevas, pero no se suspende a nadie |

Confundir "no pude saber" con "no es miembro" es el error que suspende a todos
tus clientes por una caída de tu proveedor. Consulta siempre desde el servidor,
filtrando por UN correo: nunca descargues la lista completa (son datos
personales de cientos de personas).

## Suspensión y gracia

- Una baja o un impago confirmados inician **N días de gracia desde la primera
  detección**; los reintentos no reinician el reloj.
- Cada causa (baja, impago, suspensión manual) se registra y se resuelve por
  separado. Una suspensión manual no se levanta sola al pagar.
- Suspendida = nadie entra (ni el dueño), los webhooks se siguen recibiendo y
  guardando (no pierdas mensajes), el agente no responde.
- **Nunca se borran los datos.** Sin columna de expiración ni tarea de purga, y
  este modelo no debe ganar una. El borrado solo ocurre por petición explícita
  del dueño. Reactivar devuelve todo intacto.

## Cuotas con degradación definida

- Mide por organización: almacenamiento de adjuntos, mensajes, llamadas a IA.
- Al llegar al límite de media: el mensaje se guarda igual, **sin** el archivo, y
  se avisa. Nunca se bloquea la bandeja ni se pierde la conversación.
- Rate limits con clave por organización (no por IP): con un proxy delante,
  todos los clientes comparten IP.

## Panel de superadmin

- En `admin.tudominio` (reservado), con su propio control de acceso.
- Listar organizaciones con uso, estado y causa de suspensión; crear; suspender y
  reactivar; conceder plazas o excepciones.
- Toda concesión o revocación registra **autor, motivo, vigencia y afectados**.
- El superadmin no lee conversaciones por defecto: si lo necesitas para soporte,
  que sea una acción explícita y auditada.

## Cobro (si aplica)

- Detrás de un adaptador: el dominio conoce `activa` / `vencida`, no el
  vocabulario del proveedor.
- El estado de pago vive en tu base; el webhook del proveedor lo actualiza, no lo
  dicta. Un webhook que no llega deja todo como estaba.
- Checkout alojado del proveedor: ningún dato de tarjeta toca tu instancia.
- Si hay **reventa** (un cliente crea organizaciones para sus clientes), escribe
  antes de programar las cuatro reglas: de quién son los datos, qué pasa si el
  revendedor se va, a quién se cobra y si el cliente final puede seguir solo.
