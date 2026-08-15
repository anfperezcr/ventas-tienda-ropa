"use server";

import { revalidatePath } from "next/cache";
import { withPlatform } from "@/lib/db/platform";
import { requireSuperAdmin, requireTenantSession } from "@/lib/auth/guards";
import { evaluarAcceso, type AccesoTenant } from "./gate";

// Se usa como marcarPagoRecibido.bind(null, tenant.id) en un <form
// action={...}>.
export async function marcarPagoRecibido(tenantId: string): Promise<void> {
  const session = await requireSuperAdmin();

  const hoy = new Date();
  const vencimiento = new Date(hoy);
  vencimiento.setDate(vencimiento.getDate() + 30);

  await withPlatform(async (tx) => {
    await tx`
      update suscripciones
      set estado = 'activo',
          fecha_ultimo_pago = ${hoy.toISOString().slice(0, 10)},
          fecha_vencimiento = ${vencimiento.toISOString().slice(0, 10)},
          actualizado_por = ${session.usuario},
          actualizado_en = now()
      where tenant_id = ${tenantId}
    `;
  });

  revalidatePath("/super-admin");
}

// Llamada por SyncProvider (Fase 7.2) antes de refrescar o drenar
// cualquier cola al reconectar -- si el tenant fue suspendido mientras
// el dispositivo estaba genuinamente offline, no debe seguir subiendo
// ventas/movimientos de un tenant ya bloqueado.
export async function verificarAccesoTenant(): Promise<{ estado: AccesoTenant }> {
  const session = await requireTenantSession();
  const estado = await evaluarAcceso(session.tenantId!);
  return { estado };
}
