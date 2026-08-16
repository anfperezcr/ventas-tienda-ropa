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
import { soloDigitos } from "@/lib/soloDigitos";
import { generarCsv, descargarCsv } from "@/lib/csv";
import {
  IconoTarjeta,
  IconoCarrito,
  IconoBillete,
  IconoUsuario,
  IconoMoneda,
  IconoCandadoAbierto,
  IconoCandado,
  IconoDescarga,
  IconoFlechaArriba,
  IconoBombilla,
  type IconoProps,
} from "./IconosCaja";

const TABS = [
  { valor: "todos", etiqueta: "Todos" },
  { valor: "venta", etiqueta: "Ventas" },
  { valor: "retiro", etiqueta: "Retiros" },
  { valor: "pago_distribuidor", etiqueta: "Pagos a distribuidor" },
] as const;

type ComponenteIcono = (p: IconoProps) => React.ReactElement;

const ICONO_TIPO: Record<string, ComponenteIcono> = {
  venta: IconoCarrito,
  apertura: IconoCandadoAbierto,
  cierre: IconoCandado,
  retiro: IconoBillete,
  pago_distribuidor: IconoUsuario,
};

const MOSTRAR_INICIAL = 5;
const COLOR_EFECTIVO = "var(--brand-600)";
const COLOR_NEQUI = "#7C3AED";
const COLOR_DAVIPLATA = "#F97316";

// Todos los emoji nativos de la vista anterior se reemplazaron por
// IconosCaja.tsx (SVG monocromo, stroke=currentColor) -- los emoji
// renderizan a todo color según el set tipográfico del sistema
// operativo, lo que se veía "demasiado colorido" comparado con el
// mockup de referencia (íconos de línea planos).
type Tono = "marca" | "neutro" | "ingreso" | "egreso";

const TONOS: Record<Tono, { bg: string; color: string }> = {
  marca: { bg: "var(--brand-600)", color: "white" },
  neutro: { bg: "#f5f5f5", color: "#525252" },
  ingreso: { bg: "color-mix(in srgb, var(--brand-600) 12%, white)", color: "var(--brand-700)" },
  egreso: { bg: "#fee2e2", color: "#dc2626" },
};

function IconoBox({
  icono: Icono,
  tono = "neutro",
  className = "h-10 w-10",
  iconoClassName = "h-5 w-5",
}: {
  icono: ComponenteIcono;
  tono?: Tono;
  className?: string;
  iconoClassName?: string;
}) {
  const t = TONOS[tono];
  return (
    <div
      className={`flex shrink-0 items-center justify-center rounded-xl ${className}`}
      style={{ backgroundColor: t.bg, color: t.color }}
    >
      <Icono className={iconoClassName} />
    </div>
  );
}

function Tarjeta({
  icono,
  titulo,
  valor,
  subtitulo,
}: {
  icono: ComponenteIcono;
  titulo: string;
  valor: string;
  subtitulo: string;
}) {
  return (
    <div className="flex flex-col gap-2 rounded-xl border border-neutral-200 p-4">
      <IconoBox icono={icono} tono="neutro" className="h-9 w-9" iconoClassName="h-5 w-5" />
      <div className="text-xs text-neutral-500">{titulo}</div>
      <div className="text-lg font-semibold">{valor}</div>
      <div className="text-xs text-neutral-400">{subtitulo}</div>
    </div>
  );
}

function DonutVentasPorMetodo({
  efectivo,
  nequi,
  daviplata,
}: {
  efectivo: number;
  nequi: number;
  daviplata: number;
}) {
  const total = efectivo + nequi + daviplata;
  const R = 40;
  const C = 2 * Math.PI * R;

  const segmentos =
    total === 0
      ? []
      : [
          { color: COLOR_EFECTIVO, valor: efectivo },
          { color: COLOR_NEQUI, valor: nequi },
          { color: COLOR_DAVIPLATA, valor: daviplata },
        ].filter((s) => s.valor > 0);

  let acumulado = 0;

  return (
    <svg viewBox="0 0 100 100" className="h-24 w-24 shrink-0 -rotate-90" role="img" aria-label="Ventas por método">
      <circle cx="50" cy="50" r={R} fill="none" stroke="var(--brand-100, #e5e7eb)" strokeWidth="12" />
      {segmentos.map((s, i) => {
        const frac = s.valor / total;
        const largo = frac * C;
        const offset = -((acumulado / total) * C);
        acumulado += s.valor;
        return (
          <circle
            key={i}
            cx="50"
            cy="50"
            r={R}
            fill="none"
            stroke={s.color}
            strokeWidth="12"
            strokeDasharray={`${largo} ${C - largo}`}
            strokeDashoffset={offset}
          />
        );
      })}
    </svg>
  );
}

export function CajaPanel({
  tenantId,
  localId,
  nombreLocal,
  estado,
  movimientos,
}: {
  tenantId: string;
  localId: number;
  nombreLocal: string;
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
  const [verTodos, setVerTodos] = useState(false);

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
        <div className="mb-1 flex items-center gap-3">
          <IconoBox icono={IconoCandadoAbierto} tono="ingreso" />
          <h2 className="font-semibold">Abrir caja</h2>
        </div>
        <label className="flex flex-col gap-1 text-sm">
          Monto inicial
          <input
            type="text"
            inputMode="numeric"
            data-teclado-moneda="true"
            value={montoInicial}
            onChange={(e) => setMontoInicial(soloDigitos(e.target.value))}
            className="rounded-lg border border-neutral-300 px-4 py-3 text-lg"
          />
        </label>
        <label className="flex flex-col gap-1 text-sm">
          Motivo (opcional)
          <input
            type="text"
            inputMode="text"
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
  const bitacoraMostrada = verTodos ? bitacoraFiltrada : bitacoraFiltrada.slice(0, MOSTRAR_INICIAL);

  const totalVentas = estadoMostrado.ventasTotales;
  const pct = (monto: number) => (totalVentas > 0 ? (monto / totalVentas) * 100 : 0);

  function exportarCsv() {
    const filas = bitacoraFiltrada.map((item) => {
      const fecha = new Date(item.fecha);
      const esResta = item.tipo === "retiro" || item.tipo === "pago_distribuidor";
      return [
        fecha.toLocaleDateString("es-CO"),
        fecha.toLocaleTimeString("es-CO"),
        item.descripcion,
        item.metodoOMotivo,
        item.usuario ?? "—",
        `${esResta ? "-" : "+"}${item.monto}`,
      ];
    });
    const csv = generarCsv(
      ["Fecha", "Hora", "Descripción", "Método / Motivo", "Usuario", "Monto"],
      filas
    );
    const fechaArchivo = new Date().toISOString().slice(0, 10);
    descargarCsv(`movimientos-caja-${fechaArchivo}.csv`, csv);
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="rounded-2xl border border-neutral-200 p-6 text-sm">
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-center gap-3">
            <IconoBox icono={IconoTarjeta} tono="marca" className="h-12 w-12" iconoClassName="h-6 w-6" />
            <div>
              <h2 className="font-semibold">Caja abierta</h2>
              <p className="flex items-center gap-1.5 text-xs text-neutral-500">
                <span className="h-1.5 w-1.5 rounded-full bg-[var(--brand-600)]" aria-hidden="true" />
                Abierta por {estadoMostrado.aperturaUsuario ?? "—"}
              </p>
            </div>
          </div>
          <div className="text-right text-xs text-neutral-500">
            <div>{new Date(estadoMostrado.aperturaFecha).toLocaleString("es-CO")}</div>
            <div>
              Caja: <span className="font-medium text-neutral-700">{nombreLocal}</span>
            </div>
          </div>
        </div>
        <dl className="mt-4 grid grid-cols-2 gap-y-1">
          <dt className="text-neutral-500">Monto inicial</dt>
          <dd className="text-right font-medium">${estadoMostrado.aperturaMonto.toLocaleString("es-CO")}</dd>
        </dl>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Tarjeta
          icono={IconoCarrito}
          titulo="Ventas totales"
          valor={`$${estadoMostrado.ventasTotales.toLocaleString("es-CO")}`}
          subtitulo="En este turno"
        />
        <Tarjeta
          icono={IconoBillete}
          titulo="Retiros"
          valor={`$${estadoMostrado.retiros.toLocaleString("es-CO")}`}
          subtitulo="Total retirado"
        />
        <Tarjeta
          icono={IconoUsuario}
          titulo="Pagos a distribuidor"
          valor={`$${estadoMostrado.pagosDistribuidor.toLocaleString("es-CO")}`}
          subtitulo="Total pagado"
        />
        <Tarjeta
          icono={IconoMoneda}
          titulo="Saldo esperado"
          valor={`$${estadoMostrado.saldoEsperado.toLocaleString("es-CO")}`}
          subtitulo="Efectivo en caja"
        />
      </div>

      <div className="rounded-2xl border border-neutral-200 p-4 text-sm">
        <h2 className="mb-3 font-semibold">Ventas por método de pago</h2>
        <div className="flex items-center justify-between gap-4">
          <div className="grid flex-1 grid-cols-3 gap-3">
            <div>
              <p className="flex items-center gap-1.5 text-xs text-neutral-500">
                <span className="h-2 w-2 rounded-full" style={{ backgroundColor: COLOR_EFECTIVO }} aria-hidden="true" />
                Efectivo
              </p>
              <p className="mt-1 font-semibold">${estadoMostrado.ventasEfectivo.toLocaleString("es-CO")}</p>
              <p className="text-xs text-neutral-400">{pct(estadoMostrado.ventasEfectivo).toFixed(1)}%</p>
            </div>
            <div>
              <p className="flex items-center gap-1.5 text-xs text-neutral-500">
                <span className="h-2 w-2 rounded-full" style={{ backgroundColor: COLOR_NEQUI }} aria-hidden="true" />
                Nequi
              </p>
              <p className="mt-1 font-semibold">${estadoMostrado.ventasNequi.toLocaleString("es-CO")}</p>
              <p className="text-xs text-neutral-400">{pct(estadoMostrado.ventasNequi).toFixed(1)}%</p>
            </div>
            <div>
              <p className="flex items-center gap-1.5 text-xs text-neutral-500">
                <span className="h-2 w-2 rounded-full" style={{ backgroundColor: COLOR_DAVIPLATA }} aria-hidden="true" />
                Daviplata
              </p>
              <p className="mt-1 font-semibold">${estadoMostrado.ventasDaviplata.toLocaleString("es-CO")}</p>
              <p className="text-xs text-neutral-400">{pct(estadoMostrado.ventasDaviplata).toFixed(1)}%</p>
            </div>
          </div>
          <DonutVentasPorMetodo
            efectivo={estadoMostrado.ventasEfectivo}
            nequi={estadoMostrado.ventasNequi}
            daviplata={estadoMostrado.ventasDaviplata}
          />
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <div className="rounded-2xl border border-neutral-200 p-6">
          <h2 className="mb-3 font-semibold">Retiro / pago a distribuidor</h2>
          <div className="mb-3 flex gap-2 text-sm">
            <button
              onClick={() => setTipoMovimiento("retiro")}
              className={`flex flex-1 items-center justify-center gap-1.5 rounded-lg border px-3 py-2 ${
                tipoMovimiento === "retiro"
                  ? "border-[var(--brand-600)] bg-[var(--brand-600)] text-white"
                  : "border-neutral-300"
              }`}
            >
              <IconoFlechaArriba className="h-4 w-4" />
              Retiro
            </button>
            <button
              onClick={() => setTipoMovimiento("pago_distribuidor")}
              className={`flex flex-1 items-center justify-center gap-1.5 rounded-lg border px-3 py-2 ${
                tipoMovimiento === "pago_distribuidor"
                  ? "border-[var(--brand-600)] bg-[var(--brand-600)] text-white"
                  : "border-neutral-300"
              }`}
            >
              <IconoUsuario className="h-4 w-4" />
              Pago a distribuidor
            </button>
          </div>
          <label className="mb-3 flex flex-col gap-1 text-sm">
            Monto
            <div className="flex items-center rounded-lg border border-neutral-300 px-4 py-3 text-lg">
              <span className="mr-1 text-neutral-400">$</span>
              <input
                type="text"
                inputMode="numeric"
                data-teclado-moneda="true"
                value={montoMovimiento}
                onChange={(e) => setMontoMovimiento(soloDigitos(e.target.value))}
                placeholder="0"
                className="w-full outline-none"
              />
            </div>
          </label>
          <label className="mb-3 flex flex-col gap-1 text-sm">
            Motivo (opcional)
            <textarea
              inputMode="text"
              value={motivoMovimiento}
              onChange={(e) => setMotivoMovimiento(e.target.value.slice(0, 200))}
              maxLength={200}
              rows={3}
              placeholder="Ej: Gastos varios, compra de mercadería, transporte..."
              className="rounded-lg border border-neutral-300 px-4 py-3 text-lg"
            />
            <span className="self-end text-xs text-neutral-400">{motivoMovimiento.length}/200</span>
          </label>
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
            className="w-full rounded-lg bg-[var(--brand-600)] px-4 py-3 font-medium text-white disabled:opacity-60"
          >
            {enviando ? "Registrando..." : "+ Registrar movimiento"}
          </button>
        </div>

        <div className="rounded-2xl border border-neutral-200 p-4">
          <div className="mb-2 flex items-center justify-between">
            <h2 className="font-semibold">Movimientos del turno</h2>
            <button
              onClick={exportarCsv}
              disabled={bitacoraFiltrada.length === 0}
              className="flex items-center gap-1.5 rounded-lg border border-neutral-300 px-3 py-1.5 text-xs disabled:opacity-40"
            >
              <IconoDescarga className="h-3.5 w-3.5" />
              Exportar
            </button>
          </div>
          <div className="mb-3 flex flex-wrap gap-2 text-xs">
            {TABS.map((t) => (
              <button
                key={t.valor}
                onClick={() => {
                  setTabFiltro(t.valor);
                  setVerTodos(false);
                }}
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
            {bitacoraMostrada.map((item, i) => {
              const esResta = item.tipo === "retiro" || item.tipo === "pago_distribuidor";
              return (
                <div
                  key={i}
                  className="flex items-center justify-between gap-2 border-b border-neutral-100 py-2 text-sm last:border-0"
                >
                  <div className="flex min-w-0 items-center gap-2">
                    <IconoBox
                      icono={ICONO_TIPO[item.tipo] ?? IconoTarjeta}
                      tono={esResta ? "egreso" : "ingreso"}
                      className="h-9 w-9 shrink-0"
                      iconoClassName="h-4 w-4"
                    />
                    <div className="min-w-0">
                      <span className="block truncate font-medium">{item.descripcion}</span>
                      <span className="block truncate text-xs text-neutral-500">
                        {item.metodoOMotivo} · {item.usuario ?? "—"} ·{" "}
                        {new Date(item.fecha).toLocaleTimeString("es-CO", {
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </span>
                    </div>
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
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
          {bitacoraFiltrada.length > MOSTRAR_INICIAL && (
            <button
              onClick={() => setVerTodos((v) => !v)}
              className="mt-3 flex w-full items-center justify-center gap-1 rounded-lg border border-neutral-200 px-4 py-2 text-sm text-neutral-600"
            >
              {verTodos
                ? "Mostrar menos"
                : `Ver todos los movimientos (${bitacoraFiltrada.length}) ›`}
            </button>
          )}
        </div>
      </div>

      <div className="rounded-2xl border border-neutral-200 p-6">
        <h2 className="mb-1 font-semibold">Cerrar caja</h2>
        <p className="mb-3 text-sm text-neutral-500">
          Verifica el efectivo contado y registra el motivo de cierre.
        </p>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <label className="flex flex-col gap-1 text-sm">
            Efectivo contado
            <div className="flex items-center rounded-lg border border-neutral-300 px-4 py-3 text-lg">
              <span className="mr-1 text-neutral-400">$</span>
              <input
                type="text"
                inputMode="numeric"
                data-teclado-moneda="true"
                value={montoContado}
                onChange={(e) => setMontoContado(soloDigitos(e.target.value))}
                placeholder="0"
                className="w-full outline-none"
              />
            </div>
          </label>
          <label className="flex flex-col gap-1 text-sm">
            Motivo (opcional)
            <input
              type="text"
              inputMode="text"
              value={motivoCierre}
              onChange={(e) => setMotivoCierre(e.target.value)}
              placeholder="Ej: Fin de turno, cierre de jornada, cambio de turno..."
              className="rounded-lg border border-neutral-300 px-4 py-3 text-lg"
            />
          </label>
        </div>
        {diferencia !== null && (
          <p className={`mt-2 text-sm ${diferencia === 0 ? "text-green-700" : "text-red-600"}`}>
            {diferencia === 0
              ? "Todo cuadrado"
              : diferencia > 0
                ? `Sobran $${diferencia.toLocaleString("es-CO")}`
                : `Faltan $${Math.abs(diferencia).toLocaleString("es-CO")}`}
          </p>
        )}
        <div className="mt-4 flex gap-2">
          <button
            disabled={enviando || !montoContado}
            onClick={() => {
              const monto = Number(montoContado);
              const motivo = motivoCierre.trim() || null;
              ejecutar("cierre", monto, motivo, (clientRef) =>
                cerrarCaja(localId, monto, motivo, clientRef)
              );
            }}
            className="flex flex-1 items-center justify-center gap-2 rounded-lg bg-red-600 px-4 py-3 text-lg font-medium text-white disabled:opacity-60"
          >
            <IconoCandado className="h-5 w-5" />
            {enviando ? "Cerrando..." : "Cerrar caja"}
          </button>
          <button
            type="button"
            onClick={() => {
              setMontoContado("");
              setMotivoCierre("");
            }}
            className="rounded-lg border border-neutral-300 px-4 py-3 text-lg font-medium"
          >
            Cancelar
          </button>
        </div>
      </div>

      {error && <p className="text-sm text-red-600">{error}</p>}

      <div className="flex items-center gap-4 rounded-2xl border border-neutral-200 bg-neutral-50 p-4 text-sm">
        <IconoBox icono={IconoBombilla} tono="neutro" className="h-10 w-10" iconoClassName="h-5 w-5" />
        <div>
          <p className="font-medium">Consejo</p>
          <p className="text-neutral-500">
            Cuenta el efectivo, digita el monto exacto y cierra la caja para mantener tu control al
            día.
          </p>
        </div>
      </div>
    </div>
  );
}
