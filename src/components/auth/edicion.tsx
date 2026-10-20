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

export function EdicionProvider({
  cloud,
  children,
}: {
  cloud: boolean;
  children: React.ReactNode;
}) {
  return (
    <EdicionContext.Provider value={cloud}>{children}</EdicionContext.Provider>
  );
}

export function useEsPlataforma(): boolean {
  return useContext(EdicionContext);
}
