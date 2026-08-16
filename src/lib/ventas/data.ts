import { withTenant } from "@/lib/db/tenant";
import type { SessionPayload } from "@/lib/auth/session";
import { METODO_LABEL } from "@/lib/caja/labels";

export type VentaReciente = {
  id: number;
  idVentaPublico: string;
  fecha: string;
  clienteNombre: string;
  metodo: string;
  total: number;
};

// Mismo criterio que listarProductos/listarMovimientosTurno/
// obtenerResumenDashboard: recibe la session completa, no un localId
// suelto -- si es empleado, el filtro se fuerza acá a session.localId
// sin importar qué pida el llamador. "Estado: Completada" no es un
// campo real de negocio -- toda fila que llega a la tabla ventas ya
// está confirmada (una venta offline sin sincronizar vive solo en
// IndexedDB, nunca en esta tabla), así que el estado siempre es el
// mismo por definición; se muestra como texto fijo en la UI, no se
// inventa una columna para esto.
export async function listarUltimasVentas(
  session: SessionPayload,
  limite = 5
): Promise<VentaReciente[]> {
  const localId = session.rol === "empleado" ? session.localId : null;

  return withTenant(session.tenantId!, async (tx) => {
    const ventas = await tx<
      { id: number; id_venta_publico: string; fecha: string; total: number; cliente_nombre: string | null }[]
    >`
      select v.id, v.id_venta_publico, v.fecha, v.total, c.nombre as cliente_nombre
      from ventas v
      left join clientes c on c.id = v.cliente_id
      where (${localId}::bigint is null or v.local_id = ${localId})
      order by v.fecha desc
      limit ${limite}
    `;

    if (ventas.length === 0) return [];

    const pagosRows = await tx<{ venta_id: number; metodo: string }[]>`
      select venta_id, metodo
      from pagos
      where venta_id = any(${ventas.map((v) => v.id)})
    `;
    const metodosPorVenta = new Map<number, string[]>();
    for (const p of pagosRows) {
      const lista = metodosPorVenta.get(p.venta_id) ?? [];
      lista.push(METODO_LABEL[p.metodo] ?? p.metodo);
      metodosPorVenta.set(p.venta_id, lista);
    }

    return ventas.map((v) => ({
      id: v.id,
      idVentaPublico: v.id_venta_publico,
      // postgres.js devuelve timestamptz como Date -- se normaliza a ISO
      // (mismo motivo que en listarMovimientosTurno).
      fecha: new Date(v.fecha).toISOString(),
      clienteNombre: v.cliente_nombre ?? "Cliente general",
      metodo: (metodosPorVenta.get(v.id) ?? []).join(" + "),
      total: v.total,
    }));
  });
}
