"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  abrirCaja,
  cerrarCaja,
  registrarRetiro,
  registrarPagoDistribuidor,
  type CajaActionResult,
} from "@/lib/caja/actions";
import type { EstadoTurno, ItemBitacora } from "@/lib/caja/data";
import {
  guardarCajaSnapshot,
  obtenerCajaSnapshot,
  encolarMovimientoPendiente,
  listarMovimientosPendientes,
  listarVentasPendientes,
  EVENTO_CAJA_PENDIENTE_ACTUALIZADO,
  EVENTO_VENTAS_PENDIENTES_ACTUALIZADO,
  type MovimientoCajaInput,
  type TipoMovimientoCaja,
} from "@/lib/offline/db";
import { calcularEstadoEfectivo, fusionarBitacoraTurno, type ItemBitacoraFusionado } from "@/lib/offline/caja";
import { generarClientRef } from "@/lib/offline/clientRef";

// Sin lista real de motivos en el modelo de datos -- esto es solo un
// <datalist> de autocompletar, no restringe lo que se puede escribir ni
// implica ningún concepto de negocio nuevo (el campo sigue siendo texto
// libre, igual que hoy).
const MOTIVOS_SUGERIDOS = [
  "Gastos operativos",
  "Pago a proveedor",
  "Cambio para caja",
  "Retiro de efectivo",
];

const TABS = [
  { valor: "todos", etiqueta: "Todos" },
  { valor: "venta", etiqueta: "Ventas" },
  { valor: "retiro", etiqueta: "Retiros" },
  { valor: "pago_distribuidor", etiqueta: "Pagos a distribuidor" },
] as const;

function Tarjeta({ titulo, valor }: { titulo: string; valor: string }) {
  return (
    <div className="rounded-xl border border-neutral-200 p-3">
      <div className="text-xs text-neutral-500">{titulo}</div>
      <div className="text-lg font-semibold">{valor}</div>
    </div>
  );
}

export function CajaPanel({
  tenantId,
  localId,
  estado,
  movimientos,
}: {
  tenantId: string;
  localId: number;
  estado: EstadoTurno;
  movimientos: ItemBitacora[];
}) {
  const router = useRouter();
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [estadoMostrado, setEstadoMostrado] = useState<EstadoTurno>(estado);
  const [bitacora, setBitacora] = useState<ItemBitacoraFusionado[]>(() =>
    fusionarBitacoraTurno(movimientos, [], [])
  );
  const [tabFiltro, setTabFiltro] =
    useState<(typeof TABS)[number]["valor"]>("todos");

  const [montoInicial, setMontoInicial] = useState("");
  const [motivoApertura, setMotivoApertura] = useState("");

  const [tipoMovimiento, setTipoMovimiento] = useState<"retiro" | "pago_distribuidor">("retiro");
  const [montoMovimiento, setMontoMovimiento] = useState("");
  const [motivoMovimiento, setMotivoMovimiento] = useState("");

  const [montoContado, setMontoContado] = useState("");
  const [motivoCierre, setMotivoCierre] = useState("");

  // Cada vez que llega un `estado`/`movimientos` fresco del servidor
  // (carga inicial o tras un router.refresh()), es la verdad más
  // reciente conocida -- se guarda como snapshot para recalcular offline
  // más adelante, y se recalcula tanto el estado optimista como la
  // bitácora fusionada por si ya había algo pendiente en cola para este
  // local (ej. la página se recargó sin conexión). Ambos se derivan de
  // la misma lectura de la cola en el mismo tick, para que nunca puedan
  // desalinearse entre sí.
  useEffect(() => {
    let cancelado = false;

    async function recalcular(base: EstadoTurno) {
      const [movs, ventas] = await Promise.all([
        listarMovimientosPendientes(tenantId),
        listarVentasPendientes(tenantId),
      ]);
      if (cancelado) return;
      const movsLocal = movs.filter((m) => m.input.localId === localId);
      const ventasLocal = ventas.filter((v) => v.input.localId === localId);
      setEstadoMostrado(calcularEstadoEfectivo(base, movsLocal, ventasLocal));
      setBitacora(fusionarBitacoraTurno(movimientos, movsLocal, ventasLocal));
    }

    guardarCajaSnapshot(tenantId, localId, estado).then(() => {
      if (!cancelado) recalcular(estado);
    });

    async function onPendientesActualizados() {
      const snapshot = await obtenerCajaSnapshot(tenantId, localId);
      if (cancelado) return;
      await recalcular(snapshot?.estado ?? estado);
    }

    window.addEventListener(EVENTO_CAJA_PENDIENTE_ACTUALIZADO, onPendientesActualizados);
    window.addEventListener(EVENTO_VENTAS_PENDIENTES_ACTUALIZADO, onPendientesActualizados);
    return () => {
      cancelado = true;
      window.removeEventListener(EVENTO_CAJA_PENDIENTE_ACTUALIZADO, onPendientesActualizados);
      window.removeEventListener(EVENTO_VENTAS_PENDIENTES_ACTUALIZADO, onPendientesActualizados);
    };
  }, [estado, movimientos, tenantId, localId]);

  async function ejecutar(
    tipo: TipoMovimientoCaja,
    monto: number,
    motivo: string | null,
    accionOnline: (clientRef: string) => Promise<CajaActionResult>
  ) {
    setEnviando(true);
    setError(null);
    const clientRef = generarClientRef();
    const input: MovimientoCajaInput = { localId, tipo, monto, motivo };

    // Sin conexión: ni se intenta -- directo a la cola, mismo criterio que
    // VentaForm (Fase 7.3).
    if (typeof navigator !== "undefined" && !navigator.onLine) {
      await encolarMovimientoPendiente(tenantId, clientRef, input);
      setEnviando(false);
      return;
    }

    try {
      const res = await accionOnline(clientRef);
      if (res.error) {
        setError(res.error);
      } else {
        router.refresh();
      }
    } catch {
      // Server Action inalcanzable -- se encola igual en vez de perderla.
      await encolarMovimientoPendiente(tenantId, clientRef, input);
    } finally {
      setEnviando(false);
    }
  }

  if (!estadoMostrado.abierto) {
    return (
      <div className="flex flex-col gap-3 rounded-2xl border border-neutral-200 p-6">
        <h2 className="font-semibold">Abrir caja</h2>
        <label className="flex flex-col gap-1 text-sm">
          Monto inicial
          <input
            type="number"
            min={0}
            value={montoInicial}
            onChange={(e) => setMontoInicial(e.target.value)}
            className="rounded-lg border border-neutral-300 px-4 py-3 text-lg"
          />
        </label>
        <label className="flex flex-col gap-1 text-sm">
          Motivo (opcional)
          <input
            value={motivoApertura}
            onChange={(e) => setMotivoApertura(e.target.value)}
            className="rounded-lg border border-neutral-300 px-4 py-3 text-lg"
          />
        </label>
        {error && <p className="text-sm text-red-600">{error}</p>}
        <button
          disabled={enviando}
          onClick={() => {
            const monto = Number(montoInicial);
            const motivo = motivoApertura.trim() || null;
            ejecutar("apertura", monto, motivo, (clientRef) =>
              abrirCaja(localId, monto, motivo, clientRef)
            );
          }}
          className="rounded-lg bg-[var(--brand-600)] px-4 py-3 text-lg font-medium text-white disabled:opacity-60"
        >
          {enviando ? "Abriendo..." : "Abrir caja"}
        </button>
      </div>
    );
  }

  const diferencia = montoContado ? Number(montoContado) - estadoMostrado.saldoEsperado : null;
  const bitacoraFiltrada = bitacora.filter((i) => tabFiltro === "todos" || i.tipo === tabFiltro);

  return (
    <div className="flex flex-col gap-4">
      <div className="rounded-2xl border border-neutral-200 p-6 text-sm">
        <div className="mb-2 flex items-center justify-between">
          <h2 className="font-semibold">Caja abierta</h2>
          <span className="text-xs text-neutral-500">
            {new Date(estadoMostrado.aperturaFecha).toLocaleString("es-CO")}
          </span>
        </div>
        <dl className="grid grid-cols-2 gap-y-1">
          <dt>Monto inicial</dt>
          <dd className="text-right">${estadoMostrado.aperturaMonto.toLocaleString("es-CO")}</dd>
          <dt>Abierta por</dt>
          <dd className="text-right">{estadoMostrado.aperturaUsuario ?? "—"}</dd>
        </dl>
      </div>

      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        <Tarjeta titulo="Ventas totales" valor={`$${estadoMostrado.ventasTotales.toLocaleString("es-CO")}`} />
        <Tarjeta titulo="Retiros" valor={`$${estadoMostrado.retiros.toLocaleString("es-CO")}`} />
        <Tarjeta
          titulo="Pagos a distribuidor"
          valor={`$${estadoMostrado.pagosDistribuidor.toLocaleString("es-CO")}`}
        />
        <Tarjeta titulo="Saldo esperado" valor={`$${estadoMostrado.saldoEsperado.toLocaleString("es-CO")}`} />
      </div>

      <div className="rounded-2xl border border-neutral-200 p-4 text-sm">
        <h2 className="mb-2 font-semibold">Ventas por método</h2>
        <dl className="grid grid-cols-3 gap-y-1 text-center">
          <dt className="text-xs text-neutral-500">Efectivo</dt>
          <dt className="text-xs text-neutral-500">Nequi</dt>
          <dt className="text-xs text-neutral-500">Daviplata</dt>
          <dd>${estadoMostrado.ventasEfectivo.toLocaleString("es-CO")}</dd>
          <dd>${estadoMostrado.ventasNequi.toLocaleString("es-CO")}</dd>
          <dd>${estadoMostrado.ventasDaviplata.toLocaleString("es-CO")}</dd>
        </dl>
      </div>

      <div className="rounded-2xl border border-neutral-200 p-6">
        <h2 className="mb-2 font-semibold">Retiro / pago a distribuidor</h2>
        <div className="mb-2 flex gap-2 text-sm">
          <button
            onClick={() => setTipoMovimiento("retiro")}
            className={`rounded-lg border px-3 py-1.5 ${
              tipoMovimiento === "retiro"
                ? "border-[var(--brand-600)] bg-[var(--brand-600)] text-white"
                : "border-neutral-300"
            }`}
          >
            Retiro
          </button>
          <button
            onClick={() => setTipoMovimiento("pago_distribuidor")}
            className={`rounded-lg border px-3 py-1.5 ${
              tipoMovimiento === "pago_distribuidor"
                ? "border-[var(--brand-600)] bg-[var(--brand-600)] text-white"
                : "border-neutral-300"
            }`}
          >
            Pago a distribuidor
          </button>
        </div>
        <input
          type="number"
          min={0}
          value={montoMovimiento}
          onChange={(e) => setMontoMovimiento(e.target.value)}
          placeholder="Monto"
          className="mb-2 w-full rounded-lg border border-neutral-300 px-4 py-3 text-lg"
        />
        <input
          list="motivos-sugeridos"
          value={motivoMovimiento}
          onChange={(e) => setMotivoMovimiento(e.target.value)}
          placeholder="Motivo"
          className="mb-2 w-full rounded-lg border border-neutral-300 px-4 py-3 text-lg"
        />
        <datalist id="motivos-sugeridos">
          {MOTIVOS_SUGERIDOS.map((m) => (
            <option key={m} value={m} />
          ))}
        </datalist>
        <button
          disabled={enviando}
          onClick={() => {
            const monto = Number(montoMovimiento);
            const motivo = motivoMovimiento.trim() || null;
            ejecutar(tipoMovimiento, monto, motivo, (clientRef) =>
              tipoMovimiento === "retiro"
                ? registrarRetiro(localId, monto, motivo, clientRef)
                : registrarPagoDistribuidor(localId, monto, motivo, clientRef)
            );
          }}
          className="rounded-lg border border-neutral-300 px-4 py-2 disabled:opacity-60"
        >
          {enviando ? "Registrando..." : "Registrar"}
        </button>
      </div>

      <div className="rounded-2xl border border-neutral-200 p-4">
        <h2 className="mb-2 font-semibold">Movimientos del turno</h2>
        <div className="mb-3 flex flex-wrap gap-2 text-xs">
          {TABS.map((t) => (
            <button
              key={t.valor}
              onClick={() => setTabFiltro(t.valor)}
              className={`rounded-full border px-3 py-1 ${
                tabFiltro === t.valor
                  ? "border-[var(--brand-600)] bg-[var(--brand-600)] text-white"
                  : "border-neutral-300"
              }`}
            >
              {t.etiqueta}
            </button>
          ))}
        </div>
        {bitacoraFiltrada.length === 0 && (
          <p className="text-sm text-neutral-500">Sin movimientos todavía.</p>
        )}
        <div className="flex flex-col">
          {bitacoraFiltrada.map((item, i) => {
            const esResta = item.tipo === "retiro" || item.tipo === "pago_distribuidor";
            return (
              <div
                key={i}
                className="flex items-center justify-between gap-2 border-b border-neutral-100 py-2 text-sm last:border-0"
              >
                <div className="flex flex-col">
                  <span className="font-medium">{item.descripcion}</span>
                  <span className="text-xs text-neutral-500">
                    {item.metodoOMotivo} · {item.usuario ?? "—"} ·{" "}
                    {new Date(item.fecha).toLocaleTimeString("es-CO", {
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  {item.pendiente && (
                    <span
                      className={`rounded-full px-2 py-0.5 text-xs ${
                        item.errorMsg ? "bg-red-100 text-red-800" : "bg-yellow-100 text-yellow-800"
                      }`}
                    >
                      {item.errorMsg ? "Error" : "Pendiente"}
                    </span>
                  )}
                  <span className={`w-24 text-right font-medium ${esResta ? "text-red-600" : "text-green-700"}`}>
                    {esResta ? "-" : "+"}${item.monto.toLocaleString("es-CO")}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <div className="rounded-2xl border border-neutral-200 p-6">
        <h2 className="mb-2 font-semibold">Cerrar caja</h2>
        <input
          type="number"
          min={0}
          value={montoContado}
          onChange={(e) => setMontoContado(e.target.value)}
          placeholder="Efectivo contado"
          className="mb-2 w-full rounded-lg border border-neutral-300 px-4 py-3 text-lg"
        />
        {diferencia !== null && (
          <p className={`mb-2 text-sm ${diferencia === 0 ? "text-green-700" : "text-red-600"}`}>
            {diferencia === 0
              ? "Todo cuadrado"
              : diferencia > 0
                ? `Sobran $${diferencia.toLocaleString("es-CO")}`
                : `Faltan $${Math.abs(diferencia).toLocaleString("es-CO")}`}
          </p>
        )}
        <input
          value={motivoCierre}
          onChange={(e) => setMotivoCierre(e.target.value)}
          placeholder="Motivo (opcional)"
          className="mb-2 w-full rounded-lg border border-neutral-300 px-4 py-3 text-lg"
        />
        <button
          disabled={enviando || !montoContado}
          onClick={() => {
            const monto = Number(montoContado);
            const motivo = motivoCierre.trim() || null;
            ejecutar("cierre", monto, motivo, (clientRef) =>
              cerrarCaja(localId, monto, motivo, clientRef)
            );
          }}
          className="rounded-lg bg-red-600 px-4 py-3 text-lg font-medium text-white disabled:opacity-60"
        >
          {enviando ? "Cerrando..." : "Cerrar caja"}
        </button>
      </div>

      {error && <p className="text-sm text-red-600">{error}</p>}
    </div>
  );
}
