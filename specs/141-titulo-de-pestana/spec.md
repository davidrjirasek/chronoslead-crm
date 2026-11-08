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

### Dónde NO se toca

El apex (`chronoslead.com`), el panel de superadmin y cualquier dirección que
no sea de una organización conservan `ChronosLead — CRM multicanal`: ahí no hay
cliente que nombrar, y poner uno sería peor que no poner ninguno.

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

Cinco casos en `tests/unit/titulo-de-pestana.test.ts`, incluido que dos
clientes distintos difieran **desde el primer carácter**.

En vivo, contra la aplicación:

```
e2ealfa.lvh.me    E2E Alfa · ChronosLead
e2ebeta.lvh.me    E2E Beta · ChronosLead
lvh.me            ChronosLead — CRM de WhatsApp
admin.lvh.me      ChronosLead — CRM de WhatsApp
```

Y en el guion de aislamiento, porque el título sale de la resolución por Host:
un fallo ahí pondría el nombre de un cliente en la pestaña de otro. Cosmético,
pero es una filtración de nombre de cliente que se ve en la barra del
navegador.
