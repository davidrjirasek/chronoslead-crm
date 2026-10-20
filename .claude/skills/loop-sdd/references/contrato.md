# Contrato del loop

Piso que aplica si el `CLAUDE.md` del proyecto no dice otra cosa.

## Definición de Hecho REFORZADA

"Tipos + lint + build + tests" es el **piso**, no el techo. Nada está Hecho
hasta:

1. El gate técnico en verde con los comandos reales del proyecto.
2. El comportamiento ejercido contra la app viva (local primero, luego nube),
   camino feliz y camino infeliz.
3. En un producto multitenant, el guion de aislamiento en verde. Mientras esté
   rojo, ninguna historia está Hecha por más que el gate técnico lo esté.
4. Lo que no se pueda verificar con herramientas (juicio visual, aprobación de
   un tercero) marcado como **pendiente de verificación humana**, nunca como
   completado.

La suite tiene que correr en cualquier orden: un guion que ingiere datos y no
los limpia le deja trabajo al siguiente.

## Manejo de credenciales

Cuando una feature necesite una credencial nueva:

1. Agrégala a `.env` como `REEMPLAZA_…`, con un comentario `#` que diga cómo
   obtenerla.
2. Agrégala a `.env.example` sin valor.
3. Resume en el chat qué falta y sigue con lo demás.

`.env` nunca se sube al repositorio. En plataformas como Coolify, las variables
nuevas solo se inyectan en un **deploy**, no en un restart. Jamás imprimas un
secreto completo en la salida: solo los últimos 4 caracteres.

## Bitácora operativa

Dominios, UUIDs de servicios, qué se probó y cuándo: en un archivo de bitácora
del proyecto (p. ej. `docs/bitacora.md`), **sin secretos**. Ahí solo se anota
*dónde* vive cada credencial, nunca su valor.

## Acciones que siempre requieren OK del dueño

Merge a la rama principal, borrados destructivos, mensajes a personas reales
fuera de la allowlist de pruebas, gastos (créditos, dinero), cambios en cuentas
de terceros (Meta, DNS, pasarela de pago).
