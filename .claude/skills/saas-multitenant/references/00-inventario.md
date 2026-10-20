# 0 · Inventario de atajos single-tenant

Antes de escribir una línea, encuentra cada lugar donde el código asume "hay una
sola organización". En un producto que nació single-tenant casi siempre están
**localizados** en pocos patrones; encontrarlos todos es lo que abarata el resto.

## Qué buscar

| Patrón | Por qué es un cruce de datos | Cómo buscarlo |
|---|---|---|
| `select … from organization limit 1` / `findFirst()` sobre organización | "la única org" = la de otro cuando hay dos | `grep -rnE "from\(.*organization.*\)\s*\.limit\(1\)|organization.*findFirst" src` |
| "Primera membresía del usuario" (`members[0]`, `activeOrganizationId` sin validar contra el Host) | Un usuario con dos organizaciones entra a la equivocada | `grep -rnE "members?\[0\]|activeOrganization" src` |
| Variables de entorno con un solo valor por instancia: token de Meta, token de IA, verify token del webhook, slug, número | Todas las organizaciones compartirían credencial o puerta | Revisa `.env.example` línea por línea |
| Un solo webhook para toda la instancia que reparte por `phone_number_id` del cuerpo | Cualquiera que conozca la URL mete eventos en la bandeja de otro | `grep -rn "api/webhooks" src/app` |
| Caches de proceso sin clave de organización (`let cached = …`) | Recuerdan la organización de la petición anterior | `grep -rnE "^let |^const .*= new Map" src/server src/lib` |
| Tareas de fondo que recorren "las conversaciones" sin filtrar | Mezclan organizaciones en un mismo lote | Busca crons, workers, `setInterval` |
| Tablas sin `organization_id` o con índices únicos globales (`UNIQUE(email)`, `UNIQUE(wa_identity)`) | Dos negocios comparten la fila de la misma persona | Revisa el esquema tabla por tabla |
| Marca, favicon y login que leen la configuración "de la instancia" | La pantalla de login de A muestra el logo de B | Busca dónde se carga el branding |
| Endpoints de auth genéricos (crear organización, invitar) habilitados por defecto | Alta por la puerta de atrás | Revisa los plugins del auth |

## Entregable

Una tabla en `specs/<feature>/research.md` (o en el spec) con: archivo:línea,
patrón, reemplazo previsto y paso de esta skill que lo cubre. Esa tabla es tu
lista de tareas y, al final, tu lista de verificación: cada fila debe tener un
caso en el guion de aislamiento o un test.

## Consejo

Conserva el comportamiento de una sola organización detrás de una bandera
(`EDITION=estandar|cloud` o similar) en vez de borrarlo. Así el mismo código
sigue sirviendo a quien instala para un solo negocio, y si partes de un fork
puedes seguir mezclando las correcciones de upstream sin reescribirlas.
