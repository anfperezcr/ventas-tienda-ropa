import { cookies } from "next/headers";
import { platformSql } from "@/lib/db/platform";
import { withTenant } from "@/lib/db/tenant";
import { SESSION_COOKIE, verifySession, type SessionPayload } from "./session";

export async function getSession(): Promise<SessionPayload | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE)?.value;
  if (!token) return null;

  const payload = await verifySession(token);
  if (!payload) return null;

  // Revalida `activo` en cada request: si el owner desactiva a este
  // usuario, pierde el acceso de inmediato en vez de esperar a que el JWT
  // expire (hasta 30 días). Si no se pudo determinar (ej. base sin
  // conexión), NO se cierra la sesión: se confía en el JWT y se revalida
  // en el próximo request que sí tenga señal (mismo criterio del proyecto
  // hermano).
  const activo = await revisarActivo(payload);
  if (activo === false) return null;
  return payload;
}

async function revisarActivo(payload: SessionPayload): Promise<boolean | null> {
  try {
    if (payload.rol === "super_admin") {
      const sql = platformSql();
      const rows = await sql<{ activo: boolean }[]>`
        select activo from usuarios where id = ${payload.usuarioId} and tenant_id is null
      `;
      return rows[0]?.activo ?? false;
    }

    if (!payload.tenantId) return false;

    return await withTenant(payload.tenantId, async (tx) => {
      const rows = await tx<{ activo: boolean }[]>`
        select activo from usuarios where id = ${payload.usuarioId}
      `;
      return rows[0]?.activo ?? false;
    });
  } catch {
    return null;
  }
}
