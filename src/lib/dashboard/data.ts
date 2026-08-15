import { withTenant } from "@/lib/db/tenant";
import { rangoDiaBogota } from "@/lib/fechas/bogota";
import type { SessionPayload } from "@/lib/auth/session";

const METODOS_PAGO = ["efectivo", "nequi", "daviplata"] as const;

export type ResumenDashboard = {
  ventasHoy: { totalVentas: number; totalMonto: number };
  ventasAyer: { totalVentas: number; totalMonto: number };
  porMetodo: { metodo: string; monto: number }[];
  clientesAtendidosHoy: number;
  ventasPorHora: { hora: number; monto: number }[];
};

export async function obtenerResumenDashboard(session: SessionPayload): Promise<ResumenDashboard> {
  // owner ve el consolidado del tenant; empleado, solo su local (mismo
  // criterio que listarMovimientosTurno en caja/data.ts).
  const localId = session.rol === "empleado" ? session.localId : null;
  const { inicio: inicioHoy, fin: finHoy } = rangoDiaBogota(0);
  const { inicio: inicioAyer, fin: finAyer } = rangoDiaBogota(-1);

  return withTenant(session.tenantId!, async (tx) => {
    const [hoy] = await tx<{ total_ventas: number; total_monto: number }[]>`
      select count(*) as total_ventas, coalesce(sum(total), 0) as total_monto
      from ventas
      where fecha >= ${inicioHoy} and fecha < ${finHoy}
        and (${localId}::bigint is null or local_id = ${localId})
    `;

    const [ayer] = await tx<{ total_ventas: number; total_monto: number }[]>`
      select count(*) as total_ventas, coalesce(sum(total), 0) as total_monto
      from ventas
      where fecha >= ${inicioAyer} and fecha < ${finAyer}
        and (${localId}::bigint is null or local_id = ${localId})
    `;

    const porMetodoRows = await tx<{ metodo: string; monto: number }[]>`
      select p.metodo, coalesce(sum(p.monto), 0) as monto
      from pagos p
      join ventas v on v.id = p.venta_id
      where v.fecha >= ${inicioHoy} and v.fecha < ${finHoy}
        and (${localId}::bigint is null or v.local_id = ${localId})
      group by p.metodo
    `;
    const montosPorMetodo = new Map(porMetodoRows.map((r) => [r.metodo, Number(r.monto)]));

    const [clientes] = await tx<{ count: number }[]>`
      select count(distinct cliente_id) as count
      from ventas
      where fecha >= ${inicioHoy} and fecha < ${finHoy}
        and cliente_id is not null
        and (${localId}::bigint is null or local_id = ${localId})
    `;

    const porHoraRows = await tx<{ hora: number; monto: number }[]>`
      select extract(hour from fecha at time zone 'America/Bogota')::int as hora,
             coalesce(sum(total), 0) as monto
      from ventas
      where fecha >= ${inicioHoy} and fecha < ${finHoy}
        and (${localId}::bigint is null or local_id = ${localId})
      group by hora
    `;
    const montoPorHora = new Map(porHoraRows.map((r) => [Number(r.hora), Number(r.monto)]));

    // La serie solo llega hasta la hora actual en Bogotá -- no tiene
    // sentido dibujar horas del día que todavía no han pasado.
    const horaActualBogota = new Date(Date.now() - 5 * 60 * 60 * 1000).getUTCHours();
    const ventasPorHora = Array.from({ length: horaActualBogota + 1 }, (_, hora) => ({
      hora,
      monto: montoPorHora.get(hora) ?? 0,
    }));

    return {
      ventasHoy: {
        totalVentas: Number(hoy?.total_ventas ?? 0),
        totalMonto: Number(hoy?.total_monto ?? 0),
      },
      ventasAyer: {
        totalVentas: Number(ayer?.total_ventas ?? 0),
        totalMonto: Number(ayer?.total_monto ?? 0),
      },
      porMetodo: METODOS_PAGO.map((metodo) => ({
        metodo,
        monto: montosPorMetodo.get(metodo) ?? 0,
      })),
      clientesAtendidosHoy: Number(clientes?.count ?? 0),
      ventasPorHora,
    };
  });
}
