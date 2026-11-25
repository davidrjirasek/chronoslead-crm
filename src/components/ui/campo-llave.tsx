"use client";

import { useId, useRef, useState } from "react";
import { Input } from "@/components/ui/input";

/**
 * 155 — El campo donde se pega una LLAVE, a prueba del gestor de contraseñas.
 *
 * **Por qué existe.** El 25-nov-2026 el agente de un cliente quedó mudo y
 * «Probar conexión» contestaba `401 Missing Authentication header` con una
 * llave que, probada a mano en una terminal, funcionaba. Costó medio día.
 *
 * La causa: el campo era un `type="password"` pelado, así que **Chrome lo
 * autocompletaba con una contraseña guardada del sitio**. La pantalla
 * mostraba unos puntitos que parecían el marcador de «ya hay una llave», el
 * dueño no tocaba nada, y al pulsar Probar se mandaba ESA contraseña en vez
 * de la llave guardada. OpenRouter no decía «llave inválida» sino «cabecera
 * malformada», que es exactamente lo que es una contraseña metida donde iba
 * un token — y esa diferencia fue la que nos tuvo persiguiendo un fantasma.
 *
 * Lo grave no es el error que muestra: es que el mismo texto se guarda si uno
 * pulsa Guardar. Una contraseña cifrada en lugar de la llave, el agente mudo,
 * y la pantalla diciendo «Activo».
 *
 * **Por qué no alcanza `autoComplete="off"`:** Chrome lo ignora en campos de
 * contraseña desde hace años. Lo que sí respeta es que el campo esté en solo
 * lectura mientras no tenga el foco; se lo quita al tocarlo, así que pegar
 * sigue siendo pegar. Los `data-*` son para 1Password, LastPass y Bitwarden,
 * cada uno con el suyo.
 *
 * Esto NO va en el campo de la contraseña del propio usuario
 * (`CampoContrasena`): ahí autocompletar es justo lo que se quiere.
 */
export function CampoLlave({
  onFocus,
  ...props
}: Omit<React.ComponentPropsWithRef<"input">, "type" | "readOnly">) {
  // Arranca en solo lectura: es lo único que Chrome respeta de verdad.
  const [bloqueado, setBloqueado] = useState(true);
  const propio = useId();

  /**
   * Un `name` distinto en cada montaje. El gestor empareja por nombre, y uno
   * estable como «token» o «password» es justo lo que busca para rellenar.
   */
  const nombre = useRef(`k-${propio.replace(/[^a-zA-Z0-9]/g, "")}`).current;

  return (
    <Input
      {...props}
      type="password"
      name={props.name ?? nombre}
      readOnly={bloqueado}
      onFocus={(e) => {
        setBloqueado(false);
        onFocus?.(e);
      }}
      autoComplete="off"
      data-lpignore="true"
      data-1p-ignore=""
      data-bwignore="true"
    />
  );
}
