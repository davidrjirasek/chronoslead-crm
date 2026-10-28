/**
 * 127 — El estado que devuelve la acción de guardar.
 *
 * Vive aquí y no en el archivo de la acción porque **un archivo `"use server"`
 * solo puede exportar funciones asíncronas**. Exportar la constante desde ahí
 * e importarla en el componente compila sin quejarse y revienta en el
 * navegador con «Application error: a client-side exception», sin rastro en el
 * registro del servidor. Costó un rato encontrarlo.
 */
export type EstadoGuardado = {
  ok: boolean;
  /** Mensaje para el cliente. Nunca detalles internos. */
  error: string | null;
  /** La llave, que la pantalla necesita para armar el enlace de continuar. */
  llave: string | null;
  /** Campos obligatorios que faltaron, por id, para marcarlos en la pantalla. */
  faltan: string[];
};

export const ESTADO_INICIAL: EstadoGuardado = {
  ok: false,
  error: null,
  llave: null,
  faltan: [],
};
