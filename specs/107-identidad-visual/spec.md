# 107 — La identidad visual de ChronosLead

**Feature Branch**: `feat/107-identidad-visual`

**Created**: 2026-10-20

**Status**: Especificada antes de escribir código.

**Input**: fase 4 del plan. Fuente de verdad del diseño:
`docs/brand/sistema-visual.md` del repo anterior —y, sobre todo, **lo que ya
estaba construido ahí**, que es lo que de verdad manda (ver «El error de
método»).

**Carril**: ciclo completo. No toca el modelo de datos. Cambia la marca por
defecto, la tipografía y el acento de toda la aplicación, y trae cuatro
superficies públicas del repo anterior.

## El error de método, escrito aquí para que no se repita

Esta spec empezó mal. Leí `sistema-visual.md` —que **describe** la marca:
paleta, tipografía, concepto— y me puse a **redibujar el isotipo en SVG** y a
**rehacer el login**. Las dos cosas ya existían, terminadas, en el repo
anterior: `public/isotipo.png`, `public/brand/login-hero.png`,
`src/app/app/login/page.tsx`.

El dueño lo vio antes que yo: *«¿para qué te complicás redibujando? Si en
ChronosLead ya le puse perfil, cabecero, logo, interfaz, landing…»*. Y después:
*«¿podrías razonar eso sin que te lo diga?»*.

Es **el mismo error que este fork entero está corrigiendo**, en miniatura:
reconstruir en vez de reutilizar. La causa concreta: leí «fuente de verdad:
sistema-visual.md» como *«estas son las instrucciones»* en vez de *«estas son
las especificaciones, ahora buscá la implementación»*. Un documento que describe
una marca no es la marca ya hecha.

**Regla que queda:** toda fase empieza con un inventario de lo que ya existe
—`find` y `ls` sobre el repo anterior y sobre upstream— antes de escribir nada.
Lo que exista se porta; solo se escribe de cero lo que no aparezca.

## Decisiones

### El acento es un token, no un color pintado a mano

Vocero deriva toda su escala —hover, soft, tint, texto, tinta del botón, tema
oscuro, barra lateral— de **un solo hex**. Cambiar `DEFAULT_BRANDING.accent` a
`#ff6a00` repinta la aplicación entera sin tocar un componente. Es lo que
garantiza que el próximo merge de upstream no rompa el diseño: no hay nada que
pueda entrar en conflicto porque no hay nada pintado.

### El naranja puro no se usa tal cual sobre blanco

`#ff6a00` como relleno con texto encima no pasa AA. La escala lo oscurece a
`#e05d00` en tema claro y lo deja puro en oscuro, donde ya contrasta. No es una
licencia: es el mismo mecanismo que Vocero aplica a cualquier acento
white-label, y sus 20 pruebas de contraste lo verifican.

### Montserrat hace también de serif

El sistema visual no declara tipografía secundaria. Poner una que nadie eligió
sería inventarse la mitad del sistema, así que la familia serif del tema apunta
a Montserrat en pesos medios.

### El logo es el archivo, no un dibujo del código

`public/isotipo.png`, el original. Un logo redibujado deja de ser el logo.

### La landing va por HOST, no por ruta

`chronoslead.com` es la landing; `{slug}.chronoslead.com` es el CRM. El repo
anterior los separaba por ruta (`/` y `/app/*`), lo que obliga a que cada enlace
sepa en cuál de los dos mundos está. Con el Host, la raíz decide una vez.

### Las rutas legales no se tocan

`/privacidad`, `/condiciones-servicio` y `/eliminacion-datos`, idénticas. La app
de Meta, la Business Verification y el App Review apuntan a esas URLs: cambiarlas
rompe el trámite de Tech Provider.

### El formulario de la landing entra por la puerta del CRM

Contacto + lead en la primera etapa, con `getOrCreateContactByIdentity` y
`createLeadForContact` — las mismas funciones que usa un WhatsApp entrante. La
ficha va por `upsertFicha`, no con un UPDATE propio: un guardarraíl de upstream
escanea `src/` para que nadie esquive esa puerta, y cazó la primera versión de
este archivo.

### Una organización white-label NO ve la marca de la plataforma

Si el cliente pone su propio nombre, su login vuelve a la escenografía sobria de
Vocero y su pestaña muestra su inicial. No tiene por qué ver el logo de
ChronosLead al entrar a su propio CRM.

## Criterios de aceptación

1. Con `EDITION` apagada, el CRM se comporta como upstream.
2. El login de una organización sin marca propia muestra el isotipo real, el
   wordmark «Chronos**Lead**», Montserrat y el botón naranja.
3. Una organización con marca propia conserva la escenografía neutra.
4. `chronoslead.com` (apex) sirve la landing; `{slug}` sirve el CRM; un
   subdominio de nadie dice «esta instancia no existe».
5. Las tres rutas legales responden 200 en el apex.
6. El formulario de la landing crea contacto y lead en el pipeline de la
   organización de la plataforma.
7. Las 20 pruebas de contraste pasan con el naranja, en ambos temas.
8. El guion de aislamiento sigue verde.

## Fuera de alcance

- **La landing aspiracional** de 7 secciones que describe `sistema-visual.md`.
  Se porta la que existe, que es la que está escrita y probada.
- **El favicon con el isotipo exacto**: el icono generado es un SVG y el isotipo
  es un PNG de 188 KB. Hoy la pestaña muestra la «C» sobre naranja, que es el
  isotipo reducido a su lectura mínima. Meter el PNG pide generar una versión
  pequeña, y es una decisión del dueño si vale la pena.
- Las pantallas del CRM del repo anterior (bandeja, pipeline, agenda…): son las
  43 000 líneas reconstruidas imitando capturas de Vocero. Vocero tiene las
  originales. **No se portan**: es justo el error que este fork corrige.
