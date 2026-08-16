"use client";

import { useEffect, useState } from "react";
import {
  obtenerUltimaSincronizacion,
  EVENTO_ULTIMA_SINCRONIZACION_ACTUALIZADA,
} from "@/lib/offline/db";

function formatoRelativo(iso: string): string {
  const segundos = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (segundos < 10) return "hace instantes";
  if (segundos < 60) return `hace ${segundos} seg`;
  const minutos = Math.floor(segundos / 60);
  if (minutos < 60) return `hace ${minutos} min`;
  const horas = Math.floor(minutos / 60);
  if (horas < 24) return `hace ${horas} h`;
  const dias = Math.floor(horas / 24);
  return `hace ${dias} d`;
}

// Lee el timestamp real guardado por SyncProvider en IndexedDB (ver
// guardarUltimaSincronizacion) -- no es un texto de ejemplo. Se
// actualiza sola cuando termina un ciclo de sync (evento) y además cada
// 30s por si acaso, para que el "hace X" siga avanzando aunque no pase
// nada nuevo.
export function UltimaSincronizacion({ tenantId }: { tenantId: string }) {
  const [ultimaIso, setUltimaIso] = useState<string | null | undefined>(undefined);

  useEffect(() => {
    let cancelado = false;

    async function refrescar() {
      const valor = await obtenerUltimaSincronizacion(tenantId);
      if (!cancelado) setUltimaIso(valor ?? null);
    }

    refrescar();
    window.addEventListener(EVENTO_ULTIMA_SINCRONIZACION_ACTUALIZADA, refrescar);
    const interval = setInterval(refrescar, 30_000);
    return () => {
      cancelado = true;
      window.removeEventListener(EVENTO_ULTIMA_SINCRONIZACION_ACTUALIZADA, refrescar);
      clearInterval(interval);
    };
  }, [tenantId]);

  if (ultimaIso === undefined) return null;

  return (
    <span className="flex items-center gap-1.5 text-xs text-neutral-500">
      <span
        className={`h-1.5 w-1.5 rounded-full ${ultimaIso ? "bg-[var(--brand-600)]" : "bg-neutral-300"}`}
        aria-hidden="true"
      />
      {ultimaIso ? `Última sincronización: ${formatoRelativo(ultimaIso)}` : "Todavía no se ha sincronizado"}
    </span>
  );
}
