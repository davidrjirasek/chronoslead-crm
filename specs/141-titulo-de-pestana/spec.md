# 141 — El título de la pestaña nombra al cliente

**Feature Branch**: `main` (cambio chico, sin rama propia)

**Created**: 2026-11-08

**Status**: Implementada y verificada en vivo.

**Input**: pedido del dueño el 8-nov-2026, trabajando con Creativo 4D, Castell
Muebles y ZA Climatización abiertos a la vez.

## Problema

Las tres pestañas decían lo mismo: **«ChronosLead — CRM multicanal»**.

El título salía de `${branding.name} — ${producto}`, y `branding.name` es la
marca de la organización — que solo cambia si el cliente la personaliza en
Ajustes → Marca. Ninguno lo hizo, así que todas caen en el valor por defecto.

No es un defecto de la marca: **el producto se llama igual para todos a
propósito**. Lo que faltaba era el nombre de la organización, que existe y
nunca se usaba ahí.

## Decisión · el cliente va PRIMERO

```
Castell Muebles · ChronosLead
```

y no «ChronosLead · Castell Muebles», que era la forma en que el dueño lo
planteó. **El navegador recorta la pestaña por la derecha.** Con la marca
adelante, tres pestañas abiertas se leen «ChronosLe…», «ChronosLe…»,
«ChronosLe…» y el problema queda exactamente igual que antes.

Lo que distingue tiene que entrar en los primeros caracteres. Con el cliente
adelante se lee «Castell…», «ZA Clim…», «Creativo…».

### Cada puerta dice lo suyo

El dueño lo extendió el mismo día: si la pestaña puede decir dónde estás
parado, que lo diga en **todas** las superficies, no solo en las de clientes.

| Dirección | Título |
|---|---|
| `{cliente}.chronoslead.com` | `Castell Muebles · ChronosLead` |
| `chronoslead.com` (el apex) | `ChronosLead, tu CRM a tiempo y a medida` |
| `admin.chronoslead.com` | `Panel de control · ChronosLead` |
| `cuentas.chronoslead.com` | `Cuentas · ChronosLead` |
| `alta.chronoslead.com` | `Alta · ChronosLead` |
| `onboarding.chronoslead.com` | `Cuestionario · ChronosLead` |
| Una dirección de nadie | `ChronosLead — CRM multicanal` |

**La landing es la única excepción al orden.** En las demás lo que distingue va
primero porque la pestaña se recorta; en la landing lo que distingue **es la
marca**, y además ese título es el que sale en Google y en la vista previa al
compartir el enlace. Ahí el lema vale más que la brevedad.

Una dirección que no es de nadie conserva el título genérico: no hay nada que
nombrar, y poner algo sería peor que no poner nada.

### Si el cliente personalizó su marca, se respeta

`tituloDePestana` combina el nombre de la organización con la marca vigente, no
con una constante. Un cliente con marca propia ve
`Castell Muebles · Castell CRM`.

## Por qué la regla es una función pura

`tituloDePestana` vive en `src/lib/branding.ts` y no dentro de
`generateMetadata`. Así la regla —y sobre todo **el porqué del orden**— se
puede probar y leer sin levantar la aplicación. Una regla de presentación
escondida en un layout es una regla que el próximo la cambia sin saber qué
rompía.

## Verificación

Ocho casos en `tests/unit/titulo-de-pestana.test.ts`, incluidos que dos
clientes distintos difieran **desde el primer carácter** y que **las siete
superficies den títulos distintos entre sí** — si dos coincidieran, volvería el
problema que esto vino a resolver.

En vivo, contra la aplicación:

```
e2ealfa.lvh.me        E2E Alfa · ChronosLead
lvh.me                ChronosLead, tu CRM a tiempo y a medida
admin.lvh.me          Panel de control · ChronosLead
cuentas.lvh.me        Cuentas · ChronosLead
alta.lvh.me           Alta · ChronosLead
onboarding.lvh.me     Cuestionario · ChronosLead
noexiste999.lvh.me    ChronosLead — CRM de WhatsApp
```

Y en el guion de aislamiento, porque el título sale de la resolución por Host:
un fallo ahí pondría el nombre de un cliente en la pestaña de otro. Cosmético,
pero es una filtración de nombre de cliente que se ve en la barra del
navegador.
