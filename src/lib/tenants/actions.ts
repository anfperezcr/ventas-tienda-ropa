"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { withPlatform } from "@/lib/db/platform";
import { hashPassword } from "@/lib/auth/password";
import { requireSuperAdmin } from "@/lib/auth/guards";

export type CrearTenantState = {
  error: string | null;
};

const SLUG_REGEX = /^[a-z0-9-]+$/;

// Mismo aprovisionamiento atómico que scripts/seed-tenant.ts (tenant +
// suscripción activa +30d + configuracion_tenant + local "Principal" +
// owner), ahora expuesto como Server Action para el formulario del
// panel. Pensada para useActionState.
export async function crearTenant(
  _prevState: CrearTenantState,
  formData: FormData
): Promise<CrearTenantState> {
  await requireSuperAdmin();

  const nombreNegocio = String(formData.get("nombreNegocio") ?? "").trim();
  const slug = String(formData.get("slug") ?? "").trim();
  const ownerNombre = String(formData.get("ownerNombre") ?? "").trim();
  const ownerUsuario = String(formData.get("ownerUsuario") ?? "").trim();
  const ownerPassword = String(formData.get("ownerPassword") ?? "");
  const diasGraciaRaw = String(formData.get("diasGracia") ?? "").trim();
  const diasGracia = diasGraciaRaw === "" ? 5 : Number(diasGraciaRaw);

  if (!nombreNegocio || !slug || !ownerNombre || !ownerUsuario || !ownerPassword) {
    return { error: "Todos los campos son obligatorios" };
  }
  if (!SLUG_REGEX.test(slug)) {
    return { error: "El slug solo puede tener minúsculas, números y guiones" };
  }
  if (ownerPassword.length < 8) {
    return { error: "La contraseña debe tener al menos 8 caracteres" };
  }
  if (!Number.isInteger(diasGracia) || diasGracia < 0) {
    return { error: "Los días de gracia deben ser un entero mayor o igual a 0" };
  }

  // Se hashea de inmediato -- de acá en adelante solo existe el hash en
  // memoria, la password cruda nunca se loguea ni se reenvía en ningún
  // mensaje de error.
  const passwordHash = await hashPassword(ownerPassword);

  try {
    await withPlatform(async (tx) => {
      const [tenant] = await tx<{ id: string }[]>`
        insert into tenants (nombre_negocio, slug)
        values (${nombreNegocio}, ${slug})
        returning id
      `;

      const hoy = new Date();
      const vencimiento = new Date(hoy);
      vencimiento.setDate(vencimiento.getDate() + 30);

      await tx`
        insert into suscripciones (tenant_id, estado, fecha_ultimo_pago, fecha_vencimiento, monto, metodo_pago, dias_gracia)
        values (
          ${tenant.id},
          'activo',
          ${hoy.toISOString().slice(0, 10)},
          ${vencimiento.toISOString().slice(0, 10)},
          30000,
          'manual',
          ${diasGracia}
        )
      `;

      await tx`
        insert into configuracion_tenant (tenant_id, nombre_negocio)
        values (${tenant.id}, ${nombreNegocio})
      `;

      const [local] = await tx<{ id: number }[]>`
        insert into locales (tenant_id, nombre)
        values (${tenant.id}, 'Principal')
        returning id
      `;

      await tx`
        insert into usuarios (tenant_id, nombre, usuario, password_hash, rol, local_id)
        values (${tenant.id}, ${ownerNombre}, ${ownerUsuario}, ${passwordHash}, 'owner', ${local.id})
      `;
    });
  } catch (err) {
    // No reenviar el error crudo de Postgres a la UI ni a logs -- se
    // traduce a un mensaje propio. (No traería la password de todos
    // modos: password_hash no participa en ningún constraint único.)
    const mensaje = err instanceof Error ? err.message : "";
    if (mensaje.includes("tenants_slug_key")) {
      return { error: "Ese slug ya existe" };
    }
    if (mensaje.includes("usuarios_tenant_usuario_uniq")) {
      return { error: "Ese usuario ya existe en este tenant" };
    }
    return { error: "No se pudo crear el tenant" };
  }

  revalidatePath("/super-admin");
  redirect("/super-admin");
}

// Se usa como alternarActivoTenant.bind(null, tenant.id) en un <form
// action={...}> -- el bind produce (formData) => Promise<void>, que es
// lo que exige el atributo action, aunque acá no se use el FormData.
export async function alternarActivoTenant(tenantId: string): Promise<void> {
  const session = await requireSuperAdmin();

  await withPlatform(async (tx) => {
    await tx`
      update tenants
      set activo = not activo,
          activo_actualizado_por = ${session.usuario},
          activo_actualizado_en = now()
      where id = ${tenantId}
    `;
  });

  revalidatePath("/super-admin");
}
