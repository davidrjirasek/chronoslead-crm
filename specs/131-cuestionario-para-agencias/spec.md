# 131 · El cuestionario para agencias

**Carril: solo datos** — no hay migración ni cambio de interfaz. Es una variante
más en `src/server/cuestionario/secciones.ts`.

## El problema

La general supone **un negocio que quiere un asesor para atender a SUS
clientes**. Una agencia pide otra cosa, y no es un asunto de vocabulario:
quiere recuperar las horas que se le van en lo operativo, dejar de hacer a mano
lo que podría hacerse solo, y mejorar lo que su cliente recibe.

Mandarle la general a una agencia le pregunta «¿a qué precio vendés?» y «¿cómo
te paga un cliente?», y **no le pregunta nada de lo que vino a buscar**.

## Qué se ve

```
onboarding.chronoslead.com/?v=agencia
```

Diez secciones, veinte minutos, como las otras dos.

### Las tres desviaciones, y por qué

1. **La sección 5 pregunta por HORAS antes que por consultas.** El inventario de
   tareas repetitivas con sus horas por semana es, además del insumo del agente,
   **la línea de base para medir el retorno**. Sin el número de partida no hay
   con qué comparar a los tres meses, y es un dato que solo existe el día que
   alguien lo escribe.
2. **La sección 6 pregunta en nombre de quién habla el agente.** En una agencia
   eso no es estilo: decide si atiende a los clientes de la agencia o a los
   clientes DE sus clientes. Son dos productos, y uno de ellos es el camino por
   el que una agencia revende esto con su marca.
3. **La 9 y la 10 NO piden datos de alta.** Las otras dos variantes son el paso
   0 del alta y por eso piden el correo del propietario y el número a conectar.
   Una agencia suele llenar esto **antes de decidir si contrata**, y pedirle el
   dueño de la cuenta ahí le presupone la venta. Los datos del alta se piden
   cuando hay alta: son los doce pasos de `docs/alta-de-cliente.md`.

### Criterios de aceptación

1. `?v=agencia` sirve las diez secciones de agencia; sin `?v=`, la general
2. Las variantes `general` y `the-student-store` quedan **sin tocar** — el
   cambio es puramente aditivo
3. Los invariantes de `tests/unit/cuestionario.test.ts` corren sobre ella:
   diez secciones, ids únicos, sección 5 la más pesada, veinte minutos
4. **No nombra a ningún cliente ni prospecto.** Es una variante por RUBRO

## Por rubro, y no por cliente

130 dejó dicho que lo propio de cada negocio se pregunta mejor en la reunión de
diagnóstico, y que no habría bloques por cliente todavía. Esto no lo contradice:
**una agencia no es un cliente, es un rubro**, y la variante sirve a cualquiera
que entre.

La distinción tiene una consecuencia práctica y es la razón de ser del criterio
4: **este repositorio es público.** Una variante llamada con el nombre de un
cliente —y peor, de un prospecto— publica quién está hablando con nosotros y qué
pidió en una reunión privada. Se intentó y se revirtió el 3-nov-2026. Si alguna
vez hace falta una variante propia de un cliente, el nombre no va en el código.

## Qué NO hace

- **No pide datos de alta** (arriba, desviación 3). Si una agencia contrata, el
  alta sigue siendo los doce pasos del manual
- **No crea nada.** Como las otras dos: recoge respuestas (spec 127)
- **No hay enlace propio ni subdominio.** El operador arma el enlace con `?v=`
