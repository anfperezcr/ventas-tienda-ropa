"use client";

import { useActionState } from "react";
import { useRouter } from "next/navigation";
import { crearLocal, type CrearLocalState } from "@/lib/locales/actions";

const initialState: CrearLocalState = { error: null, local: null };

export function NuevoLocalForm() {
  const router = useRouter();
  const [state, formAction, pending] = useActionState(
    async (prev: CrearLocalState, formData: FormData) => {
      const result = await crearLocal(prev, formData);
      if (result.local) router.refresh();
      return result;
    },
    initialState
  );

  return (
    <form
      action={formAction}
      className="flex flex-col gap-2 rounded-lg border border-dashed border-neutral-300 p-3 text-sm"
    >
      <p className="font-medium">Nuevo local</p>
      <input
        name="nombre"
        placeholder="Nombre"
        className="rounded-lg border border-neutral-300 px-3 py-2"
        required
      />
      {state.error && <p className="text-red-600">{state.error}</p>}
      {state.local && (
        <p className="text-green-700">Local creado — ya aparece en la lista de arriba.</p>
      )}
      <button
        type="submit"
        disabled={pending}
        className="self-start rounded-lg border border-neutral-300 px-3 py-1.5 disabled:opacity-60"
      >
        {pending ? "Creando..." : "Crear local"}
      </button>
    </form>
  );
}
