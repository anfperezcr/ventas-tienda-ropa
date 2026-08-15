"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { withTenant } from "@/lib/db/tenant";
import { requireOwner } from "@/lib/auth/guards";
import { hashPassword } from "@/lib/auth/password";

export type EmpleadoFormState = {
  error: string | null;
};

// Mismo aprovisionamiento que crearTenant para el primer owner, pero acá
// para empleados adicionales: hash inmediato (nunca se loguea ni se
// reenvía cruda), rol fijo 'empleado' (nunca se expone ese campo al
// formulario -- este flujo no crea owners).
export async function crearEmpleado(
  _prevState: EmpleadoFormState,
  formData: FormData
): Promise<EmpleadoFormState> {
  const session = await requireOwner();

  const nombre = String(formData.get("nombre") ?? "").trim();
  const usuario = String(formData.get("usuario") ?? "").trim();
  const password = String(formData.get("password") ?? "");
  const localId = Number(formData.get("localId"));

  if (!nombre || !usuario || !password || !Number.isInteger(localId)) {
    return { error: "Todos los campos son obligatorios" };
  }
  if (password.length < 8) {
    return { error: "La contraseña debe tener al menos 8 caracteres" };
  }

  const passwordHash = await hashPassword(password);

  try {
    await withTenant(session.tenantId!, async (tx) => {
      await tx`
        insert into usuarios (tenant_id, nombre, usuario, password_hash, rol, local_id)
        values (${session.tenantId}, ${nombre}, ${usuario}, ${passwordHash}, 'empleado', ${localId})
      `;
    });
  } catch (err) {
    const mensaje = err instanceof Error ? err.message : "";
    if (mensaje.includes("usuarios_tenant_usuario_uniq")) {
      return { error: "Ese usuario ya existe en este tenant" };
    }
    return { error: "No se pudo crear el empleado" };
  }

  revalidatePath("/usuarios");
  redirect("/usuarios");
}

// El "usuario" (login) queda inmutable después de creado -- mismo
// criterio que el slug de tenant. La reasignación de local se permite
// aunque el empleado tenga un turno de caja abierto en su local actual
// (decisión explícita: el owner puede cerrar cualquier turno desde
// /caja sin estar sujeto a assertLocalPermitido, así que nunca queda un
// turno realmente huérfano -- solo pasa a ser una tarea manual suya en
// vez de bloquear la reasignación con una validación nueva).
export async function actualizarEmpleado(
  usuarioId: number,
  _prevState: EmpleadoFormState,
  formData: FormData
): Promise<EmpleadoFormState> {
  const session = await requireOwner();

  const nombre = String(formData.get("nombre") ?? "").trim();
  const localId = Number(formData.get("localId"));
  const password = String(formData.get("password") ?? "");

  if (!nombre || !Number.isInteger(localId)) {
    return { error: "Todos los campos son obligatorios" };
  }
  if (password && password.length < 8) {
    return { error: "La contraseña debe tener al menos 8 caracteres" };
  }

  try {
    const passwordHash = password ? await hashPassword(password) : null;

    await withTenant(session.tenantId!, async (tx) => {
      if (passwordHash) {
        await tx`
          update usuarios
          set nombre = ${nombre}, local_id = ${localId}, password_hash = ${passwordHash}
          where id = ${usuarioId} and rol = 'empleado'
        `;
      } else {
        await tx`
          update usuarios
          set nombre = ${nombre}, local_id = ${localId}
          where id = ${usuarioId} and rol = 'empleado'
        `;
      }
    });
  } catch {
    return { error: "No se pudo actualizar el empleado" };
  }

  revalidatePath("/usuarios");
  redirect("/usuarios");
}

// El corte de acceso ya lo hace getSession() (revalida `activo` en cada
// request, no solo en el login -- ver src/lib/auth/getSession.ts) sin
// ningún cambio necesario acá; esta acción solo mueve el flag.
export async function alternarActivoEmpleado(usuarioId: number): Promise<void> {
  const session = await requireOwner();
  await withTenant(session.tenantId!, async (tx) => {
    await tx`
      update usuarios set activo = not activo where id = ${usuarioId} and rol = 'empleado'
    `;
  });

  revalidatePath("/usuarios");
}
