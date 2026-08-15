import type postgres from "postgres";
import { withTenant } from "@/lib/db/tenant";
import { rangoDiaBogota } from "@/lib/fechas/bogota";

const METODOS_PAGO = ["efectivo", "nequi", "daviplata"] as const;

// localId viene de un ?local= en la URL -- valor que el owner puede
// tocar a mano. Dentro de withTenant esta select ya está scoped por RLS
// al tenant en sesión, pero se valida explícito en vez de confiar en
// que RLS lo neutralice en silencio: si esta función se termina
// reusando en un contexto que no pase por withTenant, un filtro nunca
// validado sería el único guardarraíl roto.
async function validarLocalDelTenant(tx: postgres.TransactionSql, localId: number): Promise<void> {
  const [row] = await tx<{ id: number }[]>`select id from locales where id = ${localId}`;
  if (!row) throw new Error("El local indicado no pertenece a este tenant");
}

export type VentasDelDia = {
  totalVentas: number;
  totalMonto: number;
  porMetodo: { metodo: string; monto: number }[];
};

export async function obtenerVentasDelDia(
  tenantId: string,
  opts?: { localId?: number }
): Promise<VentasDelDia> {
  const { inicio, fin } = rangoDiaBogota();

  return withTenant(tenantId, async (tx) => {
    if (opts?.localId) await validarLocalDelTenant(tx, opts.localId);
    const localId = opts?.localId ?? null;

    const [resumen] = await tx<{ total_ventas: number; total_monto: number }[]>`
      select count(*) as total_ventas, coalesce(sum(total), 0) as total_monto
      from ventas
      where fecha >= ${inicio} and fecha < ${fin}
        and (${localId}::bigint is null or local_id = ${localId})
    `;

    const porMetodoRows = await tx<{ metodo: string; monto: number }[]>`
      select p.metodo, coalesce(sum(p.monto), 0) as monto
      from pagos p
      join ventas v on v.id = p.venta_id
      where v.fecha >= ${inicio} and v.fecha < ${fin}
        and (${localId}::bigint is null or v.local_id = ${localId})
      group by p.metodo
    `;
    const montosPorMetodo = new Map(porMetodoRows.map((r) => [r.metodo, Number(r.monto)]));

    return {
      totalVentas: Number(resumen?.total_ventas ?? 0),
      totalMonto: Number(resumen?.total_monto ?? 0),
      porMetodo: METODOS_PAGO.map((metodo) => ({
        metodo,
        monto: montosPorMetodo.get(metodo) ?? 0,
      })),
    };
  });
}

export type ClienteRanking = {
  id: number;
  nombre: string;
  telefono: string;
  total: number;
};

export async function obtenerRankingClientes(
  tenantId: string,
  opts?: { localId?: number; limite?: number }
): Promise<ClienteRanking[]> {
  return withTenant(tenantId, async (tx) => {
    if (opts?.localId) await validarLocalDelTenant(tx, opts.localId);
    const localId = opts?.localId ?? null;
    const limite = opts?.limite ?? 20;

    const rows = await tx<{ id: number; nombre: string; telefono: string; total: number }[]>`
      select c.id, c.nombre, c.telefono, sum(v.total) as total
      from clientes c
      join ventas v on v.cliente_id = c.id
      where (${localId}::bigint is null or v.local_id = ${localId})
      group by c.id, c.nombre, c.telefono
      order by total desc
      limit ${limite}
    `;

    return rows.map((r) => ({
      id: r.id,
      nombre: r.nombre,
      telefono: r.telefono,
      total: Number(r.total),
    }));
  });
}
