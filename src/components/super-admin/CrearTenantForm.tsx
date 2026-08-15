"use client";

import { useActionState, useState } from "react";
import Link from "next/link";
import { crearTenant, type CrearTenantState } from "@/lib/tenants/actions";

const initialState: CrearTenantState = { error: null };

export function CrearTenantForm() {
  const [state, formAction, pending] = useActionState(crearTenant, initialState);
  const [nombreNegocio, setNombreNegocio] = useState("");
  const [slug, setSlug] = useState("");

  return (
    <form action={formAction} className="flex w-full flex-col gap-4">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm text-neutral-500">
            <Link href="/super-admin">Tenants</Link> › Nuevo tenant
          </p>
          <h1 className="text-xl font-semibold">Nuevo tenant</h1>
        </div>
        <Link
          href="/super-admin"
          className="rounded-lg border border-neutral-300 px-4 py-2 text-sm font-medium"
        >
          Cancelar
        </Link>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[3fr_2fr]">
        <div className="flex flex-col gap-4">
          <div className="rounded-2xl border border-neutral-200 p-4">
            <h2 className="mb-3 font-semibold">Información del tenant</h2>
            <label className="flex flex-col gap-1 text-sm">
              Nombre del negocio
              <input
                name="nombreNegocio"
                value={nombreNegocio}
                onChange={(e) => setNombreNegocio(e.target.value)}
                className="rounded-lg border border-neutral-300 px-4 py-3 text-lg"
                required
              />
            </label>
            <label className="mt-3 flex flex-col gap-1 text-sm">
              Slug (para /login/&lt;slug&gt;)
              <input
                name="slug"
                value={slug}
                onChange={(e) => setSlug(e.target.value)}
                pattern="[a-z0-9\-]+"
                title="Solo minúsculas, números y guiones"
                className="rounded-lg border border-neutral-300 px-4 py-3 text-lg"
                required
              />
              <span className="text-xs text-neutral-500">
                Solo minúsculas, números y guiones. No se puede cambiar después.
              </span>
            </label>
          </div>

          <div className="rounded-2xl border border-neutral-200 p-4">
            <h2 className="mb-3 font-semibold">Suscripción</h2>
            <label className="flex flex-col gap-1 text-sm">
              Días de período de gracia
              <input
                name="diasGracia"
                type="number"
                min={0}
                step="1"
                defaultValue={5}
                className="rounded-lg border border-neutral-300 px-4 py-3 text-lg"
                required
              />
              <span className="text-xs text-neutral-500">
                Días adicionales después del vencimiento antes de suspender el acceso.
              </span>
            </label>
          </div>

          <div className="rounded-2xl border border-neutral-200 p-4">
            <h2 className="mb-3 font-semibold">Usuario owner</h2>
            <label className="flex flex-col gap-1 text-sm">
              Nombre
              <input
                name="ownerNombre"
                className="rounded-lg border border-neutral-300 px-4 py-3 text-lg"
                required
              />
            </label>
            <label className="mt-3 flex flex-col gap-1 text-sm">
              Usuario
              <input
                name="ownerUsuario"
                autoComplete="off"
                className="rounded-lg border border-neutral-300 px-4 py-3 text-lg"
                required
              />
            </label>
            <label className="mt-3 flex flex-col gap-1 text-sm">
              Contraseña
              <input
                name="ownerPassword"
                type="password"
                autoComplete="new-password"
                minLength={8}
                className="rounded-lg border border-neutral-300 px-4 py-3 text-lg"
                required
              />
            </label>
          </div>
        </div>

        <div className="flex flex-col gap-4">
          <div className="rounded-2xl border border-neutral-200 p-4">
            <h2 className="mb-3 font-semibold">Vista previa</h2>
            <div className="flex flex-col items-center gap-2 rounded-xl border border-dashed border-neutral-300 p-4 text-center">
              <div
                className="flex h-16 w-16 items-center justify-center rounded-full text-lg font-semibold"
                style={{
                  backgroundColor: "color-mix(in srgb, var(--brand-600) 12%, white)",
                  color: "var(--brand-600)",
                }}
              >
                {nombreNegocio.trim() ? nombreNegocio.trim().slice(0, 2).toUpperCase() : "?"}
              </div>
              <p className="font-medium">{nombreNegocio.trim() || "Nombre del negocio"}</p>
              <p className="text-xs text-neutral-500">/login/{slug.trim() || "slug"}</p>
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
        {pending ? "Creando..." : "Crear tenant"}
      </button>
    </form>
  );
}
