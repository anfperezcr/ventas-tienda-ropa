"use server";

import { revalidatePath } from "next/cache";
import { withTenant } from "@/lib/db/tenant";
import { requireOwner } from "@/lib/auth/guards";
import type { Local } from "./data";

export type CrearLocalState = {
  error: string | null;
  local: Local | null;
};

// Solo create -- no hace falta editar/borrar locales por ahora (mismo
// alcance mínimo que crearCategoria).
export async function crearLocal(
  _prevState: CrearLocalState,
  formData: FormData
): Promise<CrearLocalState> {
  const session = await requireOwner();

  const nombre = String(formData.get("nombre") ?? "").trim();
  if (!nombre) {
    return { error: "El nombre es obligatorio", local: null };
  }

  try {
    const local = await withTenant(session.tenantId!, async (tx) => {
      const [row] = await tx<{ id: number }[]>`
        insert into locales (tenant_id, nombre)
        values (${session.tenantId}, ${nombre})
        returning id
      `;
      return { id: row.id, nombre };
    });

    revalidatePath("/locales");
    return { error: null, local };
  } catch (err) {
    const mensaje = err instanceof Error ? err.message : "";
    if (mensaje.includes("duplicate key")) {
      return { error: "Ya existe un local con ese nombre", local: null };
    }
    return { error: "No se pudo crear el local", local: null };
  }
}
