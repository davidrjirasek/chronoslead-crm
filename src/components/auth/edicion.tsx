"use client";

import { createContext, useContext } from "react";

/**
 * 106 — Si las pantallas de entrada corren en plataforma o en una instancia de
 * un solo negocio.
 *
 * El valor lo resuelve el layout, que es servidor; estas pantallas son cliente
 * y no pueden leer `process.env` en runtime. Sin esto, el login de plataforma
 * seguiría ofreciendo «crear la cuenta inicial», que ahí responde 404: una
 * puerta muerta es peor que no ofrecer nada.
 */
const EdicionContext = createContext(false);

/**
 * 116 — Y si además es la puerta del OPERADOR (`admin.…`) y no la de un
 * cliente. Las dos se pintan igual —la de plataforma no tiene marca propia, así
 * que cae en la de ChronosLead— y eso confunde: el dueño llegó al panel y creyó
 * que le habían servido la pantalla equivocada. Lo único que cambia es el
 * titular; el formulario es el mismo porque el usuario también lo es.
 */
/**
 * 138 — Tres puertas, no dos: la del cliente, la del operador (`admin.…`) y el
 * lanzador (`cuentas.…`). Como string y no como booleanos sueltos: dos
 * booleanos permiten estados que no existen.
 */
export type Puerta = "cliente" | "operador" | "cuentas";

const PuertaContext = createContext<Puerta>("cliente");

export function EdicionProvider({
  cloud,
  puerta = "cliente",
  children,
}: {
  cloud: boolean;
  puerta?: Puerta;
  children: React.ReactNode;
}) {
  return (
    <EdicionContext.Provider value={cloud}>
      <PuertaContext.Provider value={puerta}>
        {children}
      </PuertaContext.Provider>
    </EdicionContext.Provider>
  );
}

export function useEsPlataforma(): boolean {
  return useContext(EdicionContext);
}

export function usePuerta(): Puerta {
  return useContext(PuertaContext);
}
