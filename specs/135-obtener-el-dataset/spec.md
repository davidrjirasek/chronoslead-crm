# 135 · Obtener el conjunto de datos solo

**Carril: ligero.** No toca el modelo de datos —la columna del dataset ya
existe desde 016— ni ningún contrato publicado. Agrega una acción en Ajustes.

## El problema

Para encender la atribución hay que pegar a mano el **ID del conjunto de datos
de Meta** en Ajustes → Anuncios. Nadie sabe de dónde sacarlo:

- El Administrador de eventos muestra píxeles web, no el de mensajería
- El conjunto de WhatsApp **puede no existir todavía**: hay que crearlo
- Se crea con `POST {waba_id}/dataset`, que no tiene pantalla en Meta

Medido el 29-oct con el dueño: buscándolo en su propia cuenta de Meta no
apareció, y el conector de anuncios solo devolvió dos píxeles web de otros
proyectos. **El dato que el formulario pide no se puede conseguir por la
interfaz de Meta.**

Y se repite por cliente: cada negocio tiene su cuenta de WhatsApp y su
conjunto propio.

## Qué se ve

En **Ajustes → Anuncios**, junto al campo del dataset, un botón:

```
Obtener el mío
```

Al apretarlo, el CRM usa el token de WhatsApp **que ese negocio ya conectó** y
rellena el campo solo.

### Criterios de aceptación

1. Con WhatsApp conectado, el botón rellena el campo con un id válido
2. Es **idempotente**: apretarlo dos veces da el mismo id, no crea dos
3. **Sin WhatsApp conectado**, el botón explica que primero hay que conectarlo
   — no falla con un error técnico
4. Si el token no tiene permiso, **lo dice con claridad** y el campo manual
   sigue sirviendo. No se pierde nada
5. El token **nunca** sale del servidor ni aparece en la respuesta

## Por qué el CRM puede hacerlo y una persona no

La spec 016 ya lo supone:

> *El dataset de `business_messaging` es el de la propia cuenta de WhatsApp del
> negocio (en la práctica, `POST {waba_id}/dataset` devuelve ese mismo id), y
> el token del negocio ya conectado tiene permiso para publicar en él.*

El CRM tiene las dos piezas —`waba_id` y token, guardados al conectar
WhatsApp— y Meta no expone pantalla para esto. Es exactamente el caso donde
automatizar no es comodidad: es la única vía practicable.

## Qué NO hace

- **No es Embedded Signup.** No abre ninguna ventana de Meta, no conecta
  cuentas de nadie y **no necesita el estatus de Tech Provider**. Es una
  llamada a la Graph API con un token que ya está guardado
- **No quita el campo manual.** Si el permiso no alcanza, o el negocio prefiere
  usar otro conjunto, se sigue pudiendo pegar a mano
- **No guarda nada solo.** Rellena el campo; guardar lo decide la persona

## El riesgo, dicho

La spec 016 asume permiso para **publicar** en el dataset. **Crearlo puede
pedir otro permiso** (`whatsapp_business_management`). Si el token no lo
tiene, la llamada falla — y por eso el criterio 4 existe: el botón lo dice y
el camino manual queda intacto.
