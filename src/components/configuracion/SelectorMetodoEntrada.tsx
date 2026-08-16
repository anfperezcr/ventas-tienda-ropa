"use client";

import { useTouchKeyboard } from "@/components/touch-keyboard/TouchKeyboardContext";
import type { ModoEntrada } from "@/lib/touchKeyboard/types";

const OPCIONES: { valor: ModoEntrada; icono: string; titulo: string; descripcion: string }[] = [
  {
    valor: "touch",
    icono: "🖐️",
    titulo: "Modo táctil",
    descripcion: "Muestra un teclado virtual grande, optimizado para pantallas táctiles.",
  },
  {
    valor: "keyboard",
    icono: "⌨️",
    titulo: "Modo teclado",
    descripcion: "Usa el teclado físico o nativo del dispositivo (comportamiento web normal).",
  },
];

// Preferencia local al dispositivo/navegador (localStorage, ver
// src/lib/touchKeyboard/storage.ts) -- a propósito NO vive dentro del
// <form action={actualizarConfiguracion}> de ConfiguracionForm: esa
// acción persiste configuracion_tenant en el servidor (compartido por
// todo el tenant), mientras que esto es "esta tablet siempre en táctil,
// el PC de oficina en teclado" (ticket §22), sin pasar por el backend.
export function SelectorMetodoEntrada() {
  const { modo, setModo } = useTouchKeyboard();

  return (
    <div className="rounded-2xl border border-neutral-200 p-4">
      <h2 className="mb-1 flex items-center gap-2 font-semibold">
        <span aria-hidden="true">🖥️</span> Experiencia de uso
      </h2>
      <p className="mb-3 text-sm text-neutral-500">
        Elige cómo deseas interactuar con la aplicación — se guarda solo en este dispositivo, no
        afecta a otros.
      </p>
      <div role="radiogroup" aria-label="Método de entrada" className="flex flex-col gap-2">
        {OPCIONES.map((op) => {
          const seleccionado = modo === op.valor;
          return (
            <button
              key={op.valor}
              type="button"
              role="radio"
              aria-checked={seleccionado}
              onClick={() => setModo(op.valor)}
              className={`flex items-center gap-3 rounded-xl border p-4 text-left transition-colors ${
                seleccionado
                  ? "border-[var(--brand-600)] bg-[color-mix(in_srgb,var(--brand-600)_8%,white)]"
                  : "border-neutral-200"
              }`}
            >
              <span className="text-2xl" aria-hidden="true">
                {op.icono}
              </span>
              <span className="flex-1">
                <span className="block font-medium">{op.titulo}</span>
                <span className="block text-xs text-neutral-500">{op.descripcion}</span>
              </span>
              <span
                aria-hidden="true"
                className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full border-2 ${
                  seleccionado ? "border-[var(--brand-600)]" : "border-neutral-300"
                }`}
              >
                {seleccionado && <span className="h-3 w-3 rounded-full bg-[var(--brand-600)]" />}
              </span>
            </button>
          );
        })}
      </div>
      <div className="mt-3 flex gap-2 rounded-xl bg-blue-50 p-3 text-sm text-blue-900">
        <span aria-hidden="true">ℹ️</span>
        <p>
          <span className="font-medium">¿Qué modo elegir?</span>
          <br />
          Si usas la app en tablet o pantalla táctil, elige <strong>Modo táctil</strong>.
          <br />
          Si usas computador con teclado y mouse, elige <strong>Modo teclado</strong>.
        </p>
      </div>
    </div>
  );
}
