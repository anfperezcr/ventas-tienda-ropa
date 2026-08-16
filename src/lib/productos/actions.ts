"use server";

import { revalidatePath } from "next/cache";
import postgres from "postgres";
import { withTenant } from "@/lib/db/tenant";
import { requireOwner, requireTenantSession } from "@/lib/auth/guards";
import { listarProductos, type Producto } from "./data";
import {
  subirImagenProductoStorage,
  borrarImagenProductoStorageSiPropia,
  type SubirImagenResultado,
} from "@/lib/storage/imagenesProducto";

export async function subirImagenProducto(formData: FormData): Promise<SubirImagenResultado> {
  const session = await requireOwner();

  const archivo = formData.get("archivo");
  if (!(archivo instanceof File)) {
    return { ok: false, error: "No se recibió ningún archivo" };
  }

  return subirImagenProductoStorage(session.tenantId!, archivo);
}

export async function alternarActivoProducto(productoId: number): Promise<void> {
  const session = await requireOwner();

  await withTenant(session.tenantId!, async (tx) => {
    await tx`
      update productos set activo = not activo where id = ${productoId}
    `;
  });

  revalidatePath("/productos");
}

export type AjustarStockState = {
  error: string | null;
  stockResultante: number | null;
};

// Único camino para mover productos.stock -- app_tenant no tiene UPDATE
// directo sobre esa columna (0004_categorias_productos.sql). Llama la
// función security definer ajustar_stock (0009_ajustar_stock.sql), que
// además deja rastro en ajustes_stock.
export async function ajustarStock(
  productoId: number,
  _prevState: AjustarStockState,
  formData: FormData
): Promise<AjustarStockState> {
  const session = await requireOwner();

  const delta = Number(formData.get("delta"));
  const motivo = String(formData.get("motivo") ?? "").trim() || null;

  if (!Number.isInteger(delta) || delta === 0) {
    return { error: "El ajuste debe ser un entero distinto de 0", stockResultante: null };
  }

  try {
    const stockResultante = await withTenant(session.tenantId!, async (tx) => {
      const [row] = await tx<{ ajustar_stock: number }[]>`
        select ajustar_stock(${session.tenantId}, ${session.usuarioId}, ${productoId}, ${delta}, ${motivo})
      `;
      return row.ajustar_stock;
    });

    revalidatePath("/productos");
    return { error: null, stockResultante };
  } catch (err) {
    const mensaje = err instanceof Error ? err.message : "";
    if (mensaje.includes("negativo")) {
      return { error: "El ajuste dejaría el stock en negativo", stockResultante: null };
    }
    return { error: "No se pudo ajustar el stock", stockResultante: null };
  }
}

export type FilaGrupoInput = {
  id: number | null; // null = fila nueva, todavía no existe en productos
  talla: string;
  precio: number;
  stock: number;
  eliminar: boolean;
};

export type GuardarGrupoInput = {
  nombre: string;
  categoriaId: number;
  localId: number;
  imagenUrl: string | null;
  // Valor de imagenUrl ANTES de esta edición (null en creación, donde no
  // hay imagen previa que borrar). Sirve solo para el borrado best-effort
  // de Storage después de guardar -- guardarGrupoProducto es una Server
  // Action sin estado propio, así que quien llama debe decirle qué había
  // antes si quiere que el reemplazo limpie el objeto viejo.
  imagenUrlAnterior?: string | null;
  stockMinimo: number;
  filas: FilaGrupoInput[];
};

export type GuardarGrupoResult = { ok: true } | { ok: false; error: string };

const MOTIVO_AJUSTE_EDICION = "Ajuste desde edición de producto";

// Edita todas las tallas de un mismo grupo (nombre+categoría, misma
// clave que agrupa VentaForm) en una sola operación: la tabla de
// /productos/[id]/editar llama esto directo (no useActionState/FormData
// -- el payload es un array, no un formulario plano).
export async function guardarGrupoProducto(input: GuardarGrupoInput): Promise<GuardarGrupoResult> {
  const session = await requireOwner();

  const nombre = input.nombre.trim();
  if (!nombre) return { ok: false, error: "El nombre es obligatorio" };
  if (!Number.isInteger(input.categoriaId)) return { ok: false, error: "Elige una categoría" };
  if (!Number.isInteger(input.localId)) return { ok: false, error: "Elige un local" };
  if (!Number.isInteger(input.stockMinimo) || input.stockMinimo < 0) {
    return { ok: false, error: "El stock mínimo debe ser un entero mayor o igual a 0" };
  }
  const imagenUrl = input.imagenUrl?.trim() || null;
  if (imagenUrl && !/^https?:\/\//i.test(imagenUrl)) {
    return { ok: false, error: "La URL de la imagen debe empezar con http:// o https://" };
  }

  const filasQueQuedan = input.filas.filter((f) => !f.eliminar);
  if (filasQueQuedan.length === 0) {
    return { ok: false, error: "El producto debe tener al menos una talla" };
  }
  for (const fila of filasQueQuedan) {
    if (!fila.talla.trim()) return { ok: false, error: "Todas las tallas deben tener un valor" };
    if (!Number.isFinite(fila.precio) || fila.precio < 0) {
      return { ok: false, error: "El precio debe ser un número mayor o igual a 0" };
    }
    if (!Number.isInteger(fila.stock) || fila.stock < 0) {
      return { ok: false, error: "El stock debe ser un entero mayor o igual a 0" };
    }
  }

  try {
    await withTenant(session.tenantId!, async (tx) => {
      for (const fila of input.filas) {
        // Fila nueva marcada para eliminar antes de guardarse -- nunca
        // llegó a existir en la base, no hay nada que hacer.
        if (fila.id === null && fila.eliminar) continue;

        if (fila.id === null) {
          await tx`
            insert into productos
              (tenant_id, nombre, categoria_id, talla, precio, stock, stock_minimo, local_id, imagen_url)
            values (
              ${session.tenantId}, ${nombre}, ${input.categoriaId}, ${fila.talla.trim()},
              ${fila.precio}, ${fila.stock}, ${input.stockMinimo}, ${input.localId}, ${imagenUrl}
            )
          `;
          continue;
        }

        if (fila.eliminar) {
          // Intenta borrar de verdad -- si detalle_venta o ajustes_stock
          // ya referencian esta fila, el DELETE viola su FK (código
          // 23503) y el savepoint lo revierte SIN abortar el resto de la
          // transacción, para caer a desactivar. Cualquier otro tipo de
          // error (conexión, timeout, etc.) se relanza tal cual -- nunca
          // se enmascara como "tiene historial".
          let borrada = true;
          try {
            await tx.savepoint(async (sp) => {
              await sp`delete from productos where id = ${fila.id}`;
            });
          } catch (err) {
            if (err instanceof postgres.PostgresError && err.code === "23503") {
              borrada = false;
            } else {
              throw err;
            }
          }
          if (!borrada) {
            await tx`update productos set activo = false where id = ${fila.id}`;
          }
          continue;
        }

        await tx`
          update productos
          set nombre = ${nombre},
              categoria_id = ${input.categoriaId},
              talla = ${fila.talla.trim()},
              precio = ${fila.precio},
              stock_minimo = ${input.stockMinimo},
              local_id = ${input.localId},
              imagen_url = ${imagenUrl}
          where id = ${fila.id}
        `;

        // El delta se calcula contra el stock que hay AHORA en la base
        // (no contra el valor que el owner vio al abrir la pantalla) --
        // así el resultado final es exactamente lo que escribió, sin
        // importar si algo más (una venta, otro ajuste) movió el stock
        // mientras tenía la pantalla abierta.
        const [actual] = await tx<{ stock: number }[]>`
          select stock from productos where id = ${fila.id}
        `;
        const delta = fila.stock - actual.stock;
        if (delta !== 0) {
          await tx`
            select ajustar_stock(
              ${session.tenantId}, ${session.usuarioId}, ${fila.id}, ${delta}, ${MOTIVO_AJUSTE_EDICION}
            )
          `;
        }
      }
    });
  } catch (err) {
    const mensaje = err instanceof Error ? err.message : "";
    if (mensaje.includes("negativo")) {
      return { ok: false, error: "Uno de los ajustes dejaría el stock en negativo" };
    }
    return { ok: false, error: "No se pudo guardar el producto" };
  }

  revalidatePath("/productos");

  if (input.imagenUrlAnterior && input.imagenUrlAnterior !== imagenUrl) {
    // Best-effort, fuera de la transacción -- si falla queda un huérfano
    // en Storage, pero el guardado en base de datos ya es válido y no se
    // revierte por esto (borrarImagenProductoStorageSiPropia ya no lanza).
    void borrarImagenProductoStorageSiPropia(input.imagenUrlAnterior);
  }

  return { ok: true };
}

// El cliente la llama directo (Fase 7.2) para refrescar el cache de
// IndexedDB usado offline por StockBajoBanner y el picker de VentaForm.
// Sin localId: listarProductos ya fuerza el alcance correcto según el
// rol de la sesión (empleado -> su local; owner -> todos), así el
// llamador no necesita saber ni pasar nada más.
export async function obtenerCatalogoLocal(): Promise<Producto[]> {
  const session = await requireTenantSession();
  return listarProductos(session, { soloActivos: true });
}
