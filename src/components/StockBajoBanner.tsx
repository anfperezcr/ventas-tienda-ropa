"use client";

import { useEffect, useState } from "react";
import type { Producto } from "@/lib/productos/data";
import { listarProductosCache, EVENTO_CATALOGO_ACTUALIZADO } from "@/lib/offline/db";

// Cliente, no servidor (Fase 7.2): un Server Component nunca se ejecuta
// si la página se sirve desde el cache del service worker sin red, así
// que la fuente de verdad en vivo pasa a ser IndexedDB (poblado por
// SyncProvider). `initial` es el snapshot que sí se pudo pedir en el
// render server-side de este mismo request (pinta rápido en el caso
// online normal, sin esperar a que el cache local se llene por primera
// vez) -- en cuanto el cache local tiene algo, lo reemplaza.
export function StockBajoBanner({
  tenantId,
  initial,
}: {
  tenantId: string;
  initial: Producto[];
}) {
  const [productos, setProductos] = useState<Producto[]>(initial);

  useEffect(() => {
    let cancelado = false;

    async function cargarDesdeCache() {
      const todos = await listarProductosCache(tenantId);
      if (cancelado || todos.length === 0) return;
      setProductos(todos.filter((p) => p.activo && p.stock < p.stockMinimo));
    }

    cargarDesdeCache();
    window.addEventListener(EVENTO_CATALOGO_ACTUALIZADO, cargarDesdeCache);
    return () => {
      cancelado = true;
      window.removeEventListener(EVENTO_CATALOGO_ACTUALIZADO, cargarDesdeCache);
    };
  }, [tenantId]);

  if (productos.length === 0) return null;

  return (
    <div className="border-b border-red-200 bg-red-50 px-4 py-2 text-sm text-red-800">
      <span className="font-medium">Stock bajo: </span>
      {productos
        .map((p) => `${p.nombre} · Talla ${p.talla} (${p.localNombre}): ${p.stock}`)
        .join(" — ")}
    </div>
  );
}
