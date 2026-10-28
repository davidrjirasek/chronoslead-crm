# 127 · Formulario de onboarding

**Carril: ciclo completo** — toca el modelo de datos (migración nueva).
Declarado antes de escribir código.

## El problema

El cuestionario de puesta en marcha es un PDF de nueve páginas. Se manda por
correo y vuelve contestado a mano, incompleto, o no vuelve. Son ~20 minutos de
preguntas y el cliente no sabe cuánto le falta, así que abandona a la mitad y
nadie se entera de en qué pregunta se cansó.

Y hay tres clientes por dar de alta esta semana.

## Qué se ve, desde afuera

`onboarding.chronoslead.com` sirve un formulario público, sin sesión, con la
identidad visual de ChronosLead.

| | |
|---|---|
| **Quién entra** | Cualquiera con el enlace. No hay cuenta, no hay contraseña |
| **Qué ve** | Una sección por pantalla, de diez. Nunca las diez juntas |
| **Qué sabe siempre** | En qué sección está, cuántas faltan y cuántos minutos quedan |
| **Si se corta** | Vuelve al mismo enlace y sigue donde estaba, incluso desde otro día o cerrando el navegador |
| **Primer campo** | De qué cliente es. El mismo formulario sirve para todos |

### Criterios de aceptación

1. `onboarding.chronoslead.com` responde el formulario **sin sesión**, y
   `{cualquier-otro}.chronoslead.com` sigue respondiendo lo que respondía
2. La primera pantalla dice el total de secciones y el tiempo estimado **antes**
   de que el cliente escriba nada
3. Completar una sección y cerrar el navegador: al volver al enlace, lo escrito
   está ahí y arranca en la sección donde quedó
4. Dos clientes distintos completando a la vez no se ven entre sí
5. Enviar sin completar un campo obligatorio no pierde lo demás escrito
6. El operador puede leer las respuestas completas de un cliente
7. El guion de aislamiento sigue verde: esta función no lo toca, y hay que
   demostrarlo, no suponerlo

## Qué NO hace, y por qué

- **No crea organizaciones.** La constitución (Principio VIII) prohíbe el
  registro público y el autoservicio: las organizaciones las crea solo el
  operador o el script de aprovisionamiento. Este formulario recoge respuestas
  y nada más; el alta sigue siendo los doce pasos de
  [docs/alta-de-cliente.md](../../docs/alta-de-cliente.md). **Si alguna vez
  este formulario termina creando la cuenta, eso es una enmienda a la
  constitución, no una mejora.**
- **No manda correos.** Coolify no tiene SMTP y el recupero por correo no
  existe en ningún sistema nuestro todavía. Volver al formulario no puede
  depender del correo: depende del enlace.
- **No pide cuenta ni contraseña.** Un cliente que todavía no es cliente no
  debería tener que registrarse para contarnos cómo trabaja.
- **No valida casi nada.** Son preguntas abiertas sobre su negocio. Un
  formulario que discute con quien lo está llenando gratis es un formulario que
  se abandona. «No aplica» es una respuesta válida y así se lo dice.

## Constitution Check

| Principio | Cómo queda |
|---|---|
| **III · Multi-tenancy** | La tabla **no lleva `organization_id`, y es deliberado**: el registro existe ANTES de que exista la organización. No es tabla de dominio sino de la **capa de plataforma** (Principio VIII, alcance nuclear), igual que `organization` misma. Por eso tampoco pasa por `scoped()`: no hay tenant que exigir. **Declarado acá para que nadie lo lea como un olvido** y para que el guardarraíl que busque `organization_id` sepa por qué esta no lo tiene |
| **I · Seguridad** | No se guardan secretos. Lo que entra son respuestas de negocio: horarios, precios, cómo atienden. Nada cifrable y nada que el cliente no esté mandando a propósito |
| **IV · Idempotencia** | El guardado por sección es un upsert por llave de respuesta: guardar dos veces la misma sección no duplica |
| **VIII · Capa de plataforma** | Es exactamente eso: sirve al operador para incorporar clientes, no a un cliente para operar su negocio |
| **Soberanía (II)** | Sin terceros. Ni servicio de formularios, ni correo, ni almacenamiento externo |

## Supuestos

- **El enlace ES la credencial.** Quien lo tiene puede ver y editar esas
  respuestas. Es aceptable: no hay datos personales sensibles y el enlace lo
  manda el operador al cliente por un canal privado. Lo que sí hace falta es
  que el enlace **no sea adivinable** ni enumerable, y que no exista ninguna
  pantalla que liste los formularios de otros.
- **Veinte minutos** es la estimación del dueño para las diez secciones.
  Se reparte por sección según su peso, no en partes iguales: la sección 5
  (las diez consultas más frecuentes) es la más larga y la más valiosa.
- El contenido de las diez secciones es el de
  `~/Documents/ChronosLead/onboarding-student-store.md`. Está escrito para
  The Student Store; generalizarlo para cualquier cliente es trabajo posterior
  y explícitamente **no** es parte de esto.

## Lo que esto deja preparado, sin hacerlo

El dueño pidió, para después: un cuestionario **genérico** que sirva para
cualquier cliente, donde el primer campo elija de quién es y eso arme la
planilla. Por eso el primer campo ya identifica al cliente y la tabla no está
atada a The Student Store. El contenido genérico es otra spec.
