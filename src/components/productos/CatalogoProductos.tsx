"use client";

import { useState } from "react";
import Link from "next/link";
import type { Producto } from "@/lib/productos/data";
import type { Categoria } from "@/lib/categorias/data";
import { alternarActivoProducto } from "@/lib/productos/actions";
import { NuevaCategoriaForm } from "@/components/productos/NuevaCategoriaForm";
import { iniciales } from "@/lib/iniciales";

type EstadoProducto = "activo" | "stock-bajo" | "sin-stock" | "inactivo";

function estadoDe(p: Producto): EstadoProducto {
  if (!p.activo) return "inactivo";
  if (p.stock === 0) return "sin-stock";
  if (p.stock < p.stockMinimo) return "stock-bajo";
  return "activo";
}

const ESTADO_LABEL: Record<EstadoProducto, string> = {
  activo: "Activo",
  "stock-bajo": "Stock bajo",
  "sin-stock": "Sin stock",
  inactivo: "Inactivo",
};

const ESTADO_BADGE: Record<EstadoProducto, string> = {
  activo: "bg-green-100 text-green-800",
  "stock-bajo": "bg-amber-100 text-amber-800",
  "sin-stock": "bg-red-100 text-red-800",
  inactivo: "bg-neutral-100 text-neutral-600",
};

// key={imagenUrl} en el componente completo (no solo en el <img>) --
// fuerza a que el estado de error se reinicie cuando cambia de fila con
// una URL distinta, no solo cuando cambia el <img> del mismo componente.
function IconoProducto({ producto }: { producto: Producto }) {
  return <IconoProductoInterno key={producto.imagenUrl ?? "sin-imagen"} producto={producto} />;
}

function IconoProductoInterno({ producto }: { producto: Producto }) {
  const [error, setError] = useState(false);

  if (producto.imagenUrl && !error) {
    return (
      // eslint-disable-next-line @next/next/no-img-element -- URL externa arbitraria del owner, sin dominios configurados para next/image
      <img
        src={producto.imagenUrl}
        alt=""
        className="h-10 w-10 shrink-0 rounded-lg object-cover"
        onError={() => setError(true)}
      />
    );
  }

  return (
    <div
      className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg text-xs font-semibold"
      style={{
        backgroundColor: "color-mix(in srgb, var(--brand-600) 12%, white)",
        color: "var(--brand-600)",
      }}
    >
      {iniciales(producto.nombre)}
    </div>
  );
}

function Tarjeta({ titulo, valor }: { titulo: string; valor: number | string }) {
  return (
    <div className="rounded-xl border border-neutral-200 p-3">
      <div className="text-xs text-neutral-500">{titulo}</div>
      <div className="text-xl font-semibold">{valor}</div>
    </div>
  );
}

export function CatalogoProductos({
  productos,
  categorias,
  rol,
}: {
  productos: Producto[];
  categorias: Categoria[];
  rol: "owner" | "empleado";
}) {
  const [busqueda, setBusqueda] = useState("");
  const [categoriaFiltro, setCategoriaFiltro] = useState<string | null>(null);
  const [localFiltro, setLocalFiltro] = useState<string | null>(null);
  const [estadoFiltro, setEstadoFiltro] = useState<"todos" | EstadoProducto>("todos");
  const [panelCategorias, setPanelCategorias] = useState(false);

  // Para empleado, listarProductos ya forzó soloActivos + su propio
  // local (src/lib/productos/data.ts) -- estas tarjetas y filtros se
  // calculan sobre ese mismo array, así que heredan el scope correcto
  // sin ningún filtro adicional acá.
  const totalActivosSinStock = productos.filter((p) => p.activo && p.stock === 0).length;
  const totalActivosStockBajo = productos.filter(
    (p) => p.activo && p.stock > 0 && p.stock < p.stockMinimo
  ).length;
  const stockTotal = productos.reduce((sum, p) => sum + p.stock, 0);

  const categoriasDisponibles = Array.from(new Set(productos.map((p) => p.categoriaNombre))).sort();
  const localesDisponibles = Array.from(new Set(productos.map((p) => p.localNombre))).sort();

  const productosFiltrados = productos.filter((p) => {
    const estado = estadoDe(p);
    return (
      (busqueda.trim() === "" || p.nombre.toLowerCase().includes(busqueda.trim().toLowerCase())) &&
      (categoriaFiltro === null || p.categoriaNombre === categoriaFiltro) &&
      (rol === "empleado" || localFiltro === null || p.localNombre === localFiltro) &&
      (estadoFiltro === "todos" || estado === estadoFiltro)
    );
  });

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <div
          className={`grid flex-1 grid-cols-2 gap-2 ${
            rol === "owner" ? "sm:grid-cols-4" : "sm:grid-cols-3"
          }`}
        >
          <Tarjeta titulo="Total productos" valor={productos.length} />
          {rol === "owner" && <Tarjeta titulo="Stock total" valor={stockTotal} />}
          <Tarjeta titulo="Sin stock" valor={totalActivosSinStock} />
          <Tarjeta titulo="Stock bajo" valor={totalActivosStockBajo} />
        </div>
        {rol === "owner" && (
          <div className="ml-4 flex shrink-0 gap-2">
            <button
              onClick={() => setPanelCategorias((v) => !v)}
              className="rounded-lg border border-neutral-300 px-4 py-2 text-sm font-medium"
            >
              Categorías
            </button>
          </div>
        )}
      </div>

      {panelCategorias && (
        <div className="rounded-xl border border-neutral-200 p-4">
          <h2 className="mb-2 font-semibold">Categorías</h2>
          {categorias.length > 0 ? (
            <ul className="mb-3 flex flex-wrap gap-2 text-sm">
              {categorias.map((c) => (
                <li key={c.id} className="rounded-full bg-neutral-100 px-3 py-1">
                  {c.nombre}
                </li>
              ))}
            </ul>
          ) : (
            <p className="mb-3 text-sm text-neutral-500">Todavía no hay categorías.</p>
          )}
          <NuevaCategoriaForm />
        </div>
      )}

      <div className="flex flex-col gap-2 sm:flex-row">
        <input
          type="search"
          inputMode="search"
          value={busqueda}
          onChange={(e) => setBusqueda(e.target.value)}
          placeholder="Buscar producto por nombre"
          className="flex-1 rounded-lg border border-neutral-300 px-4 py-3 text-lg"
        />
        <select
          value={categoriaFiltro ?? ""}
          onChange={(e) => setCategoriaFiltro(e.target.value || null)}
          className="rounded-lg border border-neutral-300 px-3 py-2"
        >
          <option value="">Todas las categorías</option>
          {categoriasDisponibles.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </select>
        {rol === "owner" && (
          <select
            value={localFiltro ?? ""}
            onChange={(e) => setLocalFiltro(e.target.value || null)}
            className="rounded-lg border border-neutral-300 px-3 py-2"
          >
            <option value="">Todos los locales</option>
            {localesDisponibles.map((l) => (
              <option key={l} value={l}>
                {l}
              </option>
            ))}
          </select>
        )}
        <select
          value={estadoFiltro}
          onChange={(e) => setEstadoFiltro(e.target.value as "todos" | EstadoProducto)}
          className="rounded-lg border border-neutral-300 px-3 py-2"
        >
          <option value="todos">Todos los estados</option>
          <option value="activo">Activo</option>
          <option value="stock-bajo">Stock bajo</option>
          <option value="sin-stock">Sin stock</option>
          {rol === "owner" && <option value="inactivo">Inactivo</option>}
        </select>
      </div>

      {productosFiltrados.length === 0 && (
        <p className="text-sm text-neutral-500">
          {productos.length === 0
            ? "Todavía no hay productos."
            : "No se encontraron productos con ese filtro."}
        </p>
      )}

      {rol === "owner" ? (
        <div className="overflow-x-auto rounded-xl border border-neutral-200">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-neutral-200 text-left text-neutral-500">
                <th className="p-3">Producto</th>
                <th className="p-3">Categoría</th>
                <th className="p-3">Talla</th>
                <th className="p-3">Precio</th>
                <th className="p-3">Stock</th>
                <th className="p-3">Local</th>
                <th className="p-3">Estado</th>
                <th className="p-3">Acciones</th>
              </tr>
            </thead>
            <tbody>
              {productosFiltrados.map((p) => {
                const estado = estadoDe(p);
                return (
                  <tr key={p.id} className="border-b border-neutral-100 last:border-0">
                    <td className="flex items-center gap-2 p-3">
                      <IconoProducto producto={p} />
                      {p.nombre}
                    </td>
                    <td className="p-3">{p.categoriaNombre}</td>
                    <td className="p-3">{p.talla}</td>
                    <td className="p-3">${p.precio.toLocaleString("es-CO")}</td>
                    <td className="p-3">{p.stock}</td>
                    <td className="p-3">{p.localNombre}</td>
                    <td className="p-3">
                      <span className={`rounded-full px-2 py-0.5 text-xs ${ESTADO_BADGE[estado]}`}>
                        {ESTADO_LABEL[estado]}
                      </span>
                    </td>
                    <td className="p-3">
                      <div className="flex gap-2">
                        <Link
                          href={`/productos/${p.id}/editar`}
                          className="rounded-lg border border-neutral-300 px-3 py-1.5"
                        >
                          Editar
                        </Link>
                        <form action={alternarActivoProducto.bind(null, p.id)}>
                          <button
                            type="submit"
                            className="rounded-lg border border-neutral-300 px-3 py-1.5"
                          >
                            {p.activo ? "Desactivar" : "Activar"}
                          </button>
                        </form>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          {productosFiltrados.map((p) => {
            const estado = estadoDe(p);
            return (
              <div
                key={p.id}
                className="flex items-center gap-3 rounded-xl border border-neutral-200 p-4"
              >
                <IconoProducto producto={p} />
                <div className="flex-1">
                  <div className="font-medium">
                    {p.nombre} · Talla {p.talla}
                  </div>
                  <div className="text-xs text-neutral-500">{p.categoriaNombre}</div>
                  <span className={`mt-1 inline-block rounded-full px-2 py-0.5 text-xs ${ESTADO_BADGE[estado]}`}>
                    Stock: {p.stock}
                  </span>
                </div>
                <div className="text-lg font-medium">${p.precio.toLocaleString("es-CO")}</div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
