"use client";

import { useState } from "react";
import { TeclaTactil } from "./TeclaTactil";
import type { TipoTeclado } from "@/lib/touchKeyboard/types";

const FILA_1 = ["q", "w", "e", "r", "t", "y", "u", "i", "o", "p"];
const FILA_2 = ["a", "s", "d", "f", "g", "h", "j", "k", "l", "ñ"];
const FILA_3 = ["z", "x", "c", "v", "b", "n", "m"];

// Vista de números/símbolos -- incluye vocales acentuadas y ñ ya está en
// la vista principal. Cubre "razonablemente" el español sin construir un
// sistema de acento por mantener-presionado (ticket §11: "cuando sea
// razonablemente posible").
const SIMBOLOS_1 = ["1", "2", "3", "4", "5", "6", "7", "8", "9", "0"];
const SIMBOLOS_2 = ["á", "é", "í", "ó", "ú", "ü", "-", "_", "/", "@"];
const SIMBOLOS_3 = [".", ",", ";", ":", "!", "?", "'", "(", ")"];

// email/url comparten el mismo TextKeyboard (ticket §13: "no crear un
// teclado diferente para cada pequeño caso") -- solo agregan una fila de
// atajos rápidos arriba.
const ATAJOS: Partial<Record<TipoTeclado, string[]>> = {
  email: ["@", ".com"],
  url: ["https://", "www.", ".com", "/"],
};

const TECLA_BASE = "min-h-11 text-base sm:min-h-14 sm:text-lg";

export function TextKeyboard({
  variante,
  value,
  etiqueta,
  onInsertText,
  onBackspace,
  onConfirm,
}: {
  variante: TipoTeclado;
  value: string;
  etiqueta?: string;
  onInsertText: (texto: string) => void;
  onBackspace: () => void;
  onConfirm: () => void;
}) {
  const [mayus, setMayus] = useState(false);
  const [vista, setVista] = useState<"letras" | "simbolos">("letras");

  function presionarLetra(caracter: string) {
    onInsertText(mayus ? caracter.toUpperCase() : caracter);
  }

  const atajos = ATAJOS[variante];

  return (
    <div className="flex flex-col gap-2">
      {/* Eco del campo + valor -- el modal centrado tapa el input real
          (rediseño de layout), así que sin esto el usuario perdería de
          vista qué está escribiendo y en qué campo. */}
      <div className="rounded-xl bg-neutral-100 px-4 py-3">
        {etiqueta && <div className="text-xs text-neutral-500">{etiqueta}</div>}
        <div className="truncate text-lg font-semibold text-neutral-900 sm:text-xl">
          {value || " "}
        </div>
      </div>

      {atajos && (
        <div className="flex flex-wrap gap-2">
          {atajos.map((a) => (
            <TeclaTactil
              key={a}
              onPress={() => onInsertText(a)}
              variante="muted"
              className="min-h-10 flex-none px-3 text-sm sm:min-h-11"
            >
              {a}
            </TeclaTactil>
          ))}
        </div>
      )}

      {vista === "letras" ? (
        <>
          <div className="grid grid-cols-10 gap-1 sm:gap-1.5">
            {FILA_1.map((c) => (
              <TeclaTactil key={c} onPress={() => presionarLetra(c)} className={TECLA_BASE}>
                {mayus ? c.toUpperCase() : c}
              </TeclaTactil>
            ))}
          </div>
          <div className="grid grid-cols-10 gap-1 sm:gap-1.5">
            {FILA_2.map((c) => (
              <TeclaTactil key={c} onPress={() => presionarLetra(c)} className={TECLA_BASE}>
                {mayus ? c.toUpperCase() : c}
              </TeclaTactil>
            ))}
          </div>
          <div className="grid grid-cols-9 gap-1 sm:gap-1.5">
            <TeclaTactil
              onPress={() => setMayus((v) => !v)}
              variante={mayus ? "accent" : "muted"}
              ariaLabel="Mayúsculas"
              className={TECLA_BASE}
            >
              ⇧
            </TeclaTactil>
            {FILA_3.map((c) => (
              <TeclaTactil key={c} onPress={() => presionarLetra(c)} className={TECLA_BASE}>
                {mayus ? c.toUpperCase() : c}
              </TeclaTactil>
            ))}
            <TeclaTactil onPress={onBackspace} variante="muted" ariaLabel="Borrar" className={TECLA_BASE}>
              ⌫
            </TeclaTactil>
          </div>
        </>
      ) : (
        <>
          <div className="grid grid-cols-10 gap-1 sm:gap-1.5">
            {SIMBOLOS_1.map((c) => (
              <TeclaTactil key={c} onPress={() => onInsertText(c)} className={TECLA_BASE}>
                {c}
              </TeclaTactil>
            ))}
          </div>
          <div className="grid grid-cols-10 gap-1 sm:gap-1.5">
            {SIMBOLOS_2.map((c) => (
              <TeclaTactil key={c} onPress={() => onInsertText(c)} className={TECLA_BASE}>
                {c}
              </TeclaTactil>
            ))}
          </div>
          <div className="grid grid-cols-10 gap-1 sm:gap-1.5">
            {SIMBOLOS_3.map((c) => (
              <TeclaTactil key={c} onPress={() => onInsertText(c)} className={TECLA_BASE}>
                {c}
              </TeclaTactil>
            ))}
            <TeclaTactil onPress={onBackspace} variante="muted" ariaLabel="Borrar" className={TECLA_BASE}>
              ⌫
            </TeclaTactil>
          </div>
        </>
      )}

      <div className="grid grid-cols-6 gap-1.5 sm:gap-2">
        <TeclaTactil
          onPress={() => setVista((v) => (v === "letras" ? "simbolos" : "letras"))}
          variante="muted"
          className="col-span-1 min-h-12 text-sm sm:min-h-14"
        >
          {vista === "letras" ? "123" : "ABC"}
        </TeclaTactil>
        <TeclaTactil onPress={() => onInsertText(" ")} ariaLabel="Espacio" className="col-span-3 min-h-12 sm:min-h-14">
          espacio
        </TeclaTactil>
        <TeclaTactil
          onPress={onConfirm}
          variante="accent"
          className="col-span-2 min-h-12 text-sm font-semibold sm:min-h-14 sm:text-base"
        >
          ✓ LISTO
        </TeclaTactil>
      </div>
    </div>
  );
}
