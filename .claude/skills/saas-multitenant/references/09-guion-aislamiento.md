# 9 · El guion de aislamiento A/B (el gate)

El aislamiento no falla en una función: falla en la **composición** (una
consulta que olvidó `scoped()`, un cache de proceso que recuerda la organización
anterior, una cookie con dominio de más). Eso solo se ve ejerciendo todas las
superficies a la vez, con dos tenants vivos y la app real respondiendo. Por eso
es un guion propio (`scripts/e2e-aislamiento.mjs`), no tests sueltos, y **mientras
no esté verde ninguna historia está Hecha**.

## Preparación

1. Base con migraciones aplicadas.
2. Dos organizaciones sembradas con datos propios y marcas distintas
   (`demo` → "Negocio demo", `otra` → "Negocio otra"), cada una con usuario,
   contactos, conversaciones, leads y un adjunto.
3. App viva con la edición multitenant y `BASE_DOMAIN=lvh.me`.

## La trampa que invalida todo

El `fetch` de Node **ignora la cabecera `Host`** (es una cabecera prohibida). Si
pides a `127.0.0.1` con `Host: demo.lvh.me`, todas las peticiones llegan como
`127.0.0.1` —un host que no es de nadie— y el guion "detecta" un aislamiento
perfecto por el motivo equivocado. Pide por **hostname real**:
`http://demo.lvh.me:3000/...` y `http://otra.lvh.me:3000/...`.

## Las superficies (cada una con su comprobación)

| # | Superficie | Comprobación |
|---|---|---|
| 1 | Marca (login sin sesión) | El login de A muestra la marca de A y **no** la de B; el de B, la de B |
| 2 | Sesión | La cookie de A en el host de B → 401/403; en su host, 200 |
| 3 | Bandeja | Los ids de A y B no se cruzan; ambos devuelven datos |
| 4 | Pipeline / tablero | Igual (recoge todos los ids anidados, da igual la forma de la respuesta) |
| 5 | Contactos | Igual |
| 6 | Media | Un id de adjunto de B pedido desde A → 404/401/403, nunca bytes |
| 7 | Tiempo real (SSE) | El stream de B rechaza la sesión de A |
| 8 | Webhook inválido | Una firma inventada no toca datos de nadie |
| 9 | Hosts que no son de nadie | Subdominio inexistente → "esta instancia no existe" sin marca ajena; apex → landing; superficies recortadas → 404 |
| 10 | IA por organización | A guarda su llave y la ve activa (solo últimos 4); B no ve ninguna; la llave completa nunca sale en la respuesta |
| 11 | **Escritura por webhook** | Un evento con el `phone_number_id` de B enviado por la URL de A **no** aparece en la bandeja de B; el mismo evento por la URL de B **sí** |
| 12 | Cerebro compartido | Un despliegue sirve a A y B con credenciales derivadas distintas; la de A no escribe en B |
| 13 | Agenda / calendario | Las citas de un rango solo devuelven las de la organización |

La 11 es la que más importa: las comprobaciones de **escritura** son las que
suelen faltar, y un cruce de escritura corrompe datos de un cliente sin que él
lo note.

## Reglas del guion

- **Identificador de corrida** (`RUN = Date.now()`) en cada `wa_message_id`
  inyectado: sin él, la segunda corrida se descarta por idempotencia y "prueba"
  justo lo contrario.
- **Reintentos al comprobar la bandeja** (p. ej. 12 × 250 ms): el webhook acusa
  recibo antes de procesar; preguntar una sola vez mide la latencia, no el
  aislamiento.
- **Calienta las rutas** antes de medir en modo desarrollo: la primera petición
  compila y puede devolver un estado intermedio.
- **Drena al salir**: si el guion ingiere mensajes y no los procesa, el
  siguiente guion los cuenta como suyos. Un gate intermitente enseña a ignorar
  el rojo.
- Manda `Origin` como un navegador (con puerto): es lo que ejercita de verdad el
  comodín de `trustedOrigins`.
- Cuidado con el límite de logins por IP al encadenar guiones: inicia sesión una
  vez por organización y reutiliza la cookie.
- Salida: un ✅/❌ por comprobación y código de salida distinto de 0 si algo
  falla, para que la CI lo bloquee.

## Cuándo ampliarlo

Cada superficie nueva que devuelva datos de una organización (un reporte, una
exportación, un endpoint para el cerebro) entra al guion en el mismo PR que la
crea. Es la lista de verificación viva del Principio III.
