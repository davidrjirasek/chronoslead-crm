# Cumplimiento: páginas legales y callbacks

Meta abre estas URLs durante la revisión. Si no cargan, o no hablan de los datos que recibes de WhatsApp, es motivo de rechazo.

## Tres páginas públicas (HTTPS, sin login)

| Página | Qué debe decir |
|---|---|
| `/privacy` | Qué datos recibes de Meta (números, nombres de perfil, contenido de mensajes, IDs de WABA y de número), para qué, cuánto tiempo los guardas, con qué **proveedores** los procesas (los mismos que declaras en el formulario), cómo se piden el acceso y la eliminación, y un correo de contacto de tu dominio |
| `/terms` | Condiciones del servicio del SaaS |
| `/data-deletion` | Instrucciones para pedir la eliminación, y una página de estado que reciba `?code=` |

Coherencia total con lo que declaras en *Gestión de datos*: si en el formulario dices "OpenRouter", la política lo menciona.

## Eliminación de datos: instrucciones **o** callback

En *Información básica* Meta acepta una de las dos. El callback es lo correcto a medio plazo y evita el bug de "URL no válida" del campo de instrucciones.

```ts
// POST /api/meta/data-deletion   (form-urlencoded: signed_request=...)
const datos = leerSignedRequest(signedRequest, APP_SECRET);
if (!datos) return new Response("invalid", { status: 400 });
const codigo = await borrarDatosDe(datos.user_id);   // desvincula credenciales y purga lo que corresponda
return Response.json({ url: `https://tu-dominio.com/data-deletion/status?code=${codigo}`, confirmation_code: codigo });
```

## Desautorización

`POST /api/meta/deauthorize` recibe el mismo `signed_request` cuando alguien quita tu app desde Meta. Revoca las credenciales de ese `user_id` (marca la conexión como inactiva; no borres el historial del negocio sin pedírselo) y responde 200.

## Verificar el `signed_request`

```ts
import { createHmac, timingSafeEqual } from "node:crypto";

export function leerSignedRequest(sr: string, appSecret: string): { user_id: string } | null {
  const [firma, payload] = (sr ?? "").split(".");
  if (!firma || !payload) return null;
  const esperado = createHmac("sha256", appSecret).update(payload).digest();
  const recibido = Buffer.from(firma, "base64url");
  if (recibido.length !== esperado.length || !timingSafeEqual(recibido, esperado)) return null;
  try {
    const datos = JSON.parse(Buffer.from(payload, "base64url").toString("utf8"));
    return datos?.algorithm === "HMAC-SHA256" && typeof datos.user_id === "string" && datos.user_id ? datos : null;
  } catch { return null; }
}
```

Pruébalo con un `signed_request` firmado con **otro** secreto y con uno manipulado: los dos deben dar `null`.

## Qué guardas y qué borras

| Dato | Guardar | Al eliminar |
|---|---|---|
| Token del cliente | Cifrado (AES-256-GCM) | Borrar |
| WABA ID, Phone Number ID, número visible | Sí | Conservar solo si el negocio sigue activo |
| `meta_user_id` (app-scoped) de quien autorizó | Sí | Es la llave para mapear la desautorización |
| Mensajes y contactos | Sí, por tenant | Borrar o anonimizar según tu política (declara el plazo: p. ej. 90 días) |
| App Secret y PIN | Nunca en la base de datos del tenant | — |

## Cuestionario de protección de datos (después de la aprobación)

Meta exige el *Data Protection Assessment* a las apps con acceso avanzado, con plazo y pérdida de acceso si no se contesta. No pide certificaciones: pide **políticas escritas** y evidencia. Ten listo desde ahora: cifrado en reposo de secretos, TLS, MFA en tus cuentas (GitHub, panel de despliegue, DNS, hosting), revisión de accesos, parches y un canal para reportar vulnerabilidades publicado en la política de privacidad.
