# 106 — Enlace de primer acceso y recuperación de contraseña

**Feature Branch**: `feat/106-enlace-de-primer-acceso`

**Created**: 2026-10-20

**Status**: Especificada antes de escribir código. Depende de la
[104](../104-capa-de-plataforma/spec.md).

**Input**: decisión del operador del 2026-10-20, al preguntar cómo entregarle el
acceso a un cliente nuevo «para que la experiencia sea pro», y pedir el
protocolo completo: dónde guardar la contraseña y qué hacer si se pierde.

**Carril**: ciclo completo. Toca el modelo de datos (tabla nueva, con migración)
y añade dos superficies públicas.

## Problema

La 104 dejó la entrega del acceso a medias a propósito: el alta escribe la
contraseña en un archivo y el operador se la pasa al cliente. Eso tiene tres
defectos, y ninguno es teórico:

1. **La contraseña queda para siempre** en el historial de WhatsApp o del correo
   del cliente. Quien le mire el teléfono la tiene.
2. **El operador la conoce.** Si mañana hay una disputa sobre quién hizo qué
   dentro de un CRM, eso importa.
3. **No hay recuperación.** Vocero nunca tuvo «olvidé mi contraseña»
   (`scripts/reset-password.mjs` lo dice: la única salida es reescribir el hash
   en la base). Un cliente que la pierde depende de que el operador entre a la
   base de datos.

## Decisiones

### Un enlace de un solo uso, no una contraseña

El alta genera `https://{slug}.chronoslead.com/activar/{token}`. El cliente lo
abre, **elige su propia contraseña** y entra. Nadie más la conoce nunca.

El operador manda un enlace por donde quiera —WhatsApp, correo, un papel—, y eso
sigue siendo aceptable aunque el canal no sea seguro: el enlace **caduca a los 7
días y muere al usarse**. Un enlace viejo en un chat antiguo no vale para nada.

### El mismo mecanismo resuelve la recuperación

Un token con `motivo: "recuperacion"` hace exactamente lo mismo. Una sola pieza
cubre el alta y el «olvidé mi contraseña», y cubre el hueco heredado de Vocero
sin añadir ninguna dependencia externa — que es justamente por lo que la
constitución descartó el correo transaccional.

### En la base se guarda el hash, no el token

Quien lea la base no puede usar los enlaces. Se busca por el hash, que va
indexado.

### Un enlace vivo por persona y motivo

Generar uno nuevo invalida el anterior. Si no, un enlace que el operador creyó
reemplazado sigue abriendo la cuenta.

### Al fijar la contraseña se cierran las sesiones abiertas

Si alguien había entrado con la contraseña vieja, deja de estar dentro. Es lo
que hace que la recuperación sirva de verdad cuando se sospecha de un acceso
ajeno.

### El protocolo que ve el cliente

No basta con que funcione: el cliente final no es técnico.

- En la pantalla de elegir contraseña, **recomendar un gestor de contraseñas y
  explicar en una frase qué es** — no dar por sabido el término.
- Decirle que ChronosLead **nunca le va a pedir su contraseña** por WhatsApp ni
  por correo. Es la defensa barata contra que alguien se haga pasar por soporte.
- En la pantalla de entrada, un «¿olvidaste tu contraseña?» que **diga a quién
  escribir**, en vez de una puerta muerta.

### El alta deja de imprimir contraseñas

`pnpm provision` escribe el enlace, no una contraseña. Y `pnpm acceso` genera el
de recuperación para un correo que ya existe.

## Comportamiento esperado

| Situación | Resultado |
|---|---|
| Enlace válido | pantalla para elegir contraseña |
| Contraseña elegida | entra, con sesión iniciada, a la guía de inicio |
| El mismo enlace otra vez | «este enlace ya se usó» |
| Enlace caducado (> 7 días) | «este enlace caducó», con a quién pedir otro |
| Enlace inventado o manipulado | la misma pantalla que uno caducado — no se distingue |
| Enlace de una organización, abierto en el subdominio de otra | no vale |
| Contraseña de menos de 8 caracteres | se rechaza, con el motivo |
| Se genera un enlace nuevo | el anterior deja de valer |
| Al fijar la contraseña | las sesiones abiertas de esa persona se cierran |
| Organización suspendida | el enlace no vale: no hay a qué entrar |

## Criterios de aceptación

1. Con `EDITION` apagada, nada de esto se activa y los 1205 tests siguen verdes.
2. Un alta nueva entrega un enlace; el cliente lo abre, elige contraseña y entra
   a la guía de inicio sin que nadie haya visto su contraseña.
3. El mismo enlace, usado dos veces, falla la segunda.
4. Un enlace caducado falla, y un enlace inventado da **la misma** respuesta: no
   se puede distinguir cuál existe.
5. Generar un enlace nuevo invalida el anterior.
6. Al fijar la contraseña, una sesión que estaba abierta con la anterior deja de
   funcionar.
7. `pnpm acceso` genera el enlace de recuperación de un correo existente.
8. La pantalla de entrada explica a quién escribir si se olvidó la contraseña.
9. El guion de aislamiento sigue en 34/34, y gana una comprobación: el enlace de
   A no vale en el subdominio de B.

## Fuera de alcance

- **Envío automático** del enlace por correo o WhatsApp: sigue necesitando un
  canal que no existe. El operador lo manda.
- **Segundo factor**: no lo pide ningún cliente todavía.
- **Caducidad configurable**: 7 días fijos. Cuando alguien necesite otra cosa,
  se hace variable.
