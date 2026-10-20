# 108 — El panel de superadmin

**Feature Branch**: `feat/108-panel-de-superadmin`

**Created**: 2026-10-20

**Status**: Especificada antes de escribir código. Depende de la
[101](../101-resolucion-tenant-por-host/spec.md) (el Host `admin`) y de la
[104](../104-capa-de-plataforma/spec.md) (estado y aprovisionamiento).

**Input**: paso 7 de la skill `saas-multitenant`, y el inventario del repo
anterior y de upstream (ver abajo).

**Carril**: ciclo completo. No toca el modelo de datos: todo lo que el panel
muestra y cambia ya existe desde la 104.

## El inventario, primero

| Fuente | Qué aporta | Qué NO |
|---|---|---|
| **Repo anterior** (`(platform)/organizations/`) | Las columnas que acertó: cliente, identificador, estado, fecha de alta, usuarios, soporte | Es **solo de consulta**: su propio código dice que los controles de alta y suspensión quedaron fuera |
| **Upstream (Vocero)** | El aspecto y los componentes de sus pantallas de Ajustes | **No tiene superadmin.** Sus roles son `owner` y `admin` *dentro* de una organización, y sus 20 pantallas son todas del CRM de un negocio |
| **Skill `saas-multitenant`, ref. 07** | Las reglas: qué registra una concesión, y que el superadmin no lee conversaciones por defecto | No trae código: es el destilado de Vocero Cloud, que es cerrado |

Vocero no tiene esta capa **porque no es una plataforma**: con un cliente por
instancia no hay cartera que administrar. Es lo único de este fork que no puede
venir de upstream.

## Problema

Desde la 104 se puede dar de alta un cliente, moverle la fecha de pago y
suspenderlo — **por comando y por SQL**. Eso sirve para construir, no para
operar: obliga al dueño a tener una terminal abierta y a acordarse de la
sintaxis, y hace que el negocio dependa de quien sepa escribirla.

## Decisiones

### El superadmin se declara en el entorno, no en la base

`PLATFORM_SUPERADMIN_EMAILS`, separados por coma. Sin tabla nueva, sin rol
nuevo, sin una pantalla donde alguien pueda concederse el permiso a sí mismo.
Cambiar quién manda exige acceso al servidor, que es exactamente la barrera que
uno quiere para eso.

### El superadmin NO tiene membresía en ninguna organización

No es dueño de nada: administra la cartera. Por eso su sesión no pasa por
`requireSession()` —que exige organización— sino por una puerta propia.

### Vive en `admin.chronoslead.com`, no en una ruta del CRM

El Host `admin` ya está reservado desde la 101. Separarlo por subdominio y no
por ruta hace que el panel no comparta superficie con ningún cliente: no hay
forma de llegar desde el CRM de nadie.

### Solo escribe lo que la 104 ya define

Crear organización, mover `paid_through`, suspender y levantar la suspensión,
y generar un enlace de acceso. **Nada más.** El panel es una cara para lo que
ya existe y está probado, no una vía nueva de escribir en la base.

### No lee conversaciones

El padrón muestra cuántos usuarios y cuándo se dio de alta cada cliente. No
muestra contactos, ni mensajes, ni citas. Si algún día hace falta entrar al CRM
de un cliente para soporte, será una acción explícita y registrada — y será otra
spec.

### Toda acción queda registrada

Quién, qué, sobre quién y cuándo. Sin eso, «yo no suspendí a nadie» no se puede
contestar.

## Comportamiento esperado

| Situación | Resultado |
|---|---|
| `admin.chronoslead.com` sin sesión | pantalla de entrada propia |
| Entrar con un correo que NO está en la lista | 403, y queda registrado |
| Entrar con un correo de la lista | el padrón |
| Un correo de la lista entrando por `{slug}.chronoslead.com` | el CRM normal si tiene membresía; **ser superadmin no abre el CRM de nadie** |
| `admin.chronoslead.com` con `EDITION` apagada | 404: en una instancia de un solo negocio no hay cartera |
| Crear cliente desde el panel | igual que `pnpm provision`, y devuelve el enlace de primer acceso para copiar |
| Marcar un pago | mueve `paid_through` un mes desde hoy, o a la fecha que se elija |
| Suspender | `suspended_at` con motivo; el cliente deja de entrar, sus mensajes se siguen guardando |
| Levantar la suspensión | vuelve a entrar; la fecha de pago manda otra vez |

## Criterios de aceptación

1. Con `EDITION` apagada, `admin.*` responde 404 y los 1214 tests siguen verdes.
2. Un correo que no es superadmin recibe 403 en el panel y en todas sus acciones.
3. El padrón lista las organizaciones con su estado derivado (activa, en gracia
   con días restantes, suspendida y por qué).
4. Crear un cliente desde el panel produce lo mismo que el comando, con su
   enlace de primer acceso.
5. Suspender deja fuera a **esa** organización y a ninguna otra; un WhatsApp
   suyo se sigue guardando.
6. Toda acción deja una línea registrada con autor, acción, organización y
   fecha.
7. El guion de aislamiento gana sus comprobaciones y sigue verde.

## Fuera de alcance

- **Modo soporte** (entrar al CRM de un cliente): necesita su propio diseño de
  auditoría y de qué se puede tocar. Otra spec.
- **Cuotas y uso** (almacenamiento, mensajes, gasto de IA): no hay ningún cliente
  cerca de un límite.
- **Cobro automático**: decisión del operador, el cobro es manual.
