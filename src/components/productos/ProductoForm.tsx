"use client";

import { useActionState, useState } from "react";
import Link from "next/link";
import type { Categoria } from "@/lib/categorias/data";
import type { Local } from "@/lib/locales/data";
import type { Producto } from "@/lib/productos/data";
import type { ProductoFormState } from "@/lib/productos/actions";
import { iniciales } from "@/lib/iniciales";

const initialState: ProductoFormState = { error: null };

export function ProductoForm({
  action,
  categorias,
  locales,
  producto,
}: {
  action: (prevState: ProductoFormState, formData: FormData) => Promise<ProductoFormState>;
  categorias: Categoria[];
  locales: Local[];
  producto?: Producto;
}) {
  const [state, formAction, pending] = useActionState(action, initialState);
  const [categoriaId, setCategoriaId] = useState<number | undefined>(
    producto?.categoriaId ?? categorias[0]?.id
  );
  const [nombre, setNombre] = useState(producto?.nombre ?? "");
  const [imagenUrl, setImagenUrl] = useState(producto?.imagenUrl ?? "");
  const [imagenError, setImagenError] = useState(false);
  const categoriaSeleccionada = categorias.find((c) => c.id === categoriaId);

  return (
    <form action={formAction} className="flex w-full flex-col gap-4">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm text-neutral-500">
            <Link href="/productos">Productos</Link> ›{" "}
            {producto ? "Editar producto" : "Nuevo producto"}
          </p>
          <h1 className="text-xl font-semibold">
            {producto ? "Editar producto" : "Nuevo producto"}
          </h1>
        </div>
        <Link
          href="/productos"
          className="rounded-lg border border-neutral-300 px-4 py-2 text-sm font-medium"
        >
          Cancelar
        </Link>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[3fr_2fr]">
        <div className="flex flex-col gap-4">
          <div className="rounded-2xl border border-neutral-200 p-4">
            <h2 className="mb-3 font-semibold">Información básica</h2>
            <label className="flex flex-col gap-1 text-sm">
              Nombre
              <input
                name="nombre"
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
                  name="categoriaId"
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
                Talla
                {categoriaSeleccionada && categoriaSeleccionada.tallasSugeridas.length > 0 ? (
                  <select
                    name="talla"
                    defaultValue={producto?.talla}
                    className="rounded-lg border border-neutral-300 px-4 py-3 text-lg"
                    required
                  >
                    <option value="" disabled>
                      Elegir talla
                    </option>
                    {categoriaSeleccionada.tallasSugeridas.map((t) => (
                      <option key={t} value={t}>
                        {t}
                      </option>
                    ))}
                  </select>
                ) : (
                  <input
                    name="talla"
                    defaultValue={producto?.talla}
                    className="rounded-lg border border-neutral-300 px-4 py-3 text-lg"
                    required
                  />
                )}
              </label>
            </div>
          </div>

          <div className="rounded-2xl border border-neutral-200 p-4">
            <h2 className="mb-3 font-semibold">Inventario y ubicación</h2>
            <label className="flex flex-col gap-1 text-sm">
              Local
              <select
                name="localId"
                defaultValue={producto?.localId}
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

            <div
              className={`mt-3 grid grid-cols-1 gap-3 ${
                producto ? "sm:grid-cols-1" : "sm:grid-cols-2"
              }`}
            >
              {!producto && (
                <label className="flex flex-col gap-1 text-sm">
                  Stock inicial
                  <input
                    name="stockInicial"
                    type="number"
                    min={0}
                    step="1"
                    defaultValue={0}
                    className="rounded-lg border border-neutral-300 px-4 py-3 text-lg"
                    required
                  />
                </label>
              )}
              <label className="flex flex-col gap-1 text-sm">
                Stock mínimo
                <input
                  name="stockMinimo"
                  type="number"
                  min={0}
                  step="1"
                  defaultValue={producto?.stockMinimo ?? 5}
                  className="rounded-lg border border-neutral-300 px-4 py-3 text-lg"
                  required
                />
              </label>
            </div>
            <p className="mt-2 text-xs text-neutral-500">
              Se mostrará una alerta cuando el stock disponible sea menor al mínimo.
            </p>
          </div>
        </div>

        <div className="flex flex-col gap-4">
          <div className="rounded-2xl border border-neutral-200 p-4">
            <h2 className="mb-3 font-semibold">Precio</h2>
            <label className="flex flex-col gap-1 text-sm">
              Precio de venta
              <input
                name="precio"
                type="number"
                min={0}
                step="1"
                defaultValue={producto?.precio}
                className="rounded-lg border border-neutral-300 px-4 py-3 text-lg"
                required
              />
            </label>
          </div>

          <div className="rounded-2xl border border-neutral-200 p-4">
            <h2 className="mb-3 font-semibold">Imagen (opcional)</h2>
            <label className="flex flex-col gap-1 text-sm">
              URL de la imagen
              <input
                name="imagenUrl"
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
                <div
                  className="flex h-14 w-14 items-center justify-center rounded-lg text-sm font-semibold"
                  style={{
                    backgroundColor: "color-mix(in srgb, var(--brand-600) 12%, white)",
                    color: "var(--brand-600)",
                  }}
                >
                  {nombre.trim() ? iniciales(nombre) : "?"}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {state.error && <p className="text-sm text-red-600">{state.error}</p>}

      <button
        type="submit"
        disabled={pending}
        className="rounded-lg bg-[var(--brand-600)] px-4 py-4 text-lg font-medium text-white disabled:opacity-60"
      >
        {pending ? "Guardando..." : producto ? "Guardar cambios" : "Crear producto"}
      </button>
    </form>
  );
}
