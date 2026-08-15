"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { withTenant } from "@/lib/db/tenant";
import { requireOwner, requireTenantSession } from "@/lib/auth/guards";
import { listarProductos, type Producto } from "./data";

export type ProductoFormState = {
  error: string | null;
};

type ParseComunesResult =
  | { ok: true; nombre: string; categoriaId: number; talla: string; precio: number; stockMinimo: number; localId: number; imagenUrl: string | null }
  | { ok: false; error: string };

function parseComunes(formData: FormData): ParseComunesResult {
  const nombre = String(formData.get("nombre") ?? "").trim();
  const categoriaId = Number(formData.get("categoriaId"));
  const talla = String(formData.get("talla") ?? "").trim();
  const precio = Number(formData.get("precio"));
  const stockMinimo = Number(formData.get("stockMinimo"));
  const localId = Number(formData.get("localId"));
  const imagenUrl = String(formData.get("imagenUrl") ?? "").trim();

  if (!nombre || !talla || !Number.isInteger(categoriaId) || !Number.isInteger(localId)) {
    return { ok: false, error: "Todos los campos son obligatorios" };
  }
  if (!Number.isFinite(precio) || precio < 0) {
    return { ok: false, error: "El precio debe ser un número mayor o igual a 0" };
  }
  if (!Number.isInteger(stockMinimo) || stockMinimo < 0) {
    return { ok: false, error: "El stock mínimo debe ser un entero mayor o igual a 0" };
  }
  // Mismo criterio que logoUrl en actualizarConfiguracion (Fase 5) -- la
  // vista previa en el formulario ya la renderiza como <img src=...>, así
  // que server-side también se valida el esquema antes de guardar.
  if (imagenUrl && !/^https?:\/\//i.test(imagenUrl)) {
    return { ok: false, error: "La URL de la imagen debe empezar con http:// o https://" };
  }

  return {
    ok: true,
    nombre,
    categoriaId,
    talla,
    precio,
    stockMinimo,
    localId,
    imagenUrl: imagenUrl || null,
  };
}

export async function crearProducto(
  _prevState: ProductoFormState,
  formData: FormData
): Promise<ProductoFormState> {
  const session = await requireOwner();

  const parsed = parseComunes(formData);
  if (!parsed.ok) return { error: parsed.error };

  const stockInicial = Number(formData.get("stockInicial"));
  if (!Number.isInteger(stockInicial) || stockInicial < 0) {
    return { error: "El stock inicial debe ser un entero mayor o igual a 0" };
  }

  try {
    await withTenant(session.tenantId!, async (tx) => {
      await tx`
        insert into productos (tenant_id, nombre, categoria_id, talla, precio, stock, stock_minimo, local_id, imagen_url)
        values (
          ${session.tenantId}, ${parsed.nombre}, ${parsed.categoriaId}, ${parsed.talla},
          ${parsed.precio}, ${stockInicial}, ${parsed.stockMinimo}, ${parsed.localId}, ${parsed.imagenUrl}
        )
      `;
    });
  } catch {
    return { error: "No se pudo crear el producto" };
  }

  revalidatePath("/productos");
  redirect("/productos");
}

export async function actualizarProducto(
  productoId: number,
  _prevState: ProductoFormState,
  formData: FormData
): Promise<ProductoFormState> {
  const session = await requireOwner();

  const parsed = parseComunes(formData);
  if (!parsed.ok) return { error: parsed.error };

  try {
    await withTenant(session.tenantId!, async (tx) => {
      await tx`
        update productos
        set nombre = ${parsed.nombre},
            categoria_id = ${parsed.categoriaId},
            talla = ${parsed.talla},
            precio = ${parsed.precio},
            stock_minimo = ${parsed.stockMinimo},
            local_id = ${parsed.localId},
            imagen_url = ${parsed.imagenUrl}
        where id = ${productoId}
      `;
    });
  } catch {
    return { error: "No se pudo actualizar el producto" };
  }

  revalidatePath("/productos");
  redirect("/productos");
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

// El cliente la llama directo (Fase 7.2) para refrescar el cache de
// IndexedDB usado offline por StockBajoBanner y el picker de VentaForm.
// Sin localId: listarProductos ya fuerza el alcance correcto según el
// rol de la sesión (empleado -> su local; owner -> todos), así el
// llamador no necesita saber ni pasar nada más.
export async function obtenerCatalogoLocal(): Promise<Producto[]> {
  const session = await requireTenantSession();
  return listarProductos(session, { soloActivos: true });
}
