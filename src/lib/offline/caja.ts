import type { EstadoTurno } from "@/lib/caja/data";
import { type ItemBitacora, METODO_LABEL, TIPO_MOVIMIENTO_LABEL } from "@/lib/caja/labels";
import type { MovimientoPendiente, VentaPendiente } from "./db";

type EventoPendiente =
  | { clase: "venta"; fecha: string; venta: VentaPendiente }
  | { clase: "movimiento"; fecha: string; mov: MovimientoPendiente };

// Puerto directo de calcularEstadoEfectivo del proyecto hermano
// (reference/proyecto-hermano/src/lib/sync/caja.ts), adaptado a la forma
// de EstadoTurno y a los stores de este proyecto. Combina el último
// snapshot conocido del servidor con lo que sigue pendiente de
// sincronizar en este dispositivo (ventas + movimientos de caja) para
// saber si el turno está abierto y cuál es el saldo esperado incluso sin
// conexión. El llamador ya filtra ambas listas por localId -- esta
// función es agnóstica del local, igual que en el hermano.
export function calcularEstadoEfectivo(
  snapshot: EstadoTurno | null,
  movimientosLocales: MovimientoPendiente[],
  ventasLocales: VentaPendiente[]
): EstadoTurno {
  const eventos: EventoPendiente[] = [
    ...ventasLocales.map((venta) => ({ clase: "venta" as const, fecha: venta.creadoEn, venta })),
    ...movimientosLocales.map((mov) => ({ clase: "movimiento" as const, fecha: mov.creadoEn, mov })),
  ].sort((a, b) => a.fecha.localeCompare(b.fecha));

  let estado: EstadoTurno = snapshot ?? { abierto: false };

  for (const evento of eventos) {
    if (evento.clase === "venta") {
      if (!estado.abierto) continue;
      const porMetodo = (m: string) =>
        evento.venta.input.pagos.filter((p) => p.metodo === m).reduce((acc, p) => acc + p.monto, 0);
      const efectivo = porMetodo("efectivo");
      const nequi = porMetodo("nequi");
      const daviplata = porMetodo("daviplata");
      estado = {
        ...estado,
        saldoEsperado: estado.saldoEsperado + efectivo,
        ventasEfectivo: estado.ventasEfectivo + efectivo,
        ventasNequi: estado.ventasNequi + nequi,
        ventasDaviplata: estado.ventasDaviplata + daviplata,
        ventasTotales: estado.ventasTotales + efectivo + nequi + daviplata,
        numeroVentas: estado.numeroVentas + 1,
      };
      continue;
    }

    const { mov } = evento;
    if (mov.input.tipo === "apertura") {
      estado = {
        abierto: true,
        aperturaId: -1,
        aperturaMonto: mov.input.monto,
        aperturaFecha: mov.creadoEn,
        // Sin usuario real todavía porque este evento ni siquiera
        // terminó de sincronizar -- se reemplaza por el nombre real en
        // cuanto el servidor confirma (router.refresh() en SyncProvider).
        aperturaUsuario: null,
        ventasEfectivo: 0,
        ventasNequi: 0,
        ventasDaviplata: 0,
        ventasTotales: 0,
        numeroVentas: 0,
        retiros: 0,
        pagosDistribuidor: 0,
        saldoEsperado: mov.input.monto,
      };
    } else if (mov.input.tipo === "cierre") {
      estado = { abierto: false };
    } else if (mov.input.tipo === "retiro") {
      if (!estado.abierto) continue;
      estado = {
        ...estado,
        saldoEsperado: estado.saldoEsperado - mov.input.monto,
        retiros: estado.retiros + mov.input.monto,
      };
    } else if (mov.input.tipo === "pago_distribuidor") {
      if (!estado.abierto) continue;
      estado = {
        ...estado,
        saldoEsperado: estado.saldoEsperado - mov.input.monto,
        pagosDistribuidor: estado.pagosDistribuidor + mov.input.monto,
      };
    }
  }

  return estado;
}

export type ItemBitacoraFusionado = ItemBitacora & {
  pendiente: boolean;
  errorMsg: string | null;
};

// Hermana de calcularEstadoEfectivo: misma fuente de datos (las colas
// SIN filtrar de ventas_pendientes/movimientos_pendientes -- incluye
// 'error', no solo 'pendiente'), para que la bitácora nunca pueda mostrar
// algo distinto de lo que ya pesa en "Saldo esperado". Un movimiento en
// error también pesa ahí (ver el bucle de arriba, no filtra por estado),
// así que también aparece acá, marcado, en vez de quedar invisible hasta
// que alguien entre a /sincronizacion.
export function fusionarBitacoraTurno(
  itemsServidor: ItemBitacora[],
  movimientosLocales: MovimientoPendiente[],
  ventasLocales: VentaPendiente[]
): ItemBitacoraFusionado[] {
  const servidor: ItemBitacoraFusionado[] = itemsServidor.map((item) => ({
    ...item,
    pendiente: false,
    errorMsg: null,
  }));

  const pendientesMovimientos: ItemBitacoraFusionado[] = movimientosLocales.map((m) => ({
    clase: "movimiento",
    fecha: m.creadoEn,
    tipo: m.input.tipo,
    descripcion: TIPO_MOVIMIENTO_LABEL[m.input.tipo] ?? m.input.tipo,
    metodoOMotivo: m.input.motivo ?? "—",
    monto: m.input.monto,
    usuario: null,
    pendiente: true,
    errorMsg: m.errorMsg,
  }));

  const pendientesVentas: ItemBitacoraFusionado[] = ventasLocales.map((v) => ({
    clase: "venta",
    fecha: v.creadoEn,
    tipo: "venta",
    descripcion: "Venta (pendiente)",
    metodoOMotivo: v.input.pagos.map((p) => METODO_LABEL[p.metodo] ?? p.metodo).join(" + "),
    monto: v.total,
    usuario: null,
    pendiente: true,
    errorMsg: v.errorMsg,
  }));

  return [...servidor, ...pendientesMovimientos, ...pendientesVentas].sort((a, b) =>
    b.fecha.localeCompare(a.fecha)
  );
}
