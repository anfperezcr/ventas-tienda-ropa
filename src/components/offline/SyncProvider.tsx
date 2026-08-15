"use client";

import { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { verificarAccesoTenant } from "@/lib/suscripciones/actions";
import { obtenerCatalogoLocal } from "@/lib/productos/actions";
import { registrarVenta } from "@/lib/ventas/actions";
import {
  abrirCaja,
  cerrarCaja,
  registrarRetiro,
  registrarPagoDistribuidor,
  type CajaActionResult,
} from "@/lib/caja/actions";
import {
  guardarProductosCache,
  listarVentasPendientes,
  marcarVentaPendienteError,
  eliminarVentaPendiente,
  listarMovimientosPendientes,
  marcarMovimientoPendienteError,
  eliminarMovimientoPendiente,
  type MovimientoCajaInput,
} from "@/lib/offline/db";

const INTERVALO_MS = 45_000;

// Drena la cola de ventas pendientes en orden cronológico. Mismo criterio
// que el proyecto hermano: un error de red detiene todo el lote (algo
// sistémico está fallando, no tiene caso seguir intentando las
// siguientes); un error de negocio (ej. stock insuficiente) solo marca
// esa venta como error para revisión manual en /sincronizacion y sigue
// con las demás -- no hay resolución automática de conflictos. Devuelve
// si sincronizó algo, para que el llamador sepa si vale la pena refrescar
// la página actual.
async function drenarVentasPendientes(tenantId: string): Promise<boolean> {
  const pendientes = await listarVentasPendientes(tenantId, "pendiente");
  let huboSync = false;
  for (const venta of pendientes) {
    try {
      const res = await registrarVenta(venta.input);
      if (res.ok) {
        await eliminarVentaPendiente(tenantId, venta.clientRef);
        huboSync = true;
      } else {
        await marcarVentaPendienteError(tenantId, venta.clientRef, res.error);
      }
    } catch {
      return huboSync; // error de red -- deja el resto pendiente, se reintenta luego
    }
  }
  return huboSync;
}

function ejecutarMovimientoCaja(
  input: MovimientoCajaInput,
  clientRef: string
): Promise<CajaActionResult> {
  switch (input.tipo) {
    case "apertura":
      return abrirCaja(input.localId, input.monto, input.motivo, clientRef);
    case "cierre":
      return cerrarCaja(input.localId, input.monto, input.motivo, clientRef);
    case "retiro":
      return registrarRetiro(input.localId, input.monto, input.motivo, clientRef);
    case "pago_distribuidor":
      return registrarPagoDistribuidor(input.localId, input.monto, input.motivo, clientRef);
  }
}

// Mismo criterio que drenarVentasPendientes: error de red detiene el
// lote, error de negocio (ej. "ya no hay turno abierto" porque se cerró
// desde otra sesión mientras este dispositivo estaba offline) marca el
// movimiento como error para revisión manual en /sincronizacion -- ese es
// el "manejo de conflictos básico" de esta fase, no hay resolución
// automática.
async function drenarMovimientosPendientes(tenantId: string): Promise<boolean> {
  const pendientes = await listarMovimientosPendientes(tenantId, "pendiente");
  let huboSync = false;
  for (const mov of pendientes) {
    try {
      const res = await ejecutarMovimientoCaja(mov.input, mov.clientRef);
      if (res.error) {
        await marcarMovimientoPendienteError(tenantId, mov.clientRef, res.error);
      } else {
        await eliminarMovimientoPendiente(tenantId, mov.clientRef);
        huboSync = true;
      }
    } catch {
      return huboSync;
    }
  }
  return huboSync;
}

// Motor de sincronización: al reconectar (evento `online`) y cada 45s
// mientras la pestaña sigue abierta, revisa que el tenant siga activo,
// refresca el cache de catálogo, y drena las ventas guardadas offline.
export function SyncProvider({ tenantId }: { tenantId: string }) {
  const router = useRouter();
  const bloqueadoRef = useRef(false);

  useEffect(() => {
    let cancelado = false;

    async function sincronizar() {
      if (bloqueadoRef.current || cancelado) return;

      // Antes de cualquier otra cosa: si el tenant fue suspendido
      // mientras el dispositivo estaba offline, no sigue refrescando ni
      // subiendo colas pendientes para un tenant bloqueado.
      let estado: Awaited<ReturnType<typeof verificarAccesoTenant>>["estado"] | null = null;
      try {
        ({ estado } = await verificarAccesoTenant());
      } catch {
        return; // sin red u otro error -- se reintenta en el próximo trigger
      }

      if (estado === "bloqueado") {
        bloqueadoRef.current = true;
        try {
          await fetch("/api/logout", { method: "POST" });
        } catch {
          // best-effort -- igual redirige
        }
        window.location.href = "/?bloqueado=1";
        return;
      }

      try {
        const productos = await obtenerCatalogoLocal();
        if (cancelado) return;
        await guardarProductosCache(tenantId, productos);
      } catch {
        // sin red o error de servidor -- se reintenta en el próximo trigger
      }

      if (cancelado) return;
      const [ventasSync, movimientosSync] = await Promise.all([
        drenarVentasPendientes(tenantId).catch(() => false),
        drenarMovimientosPendientes(tenantId).catch(() => false),
      ]);
      // Algo se sincronizó de verdad -- refresca la página actual (ej.
      // CajaPanel) para que su estado optimista se reconcilie con lo que
      // ahora es cierto en el servidor, sin esperar a la próxima
      // navegación manual.
      if (!cancelado && (ventasSync || movimientosSync)) {
        router.refresh();
      }
    }

    sincronizar();
    const onOnline = () => sincronizar();
    window.addEventListener("online", onOnline);
    const interval = setInterval(sincronizar, INTERVALO_MS);

    return () => {
      cancelado = true;
      window.removeEventListener("online", onOnline);
      clearInterval(interval);
    };
  }, [tenantId, router]);

  return null;
}
