import { METODO_LABEL } from "@/lib/caja/labels";
import type { ResumenDashboard } from "@/lib/dashboard/data";

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

function Tarjeta({ titulo, valor, delta }: { titulo: string; valor: string; delta?: Delta }) {
  return (
    <div className="rounded-xl border border-neutral-200 p-4">
      <div className="text-sm text-neutral-500">{titulo}</div>
      <div className="mt-1 text-2xl font-semibold">{valor}</div>
      {delta && <div className="mt-1">{<BadgeDelta delta={delta} />}</div>}
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

export function DashboardPanel({ resumen }: { resumen: ResumenDashboard }) {
  const deltaMonto = calcularDelta(resumen.ventasHoy.totalMonto, resumen.ventasAyer.totalMonto);
  const deltaVentas = calcularDelta(resumen.ventasHoy.totalVentas, resumen.ventasAyer.totalVentas);

  return (
    <div className="flex flex-col gap-6">
      <section>
        <h2 className="mb-3 text-sm font-semibold text-neutral-600">Resumen del día</h2>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <Tarjeta
            titulo="Ventas totales"
            valor={`$${resumen.ventasHoy.totalMonto.toLocaleString("es-CO")}`}
            delta={deltaMonto}
          />
          <Tarjeta
            titulo="Transacciones"
            valor={String(resumen.ventasHoy.totalVentas)}
            delta={deltaVentas}
          />
          <Tarjeta titulo="Clientes atendidos hoy" valor={String(resumen.clientesAtendidosHoy)} />
        </div>
      </section>

      <section>
        <h2 className="mb-3 text-sm font-semibold text-neutral-600">Ventas por método (hoy)</h2>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          {resumen.porMetodo.map((m) => (
            <Tarjeta
              key={m.metodo}
              titulo={METODO_LABEL[m.metodo] ?? m.metodo}
              valor={`$${m.monto.toLocaleString("es-CO")}`}
            />
          ))}
        </div>
      </section>

      <section className="rounded-xl border border-neutral-200 p-4">
        <h2 className="mb-3 text-sm font-semibold text-neutral-600">Ventas por hora (hoy)</h2>
        <GraficoVentasPorHora datos={resumen.ventasPorHora} />
      </section>
    </div>
  );
}
