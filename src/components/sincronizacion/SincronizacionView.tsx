"use client";

import { useEffect, useState } from "react";
import {
  listarVentasPendientes,
  reintentarVentaPendiente,
  eliminarVentaPendiente,
  EVENTO_VENTAS_PENDIENTES_ACTUALIZADO,
  listarMovimientosPendientes,
  reintentarMovimientoPendiente,
  eliminarMovimientoPendiente,
  EVENTO_CAJA_PENDIENTE_ACTUALIZADO,
  type VentaPendiente,
  type MovimientoPendiente,
  type TipoMovimientoCaja,
} from "@/lib/offline/db";

const ESTADO_LABEL: Record<VentaPendiente["estado"], string> = {
  pendiente: "Pendiente de sincronizar",
  sincronizando: "Sincronizando...",
  error: "Error — revisar",
};

const ESTADO_BADGE: Record<VentaPendiente["estado"], string> = {
  pendiente: "bg-yellow-100 text-yellow-800",
  sincronizando: "bg-blue-100 text-blue-800",
  error: "bg-red-100 text-red-800",
};

const TIPO_MOVIMIENTO_LABEL: Record<TipoMovimientoCaja, string> = {
  apertura: "Apertura de caja",
  cierre: "Cierre de caja",
  retiro: "Retiro de caja",
  pago_distribuidor: "Pago a distribuidor",
};

export function SincronizacionView({ tenantId }: { tenantId: string }) {
  const [ventas, setVentas] = useState<VentaPendiente[]>([]);
  const [movimientos, setMovimientos] = useState<MovimientoPendiente[]>([]);

  useEffect(() => {
    let cancelado = false;

    async function cargarVentas() {
      const todas = await listarVentasPendientes(tenantId);
      if (!cancelado) setVentas(todas);
    }
    async function cargarMovimientos() {
      const todos = await listarMovimientosPendientes(tenantId);
      if (!cancelado) setMovimientos(todos);
    }

    cargarVentas();
    cargarMovimientos();
    window.addEventListener(EVENTO_VENTAS_PENDIENTES_ACTUALIZADO, cargarVentas);
    window.addEventListener(EVENTO_CAJA_PENDIENTE_ACTUALIZADO, cargarMovimientos);
    return () => {
      cancelado = true;
      window.removeEventListener(EVENTO_VENTAS_PENDIENTES_ACTUALIZADO, cargarVentas);
      window.removeEventListener(EVENTO_CAJA_PENDIENTE_ACTUALIZADO, cargarMovimientos);
    };
  }, [tenantId]);

  if (ventas.length === 0 && movimientos.length === 0) {
    return (
      <p className="text-sm text-neutral-500">
        No hay ventas ni movimientos de caja pendientes o con error en este dispositivo.
      </p>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      {ventas.length > 0 && (
        <div className="flex flex-col gap-3">
          <h2 className="text-sm font-semibold text-neutral-600">Ventas</h2>
          {ventas.map((v) => (
            <div key={v.clientRef} className="rounded-xl border border-neutral-200 p-4 text-sm">
              <div className="flex items-center justify-between">
                <span className={`rounded-full px-2 py-0.5 text-xs ${ESTADO_BADGE[v.estado]}`}>
                  {ESTADO_LABEL[v.estado]}
                </span>
                <span className="font-medium">${v.total.toLocaleString("es-CO")}</span>
              </div>
              <p className="mt-1 text-neutral-500">
                Guardada: {new Date(v.creadoEn).toLocaleString("es-CO")}
              </p>
              {v.errorMsg && <p className="mt-1 text-red-600">{v.errorMsg}</p>}
              {v.estado === "error" && (
                <div className="mt-2 flex gap-2">
                  <button
                    onClick={() => reintentarVentaPendiente(tenantId, v.clientRef)}
                    className="rounded-lg border border-neutral-300 px-3 py-1.5"
                  >
                    Reintentar
                  </button>
                  <button
                    onClick={() => {
                      if (window.confirm("¿Descartar esta venta? No se va a registrar.")) {
                        eliminarVentaPendiente(tenantId, v.clientRef);
                      }
                    }}
                    className="rounded-lg border border-neutral-300 px-3 py-1.5"
                  >
                    Descartar
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {movimientos.length > 0 && (
        <div className="flex flex-col gap-3">
          <h2 className="text-sm font-semibold text-neutral-600">Movimientos de caja</h2>
          {movimientos.map((m) => (
            <div key={m.clientRef} className="rounded-xl border border-neutral-200 p-4 text-sm">
              <div className="flex items-center justify-between">
                <span className={`rounded-full px-2 py-0.5 text-xs ${ESTADO_BADGE[m.estado]}`}>
                  {ESTADO_LABEL[m.estado]}
                </span>
                <span className="font-medium">${m.input.monto.toLocaleString("es-CO")}</span>
              </div>
              <p className="mt-1 text-neutral-500">{TIPO_MOVIMIENTO_LABEL[m.input.tipo]}</p>
              <p className="mt-1 text-neutral-500">
                Guardado: {new Date(m.creadoEn).toLocaleString("es-CO")}
              </p>
              {m.errorMsg && <p className="mt-1 text-red-600">{m.errorMsg}</p>}
              {m.estado === "error" && (
                <div className="mt-2 flex gap-2">
                  <button
                    onClick={() => reintentarMovimientoPendiente(tenantId, m.clientRef)}
                    className="rounded-lg border border-neutral-300 px-3 py-1.5"
                  >
                    Reintentar
                  </button>
                  <button
                    onClick={() => {
                      if (window.confirm("¿Descartar este movimiento? No se va a registrar.")) {
                        eliminarMovimientoPendiente(tenantId, m.clientRef);
                      }
                    }}
                    className="rounded-lg border border-neutral-300 px-3 py-1.5"
                  >
                    Descartar
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
