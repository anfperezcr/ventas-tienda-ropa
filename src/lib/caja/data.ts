import type postgres from "postgres";
import { withTenant } from "@/lib/db/tenant";
import type { SessionPayload } from "@/lib/auth/session";
import { rangoDiaBogota } from "@/lib/fechas/bogota";
import { type ItemBitacora, METODO_LABEL, TIPO_MOVIMIENTO_LABEL } from "./labels";

export type { ItemBitacora };

export type EstadoTurno =
  | { abierto: false }
  | {
      abierto: true;
      aperturaId: number;
      aperturaMonto: number;
      aperturaFecha: string;
      aperturaUsuario: string | null;
      ventasEfectivo: number;
      ventasNequi: number;
      ventasDaviplata: number;
      ventasTotales: number;
      numeroVentas: number;
      retiros: number;
      pagosDistribuidor: number;
      saldoEsperado: number;
    };

// Sin tabla de turno separada: el turno de un local es la fila
// movimientos_caja más reciente con tipo apertura/cierre para ese local
// (mismo criterio que el proyecto hermano, confirmado por exploración).
// Recibe tx directo (no abre su propia transacción) para que las
// acciones de caja (actions.ts) puedan reusar el mismo cálculo dentro de
// la transacción que ya tiene el advisory lock -- así el saldo que
// valida un retiro es el mismo que se le mostró al usuario, sin ventana
// de carrera entre leer el estado y escribir el movimiento.
export async function obtenerEstadoTurnoTx(
  tx: postgres.TransactionSql,
  localId: number
): Promise<EstadoTurno> {
  const [ultimo] = await tx<
    { id: number; tipo: string; monto: number; fecha: string; usuario_nombre: string | null }[]
  >`
    select mc.id, mc.tipo, mc.monto, mc.fecha, u.nombre as usuario_nombre
    from movimientos_caja mc
    join usuarios u on u.id = mc.usuario_id
    where mc.local_id = ${localId} and mc.tipo in ('apertura', 'cierre')
    order by mc.fecha desc
    limit 1
  `;

  if (!ultimo || ultimo.tipo === "cierre") {
    return { abierto: false };
  }

  const [pagosPorMetodo] = await tx<
    { efectivo: number; nequi: number; daviplata: number; num_ventas: number }[]
  >`
    select
      coalesce(sum(p.monto) filter (where p.metodo = 'efectivo'), 0) as efectivo,
      coalesce(sum(p.monto) filter (where p.metodo = 'nequi'), 0) as nequi,
      coalesce(sum(p.monto) filter (where p.metodo = 'daviplata'), 0) as daviplata,
      count(distinct v.id) as num_ventas
    from ventas v
    join pagos p on p.venta_id = v.id
    where v.local_id = ${localId} and v.fecha >= ${ultimo.fecha}
  `;

  const [retirosRow] = await tx<{ retiros: number; pagos_distribuidor: number }[]>`
    select
      coalesce(sum(monto) filter (where tipo = 'retiro'), 0) as retiros,
      coalesce(sum(monto) filter (where tipo = 'pago_distribuidor'), 0) as pagos_distribuidor
    from movimientos_caja
    where local_id = ${localId} and tipo in ('retiro', 'pago_distribuidor') and fecha >= ${ultimo.fecha}
  `;

  const ventasEfectivo = Number(pagosPorMetodo?.efectivo ?? 0);
  const ventasNequi = Number(pagosPorMetodo?.nequi ?? 0);
  const ventasDaviplata = Number(pagosPorMetodo?.daviplata ?? 0);
  const retiros = Number(retirosRow?.retiros ?? 0);
  const pagosDistribuidor = Number(retirosRow?.pagos_distribuidor ?? 0);

  return {
    abierto: true,
    aperturaId: ultimo.id,
    aperturaMonto: ultimo.monto,
    // postgres.js devuelve timestamptz como Date, no string -- se
    // normaliza acá (mismo motivo que en listarMovimientosTurno) para
    // que el resto del código pueda tratar esto como string de verdad.
    aperturaFecha: new Date(ultimo.fecha).toISOString(),
    aperturaUsuario: ultimo.usuario_nombre,
    ventasEfectivo,
    ventasNequi,
    ventasDaviplata,
    ventasTotales: ventasEfectivo + ventasNequi + ventasDaviplata,
    numeroVentas: Number(pagosPorMetodo?.num_ventas ?? 0),
    retiros,
    pagosDistribuidor,
    saldoEsperado: ultimo.monto + ventasEfectivo - retiros - pagosDistribuidor,
  };
}

export async function obtenerEstadoTurno(
  tenantId: string,
  localId: number
): Promise<EstadoTurno> {
  return withTenant(tenantId, (tx) => obtenerEstadoTurnoTx(tx, localId));
}

// Bitácora de un turno (ventas + movimientos de caja desde su apertura).
// Recibe session completa, no un localId suelto -- si es empleado, el
// filtro se fuerza acá a session.localId sin importar qué pida el
// llamador, mismo criterio que listarProductos (src/lib/productos/data.ts).
export async function listarMovimientosTurno(
  session: SessionPayload,
  localIdSolicitado: number,
  desdeFecha: string
): Promise<ItemBitacora[]> {
  const localId = session.rol === "empleado" ? session.localId! : localIdSolicitado;

  return withTenant(session.tenantId!, async (tx) => {
    const movimientos = await tx<
      { fecha: string; tipo: string; monto: number; motivo: string | null; usuario_nombre: string }[]
    >`
      select mc.fecha, mc.tipo, mc.monto, mc.motivo, u.nombre as usuario_nombre
      from movimientos_caja mc
      join usuarios u on u.id = mc.usuario_id
      where mc.local_id = ${localId} and mc.fecha >= ${desdeFecha}
    `;

    const ventasRows = await tx<
      { id: number; fecha: string; id_venta_publico: string; total: number; usuario_nombre: string }[]
    >`
      select v.id, v.fecha, v.id_venta_publico, v.total, u.nombre as usuario_nombre
      from ventas v
      join usuarios u on u.id = v.usuario_id
      where v.local_id = ${localId} and v.fecha >= ${desdeFecha}
    `;

    const pagosRows = await tx<{ venta_id: number; metodo: string; monto: number }[]>`
      select p.venta_id, p.metodo, p.monto
      from pagos p
      join ventas v on v.id = p.venta_id
      where v.local_id = ${localId} and v.fecha >= ${desdeFecha}
    `;

    const pagosPorVenta = new Map<number, { metodo: string; monto: number }[]>();
    for (const p of pagosRows) {
      const lista = pagosPorVenta.get(p.venta_id) ?? [];
      lista.push({ metodo: p.metodo, monto: p.monto });
      pagosPorVenta.set(p.venta_id, lista);
    }

    // postgres.js devuelve columnas timestamptz como Date, no string
    // (a diferencia de columnas date, que sí vienen como string) --
    // se normaliza a ISO acá, una sola vez, para que el resto del código
    // pueda tratar ItemBitacora.fecha como string de verdad (ver el
    // comentario equivalente sobre bigint en src/lib/offline/db.ts).
    const itemsMovimientos: ItemBitacora[] = movimientos.map((m) => ({
      clase: "movimiento",
      fecha: new Date(m.fecha).toISOString(),
      tipo: m.tipo,
      descripcion: TIPO_MOVIMIENTO_LABEL[m.tipo] ?? m.tipo,
      metodoOMotivo: m.motivo ?? "—",
      monto: m.monto,
      usuario: m.usuario_nombre,
    }));

    const itemsVentas: ItemBitacora[] = ventasRows.map((v) => ({
      clase: "venta",
      fecha: new Date(v.fecha).toISOString(),
      tipo: "venta",
      descripcion: `Venta #${v.id_venta_publico}`,
      metodoOMotivo: (pagosPorVenta.get(v.id) ?? [])
        .map((p) => METODO_LABEL[p.metodo] ?? p.metodo)
        .join(" + "),
      monto: v.total,
      usuario: v.usuario_nombre,
    }));

    return [...itemsMovimientos, ...itemsVentas].sort((a, b) => b.fecha.localeCompare(a.fecha));
  });
}

// Para el dashboard: a diferencia de listarMovimientosTurno, NO está
// atada a un turno específico (evita la ambigüedad de "¿cuál turno?"
// cuando el owner tiene varios locales con turnos abiertos en
// paralelo) -- es simplemente "lo que pasó hoy", mismo rango que
// obtenerResumenDashboard. Mismo criterio de siempre: empleado fuerza
// su propio local, sin importar qué pida el llamador.
export async function listarMovimientosRecientes(
  session: SessionPayload,
  limite = 5
): Promise<ItemBitacora[]> {
  const localId = session.rol === "empleado" ? session.localId : null;
  const { inicio } = rangoDiaBogota();

  return withTenant(session.tenantId!, async (tx) => {
    const movimientos = await tx<
      { fecha: string; tipo: string; monto: number; motivo: string | null; usuario_nombre: string }[]
    >`
      select mc.fecha, mc.tipo, mc.monto, mc.motivo, u.nombre as usuario_nombre
      from movimientos_caja mc
      join usuarios u on u.id = mc.usuario_id
      where mc.fecha >= ${inicio}
        and (${localId}::bigint is null or mc.local_id = ${localId})
    `;

    const ventasRows = await tx<
      { id: number; fecha: string; id_venta_publico: string; total: number; usuario_nombre: string }[]
    >`
      select v.id, v.fecha, v.id_venta_publico, v.total, u.nombre as usuario_nombre
      from ventas v
      join usuarios u on u.id = v.usuario_id
      where v.fecha >= ${inicio}
        and (${localId}::bigint is null or v.local_id = ${localId})
    `;

    const pagosRows = ventasRows.length
      ? await tx<{ venta_id: number; metodo: string }[]>`
          select venta_id, metodo from pagos where venta_id = any(${ventasRows.map((v) => v.id)})
        `
      : [];
    const metodosPorVenta = new Map<number, string[]>();
    for (const p of pagosRows) {
      const lista = metodosPorVenta.get(p.venta_id) ?? [];
      lista.push(METODO_LABEL[p.metodo] ?? p.metodo);
      metodosPorVenta.set(p.venta_id, lista);
    }

    const itemsMovimientos: ItemBitacora[] = movimientos.map((m) => ({
      clase: "movimiento",
      fecha: new Date(m.fecha).toISOString(),
      tipo: m.tipo,
      descripcion: TIPO_MOVIMIENTO_LABEL[m.tipo] ?? m.tipo,
      metodoOMotivo: m.motivo ?? "—",
      monto: m.monto,
      usuario: m.usuario_nombre,
    }));

    const itemsVentas: ItemBitacora[] = ventasRows.map((v) => ({
      clase: "venta",
      fecha: new Date(v.fecha).toISOString(),
      tipo: "venta",
      descripcion: `Venta #${v.id_venta_publico}`,
      metodoOMotivo: (metodosPorVenta.get(v.id) ?? []).join(" + "),
      monto: v.total,
      usuario: v.usuario_nombre,
    }));

    return [...itemsMovimientos, ...itemsVentas]
      .sort((a, b) => b.fecha.localeCompare(a.fecha))
      .slice(0, limite);
  });
}

export type SaldoCajaDashboard = {
  monto: number;
  hayTurnosAbiertos: boolean;
};

// Para el dashboard: empleado ve SOLO el saldo de su propio local (nunca
// debe poder inferir cuánto efectivo hay en otras sucursales). Owner ve
// la suma de todos los turnos actualmente abiertos del tenant -- mismo
// criterio "consolidado" que ya usa el resto del dashboard para owner
// (ventas/transacciones/clientes ya son totales de todo el tenant, no
// de un local elegido a mano).
export async function obtenerSaldoCajaDashboard(session: SessionPayload): Promise<SaldoCajaDashboard> {
  return withTenant(session.tenantId!, async (tx) => {
    if (session.rol === "empleado") {
      const estado = await obtenerEstadoTurnoTx(tx, session.localId!);
      return estado.abierto
        ? { monto: estado.saldoEsperado, hayTurnosAbiertos: true }
        : { monto: 0, hayTurnosAbiertos: false };
    }

    const locales = await tx<{ id: number }[]>`select id from locales`;
    let total = 0;
    let hayTurnosAbiertos = false;
    for (const l of locales) {
      const estado = await obtenerEstadoTurnoTx(tx, l.id);
      if (estado.abierto) {
        total += estado.saldoEsperado;
        hayTurnosAbiertos = true;
      }
    }
    return { monto: total, hayTurnosAbiertos };
  });
}
