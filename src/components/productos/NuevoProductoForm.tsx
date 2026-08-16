"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import type { Categoria } from "@/lib/categorias/data";
import type { Local } from "@/lib/locales/data";
import { guardarGrupoProducto, type FilaGrupoInput } from "@/lib/productos/actions";
import { soloDigitos } from "@/lib/soloDigitos";
import { useSubidaImagenProducto } from "@/hooks/useSubidaImagenProducto";
import { IniciaLesBox } from "./IniciaLesBox";

type FilaLocal = {
  clientKey: string;
  talla: string;
  precio: string;
  stock: string;
};

let contadorFilaNueva = 0;
function nuevaClaveFila(): string {
  contadorFilaNueva += 1;
  return `fila-${contadorFilaNueva}`;
}

const MENSAJE_ESTADO: Record<string, string> = {
  comprimiendo: "Comprimiendo imagen...",
  subiendo: "Subiendo imagen...",
};

// Crea un producto con una o varias tallas de una vez -- reusa
// guardarGrupoProducto (la misma Server Action transaccional que edita
// grupos existentes) pasando todas las filas con id: null, ya que su
// rama de INSERT ya cubre exactamente ese caso. Evita mantener dos
// versiones de la misma lógica de guardado por separado.
export function NuevoProductoForm({
  categorias,
  locales,
}: {
  categorias: Categoria[];
  locales: Local[];
}) {
  const router = useRouter();
  const inputArchivoRef = useRef<HTMLInputElement>(null);

  const [nombre, setNombre] = useState("");
  // Number(...) es necesario aunque Categoria/Local tipen id como number:
  // son bigint en Postgres y postgres.js los devuelve como string en
  // runtime -- sin este coerce, si el owner nunca toca el <select> (deja
  // la primera categoría/local por defecto), el valor llega a
  // guardarGrupoProducto como string y falla su Number.isInteger() sin
  // aviso visible (mismo bug ya encontrado y corregido en
  // EditarProductoForm.tsx).
  const [categoriaId, setCategoriaId] = useState<number | undefined>(
    categorias[0] ? Number(categorias[0].id) : undefined
  );
  const [localId, setLocalId] = useState<number | undefined>(
    locales[0] ? Number(locales[0].id) : undefined
  );
  const [precioBase, setPrecioBase] = useState("");
  const [stockMinimo, setStockMinimo] = useState("5");
  const [filas, setFilas] = useState<FilaLocal[]>([]);
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [modoImagen, setModoImagen] = useState<"archivo" | "url">("archivo");
  const [imagenErrorCarga, setImagenErrorCarga] = useState(false);

  const imagen = useSubidaImagenProducto(null);
  const categoriaSeleccionada = categorias.find((c) => c.id === categoriaId);

  function actualizarFila(clientKey: string, cambio: Partial<FilaLocal>) {
    setFilas((prev) => prev.map((f) => (f.clientKey === clientKey ? { ...f, ...cambio } : f)));
  }

  function agregarFila() {
    setFilas((prev) => [
      ...prev,
      { clientKey: nuevaClaveFila(), talla: "", precio: precioBase, stock: "0" },
    ]);
  }

  function eliminarFila(clientKey: string) {
    setFilas((prev) => prev.filter((f) => f.clientKey !== clientKey));
  }

  async function guardar(e: React.FormEvent) {
    e.preventDefault();
    if (!Number.isInteger(categoriaId) || !Number.isInteger(localId)) {
      setError("Elige una categoría y un local antes de crear el producto");
      return;
    }
    setEnviando(true);
    setError(null);

    const filasPayload: FilaGrupoInput[] = filas.map((f) => ({
      id: null,
      talla: f.talla,
      precio: Number(f.precio || 0),
      stock: Number(f.stock || 0),
      eliminar: false,
    }));

    const resultado = await guardarGrupoProducto({
      nombre,
      categoriaId: categoriaId!,
      localId: localId!,
      imagenUrl: imagen.imagenGuardada,
      imagenUrlAnterior: null,
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

  const mostrandoImagen = imagen.urlMostrada?.trim() && !imagenErrorCarga;

  return (
    <form onSubmit={guardar} className="flex w-full flex-col gap-4">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm text-neutral-500">
            <Link href="/productos">Productos</Link> › Crear producto
          </p>
          <h1 className="text-xl font-semibold">Crear producto</h1>
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
            disabled={enviando || imagen.estado === "comprimiendo" || imagen.estado === "subiendo"}
            className="rounded-lg bg-[var(--brand-600)] px-4 py-2 text-sm font-medium text-white disabled:opacity-60"
          >
            {enviando ? "Creando..." : "Crear producto"}
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
                placeholder="Ej: Buzo tortuga"
                className="rounded-lg border border-neutral-300 px-4 py-3 text-lg"
                required
              />
            </label>

            <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
              <label className="flex flex-col gap-1 text-sm">
                Categoría
                <select
                  value={categoriaId ?? ""}
                  onChange={(e) => setCategoriaId(Number(e.target.value))}
                  className="rounded-lg border border-neutral-300 px-4 py-3 text-lg"
                  required
                >
                  {categorias.length === 0 && (
                    <option value="" disabled>
                      Sin categorías todavía
                    </option>
                  )}
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
                  value={localId ?? ""}
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
              Agrega las tallas o variantes disponibles y su stock inicial.
            </p>
            {filas.length > 0 && (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-left text-neutral-500">
                      <th className="p-2">Talla</th>
                      <th className="p-2">Precio de venta</th>
                      <th className="p-2">Stock inicial</th>
                      <th className="p-2">Acciones</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filas.map((fila) => (
                      <tr key={fila.clientKey} className="border-t border-neutral-100">
                        <td className="p-2">
                          <input
                            type="text"
                            inputMode="text"
                            value={fila.talla}
                            onChange={(e) =>
                              actualizarFila(fila.clientKey, { talla: e.target.value })
                            }
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
                            aria-label="Quitar talla"
                            title="Quitar talla"
                            className="rounded-lg border border-neutral-300 p-2 text-red-600"
                          >
                            🗑
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
            {filas.length === 0 && (
              <p className="rounded-xl border border-dashed border-neutral-300 p-4 text-center text-sm text-neutral-500">
                Aún no has agregado tallas o variantes.
              </p>
            )}
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
            <h2 className="mb-3 font-semibold">Precio</h2>
            <label className="flex flex-col gap-1 text-sm">
              Precio de venta base
              <input
                type="text"
                inputMode="numeric"
                data-teclado-moneda="true"
                value={precioBase}
                onChange={(e) => setPrecioBase(soloDigitos(e.target.value))}
                className="rounded-lg border border-neutral-300 px-4 py-3 text-lg"
              />
            </label>
            <p className="mt-2 text-xs text-neutral-500">
              Se copia como valor por defecto a cada talla nueva que agregues -- editable por
              talla después.
            </p>
          </div>

          <div className="rounded-2xl border border-neutral-200 p-4">
            <h2 className="mb-3 font-semibold">Imagen (opcional)</h2>
            <div className="mb-3 flex gap-2">
              <button
                type="button"
                onClick={() => setModoImagen("archivo")}
                className={`flex-1 rounded-lg border px-3 py-2 text-sm font-medium ${
                  modoImagen === "archivo"
                    ? "border-[var(--brand-600)] text-[var(--brand-600)]"
                    : "border-neutral-300 text-neutral-600"
                }`}
              >
                Desde mi dispositivo
              </button>
              <button
                type="button"
                onClick={() => setModoImagen("url")}
                className={`flex-1 rounded-lg border px-3 py-2 text-sm font-medium ${
                  modoImagen === "url"
                    ? "border-[var(--brand-600)] text-[var(--brand-600)]"
                    : "border-neutral-300 text-neutral-600"
                }`}
              >
                Desde URL
              </button>
            </div>

            {modoImagen === "archivo" ? (
              <div>
                <input
                  ref={inputArchivoRef}
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  className="hidden"
                  onChange={(e) => {
                    const archivo = e.target.files?.[0];
                    setImagenErrorCarga(false);
                    if (archivo) imagen.manejarArchivo(archivo);
                    e.target.value = "";
                  }}
                />
                <button
                  type="button"
                  onClick={() => inputArchivoRef.current?.click()}
                  className="w-full rounded-lg border border-dashed border-neutral-300 px-4 py-3 text-sm text-neutral-600"
                >
                  Elegir imagen (JPG, PNG o WEBP, máx 5MB)
                </button>
              </div>
            ) : (
              <input
                type="url"
                inputMode="url"
                defaultValue={imagen.imagenGuardada ?? ""}
                onChange={(e) => {
                  setImagenErrorCarga(false);
                  imagen.establecerUrlDirecta(e.target.value);
                }}
                placeholder="https://..."
                className="w-full rounded-lg border border-neutral-300 px-4 py-3 text-lg"
              />
            )}

            {(imagen.estado === "comprimiendo" || imagen.estado === "subiendo") && (
              <p className="mt-2 text-sm text-neutral-500">{MENSAJE_ESTADO[imagen.estado]}</p>
            )}
            {imagen.estado === "error" && (
              <p className="mt-2 text-sm text-red-600">
                {imagen.error} -- puedes crear el producto sin imagen y agregarla después editando.
              </p>
            )}

            <div className="mt-3 flex h-32 items-center justify-center overflow-hidden rounded-xl border border-dashed border-neutral-300">
              {mostrandoImagen ? (
                // eslint-disable-next-line @next/next/no-img-element -- preview local (object URL) o URL externa, sin dominios configurados para next/image
                <img
                  key={imagen.urlMostrada}
                  src={imagen.urlMostrada!}
                  alt=""
                  className="h-full w-full object-cover"
                  onError={() => setImagenErrorCarga(true)}
                />
              ) : (
                <IniciaLesBox nombre={nombre} className="h-14 w-14" />
              )}
            </div>
            {imagen.imagenGuardada && (
              <button
                type="button"
                onClick={() => {
                  imagen.quitarImagen();
                  setImagenErrorCarga(false);
                }}
                className="mt-2 text-sm text-neutral-500 underline"
              >
                Quitar imagen
              </button>
            )}
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
              {mostrandoImagen ? (
                // eslint-disable-next-line @next/next/no-img-element -- mismo preview de la sección de arriba
                <img
                  src={imagen.urlMostrada!}
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
                  Desde ${Number(filas[0]?.precio || precioBase || 0).toLocaleString("es-CO")}
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
