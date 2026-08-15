"use client";

import { TecladoNumericoBase } from "./TecladoNumericoBase";

export function PhoneKeyboard({
  value,
  etiqueta,
  onDigit,
  onBackspace,
  onConfirm,
}: {
  value: string;
  etiqueta?: string;
  onDigit: (d: string) => void;
  onBackspace: () => void;
  onConfirm: () => void;
}) {
  return (
    <div className="flex flex-col gap-3">
      <div className="rounded-xl bg-neutral-100 px-4 py-3 text-center">
        {etiqueta && <div className="text-xs text-neutral-500">{etiqueta}</div>}
        <div className="text-2xl font-bold tracking-wider text-neutral-900 sm:text-3xl">{value || "—"}</div>
      </div>
      <TecladoNumericoBase variante="telefono" onDigito={onDigit} onBorrar={onBackspace} onConfirmar={onConfirm} />
    </div>
  );
}
