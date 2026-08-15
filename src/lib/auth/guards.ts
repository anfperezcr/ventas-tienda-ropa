import { redirect } from "next/navigation";
import { getSession } from "./getSession";
import type { SessionPayload } from "./session";

// Segunda capa de defensa, además de src/proxy.ts: cada Server Action de
// super_admin llama esto directo, para que invocarla sin pasar por la
// página protegida tampoco alcance a tocar la base.
export async function requireSuperAdmin(): Promise<SessionPayload> {
  const session = await getSession();
  if (!session) redirect("/super-admin/login");
  if (session.rol !== "super_admin") redirect("/");
  return session;
}

// Segunda capa para todo lo de la tienda (productos, ventas, caja): rol
// owner o empleado. super_admin no pertenece acá.
export async function requireTenantSession(): Promise<SessionPayload> {
  const session = await getSession();
  if (!session) redirect("/");
  if (session.rol === "super_admin") redirect("/super-admin");
  return session;
}

// CRUD de productos/categorías/ajuste de stock es solo del owner
// (CLAUDE.md §3).
export async function requireOwner(): Promise<SessionPayload> {
  const session = await requireTenantSession();
  if (session.rol !== "owner") redirect("/dashboard");
  return session;
}

// Un empleado está atado a session.localId -- nada impide que la
// request traiga un localId distinto al que la UI le mostró, así que se
// valida server-side en cada acción que reciba un localId. Un owner no
// tiene esta restricción (opera cualquier local del tenant).
export function assertLocalPermitido(session: SessionPayload, localId: number): void {
  if (session.rol === "empleado" && session.localId !== localId) {
    throw new Error("No tienes acceso a ese local");
  }
}
