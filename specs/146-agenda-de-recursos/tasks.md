# 146 · Tareas

Estado durable. Marcar al cerrar cada una.

## Datos
- [x] T01 · `agenda_resource` en `schema.ts` (+ `avisos` jsonb, `criterio`)
- [x] T02 · `booking.resource_id` + índice `booking_org_resource_when_idx`
- [x] T03 · El único anti doble-booking pasa a `coalesce(resource_id,'')`
- [x] T04 · `organization.agenda_resources` boolean default false
- [x] T05 · `db:generate` → migración aditiva, revisada a mano

## Motor
- [x] T06 · `recursos.ts`: leer recursos activos, resolver nombre → id
- [x] T07 · `availability.ts`: huecos por recurso (sin tocar el motor puro)
- [x] T08 · `service.ts`: reservar con recurso + advisory lock por recurso
- [x] T09 · `offered_slot.resource_id`: la oferta recuerda de quién era

## Agente
- [x] T10 · `actions.ts`: `resource` opcional en offer/book
- [x] T11 · `prompts.ts`: listar recursos con criterio, solo si están encendidos
- [x] T12 · `agenda/agent.ts`: pasar el recurso, degradar si no resuelve

## Avisos
- [x] T13 · `destinatariosDelAviso()`: org + recurso, deduplicado
- [x] T14 · `avisarDeCita()` itera destinatarios
- [x] T15 · `recordatorio-de-cita.ts` itera destinatarios

## Pantallas
- [x] T16 · Ajustes → Agenda: sección Recursos (solo si encendido)
- [x] T17 · Citas: color por recurso + filtro
- [x] T18 · Superadmin: el interruptor por cliente

## Verificación
- [x] T19 · Unitarios: AC-7, AC-8, dedupe de avisos, resolución por nombre
- [x] T20 · Gate de aislamiento extendido: AC-4 (org sin interruptor intacta)
- [x] T21 · E2E en vivo: AC-1, AC-2, AC-3
- [x] T22a · Ensayo del camino del agente (`test:ensayo:recursos`): la oferta
  recuerda el recurso y reservar respeta la promesa — 12/12 en vivo
- [x] T22b · Pantallas en navegador (`test:e2e:recursos:ui`) — 15/15, encendida
  y apagada
- [ ] T22c · **AC-5 y AC-6 en vivo sobre Cerritos.** Bloqueado: su WhatsApp
  todavía no está conectado (va último, con la campaña corriendo). Lo que
  falta es el ruteo por criterio decidido por el modelo real y los tres avisos
  saliendo a los teléfonos reales
