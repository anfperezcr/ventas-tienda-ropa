"use client";

import { useTouchKeyboard } from "./TouchKeyboardContext";

// Atajo rápido en el header (ticket §24) -- se agregó porque sin esto un
// empleado no tendría forma de cambiar su propio modo táctil/teclado: la
// pantalla completa de preferencia vive en /configuracion, que es
// exclusiva de owner (requireOwner). Un botón simple que alterna entre
// los dos modos (sin popover) evita el "ruido visual" que el ticket pide
// prevenir si no aporta valor real.
export function IndicadorMetodoEntrada() {
  const { modo, setModo } = useTouchKeyboard();
  const esTactil = modo === "touch";

  return (
    <button
      type="button"
      onClick={() => setModo(esTactil ? "keyboard" : "touch")}
      title="Cambiar método de entrada"
      aria-label={`Método de entrada actual: ${esTactil ? "táctil" : "teclado"}. Tocar para cambiar.`}
      className="flex items-center gap-1.5 rounded-lg border border-neutral-300 px-2.5 py-1.5 text-xs text-neutral-600"
    >
      <span aria-hidden="true">{esTactil ? "🖐️" : "⌨️"}</span>
      <span className="hidden sm:inline">{esTactil ? "Táctil" : "Teclado"}</span>
    </button>
  );
}
