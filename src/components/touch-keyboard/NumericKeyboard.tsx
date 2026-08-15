"use client";

import { TecladoNumericoBase } from "./TecladoNumericoBase";

// Mismo formato $ que ya usa el resto de la app (VentaForm, CajaPanel,
// DashboardPanel: `${monto.toLocaleString("es-CO")}`) -- el valor interno
// del input sigue siendo solo dígitos, esto es puramente el eco grande
// que se muestra arriba del teclado (ticket §10: "el valor interno debe
// seguir siendo 10000" aunque se muestre "$10.000").
function formatearMonto(valor: string): string {
  const digitos = valor.replace(/\D/g, "");
  if (!digitos) return "0";
  return Number(digitos).toLocaleString("es-CO");
}

export function NumericKeyboard({
  value,
  esMoneda,
  etiqueta,
  onDigit,
  onBackspace,
  onClear,
  onConfirm,
}: {
  value: string;
  esMoneda: boolean;
  etiqueta?: string;
  onDigit: (d: string) => void;
  onBackspace: () => void;
  onClear: () => void;
  onConfirm: () => void;
}) {
  const textoMostrado = esMoneda ? `$${formatearMonto(value)}` : value || "0";

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between gap-3 rounded-xl bg-neutral-100 px-4 py-3">
        <span className="min-w-0 truncate">
          {etiqueta && <span className="block text-xs text-neutral-500">{etiqueta}</span>}
          <span className="block text-2xl font-bold text-neutral-900 sm:text-3xl">{textoMostrado}</span>
        </span>
        <button
          type="button"
          onPointerDown={(e) => e.preventDefault()}
          onClick={onClear}
          className="shrink-0 rounded-lg border border-neutral-300 px-3 py-1.5 text-sm font-medium text-neutral-600 active:bg-neutral-200"
        >
          Limpiar
        </button>
      </div>
      <TecladoNumericoBase variante="dinero" onDigito={onDigit} onBorrar={onBackspace} onConfirmar={onConfirm} />
    </div>
  );
}
