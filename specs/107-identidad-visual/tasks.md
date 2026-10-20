# 107 — Tareas

## Inventario (el paso 0 que faltó)

Lo que YA existía en el repo anterior y se porta, en vez de escribirse:

| Qué | De dónde | Estado |
|---|---|---|
| Isotipo | `public/isotipo.png` | portado |
| Fondos de marca y foto del login | `public/brand/{bg-light,bg-dark,login-hero}.png` | portados |
| Imágenes de la landing (9) | `public/landing/` | portadas |
| Cabecera legal | `public/legal/header-legal.png` | portada |
| Landing comercial (1115 líneas) | `src/app/(public)/page.tsx` | portada |
| Tres páginas legales | `src/app/(public)/{privacidad,condiciones-servicio,eliminacion-datos}` | portadas |
| Formulario de leads | `src/app/(public)/lead-form.tsx` | portado; `actions.ts` reescrito contra el modelo de Vocero |
| Maquetación legal y pie | `src/components/legal/` | portados |
| Pantalla de login a dos columnas | `src/app/app/login/page.tsx` | portada como `EscenografiaChronosLead` |
| Pantallas del CRM | `src/app/app/(tenant)/*` | **NO se portan**: Vocero tiene las originales |
| Padrón de organizaciones | `src/app/app/(platform)/organizations/` | **para la spec 108**, como referencia de qué columnas mostrar |

## Hecho

- [x] `DEFAULT_BRANDING` → ChronosLead, `#ff6a00`; preset «Naranja ChronosLead» en el
      selector de Ajustes → Marca.
- [x] `resolveAccentSet` — respaldo robusto: con un acento por defecto sin preset, un hex
      inválido reventaba en vez de degradar.
- [x] `globals.css` — los bloques de acento de ambos temas con la escala del naranja.
- [x] Montserrat vía `next/font` (sans y serif), self-hosted.
- [x] `ChronosLeadMark` — el isotipo **original**, no un redibujo.
- [x] `EscenografiaChronosLead` — el login a dos columnas portado.
- [x] `(auth)/layout.tsx` — la plataforma ve esa escenografía; una organización
      white-label conserva la neutra de Vocero.
- [x] Login en plataforma: «Ingresá a tu CRM», sin registro abierto, con a quién escribir
      si se olvidó la contraseña.
- [x] `src/app/page.tsx` — la raíz decide por **Host**: apex → landing, slug → CRM, resto
      → «esta instancia no existe».
- [x] `(public)/actions.ts` — el lead entra por `getOrCreateContactByIdentity` +
      `createLeadForContact`, y la ficha por `upsertFicha`.
- [x] `src/server/tenant/current.ts` — columnas perezosas (evaluarlas al importar rompía
      `onboarding-page.test.ts`).
- [x] Tests de upstream actualizados: la marca por defecto cambió a propósito, y la del
      azul Vocero se pasa ahora explícita.

## Verificación

| Comprobación | Resultado |
|---|---|
| Login de la plataforma | isotipo real, «Chronos**Lead**», Montserrat, botón naranja — **confirmado por el dueño en su navegador** |
| Landing en el apex | 200, 287 KB con sus imágenes |
| `/privacidad`, `/condiciones-servicio`, `/eliminacion-datos` | 200 las tres |
| CRM en el subdominio | 200 |
| Contraste del naranja en ambos temas | 20/20 |
| Gates | typecheck ✓ · lint ✓ · **1214 tests** ✓ · build ✓ |

## Tres fallos encontrados por las pruebas, no por mí

1. **El guardarraíl de la ficha.** Mi `actions.ts` escribía `contact.ficha` con un UPDATE
   propio. Un test de upstream escanea `src/` para que solo `upsertFicha` lo haga —esa
   puerta filtra por organización ella misma— y lo cazó.
2. **El respaldo del acento.** Al cambiar el default a un hex sin preset,
   `ACCENT_PRESETS[DEFAULT_BRANDING.accent]!.set` pasó a ser `undefined` y un color
   inválido tumbaba la marca entera en vez de degradar.
3. **Columnas evaluadas al importar.** `onboarding-page.test.ts` reventaba antes de correr
   un solo test.

## Pendiente de verificación humana

- **375 px sin scroll horizontal** en bandeja, pipeline, agenda, contactos y resultados.
  El navegador integrado bloquea los archivos estáticos de la app
  (`ERR_BLOCKED_BY_CLIENT`), así que no puedo juzgar el diseño con él: lo que muestra es la
  página sin CSS. Lo mira el dueño en su navegador.
- **El favicon con el isotipo exacto**: hoy la pestaña muestra la «C» sobre naranja.
