# 127 · Tareas

- [x] **T1 · Host.** `kind: "onboarding"` en `resolveTenantFromHost`, antes del
      filtro de reservados. Actualizar el test de 127 (hoy espera
      `desconocido`, debe esperar `onboarding`) y mantener el que comprueba que
      `alta` sigue siendo `alta`
- [x] **T2 · Esquema.** Tabla `onboarding_respuesta` en `schema.ts` + migración
      generada (`db:generate`). Sin `organization_id`, con comentario del por qué
- [x] **T3 · Contenido.** `secciones.ts` con las diez secciones, sus preguntas
      tipadas y sus minutos por peso. Suma total ≈ 20
- [x] **T4 · Guardado.** Acción de servidor: crea la llave en el primer guardado,
      upsert por sección, límite de uso, Zod en la entrada
- [x] **T5 · Pantalla.** Formulario por pasos con identidad ChronosLead:
      progreso visible desde la primera pantalla, minutos restantes, volver y
      avanzar, y el enlace para continuar siempre a la vista
- [x] **T6 · Lectura.** Guion que imprime las respuestas de un cliente
- [x] **T7 · Pruebas.** Unitarias de los minutos y del upsert; y el recorrido
      real: abrir sin llave, completar una sección, cerrar, volver por la URL y
      encontrar lo escrito
- [x] **T8 · Gate.** Tipos, lint, tests, build, y el guion de aislamiento verde
- [ ] **T9 · Bitácora + manual.** Qué quedó, cómo se probó, qué sigue; y el
      enlace entra en el manual de alta como paso previo

## Los tres fallos que solo aparecieron al usarlo

Ninguno lo atrapó el `typecheck`, el `lint` ni los tests. Los tres salieron
abriendo el formulario en un navegador de verdad y completándolo.

| Qué se veía | Qué era |
|---|---|
| Pantalla en blanco: «Application error: a client-side exception» | Un archivo `"use server"` **solo puede exportar funciones asíncronas**. Se exportaba también `ESTADO_INICIAL` y se importaba desde el componente. Compila sin una queja y revienta en el navegador, sin rastro en el registro del servidor. Arreglo: la constante vive en `server/cuestionario/estado.ts` |
| Al primer guardado saltaba de la sección 1 a la **3** | El efecto que avanza dependía de `llave`; al llegar la llave nueva el efecto corría otra vez con el mismo `estado.ok` y avanzaba dos veces. El servidor guardaba bien: era solo la pantalla, lo que lo hacía más difícil de ver. Arreglo: un centinela con `useRef` |
| Hidratación fallida en toda la página | El enlace para continuar se armaba con `window.location.origin` **durante el render**: el servidor dibujaba sin ese párrafo y el navegador con él. Arreglo: el origen se lee en un efecto, después de montar |

**Lo que esto dice del método:** el gate del repo es necesario y no alcanza.
Las tres fallas estaban en la frontera servidor/navegador, que es justo donde
los tipos no miran.

**Sin cubrir por una prueba automática:** el salto doble de sección. Es
comportamiento de un componente de React y el repo no tiene arnés para eso.
Queda anotado acá; si vuelve a pasar, el primer sospechoso son las
dependencias de ese efecto.
