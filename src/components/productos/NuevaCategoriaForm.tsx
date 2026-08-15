"use client";

import { useActionState } from "react";
import { useRouter } from "next/navigation";
import { crearCategoria, type CrearCategoriaState } from "@/lib/categorias/actions";

const initialState: CrearCategoriaState = { error: null, categoria: null };

export function NuevaCategoriaForm() {
  const router = useRouter();
  const [state, formAction, pending] = useActionState(
    async (prev: CrearCategoriaState, formData: FormData) => {
      const result = await crearCategoria(prev, formData);
      if (result.categoria) router.refresh();
      return result;
    },
    initialState
  );

  return (
    <form
      action={formAction}
      className="flex flex-col gap-2 rounded-lg border border-dashed border-neutral-300 p-3 text-sm"
    >
      <p className="font-medium">Nueva categoría</p>
      <input
        name="nombre"
        placeholder="Nombre"
        className="rounded-lg border border-neutral-300 px-3 py-2"
        required
      />
      <input
        name="tallasSugeridas"
        placeholder="Tallas sugeridas (separadas por coma, opcional)"
        className="rounded-lg border border-neutral-300 px-3 py-2"
      />
      {state.error && <p className="text-red-600">{state.error}</p>}
      {state.categoria && (
        <p className="text-green-700">Categoría creada — ya aparece en la lista de arriba.</p>
      )}
      <button
        type="submit"
        disabled={pending}
        className="self-start rounded-lg border border-neutral-300 px-3 py-1.5 disabled:opacity-60"
      >
        {pending ? "Creando..." : "Crear categoría"}
      </button>
    </form>
  );
}
