import { platformSql } from "@/lib/db/platform";
import { calcularEstadoAcceso, type EstadoAcceso } from "./estado";

export type AccesoTenant = EstadoAcceso;

// Trae el estado crudo de un tenant y delega el cálculo a
// calcularEstadoAcceso() (src/lib/suscripciones/estado.ts) -- la misma
// función que usa el panel de super_admin para el badge, así las dos
// vistas nunca se desalinean.
export async function evaluarAcceso(tenantId: string): Promise<AccesoTenant> {
  const sql = platformSql();

  const tenantRows = await sql<{ activo: boolean }[]>`
    select activo from tenants where id = ${tenantId}
  `;
  if (!tenantRows[0]) return "bloqueado";

  const suscripcionRows = await sql<
    { estado: string; fecha_vencimiento: string; dias_gracia: number }[]
  >`
    select estado, fecha_vencimiento, dias_gracia from suscripciones where tenant_id = ${tenantId}
  `;
  const suscripcion = suscripcionRows[0];

  return calcularEstadoAcceso({
    tenantActivo: tenantRows[0].activo,
    suscripcionEstado: suscripcion?.estado ?? null,
    fechaVencimiento: suscripcion?.fecha_vencimiento ?? null,
    diasGracia: suscripcion?.dias_gracia ?? 5,
  });
}
