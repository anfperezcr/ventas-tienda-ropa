"use client";

import { forwardRef } from "react";
import { createPortal } from "react-dom";
import { NumericKeyboard } from "./NumericKeyboard";
import { PhoneKeyboard } from "./PhoneKeyboard";
import { TextKeyboard } from "./TextKeyboard";
import type { TipoTeclado } from "@/lib/touchKeyboard/types";

const ETIQUETA: Record<TipoTeclado, string> = {
  numeric: "Teclado numérico",
  text: "Teclado de texto",
  tel: "Teclado telefónico",
  email: "Teclado de texto",
  url: "Teclado de texto",
  search: "Teclado de búsqueda",
};

// Numérico/teléfono son 3 columnas -- no necesitan el ancho completo del
// QWERTY. El modal se compacta en POSICIÓN/ancho, nunca en tamaño de
// tecla (los botones no cambian entre este archivo y los de cada
// teclado).
const ANCHO_MODAL: Record<TipoTeclado, string> = {
  numeric: "max-w-sm",
  tel: "max-w-sm",
  text: "max-w-2xl",
  search: "max-w-2xl",
  email: "max-w-2xl",
  url: "max-w-2xl",
};

type Props = {
  keyboardType: TipoTeclado;
  value: string;
  esMoneda: boolean;
  etiqueta: string;
  onDigit: (d: string) => void;
  onInsertText: (texto: string) => void;
  onBackspace: () => void;
  onClear: () => void;
  onConfirm: () => void;
  onClose: () => void;
};

// Portal a document.body -- capa propia por encima de cualquier contenido
// (ticket §18). Modal centrado con overlay atenuado (no barra fija de
// ancho completo): el backdrop deja el formulario de atrás visible pero
// oscurecido, y el panel ocupa solo el espacio que su contenido necesita.
// Nunca reemplaza el <input> real: solo lee/escribe su value a través de
// TouchKeyboardContext.
export const TouchKeyboard = forwardRef<HTMLDivElement, Props>(function TouchKeyboard(
  { keyboardType, value, esMoneda, etiqueta, onDigit, onInsertText, onBackspace, onClear, onConfirm, onClose },
  ref
) {
  if (typeof document === "undefined") return null;

  return createPortal(
    <div
      // items-end (no items-center) en todos los tamaños: en layouts de 2
      // columnas como /venta, el campo de pago vive en la misma columna
      // que el total/carrito -- centrado en todo el viewport terminaba
      // tapando el total con el panel opaco (confirmado midiendo
      // getBoundingClientRect en vivo, incluso en desktop 1280px).
      // Anclado abajo deja visible lo que está más arriba en esa misma
      // columna, y de paso es más alcanzable con el pulgar en móvil.
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-4"
      // Refuerzo explícito de cierre al tocar el fondo -- en pantallas
      // táctiles, depender solo de que el input pierda el foco
      // (focusout) no es consistente entre navegadores. onClick del
      // backdrop nunca se dispara por una tecla del teclado porque el
      // panel de abajo detiene la propagación del click.
      onClick={onClose}
    >
      <div
        ref={ref}
        role="group"
        aria-label="Teclado virtual"
        onClick={(e) => e.stopPropagation()}
        className={`flex w-full ${ANCHO_MODAL[keyboardType]} flex-col gap-2 rounded-2xl bg-white p-3 shadow-2xl sm:p-4`}
        style={{ marginBottom: "env(safe-area-inset-bottom)" }}
      >
        <div className="flex items-center justify-between px-1">
          <span className="text-xs font-medium text-neutral-500">{ETIQUETA[keyboardType]}</span>
          <button
            type="button"
            onPointerDown={(e) => e.preventDefault()}
            onClick={onClose}
            aria-label="Cerrar teclado"
            className="rounded-lg px-2 py-1 text-sm text-neutral-500 active:bg-neutral-100"
          >
            ✕
          </button>
        </div>

        {keyboardType === "numeric" && (
          <NumericKeyboard
            value={value}
            esMoneda={esMoneda}
            etiqueta={etiqueta}
            onDigit={onDigit}
            onBackspace={onBackspace}
            onClear={onClear}
            onConfirm={onConfirm}
          />
        )}
        {keyboardType === "tel" && (
          <PhoneKeyboard
            value={value}
            etiqueta={etiqueta}
            onDigit={onDigit}
            onBackspace={onBackspace}
            onConfirm={onConfirm}
          />
        )}
        {(keyboardType === "text" ||
          keyboardType === "search" ||
          keyboardType === "email" ||
          keyboardType === "url") && (
          <TextKeyboard
            variante={keyboardType}
            value={value}
            etiqueta={etiqueta}
            onInsertText={onInsertText}
            onBackspace={onBackspace}
            onConfirm={onConfirm}
          />
        )}
      </div>
    </div>,
    document.body
  );
});
