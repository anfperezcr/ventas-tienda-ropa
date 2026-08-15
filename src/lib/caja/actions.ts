"use server";

import type postgres from "postgres";
import { revalidatePath } from "next/cache";
import { withTenant } from "@/lib/db/tenant";
import { requireTenantSession, assertLocalPermitido } from "@/lib/auth/guards";
import { obtenerEstadoTurnoTx } from "./data";

export type CajaActionResult = { error: string | null };

// Serializa cualquier operación de caja sobre el mismo local -- sin esto,
// dos requests casi simultáneas podrían leer "cerrado" antes de que
// cualquiera de las dos inserte su apertura, y las dos pasarían. Se
// libera solo al terminar la transacción (commit o rollback), no hace
// falta un unlock explícito. Mismo espíritu que el "for update" que ya
// usa registrar_venta sobre productos, pero acá hace falta un lock
// explícito porque el ciclo es leer el estado derivado -> decidir ->
// insertar, no una sola fila que un "for update" pueda proteger sola.
async function bloquearLocal(
  tx: postgres.TransactionSql,
  tenantId: string,
  localId: number
) {
  await tx`select pg_advisory_xact_lock(hashtextextended(${tenantId + ":" + localId}, 0))`;
}

// Idempotencia (Fase 7.4): a diferencia de registrar_venta (función RPC,
// chequeo en SQL), estos son inserts planos en código de aplicación --
// antes de tomar el lock, si ya existe un movimiento con este client_ref
// (ej. un reintento de sincronización cuya respuesta anterior se perdió)
// se retorna éxito sin volver a insertar. Ya scoped por RLS al tenant en
// sesión (no security definer), no hace falta repetir tenant_id a mano.
async function yaRegistrado(tx: postgres.TransactionSql, clientRef: string | null): Promise<boolean> {
  if (!clientRef) return false;
  const [existente] = await tx<{ id: number }[]>`
    select id from movimientos_caja where client_ref = ${clientRef}
  `;
  return !!existente;
}

export async function abrirCaja(
  localId: number,
  montoInicial: number,
  motivo: string | null,
  clientRef: string | null
): Promise<CajaActionResult> {
  const session = await requireTenantSession();
  assertLocalPermitido(session, localId);

  if (!Number.isInteger(montoInicial) || montoInicial < 0) {
    return { error: "El monto inicial debe ser un entero mayor o igual a 0" };
  }

  try {
    await withTenant(session.tenantId!, async (tx) => {
      if (await yaRegistrado(tx, clientRef)) return;

      await bloquearLocal(tx, session.tenantId!, localId);

      const estado = await obtenerEstadoTurnoTx(tx, localId);
      if (estado.abierto) {
        throw new Error("Ya hay un turno abierto en este local");
      }

      await tx`
        insert into movimientos_caja (tenant_id, local_id, tipo, monto, motivo, usuario_id, client_ref)
        values (${session.tenantId}, ${localId}, 'apertura', ${montoInicial}, ${motivo}, ${session.usuarioId}, ${clientRef})
      `;
    });
  } catch (err) {
    return { error: err instanceof Error ? err.message : "No se pudo abrir la caja" };
  }

  revalidatePath("/caja");
  return { error: null };
}

export async function cerrarCaja(
  localId: number,
  montoContado: number,
  motivo: string | null,
  clientRef: string | null
): Promise<CajaActionResult> {
  const session = await requireTenantSession();
  assertLocalPermitido(session, localId);

  if (!Number.isInteger(montoContado) || montoContado < 0) {
    return { error: "El monto contado debe ser un entero mayor o igual a 0" };
  }

  try {
    await withTenant(session.tenantId!, async (tx) => {
      if (await yaRegistrado(tx, clientRef)) return;

      await bloquearLocal(tx, session.tenantId!, localId);

      const estado = await obtenerEstadoTurnoTx(tx, localId);
      if (!estado.abierto) {
        throw new Error("No hay un turno abierto en este local");
      }

      await tx`
        insert into movimientos_caja (tenant_id, local_id, tipo, monto, motivo, usuario_id, client_ref)
        values (${session.tenantId}, ${localId}, 'cierre', ${montoContado}, ${motivo}, ${session.usuarioId}, ${clientRef})
      `;
    });
  } catch (err) {
    return { error: err instanceof Error ? err.message : "No se pudo cerrar la caja" };
  }

  revalidatePath("/caja");
  return { error: null };
}

async function registrarMovimiento(
  tipo: "retiro" | "pago_distribuidor",
  localId: number,
  monto: number,
  motivo: string | null,
  clientRef: string | null
): Promise<CajaActionResult> {
  const session = await requireTenantSession();
  assertLocalPermitido(session, localId);

  if (!Number.isInteger(monto) || monto <= 0) {
    return { error: "El monto debe ser un entero mayor a 0" };
  }
  if (!motivo?.trim()) {
    return { error: "El motivo es obligatorio" };
  }

  try {
    await withTenant(session.tenantId!, async (tx) => {
      if (await yaRegistrado(tx, clientRef)) return;

      await bloquearLocal(tx, session.tenantId!, localId);

      const estado = await obtenerEstadoTurnoTx(tx, localId);
      if (!estado.abierto) {
        throw new Error("No hay un turno abierto en este local");
      }
      if (monto > estado.saldoEsperado) {
        throw new Error("El monto supera el saldo esperado en caja");
      }

      await tx`
        insert into movimientos_caja (tenant_id, local_id, tipo, monto, motivo, usuario_id, client_ref)
        values (${session.tenantId}, ${localId}, ${tipo}, ${monto}, ${motivo}, ${session.usuarioId}, ${clientRef})
      `;
    });
  } catch (err) {
    return { error: err instanceof Error ? err.message : "No se pudo registrar el movimiento" };
  }

  revalidatePath("/caja");
  return { error: null };
}

export async function registrarRetiro(
  localId: number,
  monto: number,
  motivo: string | null,
  clientRef: string | null
): Promise<CajaActionResult> {
  return registrarMovimiento("retiro", localId, monto, motivo, clientRef);
}

export async function registrarPagoDistribuidor(
  localId: number,
  monto: number,
  motivo: string | null,
  clientRef: string | null
): Promise<CajaActionResult> {
  return registrarMovimiento("pago_distribuidor", localId, monto, motivo, clientRef);
}
