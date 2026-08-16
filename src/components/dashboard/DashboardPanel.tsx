import Link from "next/link";
import { METODO_LABEL } from "@/lib/caja/labels";
import type { ResumenDashboard } from "@/lib/dashboard/data";
import type { SaldoCajaDashboard, ItemBitacora } from "@/lib/caja/data";
import type { VentaReciente } from "@/lib/ventas/data";
import { DonutMetodosPago, COLOR_EFECTIVO, COLOR_NEQUI, COLOR_DAVIPLATA } from "@/components/graficos/DonutMetodosPago";
import {
  IconoVender,
  IconoRecibo,
  IconoUsuarios,
  IconoCaja,
} from "./iconos";
import {
  IconoCarrito,
  IconoBillete,
  IconoUsuario,
  IconoCandadoAbierto,
  IconoBombilla,
  type IconoProps,
} from "@/components/caja/IconosCaja";
import { UltimaSincronizacion } from "./UltimaSincronizacion";

type ComponenteIcono = (p: IconoProps) => React.ReactElement;

type Delta = { tipo: "porcentaje"; valor: number } | { tipo: "nuevo" } | { tipo: "sin_cambio" };

function calcularDelta(hoy: number, ayer: number): Delta {
  if (ayer === 0) return hoy === 0 ? { tipo: "sin_cambio" } : { tipo: "nuevo" };
  return { tipo: "porcentaje", valor: ((hoy - ayer) / ayer) * 100 };
}

function BadgeDelta({ delta }: { delta: Delta }) {
  if (delta.tipo === "sin_cambio") {
    return <span className="text-xs text-neutral-400">Igual que ayer</span>;
  }
  if (delta.tipo === "nuevo") {
    return <span className="text-xs text-neutral-400">Sin datos de ayer</span>;
  }
  const positivo = delta.valor >= 0;
  return (
    <span className={`text-xs font-medium ${positivo ? "text-green-600" : "text-red-600"}`}>
      {positivo ? "▲" : "▼"} {Math.abs(delta.valor).toFixed(1)}% vs. ayer
    </span>
  );
}

// Mismo estilo de caja de ícono (fondo teñido de marca) que ya usan las
// 7 tarjetas de navegación de arriba en esta misma página -- se
// mantiene un solo acento de color en vez de uno distinto por tarjeta,
// para no romper la consistencia visual con lo que ya está construido.
function Tarjeta({
  icono: Icono,
  titulo,
  valor,
  delta,
  subtitulo,
  href,
}: {
  icono: ComponenteIcono;
  titulo: string;
  valor: string;
  delta?: Delta;
  subtitulo?: string;
  href?: string;
}) {
  return (
    <div className="flex flex-col gap-2 rounded-xl border border-neutral-200 p-4">
      <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-[var(--brand-600)]/10 text-[var(--brand-600)]">
        <Icono className="h-5 w-5" />
      </span>
      <div className="text-sm text-neutral-500">{titulo}</div>
      <div className="text-2xl font-semibold">{valor}</div>
      {delta && <BadgeDelta delta={delta} />}
      {subtitulo &&
        (href ? (
          <Link href={href} className="text-xs text-neutral-400 hover:text-[var(--brand-600)]">
            {subtitulo} →
          </Link>
        ) : (
          <p className="text-xs text-neutral-400">{subtitulo}</p>
        ))}
    </div>
  );
}

function GraficoVentasPorHora({ datos }: { datos: ResumenDashboard["ventasPorHora"] }) {
  const ANCHO = 600;
  const ALTO = 140;
  const PAD = 8;

  if (datos.every((d) => d.monto === 0)) {
    return <p className="text-sm text-neutral-500">Todavía no hay ventas hoy para graficar.</p>;
  }

  const max = Math.max(...datos.map((d) => d.monto));
  const pasoX = datos.length > 1 ? (ANCHO - PAD * 2) / (datos.length - 1) : 0;
  const coords = datos.map((d, i) => ({
    x: PAD + i * pasoX,
    y: ALTO - PAD - (d.monto / max) * (ALTO - PAD * 2),
  }));

  return (
    <>
      <svg
        viewBox={`0 0 ${ANCHO} ${ALTO}`}
        className="w-full"
        role="img"
        aria-label="Ventas por hora de hoy"
      >
        <polyline
          points={coords.map((c) => `${c.x},${c.y}`).join(" ")}
          fill="none"
          stroke="var(--brand-600)"
          strokeWidth={2}
        />
        {coords.map((c, i) => (
          <circle key={datos[i].hora} cx={c.x} cy={c.y} r={2.5} fill="var(--brand-600)" />
        ))}
      </svg>
      <div className="mt-1 flex justify-between text-xs text-neutral-400">
        <span>{datos[0].hora}:00</span>
        <span>{datos[datos.length - 1].hora}:00</span>
      </div>
    </>
  );
}

const ICONO_MOVIMIENTO: Record<string, ComponenteIcono> = {
  venta: IconoCarrito,
  apertura: IconoCandadoAbierto,
  retiro: IconoBillete,
  pago_distribuidor: IconoUsuario,
};

function FilaMovimiento({ item }: { item: ItemBitacora }) {
  const esResta = item.tipo === "retiro" || item.tipo === "pago_distribuidor";
  const Icono = ICONO_MOVIMIENTO[item.tipo] ?? IconoCarrito;
  return (
    <div className="flex items-center justify-between gap-2 border-t border-neutral-100 py-2.5 text-sm first:border-0">
      <div className="flex min-w-0 items-center gap-2.5">
        <span
          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg"
          style={{
            backgroundColor: esResta
              ? "#fee2e2"
              : "color-mix(in srgb, var(--brand-600) 12%, white)",
            color: esResta ? "#dc2626" : "var(--brand-700)",
          }}
        >
          <Icono className="h-4 w-4" />
        </span>
        <div className="min-w-0">
          <span className="block truncate font-medium">{item.descripcion}</span>
          <span className="block truncate text-xs text-neutral-500">
            {item.metodoOMotivo} · {item.usuario ?? "—"}
          </span>
        </div>
      </div>
      <div className="flex shrink-0 items-center gap-3">
        <span className="text-xs text-neutral-400">
          {new Date(item.fecha).toLocaleTimeString("es-CO", { hour: "2-digit", minute: "2-digit" })}
        </span>
        <span className={`font-medium ${esResta ? "text-red-600" : "text-green-700"}`}>
          {esResta ? "-" : "+"}${item.monto.toLocaleString("es-CO")}
        </span>
      </div>
    </div>
  );
}

export function DashboardPanel({
  resumen,
  saldoCaja,
  ultimasVentas,
  movimientosRecientes,
  consejoDelDia,
  tenantId,
  esOwner,
}: {
  resumen: ResumenDashboard;
  saldoCaja: SaldoCajaDashboard;
  ultimasVentas: VentaReciente[];
  movimientosRecientes: ItemBitacora[];
  consejoDelDia: string;
  tenantId: string;
  esOwner: boolean;
}) {
  const deltaMonto = calcularDelta(resumen.ventasHoy.totalMonto, resumen.ventasAyer.totalMonto);
  const deltaVentas = calcularDelta(resumen.ventasHoy.totalVentas, resumen.ventasAyer.totalVentas);
  const totalPorMetodo = resumen.porMetodo.reduce((acc, m) => acc + m.monto, 0);
  const pct = (monto: number) => (totalPorMetodo > 0 ? (monto / totalPorMetodo) * 100 : 0);
  const colorMetodo: Record<string, string> = {
    efectivo: COLOR_EFECTIVO,
    nequi: COLOR_NEQUI,
    daviplata: COLOR_DAVIPLATA,
  };

  return (
    <div className="flex flex-col gap-6">
      <section>
        <h2 className="mb-3 text-sm font-semibold text-neutral-600">Resumen del día</h2>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <Tarjeta
            icono={IconoVender}
            titulo="Ventas totales"
            valor={`$${resumen.ventasHoy.totalMonto.toLocaleString("es-CO")}`}
            delta={deltaMonto}
          />
          <Tarjeta
            icono={IconoRecibo}
            titulo="Transacciones"
            valor={String(resumen.ventasHoy.totalVentas)}
            delta={deltaVentas}
          />
          <Tarjeta
            icono={IconoUsuarios}
            titulo="Clientes atendidos"
            valor={String(resumen.clientesAtendidosHoy)}
          />
          <Tarjeta
            icono={IconoCaja}
            titulo="Saldo de caja"
            valor={
              saldoCaja.hayTurnosAbiertos
                ? `$${saldoCaja.monto.toLocaleString("es-CO")}`
                : "—"
            }
            subtitulo={saldoCaja.hayTurnosAbiertos ? "Efectivo en caja" : "Sin turnos abiertos"}
            href="/caja"
          />
        </div>
      </section>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <section className="rounded-xl border border-neutral-200 p-4">
          <h2 className="mb-3 text-sm font-semibold text-neutral-600">Ventas por método (hoy)</h2>
          <div className="flex items-center justify-between gap-4">
            <div className="flex flex-col gap-2">
              {resumen.porMetodo.map((m) => (
                <div key={m.metodo} className="flex items-center gap-2 text-sm">
                  <span
                    className="h-2 w-2 shrink-0 rounded-full"
                    style={{ backgroundColor: colorMetodo[m.metodo] ?? "#a3a3a3" }}
                    aria-hidden="true"
                  />
                  <span className="w-16 text-neutral-500">{METODO_LABEL[m.metodo] ?? m.metodo}</span>
                  <span className="font-medium">${m.monto.toLocaleString("es-CO")}</span>
                  <span className="text-xs text-neutral-400">{pct(m.monto).toFixed(1)}%</span>
                </div>
              ))}
            </div>
            <DonutMetodosPago
              efectivo={resumen.porMetodo.find((m) => m.metodo === "efectivo")?.monto ?? 0}
              nequi={resumen.porMetodo.find((m) => m.metodo === "nequi")?.monto ?? 0}
              daviplata={resumen.porMetodo.find((m) => m.metodo === "daviplata")?.monto ?? 0}
              className="h-20 w-20"
            />
          </div>
        </section>

        <section className="rounded-xl border border-neutral-200 p-4">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-sm font-semibold text-neutral-600">Ventas por hora (hoy)</h2>
            {/* Sin funcionalidad todavía -- mismo tratamiento "próximamente"
                que ya usan la campana/puntos/ayuda del header (ver
                dashboard/page.tsx): un selector de rango real requeriría
                que todo este panel acepte fechas arbitrarias, no solo
                "hoy". */}
            <button
              type="button"
              disabled
              title="Próximamente"
              className="cursor-not-allowed rounded-lg border border-dashed border-neutral-200 px-2 py-1 text-xs text-neutral-300"
            >
              Por hora ▾
            </button>
          </div>
          <GraficoVentasPorHora datos={resumen.ventasPorHora} />
        </section>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <section className="rounded-xl border border-neutral-200 p-4">
          <h2 className="mb-3 text-sm font-semibold text-neutral-600">Últimas ventas</h2>
          {ultimasVentas.length === 0 ? (
            <p className="text-sm text-neutral-500">Todavía no hay ventas registradas.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-xs text-neutral-400">
                    <th className="pb-2 font-normal">Venta</th>
                    <th className="pb-2 font-normal">Hora</th>
                    <th className="pb-2 font-normal">Cliente</th>
                    <th className="pb-2 font-normal">Método</th>
                    <th className="pb-2 text-right font-normal">Total</th>
                    <th className="pb-2 text-right font-normal">Estado</th>
                  </tr>
                </thead>
                <tbody>
                  {ultimasVentas.map((v) => (
                    <tr key={v.id} className="border-t border-neutral-100">
                      <td className="py-2 font-medium">#{v.idVentaPublico}</td>
                      <td className="py-2 text-neutral-500">
                        {new Date(v.fecha).toLocaleTimeString("es-CO", {
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </td>
                      <td className="py-2 text-neutral-500">{v.clienteNombre}</td>
                      <td className="py-2 text-neutral-500">{v.metodo || "—"}</td>
                      <td className="py-2 text-right font-medium">
                        ${v.total.toLocaleString("es-CO")}
                      </td>
                      <td className="py-2 text-right">
                        <span className="rounded-full bg-green-100 px-2 py-0.5 text-xs text-green-800">
                          Completada
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          {esOwner && (
            <Link
              href="/reportes"
              className="mt-3 flex w-full items-center justify-center gap-1 rounded-lg border border-neutral-200 px-4 py-2 text-sm text-neutral-600"
            >
              Ver todas las ventas →
            </Link>
          )}
        </section>

        <section className="rounded-xl border border-neutral-200 p-4">
          <div className="mb-1 flex items-center justify-between">
            <h2 className="text-sm font-semibold text-neutral-600">Movimientos recientes en caja</h2>
            <Link href="/caja" className="text-xs text-neutral-500 hover:text-[var(--brand-600)]">
              Ver todos →
            </Link>
          </div>
          {movimientosRecientes.length === 0 ? (
            <p className="text-sm text-neutral-500">Todavía no hay movimientos hoy.</p>
          ) : (
            <div className="flex flex-col">
              {movimientosRecientes.map((item, i) => (
                <FilaMovimiento key={i} item={item} />
              ))}
            </div>
          )}
        </section>
      </div>

      <div className="flex flex-col gap-3 rounded-xl border border-neutral-200 bg-neutral-50 p-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-start gap-3">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-amber-50 text-amber-600">
            <IconoBombilla className="h-5 w-5" />
          </span>
          <div>
            <p className="text-sm font-medium">Consejo del día</p>
            <p className="text-sm text-neutral-500">{consejoDelDia}</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <UltimaSincronizacion tenantId={tenantId} />
          {/* Sin funcionalidad todavía -- SyncProvider sincroniza solo
              (evento 'online' + cada 45s), no hay un disparador manual
              expuesto. Mismo tratamiento "próximamente" que el resto del
              header. */}
          <button
            type="button"
            disabled
            title="Próximamente"
            className="cursor-not-allowed rounded-lg border border-dashed border-neutral-300 px-3 py-1.5 text-xs text-neutral-400"
          >
            Sincronizar ahora
          </button>
        </div>
      </div>
    </div>
  );
}
