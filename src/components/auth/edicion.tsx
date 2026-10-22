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
const PuertaDeOperadorContext = createContext(false);

export function EdicionProvider({
  cloud,
  puertaDeOperador = false,
  children,
}: {
  cloud: boolean;
  puertaDeOperador?: boolean;
  children: React.ReactNode;
}) {
  return (
    <EdicionContext.Provider value={cloud}>
      <PuertaDeOperadorContext.Provider value={puertaDeOperador}>
        {children}
      </PuertaDeOperadorContext.Provider>
    </EdicionContext.Provider>
  );
}

export function useEsPlataforma(): boolean {
  return useContext(EdicionContext);
}

export function useEsPuertaDeOperador(): boolean {
  return useContext(PuertaDeOperadorContext);
}
