import { withTenant } from "@/lib/db/tenant";

export type Empleado = {
  id: number;
  nombre: string;
  usuario: string;
  localId: number;
  localNombre: string;
  activo: boolean;
};

type EmpleadoRow = {
  id: number;
  nombre: string;
  usuario: string;
  local_id: number;
  local_nombre: string;
  activo: boolean;
};

function mapear(row: EmpleadoRow): Empleado {
  return {
    id: row.id,
    nombre: row.nombre,
    usuario: row.usuario,
    localId: row.local_id,
    localNombre: row.local_nombre,
    activo: row.activo,
  };
}

// Solo rol = 'empleado' -- el owner no se gestiona desde acá (hoy hay
// uno solo por tenant, creado al aprovisionar el tenant).
export async function listarEmpleados(tenantId: string): Promise<Empleado[]> {
  return withTenant(tenantId, async (tx) => {
    const rows = await tx<EmpleadoRow[]>`
      select u.id, u.nombre, u.usuario, u.local_id, l.nombre as local_nombre, u.activo
      from usuarios u
      join locales l on l.id = u.local_id
      where u.rol = 'empleado'
      order by u.nombre
    `;
    return rows.map(mapear);
  });
}

export async function obtenerEmpleado(tenantId: string, usuarioId: number): Promise<Empleado | null> {
  return withTenant(tenantId, async (tx) => {
    const rows = await tx<EmpleadoRow[]>`
      select u.id, u.nombre, u.usuario, u.local_id, l.nombre as local_nombre, u.activo
      from usuarios u
      join locales l on l.id = u.local_id
      where u.id = ${usuarioId} and u.rol = 'empleado'
    `;
    const row = rows[0];
    return row ? mapear(row) : null;
  });
}
