"use client";

import { useActionState } from "react";
import Link from "next/link";
import type { Local } from "@/lib/locales/data";
import type { Empleado } from "@/lib/usuarios/data";
import type { EmpleadoFormState } from "@/lib/usuarios/actions";

const initialState: EmpleadoFormState = { error: null };

export function EmpleadoForm({
  action,
  locales,
  empleado,
}: {
  action: (prevState: EmpleadoFormState, formData: FormData) => Promise<EmpleadoFormState>;
  locales: Local[];
  empleado?: Empleado;
}) {
  const [state, formAction, pending] = useActionState(action, initialState);

  return (
    <form action={formAction} className="flex w-full flex-col gap-4">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm text-neutral-500">
            <Link href="/usuarios">Usuarios</Link> › {empleado ? "Editar empleado" : "Nuevo empleado"}
          </p>
          <h1 className="text-xl font-semibold">{empleado ? "Editar empleado" : "Nuevo empleado"}</h1>
        </div>
        <Link
          href="/usuarios"
          className="rounded-lg border border-neutral-300 px-4 py-2 text-sm font-medium"
        >
          Cancelar
        </Link>
      </div>

      <div className="rounded-2xl border border-neutral-200 p-4">
        <label className="flex flex-col gap-1 text-sm">
          Nombre
          <input
            name="nombre"
            defaultValue={empleado?.nombre}
            className="rounded-lg border border-neutral-300 px-4 py-3 text-lg"
            required
          />
        </label>

        {!empleado && (
          <label className="mt-3 flex flex-col gap-1 text-sm">
            Usuario
            <input
              name="usuario"
              autoComplete="off"
              className="rounded-lg border border-neutral-300 px-4 py-3 text-lg"
              required
            />
          </label>
        )}

        <label className="mt-3 flex flex-col gap-1 text-sm">
          Local
          <select
            name="localId"
            defaultValue={empleado?.localId}
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
        {empleado && (
          <p className="mt-2 text-xs text-amber-700">
            Si este empleado tiene un turno de caja abierto en su local actual, tendrás que
            cerrarlo tú desde Caja después de reasignarlo.
          </p>
        )}

        <label className="mt-3 flex flex-col gap-1 text-sm">
          {empleado ? "Nueva contraseña (opcional)" : "Contraseña"}
          <input
            name="password"
            type="password"
            autoComplete="new-password"
            minLength={empleado ? undefined : 8}
            placeholder={empleado ? "Dejar en blanco para no cambiarla" : undefined}
            className="rounded-lg border border-neutral-300 px-4 py-3 text-lg"
            required={!empleado}
          />
        </label>
      </div>

      {state.error && <p className="text-sm text-red-600">{state.error}</p>}

      <button
        type="submit"
        disabled={pending}
        className="rounded-lg bg-[var(--brand-600)] px-4 py-4 text-lg font-medium text-white disabled:opacity-60"
      >
        {pending ? "Guardando..." : empleado ? "Guardar cambios" : "Crear empleado"}
      </button>
    </form>
  );
}
