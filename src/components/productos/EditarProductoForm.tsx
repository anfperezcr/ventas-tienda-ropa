"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import type { Categoria } from "@/lib/categorias/data";
import type { Local } from "@/lib/locales/data";
import type { Producto } from "@/lib/productos/data";
import { guardarGrupoProducto, type FilaGrupoInput } from "@/lib/productos/actions";
import { soloDigitos } from "@/lib/soloDigitos";
import { IniciaLesBox } from "./IniciaLesBox";

type FilaLocal = {
  clientKey: string;
  id: number | null;
  talla: string;
  precio: string;
  stock: string;
  eliminar: boolean;
};

let contadorFilaNueva = 0;
function nuevaClaveFila(): string {
  contadorFilaNueva += 1;
  return `nueva-${contadorFilaNueva}`;
}

function filasDesdeVariantes(variantes: Producto[]): FilaLocal[] {
  return variantes.map((v) => ({
    clientKey: `existente-${v.id}`,
    id: v.id,
    talla: v.talla,
    precio: String(v.precio),
    stock: String(v.stock),
    eliminar: false,
  }));
}

// Todas las tallas de un mismo grupo (nombre+categoría, misma clave que
// agrupa VentaForm) se editan juntas -- campos compartidos (nombre,
// categoría, local, imagen, stock mínimo) se aplican a todas las filas
// al guardar; talla/precio/stock siguen siendo por fila.
export function EditarProductoForm({
  variantes,
  categorias,
  locales,
}: {
  variantes: Producto[];
  categorias: Categoria[];
  locales: Local[];
}) {
  const router = useRouter();
  const primera = variantes[0];

  const [nombre, setNombre] = useState(primera.nombre);
  // Number(...) es necesario aunque Producto tipe categoriaId/localId como
  // number: categoria_id/local_id son bigint en Postgres y postgres.js los
  // devuelve como string en runtime para no perder precisión -- sin este
  // coerce, el valor inicial (si el owner nunca toca el <select>) llega a
  // guardarGrupoProducto como string y falla su Number.isInteger().
  const [categoriaId, setCategoriaId] = useState(Number(primera.categoriaId));
  const [localId, setLocalId] = useState(Number(primera.localId));
  const [imagenUrl, setImagenUrl] = useState(primera.imagenUrl ?? "");
  const [imagenError, setImagenError] = useState(false);
  const [stockMinimo, setStockMinimo] = useState(String(primera.stockMinimo));
  const [filas, setFilas] = useState<FilaLocal[]>(() => filasDesdeVariantes(variantes));
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const filasVisibles = filas.filter((f) => !f.eliminar);
  const categoriaSeleccionada = categorias.find((c) => c.id === categoriaId);

  function actualizarFila(clientKey: string, cambio: Partial<FilaLocal>) {
    setFilas((prev) => prev.map((f) => (f.clientKey === clientKey ? { ...f, ...cambio } : f)));
  }

  function agregarFila() {
    setFilas((prev) => [
      ...prev,
      { clientKey: nuevaClaveFila(), id: null, talla: "", precio: "", stock: "0", eliminar: false },
    ]);
  }

  function eliminarFila(clientKey: string) {
    setFilas((prev) =>
      prev
        .map((f) => (f.clientKey === clientKey ? { ...f, eliminar: true } : f))
        // Una fila nueva que se "elimina" antes de guardar nunca llegó a
        // existir en la base -- simplemente desaparece de la vista.
        .filter((f) => !(f.id === null && f.clientKey === clientKey))
    );
  }

  async function guardar(e: React.FormEvent) {
    e.preventDefault();
    setEnviando(true);
    setError(null);

    const filasPayload: FilaGrupoInput[] = filas.map((f) => ({
      id: f.id,
      talla: f.talla,
      precio: Number(f.precio || 0),
      stock: Number(f.stock || 0),
      eliminar: f.eliminar,
    }));

    const resultado = await guardarGrupoProducto({
      nombre,
      categoriaId,
      localId,
      imagenUrl: imagenUrl.trim() || null,
      imagenUrlAnterior: primera.imagenUrl,
      stockMinimo: Number(stockMinimo || 0),
      filas: filasPayload,
    });

    if (!resultado.ok) {
      setError(resultado.error);
      setEnviando(false);
      return;
    }

    router.push("/productos");
  }

  return (
    <form onSubmit={guardar} className="flex w-full flex-col gap-4">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm text-neutral-500">
            <Link href="/productos">Productos</Link> › Editar producto
          </p>
          <h1 className="text-xl font-semibold">Editar producto</h1>
        </div>
        <div className="flex gap-2">
          <Link
            href="/productos"
            className="rounded-lg border border-neutral-300 px-4 py-2 text-sm font-medium"
          >
            Cancelar
          </Link>
          <button
            type="submit"
            disabled={enviando}
            className="rounded-lg bg-[var(--brand-600)] px-4 py-2 text-sm font-medium text-white disabled:opacity-60"
          >
            {enviando ? "Guardando..." : "Guardar cambios"}
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[3fr_2fr]">
        <div className="flex flex-col gap-4">
          <div className="rounded-2xl border border-neutral-200 p-4">
            <h2 className="mb-3 font-semibold">Información básica</h2>
            <label className="flex flex-col gap-1 text-sm">
              Nombre del producto
              <input
                type="text"
                inputMode="text"
                value={nombre}
                onChange={(e) => setNombre(e.target.value)}
                className="rounded-lg border border-neutral-300 px-4 py-3 text-lg"
                required
              />
            </label>

            <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
              <label className="flex flex-col gap-1 text-sm">
                Categoría
                <select
                  value={categoriaId}
                  onChange={(e) => setCategoriaId(Number(e.target.value))}
                  className="rounded-lg border border-neutral-300 px-4 py-3 text-lg"
                  required
                >
                  {categorias.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.nombre}
                    </option>
                  ))}
                </select>
              </label>
              <label className="flex flex-col gap-1 text-sm">
                Local / Sucursal
                <select
                  value={localId}
                  onChange={(e) => setLocalId(Number(e.target.value))}
                  className="rounded-lg border border-neutral-300 px-4 py-3 text-lg"
                  required
                >
                  {locales.map((l) => (
                    <option key={l.id} value={l.id}>
                      {l.nombre}
                    </option>
                  ))}
                </select>
              </label>
            </div>
          </div>

          <div className="rounded-2xl border border-neutral-200 p-4">
            <h2 className="mb-1 font-semibold">Tallas / Variantes</h2>
            <p className="mb-3 text-sm text-neutral-500">
              Todas las tallas de este producto -- se guardan juntas.
            </p>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-neutral-500">
                    <th className="p-2">Talla</th>
                    <th className="p-2">Precio de venta</th>
                    <th className="p-2">Stock disponible</th>
                    <th className="p-2">Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {filasVisibles.map((fila) => (
                    <tr key={fila.clientKey} className="border-t border-neutral-100">
                      <td className="p-2">
                        <input
                          type="text"
                          inputMode="text"
                          value={fila.talla}
                          onChange={(e) => actualizarFila(fila.clientKey, { talla: e.target.value })}
                          className="w-24 rounded-lg border border-neutral-300 px-3 py-2"
                          required
                        />
                      </td>
                      <td className="p-2">
                        <input
                          type="text"
                          inputMode="numeric"
                          data-teclado-moneda="true"
                          value={fila.precio}
                          onChange={(e) =>
                            actualizarFila(fila.clientKey, { precio: soloDigitos(e.target.value) })
                          }
                          className="w-28 rounded-lg border border-neutral-300 px-3 py-2"
                          required
                        />
                      </td>
                      <td className="p-2">
                        <input
                          type="text"
                          inputMode="numeric"
                          value={fila.stock}
                          onChange={(e) =>
                            actualizarFila(fila.clientKey, { stock: soloDigitos(e.target.value) })
                          }
                          className="w-24 rounded-lg border border-neutral-300 px-3 py-2"
                          required
                        />
                      </td>
                      <td className="p-2">
                        <button
                          type="button"
                          onClick={() => eliminarFila(fila.clientKey)}
                          disabled={filasVisibles.length <= 1}
                          title={
                            filasVisibles.length <= 1
                              ? "Debe quedar al menos una talla"
                              : "Eliminar talla"
                          }
                          aria-label="Eliminar talla"
                          className="rounded-lg border border-neutral-300 p-2 text-red-600 disabled:cursor-not-allowed disabled:opacity-30"
                        >
                          🗑
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <button
              type="button"
              onClick={agregarFila}
              className="mt-3 rounded-lg border border-[var(--brand-600)] px-4 py-2 text-sm font-medium text-[var(--brand-600)]"
            >
              + Agregar talla / variante
            </button>
          </div>
        </div>

        <div className="flex flex-col gap-4">
          <div className="rounded-2xl border border-neutral-200 p-4">
            <h2 className="mb-3 font-semibold">Imagen (opcional)</h2>
            <label className="flex flex-col gap-1 text-sm">
              URL de la imagen
              <input
                type="url"
                inputMode="url"
                value={imagenUrl}
                onChange={(e) => {
                  setImagenUrl(e.target.value);
                  setImagenError(false);
                }}
                placeholder="https://..."
                className="rounded-lg border border-neutral-300 px-4 py-3 text-lg"
              />
            </label>
            <div className="mt-3 flex h-32 items-center justify-center overflow-hidden rounded-xl border border-dashed border-neutral-300">
              {imagenUrl.trim() && !imagenError ? (
                // eslint-disable-next-line @next/next/no-img-element -- URL externa arbitraria del owner, sin dominios configurados para next/image
                <img
                  key={imagenUrl.trim()}
                  src={imagenUrl.trim()}
                  alt=""
                  className="h-full w-full object-cover"
                  onError={() => setImagenError(true)}
                />
              ) : (
                <IniciaLesBox nombre={nombre} className="h-14 w-14" />
              )}
            </div>
          </div>

          <div className="rounded-2xl border border-neutral-200 p-4">
            <h2 className="mb-3 font-semibold">Inventario</h2>
            <label className="flex flex-col gap-1 text-sm">
              Stock mínimo (alerta)
              <input
                type="text"
                inputMode="numeric"
                value={stockMinimo}
                onChange={(e) => setStockMinimo(soloDigitos(e.target.value))}
                className="rounded-lg border border-neutral-300 px-4 py-3 text-lg"
                required
              />
            </label>
            <p className="mt-2 text-xs text-neutral-500">
              Se aplica a todas las tallas de este producto.
            </p>
          </div>

          <div className="rounded-2xl border border-neutral-200 p-4">
            <h2 className="mb-1 font-semibold">Vista en ventas</h2>
            <p className="mb-3 text-xs text-neutral-500">Así se ve este producto en /venta.</p>
            <div className="flex items-center gap-3 rounded-xl border border-neutral-200 p-3">
              {imagenUrl.trim() && !imagenError ? (
                // eslint-disable-next-line @next/next/no-img-element -- URL externa arbitraria del owner, sin dominios configurados para next/image
                <img
                  src={imagenUrl.trim()}
                  alt=""
                  className="h-14 w-14 shrink-0 rounded-lg object-cover"
                />
              ) : (
                <IniciaLesBox nombre={nombre} className="h-14 w-14" />
              )}
              <div className="min-w-0">
                <p className="truncate font-medium">{nombre.trim() || "Nombre del producto"}</p>
                <p className="text-xs text-neutral-500">{categoriaSeleccionada?.nombre}</p>
                <p className="font-medium">
                  ${Number(filasVisibles[0]?.precio || 0).toLocaleString("es-CO")}
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {error && <p className="text-sm text-red-600">{error}</p>}
    </form>
  );
}
