"use server";

import { withTenant } from "@/lib/db/tenant";
import { requireTenantSession } from "@/lib/auth/guards";

export type BuscarClienteResult = {
  encontrado: boolean;
  nombre: string | null;
};

// Búsqueda rápida para la pantalla de venta -- la resolución
// autoritativa (buscar-o-crear) vuelve a pasar dentro de registrarVenta
// (src/lib/ventas/actions.ts), esto es solo feedback inmediato en la UI.
export async function buscarClientePorTelefono(telefono: string): Promise<BuscarClienteResult> {
  const session = await requireTenantSession();
  const telefonoLimpio = telefono.trim();
  if (!telefonoLimpio) return { encontrado: false, nombre: null };

  return withTenant(session.tenantId!, async (tx) => {
    const rows = await tx<{ nombre: string }[]>`
      select nombre from clientes where telefono = ${telefonoLimpio}
    `;
    return rows[0] ? { encontrado: true, nombre: rows[0].nombre } : { encontrado: false, nombre: null };
  });
}
