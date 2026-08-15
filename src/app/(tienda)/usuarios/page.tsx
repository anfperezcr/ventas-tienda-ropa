import Link from "next/link";
import { requireOwner } from "@/lib/auth/guards";
import { listarEmpleados } from "@/lib/usuarios/data";
import { alternarActivoEmpleado } from "@/lib/usuarios/actions";

export default async function UsuariosPage() {
  const session = await requireOwner();
  const empleados = await listarEmpleados(session.tenantId!);

  return (
    <main className="mx-auto flex w-full max-w-4xl flex-1 flex-col gap-4 p-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold">Usuarios</h1>
          <p className="text-sm text-neutral-500">Gestiona los empleados de tu tienda</p>
        </div>
        <Link
          href="/usuarios/nuevo"
          className="rounded-lg bg-[var(--brand-600)] px-4 py-2 text-sm font-medium text-white"
        >
          + Nuevo empleado
        </Link>
      </div>

      {empleados.length === 0 && (
        <p className="text-sm text-neutral-500">Todavía no hay empleados.</p>
      )}

      <div className="flex flex-col gap-2">
        {empleados.map((e) => (
          <div
            key={e.id}
            className="flex flex-col gap-2 rounded-xl border border-neutral-200 p-4 sm:flex-row sm:items-center sm:justify-between"
          >
            <div>
              <div className="font-medium">{e.nombre}</div>
              <div className="text-xs text-neutral-500">
                @{e.usuario} · {e.localNombre}
              </div>
              <span
                className={`mt-1 inline-block rounded-full px-2 py-0.5 text-xs ${
                  e.activo ? "bg-green-100 text-green-800" : "bg-neutral-100 text-neutral-600"
                }`}
              >
                {e.activo ? "Activo" : "Inactivo"}
              </span>
            </div>
            <div className="flex gap-2">
              <Link
                href={`/usuarios/${e.id}/editar`}
                className="rounded-lg border border-neutral-300 px-3 py-1.5 text-sm"
              >
                Editar
              </Link>
              <form action={alternarActivoEmpleado.bind(null, e.id)}>
                <button type="submit" className="rounded-lg border border-neutral-300 px-3 py-1.5 text-sm">
                  {e.activo ? "Desactivar" : "Activar"}
                </button>
              </form>
            </div>
          </div>
        ))}
      </div>
    </main>
  );
}
