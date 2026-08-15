import { platformSql } from "@/lib/db/platform";
import { calcularEstadoAcceso, type EstadoAcceso } from "@/lib/suscripciones/estado";

export type TenantConEstado = {
  id: string;
  nombreNegocio: string;
  slug: string;
  activo: boolean;
  activoActualizadoPor: string | null;
  activoActualizadoEn: string | null;
  suscripcionEstado: string | null;
  fechaVencimiento: string | null;
  monto: number | null;
  diasGracia: number;
  usuariosCount: number;
  estadoAcceso: EstadoAcceso;
};

type TenantRow = {
  id: string;
  nombre_negocio: string;
  slug: string;
  activo: boolean;
  activo_actualizado_por: string | null;
  activo_actualizado_en: string | null;
  suscripcion_estado: string | null;
  fecha_vencimiento: string | null;
  monto: number | null;
  dias_gracia: number | null;
  usuarios_count: string;
};

// El badge de estado se calcula con calcularEstadoAcceso() -- la misma
// función que usa el gate de login (src/lib/suscripciones/gate.ts) -- en
// vez de mostrar suscripciones.estado crudo, para que el panel nunca
// diga "activo" de un tenant que el login ya está bloqueando.
//
// usuarios_count sale de una subquery agregada (no un join directo a
// usuarios) para no multiplicar filas de tenants por cada usuario --
// se agrega primero, se une después.
export async function listarTenants(): Promise<TenantConEstado[]> {
  const sql = platformSql();
  const rows = await sql<TenantRow[]>`
    select
      t.id,
      t.nombre_negocio,
      t.slug,
      t.activo,
      t.activo_actualizado_por,
      t.activo_actualizado_en,
      s.estado as suscripcion_estado,
      s.fecha_vencimiento,
      s.monto,
      s.dias_gracia,
      coalesce(u.usuarios_count, 0) as usuarios_count
    from tenants t
    left join suscripciones s on s.tenant_id = t.id
    left join (
      select tenant_id, count(*) as usuarios_count
      from usuarios
      where rol != 'super_admin'
      group by tenant_id
    ) u on u.tenant_id = t.id
    order by t.creado_en desc
  `;

  return rows.map((row) => ({
    id: row.id,
    nombreNegocio: row.nombre_negocio,
    slug: row.slug,
    activo: row.activo,
    activoActualizadoPor: row.activo_actualizado_por,
    activoActualizadoEn: row.activo_actualizado_en,
    suscripcionEstado: row.suscripcion_estado,
    fechaVencimiento: row.fecha_vencimiento,
    monto: row.monto,
    diasGracia: row.dias_gracia ?? 5,
    usuariosCount: Number(row.usuarios_count),
    estadoAcceso: calcularEstadoAcceso({
      tenantActivo: row.activo,
      suscripcionEstado: row.suscripcion_estado,
      fechaVencimiento: row.fecha_vencimiento,
      diasGracia: row.dias_gracia ?? 5,
    }),
  }));
}
