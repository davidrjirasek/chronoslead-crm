# 130 · El cuestionario, para cualquier cliente

**Carril: ciclo completo** — hay migración.

## El problema

El cuestionario de 127 se escribió para The Student Store. **18 de sus 47
preguntas** hablan de comedor, saldo, almuerzo, menú y matrícula. Para Colegio
Cerritos sirve a medias; para ZA Group no sirve.

Y hay una restricción dura: **The Student Store ya tiene su enlace y puede
estar completándolo ahora mismo.** Cambiarle las preguntas mientras escribe
sería moverle el piso.

## Qué se ve

Un solo formulario, en la misma dirección, con **variantes**:

```
onboarding.chronoslead.com                     → la general
onboarding.chronoslead.com/?v=the-student-store → la de ellos
```

La variante la elige **el operador al armar el enlace**, no el cliente.
Una lista desplegable con los clientes en un formulario público le contaría a
cualquiera quiénes son los otros clientes.

### Criterios de aceptación

1. Sin `?v=`, se sirve la general, y **no menciona el rubro de ningún cliente**
2. Un cuestionario ya empezado conserva **su** variante, venga lo que venga en
   la URL. Ni editando el enlace se le cambian las preguntas
3. Una variante inventada cae en la general, nunca en un error ni en una
   pantalla que revele qué variantes existen
4. Los dos juegos tienen diez secciones y suman 20 minutos
5. El aislamiento sigue verde

## Qué NO hace

- **No hay subdominio aparte.** La alternativa era
  `onboardinggral.chronoslead.com`: dos formularios que mantener, cada mejora
  hecha dos veces, y «gral» —una abreviatura interna— impresa en una pieza que
  ve el cliente.
- **No se tocó la variante de The Student Store.** Ni una palabra.
- **No hay bloques propios por cliente todavía.** La general cubre lo necesario
  para configurar un asesor; lo verdaderamente propio de cada negocio se
  pregunta mejor en la reunión de diagnóstico. Si hace falta, se agrega después
  sin rehacer nada.

## La decisión que protege al cliente que ya está escribiendo

La migración agrega la columna con `DEFAULT 'general'` **y a continuación pone
`'the-student-store'` en las filas que ya existían.** Sin ese `UPDATE`, el
cliente habría pasado de la sección 2 a la 3 y se habría encontrado preguntas
de otro negocio.
