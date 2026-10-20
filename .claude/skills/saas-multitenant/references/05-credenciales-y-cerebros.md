# 5 · Credenciales y cerebros por organización

## Credenciales de terceros

| Credencial | Dónde vive | Regla |
|---|---|---|
| WhatsApp: WABA ID, Phone Number ID, token del negocio | Tabla por organización, token cifrado | Tras el Embedded Signup solo hacen falta esos tres datos |
| App Secret de Meta (si el cliente usa SU app) | Igual, cifrado | Verifícalo al guardar (ver abajo) |
| Llave del proveedor de IA | Tabla por organización, cifrada | Nunca en variables de entorno de la instancia si la IA la paga cada cliente |
| Conectores (Zernio, Google, Zoom…) | Por organización, cifrados | Un client ID de plataforma no autoriza compartir tokens de usuario |

- **Cifrado**: AES-256-GCM con IV aleatorio por valor; la clave maestra fuera
  del repositorio. Hacia fuera, solo los últimos 4 caracteres.
- **Estado de la credencial** (`activa`, `requiere_reconexion`, `pausada`):
  un 401 del proveedor la pasa a `requiere_reconexion` y el panel lo muestra.
- **Verifica al guardar, no al primer mensaje**:
  - Token ↔ número: `GET /{phone_number_id}?fields=display_phone_number,verified_name`
    con ese token.
  - App Secret ↔ app del token: `GET /debug_token?input_token=…` dice de qué app
    es el token; luego un token de app `{app_id}|{secreto}` solo lo acepta Meta
    si el secreto es de esa app. Con el secreto de otra app todos los eventos se
    rechazan por firma **en silencio**: el número sale "conectado" y la bandeja
    se queda vacía.

## La llave de IA no sale de la plataforma

Tentación: entregarle al agente (cerebro) el token de OpenRouter del cliente.
Tiene dos defectos que no se ven hasta que muerden:

1. Una llave filtrada no se puede "desfiltrar"; un permiso sí se quita.
2. Si el proveedor responde 401 o 402 (sin saldo), ese código lo recibe el
   cerebro, y el panel del cliente sigue diciendo "activa" mientras nada
   funciona.

Patrón: un endpoint **compatible con OpenAI** dentro de la plataforma
(`/api/brains/llm`). El cerebro pide "piensa esto", la plataforma le pone la
credencial de la organización y reenvía. La llave se queda dentro y el 401 lo
recibe quien puede actuar. Solo los despliegues marcados de confianza pueden
usar esa ruta (los demás, 403 aunque la conozcan) y solo con los modelos que la
organización aprobó.

## Un cerebro para muchas organizaciones

Levantar un contenedor de agente por cliente no escala. Para compartir un
despliegue sin romper el aislamiento:

- **Trampa**: ponerle el mismo secreto a todas las organizaciones. Cada cliente
  ve su secreto en Ajustes; con uno común, A se presenta con el slug de B y
  escribe en la bandeja de B.
- **Patrón**: el secreto es del **despliegue** (nadie lo ve) y de él se deriva
  una credencial por organización:

  ```
  credencial(org) = HMAC-SHA256(secreto_del_despliegue, "miapp:cerebro:v1:{orgId}")
  ```

  No hay credencial que guardar ni que caduque; desuscribir a una organización
  la revoca al instante; rotar el secreto del despliegue revoca todas.
- Dentro del agente, toda clave de estado es **(organización, identidad)**:
  una identidad UNIQUE global hace que la misma persona escribiéndole a dos
  negocios comparta historial, y el de uno entra en el prompt del otro.

## Un solo cerebro activo por organización

Si el agente externo está encendido, el interno se apaga (y viceversa): con los
dos, el cliente recibe dos respuestas distintas. El modelo vive en el perfil del
agente, no en la instancia.
