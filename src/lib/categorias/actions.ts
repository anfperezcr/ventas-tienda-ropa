"use server";

import { revalidatePath } from "next/cache";
import { withTenant } from "@/lib/db/tenant";
import { requireOwner } from "@/lib/auth/guards";
import type { Categoria } from "./data";

export type CrearCategoriaState = {
  error: string | null;
  categoria: Categoria | null;
};

// Solo create -- igual que el proyecto hermano, no hay editar/borrar
// categorías por ahora.
export async function crearCategoria(
  _prevState: CrearCategoriaState,
  formData: FormData
): Promise<CrearCategoriaState> {
  const session = await requireOwner();

  const nombre = String(formData.get("nombre") ?? "").trim();
  const tallasRaw = String(formData.get("tallasSugeridas") ?? "").trim();
  const tallasSugeridas = tallasRaw
    ? tallasRaw
        .split(",")
        .map((t) => t.trim())
        .filter(Boolean)
    : [];

  if (!nombre) {
    return { error: "El nombre es obligatorio", categoria: null };
  }

  try {
    const categoria = await withTenant(session.tenantId!, async (tx) => {
      const [row] = await tx<{ id: number }[]>`
        insert into categorias (tenant_id, nombre, tallas_sugeridas)
        values (${session.tenantId}, ${nombre}, ${tallasSugeridas})
        returning id
      `;
      return { id: row.id, nombre, tallasSugeridas };
    });

    revalidatePath("/productos");
    return { error: null, categoria };
  } catch (err) {
    const mensaje = err instanceof Error ? err.message : "";
    if (mensaje.includes("duplicate key")) {
      return { error: "Ya existe una categoría con ese nombre", categoria: null };
    }
    return { error: "No se pudo crear la categoría", categoria: null };
  }
}
