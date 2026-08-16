import { withTenant } from "@/lib/db/tenant";
import type { SessionPayload } from "@/lib/auth/session";

export type Producto = {
  id: number;
  nombre: string;
  categoriaId: number;
  categoriaNombre: string;
  talla: string;
  precio: number;
  stock: number;
  stockMinimo: number;
  localId: number;
  localNombre: string;
  activo: boolean;
  imagenUrl: string | null;
};

type ProductoRow = {
  id: number;
  nombre: string;
  categoria_id: number;
  categoria_nombre: string;
  talla: string;
  precio: number;
  stock: number;
  stock_minimo: number;
  local_id: number;
  local_nombre: string;
  activo: boolean;
  imagen_url: string | null;
};

// Recibe la sesión completa, no un localId suelto: si es empleado, el
// filtro se fuerza acá a session.localId sin importar qué traiga opts --
// ninguna página puede, por bug, dejarlo ver productos de otro local de
// su propio tenant (mismo criterio que assertLocalPermitido del lado de
// escritura, ver src/lib/auth/guards.ts).
export async function listarProductos(
  session: SessionPayload,
  opts?: { localId?: number; soloActivos?: boolean; soloStockBajo?: boolean }
): Promise<Producto[]> {
  const localId =
    session.rol === "empleado" ? (session.localId ?? undefined) : opts?.localId;

  return withTenant(session.tenantId!, async (tx) => {
    const rows = await tx<ProductoRow[]>`
      select
        p.id, p.nombre, p.categoria_id, c.nombre as categoria_nombre,
        p.talla, p.precio, p.stock, p.stock_minimo, p.local_id,
        l.nombre as local_nombre, p.activo, p.imagen_url
      from productos p
      join categorias c on c.id = p.categoria_id
      join locales l on l.id = p.local_id
      where (${localId ?? null}::bigint is null or p.local_id = ${localId ?? null})
        and (${opts?.soloActivos ?? false} = false or p.activo)
        and (${opts?.soloStockBajo ?? false} = false or p.stock < p.stock_minimo)
      order by p.nombre, p.talla
    `;
    return rows.map((row) => ({
      id: row.id,
      nombre: row.nombre,
      categoriaId: row.categoria_id,
      categoriaNombre: row.categoria_nombre,
      talla: row.talla,
      precio: row.precio,
      stock: row.stock,
      stockMinimo: row.stock_minimo,
      localId: row.local_id,
      localNombre: row.local_nombre,
      activo: row.activo,
      imagenUrl: row.imagen_url,
    }));
  });
}

// Todas las filas del mismo grupo que /venta agruparía (VentaForm.tsx:
// clave = nombre.trim().toLowerCase() + categoriaId) -- usado por la
// pantalla de edición para mostrar y guardar todas las tallas de un
// producto de una sola vez. Incluye inactivas a propósito: si el owner
// entra a editar justo una talla desactivada (el link "Editar" de
// /productos no filtra por activo), la fila igual debe aparecer -- si no,
// la pantalla se queda sin variantes que mostrar. guardarGrupoProducto
// nunca toca la columna activo, así que esto no reactiva nada solo.
export async function listarVariantesGrupo(
  tenantId: string,
  nombre: string,
  categoriaId: number
): Promise<Producto[]> {
  return withTenant(tenantId, async (tx) => {
    const rows = await tx<ProductoRow[]>`
      select
        p.id, p.nombre, p.categoria_id, c.nombre as categoria_nombre,
        p.talla, p.precio, p.stock, p.stock_minimo, p.local_id,
        l.nombre as local_nombre, p.activo, p.imagen_url
      from productos p
      join categorias c on c.id = p.categoria_id
      join locales l on l.id = p.local_id
      where lower(trim(p.nombre)) = lower(trim(${nombre}))
        and p.categoria_id = ${categoriaId}
      order by p.talla
    `;
    return rows.map((row) => ({
      id: row.id,
      nombre: row.nombre,
      categoriaId: row.categoria_id,
      categoriaNombre: row.categoria_nombre,
      talla: row.talla,
      precio: row.precio,
      stock: row.stock,
      stockMinimo: row.stock_minimo,
      localId: row.local_id,
      localNombre: row.local_nombre,
      activo: row.activo,
      imagenUrl: row.imagen_url,
    }));
  });
}

export async function obtenerProducto(
  tenantId: string,
  productoId: number
): Promise<Producto | null> {
  return withTenant(tenantId, async (tx) => {
    const rows = await tx<ProductoRow[]>`
      select
        p.id, p.nombre, p.categoria_id, c.nombre as categoria_nombre,
        p.talla, p.precio, p.stock, p.stock_minimo, p.local_id,
        l.nombre as local_nombre, p.activo, p.imagen_url
      from productos p
      join categorias c on c.id = p.categoria_id
      join locales l on l.id = p.local_id
      where p.id = ${productoId}
    `;
    const row = rows[0];
    if (!row) return null;
    return {
      id: row.id,
      nombre: row.nombre,
      categoriaId: row.categoria_id,
      categoriaNombre: row.categoria_nombre,
      talla: row.talla,
      precio: row.precio,
      stock: row.stock,
      stockMinimo: row.stock_minimo,
      localId: row.local_id,
      localNombre: row.local_nombre,
      activo: row.activo,
      imagenUrl: row.imagen_url,
    };
  });
}
