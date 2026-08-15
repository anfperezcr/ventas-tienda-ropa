import type { ModoEntrada } from "./types";

// Por dispositivo/navegador, nunca por tenant ni por usuario -- a
// propósito NO se guarda en configuracion_tenant ni en el JWT de sesión
// (CLAUDE.md §22 del ticket: una tablet puede estar en táctil y el PC de
// oficina en teclado sin que cambiar uno afecte al otro).
const CLAVE_STORAGE = "pos_input_mode";
const MODOS_VALIDOS: ModoEntrada[] = ["touch", "keyboard", "automatic"];

// El evento "storage" nativo del navegador NO se dispara en la misma
// pestaña que hizo el cambio (solo en otras pestañas/ventanas) -- mismo
// patrón que EVENTO_CATALOGO_ACTUALIZADO / EVENTO_CAJA_PENDIENTE_ACTUALIZADO
// en src/lib/offline/db.ts para notificar a listeners de esta pestaña.
export const EVENTO_MODO_ENTRADA_CAMBIADO = "touch-keyboard-modo-cambiado";

export function leerModoGuardado(): ModoEntrada {
  if (typeof window === "undefined") return "keyboard";
  try {
    const valor = window.localStorage.getItem(CLAVE_STORAGE);
    if (valor && MODOS_VALIDOS.includes(valor as ModoEntrada)) {
      return valor as ModoEntrada;
    }
  } catch {
    // localStorage puede fallar en modo privado/incógnito de algunos
    // navegadores -- se degrada a "keyboard" (comportamiento web normal),
    // nunca a "touch" (evita mostrar un teclado que el usuario no pidió).
  }
  return "keyboard";
}

export function obtenerSnapshotServidor(): ModoEntrada {
  return "keyboard";
}

export function guardarModo(modo: ModoEntrada): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(CLAVE_STORAGE, modo);
  } catch {
    // Sin persistencia disponible -- el modo sigue funcionando en memoria
    // para esta sesión de pestaña, solo no sobrevive un refresh.
  }
  window.dispatchEvent(new Event(EVENTO_MODO_ENTRADA_CAMBIADO));
}

export function suscribirModoGuardado(callback: () => void): () => void {
  window.addEventListener("storage", callback);
  window.addEventListener(EVENTO_MODO_ENTRADA_CAMBIADO, callback);
  return () => {
    window.removeEventListener("storage", callback);
    window.removeEventListener(EVENTO_MODO_ENTRADA_CAMBIADO, callback);
  };
}
