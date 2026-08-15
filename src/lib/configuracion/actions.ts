"use server";

import { revalidatePath } from "next/cache";
import { withTenant } from "@/lib/db/tenant";
import { requireOwner } from "@/lib/auth/guards";

export type ConfiguracionFormState = {
  error: string | null;
};

const COLOR_REGEX = /^#[0-9a-f]{6}$/i;

export async function actualizarConfiguracion(
  _prevState: ConfiguracionFormState,
  formData: FormData
): Promise<ConfiguracionFormState> {
  const session = await requireOwner();

  const nombreNegocio = String(formData.get("nombreNegocio") ?? "").trim();
  const colorPrimario = String(formData.get("colorPrimario") ?? "").trim();
  const logoUrl = String(formData.get("logoUrl") ?? "").trim();
  const mensajeRecibo = String(formData.get("mensajeRecibo") ?? "").trim();

  if (!nombreNegocio) {
    return { error: "El nombre del negocio es obligatorio" };
  }
  if (!mensajeRecibo) {
    return { error: "El mensaje de recibo es obligatorio" };
  }
  // El <input type="color"> del navegador ya garantiza #rrggbb, pero la
  // Server Action es invocable directo sin pasar por ese input -- se
  // valida server-side igual que cualquier otro dato de FormData.
  if (!COLOR_REGEX.test(colorPrimario)) {
    return { error: "El color debe tener formato #rrggbb" };
  }
  if (logoUrl && !/^https?:\/\//i.test(logoUrl)) {
    return { error: "La URL del logo debe empezar con http:// o https://" };
  }

  try {
    await withTenant(session.tenantId!, async (tx) => {
      await tx`
        update configuracion_tenant
        set nombre_negocio = ${nombreNegocio},
            color_primario = ${colorPrimario},
            logo_url = ${logoUrl || null},
            mensaje_recibo = ${mensajeRecibo}
      `;
    });
  } catch {
    return { error: "No se pudo guardar la configuración" };
  }

  revalidatePath("/configuracion");
  revalidatePath("/");
  // Ruta dinámica: 'page' revalida ese archivo de página para cualquier
  // slug, sin cascada a rutas anidadas debajo (no hay ninguna acá) --
  // así el cambio de marca se ve también en la página pública de login.
  revalidatePath("/login/[slug]", "page");

  return { error: null };
}
