"use client";

import { useState } from "react";
import type { TenantConEstado } from "@/lib/tenants/data";
import type { EstadoAcceso } from "@/lib/suscripciones/estado";
import { alternarActivoTenant } from "@/lib/tenants/actions";
import { marcarPagoRecibido } from "@/lib/suscripciones/actions";

// Relabeleo puro sobre los mismos 3 estados de calcularEstadoAcceso --
// "Bloqueado" pasa a "Suspendido" para calzar con el resto del texto de
// este panel (Activar/Suspender ya usan esa palabra).
const ESTADO_LABEL: Record<EstadoAcceso, string> = {
  ok: "Al día",
  gracia: "En gracia",
  bloqueado: "Suspendido",
};

const ESTADO_BADGE: Record<EstadoAcceso, string> = {
  ok: "bg-green-100 text-green-800",
  gracia: "bg-amber-100 text-amber-800",
  bloqueado: "bg-red-100 text-red-800",
};

function formatVencimiento(fechaVencimiento: string | null): string {
  if (!fechaVencimiento) return "sin suscripción";
  const msPorDia = 24 * 60 * 60 * 1000;
  const dias = Math.round((new Date(fechaVencimiento).getTime() - Date.now()) / msPorDia);
  if (dias === 0) return "vence hoy";
  if (dias > 0) return `vence en ${dias}d`;
  return `venció hace ${Math.abs(dias)}d`;
}

function Tarjeta({ titulo, valor, subtitulo }: { titulo: string; valor: number | string; subtitulo?: string }) {
  return (
    <div className="rounded-xl border border-neutral-200 p-3">
      <div className="text-xs text-neutral-500">{titulo}</div>
      <div className="text-xl font-semibold">{valor}</div>
      {subtitulo && <div className="text-xs text-neutral-400">{subtitulo}</div>}
    </div>
  );
}

export function PanelTenants({ tenants }: { tenants: TenantConEstado[] }) {
  const [busqueda, setBusqueda] = useState("");
  const [estadoFiltro, setEstadoFiltro] = useState<"todos" | EstadoAcceso>("todos");

  const tenantsActivos = tenants.filter((t) => t.activo).length;
  const ingresoProyectado = tenants
    .filter((t) => t.activo && t.suscripcionEstado === "activo")
    .reduce((sum, t) => sum + (t.monto ?? 0), 0);
  const enGracia = tenants.filter((t) => t.estadoAcceso === "gracia").length;
  const suspendidos = tenants.filter((t) => t.estadoAcceso === "bloqueado").length;
  const usuariosActivos = tenants.reduce((sum, t) => sum + t.usuariosCount, 0);

  const tenantsFiltrados = tenants.filter((t) => {
    const q = busqueda.trim().toLowerCase();
    return (
      (q === "" ||
        t.nombreNegocio.toLowerCase().includes(q) ||
        t.slug.toLowerCase().includes(q)) &&
      (estadoFiltro === "todos" || t.estadoAcceso === estadoFiltro)
    );
  });

  return (
    <div className="flex flex-col gap-4">
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-5">
        <Tarjeta titulo="Tenants activos" valor={tenantsActivos} subtitulo={`de ${tenants.length} registrados`} />
        <Tarjeta titulo="Ingreso proyectado" valor={`$${ingresoProyectado.toLocaleString("es-CO")}`} subtitulo="por mes" />
        <Tarjeta titulo="En gracia" valor={enGracia} />
        <Tarjeta titulo="Suspendidos" valor={suspendidos} />
        <Tarjeta titulo="Usuarios activos" valor={usuariosActivos} />
      </div>

      <div className="flex flex-col gap-2 sm:flex-row">
        <input
          value={busqueda}
          onChange={(e) => setBusqueda(e.target.value)}
          placeholder="Buscar por nombre o slug"
          className="flex-1 rounded-lg border border-neutral-300 px-4 py-3 text-lg"
        />
        <select
          value={estadoFiltro}
          onChange={(e) => setEstadoFiltro(e.target.value as "todos" | EstadoAcceso)}
          className="rounded-lg border border-neutral-300 px-3 py-2"
        >
          <option value="todos">Todos los estados</option>
          <option value="ok">Al día</option>
          <option value="gracia">En gracia</option>
          <option value="bloqueado">Suspendido</option>
        </select>
      </div>

      {tenantsFiltrados.length === 0 && (
        <p className="text-sm text-neutral-500">
          {tenants.length === 0 ? "Todavía no hay tenants." : "No se encontraron tenants con ese filtro."}
        </p>
      )}

      <div className="flex flex-col gap-3">
        {tenantsFiltrados.map((tenant) => (
          <div
            key={tenant.id}
            className="flex flex-col gap-3 rounded-xl border border-neutral-200 p-4 sm:flex-row sm:items-center sm:justify-between"
          >
            <div>
              <div className="font-medium">{tenant.nombreNegocio}</div>
              <div className="text-xs text-neutral-500">/login/{tenant.slug}</div>
              <div className="mt-1 flex flex-wrap items-center gap-2 text-xs">
                <span className={`rounded-full px-2 py-0.5 ${ESTADO_BADGE[tenant.estadoAcceso]}`}>
                  {ESTADO_LABEL[tenant.estadoAcceso]} · {formatVencimiento(tenant.fechaVencimiento)}
                </span>
                {tenant.monto !== null && (
                  <span className="text-neutral-500">${tenant.monto.toLocaleString("es-CO")}/mes</span>
                )}
                <span className="text-neutral-500">{tenant.usuariosCount} usuarios</span>
              </div>
            </div>
            <div className="flex gap-2">
              <form action={alternarActivoTenant.bind(null, tenant.id)}>
                <button type="submit" className="rounded-lg border border-neutral-300 px-3 py-2 text-sm">
                  {tenant.activo ? "Suspender" : "Activar"}
                </button>
              </form>
              <form action={marcarPagoRecibido.bind(null, tenant.id)}>
                <button type="submit" className="rounded-lg border border-neutral-300 px-3 py-2 text-sm">
                  Marcar pago
                </button>
              </form>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
