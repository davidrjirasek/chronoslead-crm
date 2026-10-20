---
name: loop-sdd
description: >-
  Ejecuta un OBJETIVO de punta a punta en modo loop autónomo sobre el flujo
  Spec-Driven Development (spec-kit) del proyecto. Úsalo cuando el dueño dé una
  META o resultado esperado en lugar de instrucciones paso a paso ("logra que…",
  "quiero que el sistema…", "implementa la feature X y déjala funcionando"), o
  diga /loop-sdd. Recorre Discover → Plan → Execute → Verify → Iterate, se
  autocorrige con sus herramientas y vuelve SOLO con el objetivo verificado en
  vivo o con un bloqueo real. No pide permiso por cada paso reversible ni
  delega la prueba. Requiere spec-kit (skills speckit-*) instalado.
---

# Loop SDD — ejecutar objetivos, no prompts

El dueño da **objetivos**; tú corres el **loop completo** y vuelves **solo al
terminar o al bloquearte de verdad**. Es `Goal → Work → Check → Repeat` (no
`Ask → Answer → Stop`) sobre el flujo de spec-kit.

**El contrato** (Definición de Hecho, manejo de credenciales, condición de paro)
está en `references/contrato.md`. Si el `CLAUDE.md` del proyecto tiene secciones
propias de "Modo Objetivo" o "Definición de Hecho", **mandan ellas** y el
contrato de la skill es el piso.

## Requisitos

- spec-kit inicializado en el repo (`.specify/` y las skills `speckit-*`).
  Si no está: `specify init --here --integration claude` (ver el README del
  arnés o https://github.com/github/spec-kit).
- Constitución en `.specify/memory/constitution.md`: el Constitution Check se
  evalúa contra ella.

## Entrada

El argumento es el **objetivo** (qué debe lograrse / cómo debe comportarse el
producto). Sin argumento, toma el último objetivo que el dueño describió.

## El loop (no saltes Verify)

1. **Discover** — Lee el estado real antes de actuar: spec/plan/tasks de la
   feature activa, código relevante, la memoria del proyecto si existe, y logs si
   hay un bug. Declara el **carril** (completo, ligero o exento) según la
   constitución. Si hace falta spec nueva: `speckit-specify` + `speckit-clarify`.
   - **Agrupa TODAS las preguntas bloqueantes y hazlas UNA sola vez aquí.** Lo
     que se resuelva con defaults sensatos o leyendo el código, no se pregunta.

2. **Plan** — `speckit-plan` → `speckit-tasks` → `speckit-analyze`. Para
   correcciones pequeñas basta un plan ligero con el alcance explícito.

3. **Execute** — `speckit-implement` (o edición directa para fixes acotados),
   respetando stack y constitución (tipos estrictos, tenant explícito si es
   multitenant, idempotencia, secretos cifrados).

4. **Verify (OBLIGATORIO — lo hace el agente, no el dueño)**
   - Gate técnico: los comandos reales del proyecto (tipos, lint, build, tests).
   - **Self-test E2E**: corre local (o despliega) y **ejerce el flujo real** como
     usuario (navegador, API, línea de prueba del canal), de punta a punta.
   - **Camino infeliz**: input inválido, respuesta vacía, fuera de ventana,
     proveedor caído → **degrada sin colgarse**.
   - En multitenant: el **guion de aislamiento** en verde (skill
     `saas-multitenant`, referencia 09).
   - Evidencia del resultado observable (transcripción, captura, log), no solo
     un 2xx ni "compila".

5. **Iterate** — Si algo falla: diagnostica (logs, salida cruda del
   proveedor/LLM), corrige y **re-verifica tú**. Cada fix vuelve al loop, no a la
   bandeja del dueño. Sin *spin*: si un deploy tarda, avanza en otra cosa.

## Sostén del loop

- **Estado**: `tasks.md` es tu estado durable; mantenlo al día para poder
  reanudar si se corta el contexto.
- **Memoria**: persiste decisiones, gotchas y correcciones.
- **Costo**: agrupa verificaciones; no dispares deploys ni llamadas de más.

## Condición de paro

- ✅ **Objetivo cumplido**: criterios de aceptación verdes **en vivo**,
  verificados por ti, con evidencia.
- ⛔ **Bloqueo real** (única razón para interrumpir): decisión de producto
  ambigua que cambia el resultado · faltan credenciales o acceso · **acción
  irreversible o hacia afuera** (merge a `main`, borrado destructivo,
  comunicación externa, gastar dinero) · techo de costo/tiempo. Trae contexto,
  opciones y tu recomendación.

## Nunca

- Declarar "listo" sin haber ejercido el comportamiento tú mismo.
- Delegar la prueba funcional al dueño ("despliego para que TÚ pruebes").
- Pedir permiso por cada paso reversible.
