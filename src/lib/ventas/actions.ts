"use server";

import { revalidatePath } from "next/cache";
import { withTenant } from "@/lib/db/tenant";
import { requireTenantSession, assertLocalPermitido } from "@/lib/auth/guards";

export type MetodoPago = "efectivo" | "nequi" | "daviplata";

export type RegistrarVentaInput = {
  localId: number;
  clienteTelefono: string | null;
  clienteNombre: string | null;
  items: { productoId: number; cantidad: number; precioUnitario: number }[];
  pagos: { metodo: MetodoPago; monto: number }[];
  // Generado en el cliente (crypto.randomUUID()) -- hace que reintentar
  // la misma venta (ej. al sincronizar una venta guardada offline) sea
  // idempotente en vez de crear un duplicado. Ver Fase 7.3 /
  // 0010_ventas_client_ref.sql.
  clientRef: string | null;
  // Monto fijo en COP aplicado al total de la venta (no por línea) --
  // 0013_ventas_descuento.sql. 0 = sin descuento.
  descuento: number;
};

export type RegistrarVentaResult =
  | { ok: true; ventaId: number; idVentaPublico: string }
  | { ok: false; error: string };

// Reusa registrar_venta (Fase 1, security definer, 0005_clientes_ventas.sql)
// -- acá solo se resuelve el cliente (buscar por teléfono o crear) antes de
// llamarla, dentro de la misma transacción.
export async function registrarVenta(
  input: RegistrarVentaInput
): Promise<RegistrarVentaResult> {
  const session = await requireTenantSession();
  assertLocalPermitido(session, input.localId);

  if (input.items.length === 0) {
    return { ok: false, error: "El carrito está vacío" };
  }

  const subtotal = input.items.reduce((sum, i) => sum + i.cantidad * i.precioUnitario, 0);
  if (!Number.isInteger(input.descuento) || input.descuento < 0) {
    return { ok: false, error: "El descuento debe ser un entero mayor o igual a 0" };
  }
  if (input.descuento > subtotal) {
    return { ok: false, error: "El descuento no puede ser mayor al subtotal" };
  }

  const total = subtotal - input.descuento;
  const totalPagos = input.pagos.reduce((sum, p) => sum + p.monto, 0);
  if (total <= 0 || total !== totalPagos) {
    return { ok: false, error: "La suma de los pagos no coincide con el total" };
  }

  try {
    const resultado = await withTenant(session.tenantId!, async (tx) => {
      let clienteId: number | null = null;
      const telefono = input.clienteTelefono?.trim() || null;

      if (telefono) {
        const rows = await tx<{ id: number }[]>`
          select id from clientes where telefono = ${telefono}
        `;
        if (rows[0]) {
          clienteId = rows[0].id;
        } else if (input.clienteNombre?.trim()) {
          const [nuevo] = await tx<{ id: number }[]>`
            insert into clientes (tenant_id, nombre, telefono)
            values (${session.tenantId}, ${input.clienteNombre.trim()}, ${telefono})
            returning id
          `;
          clienteId = nuevo.id;
        } else {
          throw new Error("Falta el nombre del cliente nuevo");
        }
      }

      const items = input.items.map((i) => ({
        producto_id: i.productoId,
        cantidad: i.cantidad,
        precio_unitario: i.precioUnitario,
      }));
      const pagosFiltrados = input.pagos
        .filter((p) => p.monto > 0)
        .map((p) => ({ metodo: p.metodo, monto: p.monto }));

      // sql.json() -- pasar un string ya serializado con JSON.stringify()
      // y castear ::jsonb hace que postgres.js lo vuelva a serializar
      // (queda como un jsonb "string" escalar, no un array; ver
      // "cannot extract elements from a scalar" si se rompe esto).
      const [row] = await tx<{ registrar_venta: number }[]>`
        select registrar_venta(
          ${session.tenantId}, ${session.usuarioId}, ${input.localId}, ${clienteId},
          ${tx.json(items)}, ${tx.json(pagosFiltrados)}, ${input.clientRef}, ${input.descuento}
        )
      `;

      const [venta] = await tx<{ id_venta_publico: string }[]>`
        select id_venta_publico from ventas where id = ${row.registrar_venta}
      `;

      return { ventaId: row.registrar_venta, idVentaPublico: venta.id_venta_publico };
    });

    revalidatePath("/productos");
    return { ok: true, ...resultado };
  } catch (err) {
    const mensaje = err instanceof Error ? err.message : "";
    if (mensaje.includes("Stock insuficiente")) {
      return { ok: false, error: "Stock insuficiente para uno de los productos" };
    }
    if (mensaje.includes("Falta el nombre")) {
      return { ok: false, error: "Falta el nombre del cliente nuevo" };
    }
    if (mensaje.includes("no pertenece a este local")) {
      return { ok: false, error: "Alguno de los productos no pertenece a este local" };
    }
    if (mensaje.includes("descuento")) {
      return { ok: false, error: "El descuento no es válido" };
    }
    return { ok: false, error: "No se pudo registrar la venta" };
  }
}
