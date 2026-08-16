"use client";

import { openDB, type DBSchema, type IDBPDatabase } from "idb";
import type { Producto } from "@/lib/productos/data";
import type { EstadoTurno } from "@/lib/caja/data";
import type { RegistrarVentaInput } from "@/lib/ventas/actions";

// Evento disparado cada vez que el cache de productos se actualiza, para
// que componentes ya montados (StockBajoBanner, el picker de VentaForm)
// se refresquen sin necesitar un remount -- mismo patrón que
// avisarActualizacion()/sync:updated del proyecto hermano.
export const EVENTO_CATALOGO_ACTUALIZADO = "catalogo:actualizado";

// Se dispara cuando la cola de ventas pendientes cambia (se encola algo
// nuevo, se sincroniza, o pasa a error) -- para que la pantalla de
// "pendiente de sincronizar" y /sincronizacion se refresquen solas.
export const EVENTO_VENTAS_PENDIENTES_ACTUALIZADO = "ventas-pendientes:actualizado";

// Mismo patrón que EVENTO_VENTAS_PENDIENTES_ACTUALIZADO, pero para la cola
// de movimientos de caja (Fase 7.4) -- CajaPanel la escucha para recalcular
// el estado optimista (calcularEstadoEfectivo, src/lib/offline/caja.ts).
export const EVENTO_CAJA_PENDIENTE_ACTUALIZADO = "caja-pendiente:actualizado";

// Se dispara cuando SyncProvider termina un ciclo completo sin errores de
// red/acceso (ver guardarUltimaSincronizacion) -- el indicador "Última
// sincronización" del dashboard lo escucha para no depender solo de su
// propio intervalo de refresco.
export const EVENTO_ULTIMA_SINCRONIZACION_ACTUALIZADA = "ultima-sincronizacion:actualizada";

type CajaSnapshotValue = {
  localId: number;
  estado: EstadoTurno;
  actualizadoEn: string;
};

export type EstadoVentaPendiente = "pendiente" | "sincronizando" | "error";

export type VentaPendiente = {
  clientRef: string;
  estado: EstadoVentaPendiente;
  input: RegistrarVentaInput;
  total: number;
  creadoEn: string;
  errorMsg: string | null;
};

export type TipoMovimientoCaja = "apertura" | "cierre" | "retiro" | "pago_distribuidor";

export type MovimientoCajaInput = {
  localId: number;
  tipo: TipoMovimientoCaja;
  monto: number;
  motivo: string | null;
};

export type EstadoMovimientoPendiente = "pendiente" | "sincronizando" | "error";

export type MovimientoPendiente = {
  clientRef: string;
  estado: EstadoMovimientoPendiente;
  input: MovimientoCajaInput;
  creadoEn: string;
  errorMsg: string | null;
};

interface OfflineDB extends DBSchema {
  productos_cache: {
    key: number;
    value: Producto;
    indexes: { by_local: number };
  };
  caja_estado_snapshot: {
    key: number;
    value: CajaSnapshotValue;
  };
  meta: {
    key: string;
    value: string;
  };
  ventas_pendientes: {
    key: string;
    value: VentaPendiente;
    indexes: { by_estado: string };
  };
  movimientos_pendientes: {
    key: string;
    value: MovimientoPendiente;
    indexes: { by_estado: string };
  };
}

let dbPromise: Promise<IDBPDatabase<OfflineDB>> | null = null;
let dbTenantId: string | null = null;

// Todos los tenants comparten el mismo origen (misma URL, sin
// subdominios -- CLAUDE.md §8), así que IndexedDB también se comparte
// por origen en un mismo navegador. Se nombra la base por tenant_id para
// que datos cacheados de un tenant no puedan colarse en la vista de otro
// en el mismo dispositivo (ej. un equipo de pruebas que pasó por varios
// tenants) -- un dispositivo real queda atado a un solo tenant tras el
// primer login, pero no cuesta nada cerrar el hueco igual.
function nombreBase(tenantId: string): string {
  return `ventas-offline-${tenantId}`;
}

function getDB(tenantId: string): Promise<IDBPDatabase<OfflineDB>> {
  if (dbPromise && dbTenantId === tenantId) return dbPromise;
  dbTenantId = tenantId;
  dbPromise = openDB<OfflineDB>(nombreBase(tenantId), 3, {
    upgrade(db) {
      if (!db.objectStoreNames.contains("productos_cache")) {
        const productos = db.createObjectStore("productos_cache", { keyPath: "id" });
        productos.createIndex("by_local", "localId");
      }
      if (!db.objectStoreNames.contains("caja_estado_snapshot")) {
        db.createObjectStore("caja_estado_snapshot", { keyPath: "localId" });
      }
      if (!db.objectStoreNames.contains("meta")) {
        db.createObjectStore("meta");
      }
      if (!db.objectStoreNames.contains("ventas_pendientes")) {
        const ventas = db.createObjectStore("ventas_pendientes", { keyPath: "clientRef" });
        ventas.createIndex("by_estado", "estado");
      }
      if (!db.objectStoreNames.contains("movimientos_pendientes")) {
        const movimientos = db.createObjectStore("movimientos_pendientes", { keyPath: "clientRef" });
        movimientos.createIndex("by_estado", "estado");
      }
    },
  });
  return dbPromise;
}

export async function guardarProductosCache(
  tenantId: string,
  productos: Producto[]
): Promise<void> {
  const db = await getDB(tenantId);
  const tx = db.transaction("productos_cache", "readwrite");
  await tx.store.clear();
  for (const p of productos) {
    // postgres.js devuelve columnas bigint como string (para no perder
    // precisión) -- Producto las tipa number, pero en runtime llegan como
    // "9"/"1"/etc. IndexedDB compara claves de índice por tipo estricto
    // (string "1" !== number 1), así que sin esta normalización
    // getAllFromIndex("by_local", <number>) devuelve vacío en silencio.
    // Se coacciona acá, una sola vez, para que el resto de la app pueda
    // seguir tratando estos campos como number sin pensarlo.
    await tx.store.put({
      ...p,
      id: Number(p.id),
      categoriaId: Number(p.categoriaId),
      localId: Number(p.localId),
    });
  }
  await tx.done;
  await db.put("meta", new Date().toISOString(), "productos_actualizado_en");
  if (typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent(EVENTO_CATALOGO_ACTUALIZADO));
  }
}

// "Última sincronización" (dashboard, ticket §punto 5): se guarda en el
// mismo store "meta" que ya usa productos_actualizado_en, bajo su propia
// clave. Representa "la última vez que SyncProvider completó un ciclo
// sin que verificarAccesoTenant fallara" -- no "la última vez que hubo
// algo nuevo que subir" (ver comentario en SyncProvider.tsx), para que
// de verdad refleje si el dispositivo está al día con el servidor.
const CLAVE_ULTIMA_SINCRONIZACION = "ultima_sincronizacion_en";

export async function guardarUltimaSincronizacion(tenantId: string): Promise<void> {
  const db = await getDB(tenantId);
  await db.put("meta", new Date().toISOString(), CLAVE_ULTIMA_SINCRONIZACION);
  if (typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent(EVENTO_ULTIMA_SINCRONIZACION_ACTUALIZADA));
  }
}

export async function obtenerUltimaSincronizacion(tenantId: string): Promise<string | undefined> {
  const db = await getDB(tenantId);
  return db.get("meta", CLAVE_ULTIMA_SINCRONIZACION);
}

export async function listarProductosCache(
  tenantId: string,
  localId?: number
): Promise<Producto[]> {
  const db = await getDB(tenantId);
  if (localId) return db.getAllFromIndex("productos_cache", "by_local", localId);
  return db.getAll("productos_cache");
}

export async function guardarCajaSnapshot(
  tenantId: string,
  localId: number,
  estado: EstadoTurno
): Promise<void> {
  const db = await getDB(tenantId);
  await db.put("caja_estado_snapshot", { localId, estado, actualizadoEn: new Date().toISOString() });
}

export async function obtenerCajaSnapshot(
  tenantId: string,
  localId: number
): Promise<CajaSnapshotValue | undefined> {
  const db = await getDB(tenantId);
  return db.get("caja_estado_snapshot", localId);
}

function avisarVentasPendientes() {
  if (typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent(EVENTO_VENTAS_PENDIENTES_ACTUALIZADO));
  }
}

export async function encolarVentaPendiente(
  tenantId: string,
  clientRef: string,
  input: RegistrarVentaInput,
  total: number
): Promise<void> {
  const db = await getDB(tenantId);
  await db.put("ventas_pendientes", {
    clientRef,
    estado: "pendiente",
    input,
    total,
    creadoEn: new Date().toISOString(),
    errorMsg: null,
  });
  avisarVentasPendientes();
}

export async function listarVentasPendientes(
  tenantId: string,
  estado?: EstadoVentaPendiente
): Promise<VentaPendiente[]> {
  const db = await getDB(tenantId);
  const todas = estado
    ? await db.getAllFromIndex("ventas_pendientes", "by_estado", estado)
    : await db.getAll("ventas_pendientes");
  return todas.sort((a, b) => a.creadoEn.localeCompare(b.creadoEn));
}

export async function marcarVentaPendienteError(
  tenantId: string,
  clientRef: string,
  errorMsg: string
): Promise<void> {
  const db = await getDB(tenantId);
  const actual = await db.get("ventas_pendientes", clientRef);
  if (!actual) return;
  await db.put("ventas_pendientes", { ...actual, estado: "error", errorMsg });
  avisarVentasPendientes();
}

export async function reintentarVentaPendiente(tenantId: string, clientRef: string): Promise<void> {
  const db = await getDB(tenantId);
  const actual = await db.get("ventas_pendientes", clientRef);
  if (!actual) return;
  await db.put("ventas_pendientes", { ...actual, estado: "pendiente", errorMsg: null });
  avisarVentasPendientes();
}

export async function eliminarVentaPendiente(tenantId: string, clientRef: string): Promise<void> {
  const db = await getDB(tenantId);
  await db.delete("ventas_pendientes", clientRef);
  avisarVentasPendientes();
}

function avisarMovimientosPendientes() {
  if (typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent(EVENTO_CAJA_PENDIENTE_ACTUALIZADO));
  }
}

export async function encolarMovimientoPendiente(
  tenantId: string,
  clientRef: string,
  input: MovimientoCajaInput
): Promise<void> {
  const db = await getDB(tenantId);
  await db.put("movimientos_pendientes", {
    clientRef,
    estado: "pendiente",
    input,
    creadoEn: new Date().toISOString(),
    errorMsg: null,
  });
  avisarMovimientosPendientes();
}

export async function listarMovimientosPendientes(
  tenantId: string,
  estado?: EstadoMovimientoPendiente
): Promise<MovimientoPendiente[]> {
  const db = await getDB(tenantId);
  const todos = estado
    ? await db.getAllFromIndex("movimientos_pendientes", "by_estado", estado)
    : await db.getAll("movimientos_pendientes");
  return todos.sort((a, b) => a.creadoEn.localeCompare(b.creadoEn));
}

export async function marcarMovimientoPendienteError(
  tenantId: string,
  clientRef: string,
  errorMsg: string
): Promise<void> {
  const db = await getDB(tenantId);
  const actual = await db.get("movimientos_pendientes", clientRef);
  if (!actual) return;
  await db.put("movimientos_pendientes", { ...actual, estado: "error", errorMsg });
  avisarMovimientosPendientes();
}

export async function reintentarMovimientoPendiente(tenantId: string, clientRef: string): Promise<void> {
  const db = await getDB(tenantId);
  const actual = await db.get("movimientos_pendientes", clientRef);
  if (!actual) return;
  await db.put("movimientos_pendientes", { ...actual, estado: "pendiente", errorMsg: null });
  avisarMovimientosPendientes();
}

export async function eliminarMovimientoPendiente(tenantId: string, clientRef: string): Promise<void> {
  const db = await getDB(tenantId);
  await db.delete("movimientos_pendientes", clientRef);
  avisarMovimientosPendientes();
}
