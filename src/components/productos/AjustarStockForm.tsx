"use client";

import { useActionState } from "react";
import type { AjustarStockState } from "@/lib/productos/actions";

const initialState: AjustarStockState = { error: null, stockResultante: null };

export function AjustarStockForm({
  stockActual,
  action,
}: {
  stockActual: number;
  action: (prevState: AjustarStockState, formData: FormData) => Promise<AjustarStockState>;
}) {
  const [state, formAction, pending] = useActionState(action, initialState);

  return (
    <form
      action={formAction}
      className="flex w-full flex-col gap-3 rounded-2xl border border-neutral-200 p-6 text-sm"
    >
      <h2 className="font-semibold">
        Ajustar stock (actual: {state.stockResultante ?? stockActual})
      </h2>
      <label className="flex flex-col gap-1">
        Cantidad (positivo suma, negativo resta)
        <input
          name="delta"
          type="number"
          step="1"
          className="rounded-lg border border-neutral-300 px-4 py-3 text-lg"
          required
        />
      </label>
      <label className="flex flex-col gap-1">
        Motivo (opcional)
        <input name="motivo" className="rounded-lg border border-neutral-300 px-4 py-3 text-lg" />
      </label>
      {state.error && <p className="text-red-600">{state.error}</p>}
      <button
        type="submit"
        disabled={pending}
        className="self-start rounded-lg border border-neutral-300 px-4 py-2 disabled:opacity-60"
      >
        {pending ? "Ajustando..." : "Ajustar"}
      </button>
    </form>
  );
}
