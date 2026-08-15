import Link from "next/link";
import { requireTenantSession } from "@/lib/auth/guards";
import { listarLocales } from "@/lib/locales/data";
import { obtenerEstadoTurno, listarMovimientosTurno } from "@/lib/caja/data";
import { CajaPanel } from "@/components/caja/CajaPanel";

export default async function CajaPage({
  searchParams,
}: {
  searchParams: Promise<{ local?: string }>;
}) {
  const session = await requireTenantSession();
  const { local } = await searchParams;

  const locales = session.rol === "owner" ? await listarLocales(session.tenantId!) : [];
  const localId =
    session.rol === "empleado" ? (session.localId ?? undefined) : Number(local) || locales[0]?.id;

  const estado = localId ? await obtenerEstadoTurno(session.tenantId!, localId) : null;
  const movimientos =
    localId && estado?.abierto
      ? await listarMovimientosTurno(session, localId, estado.aperturaFecha)
      : [];

  return (
    <main className="mx-auto flex w-full max-w-5xl flex-1 flex-col gap-4 p-6">
      <h1 className="text-xl font-semibold">Caja</h1>

      {session.rol === "owner" && locales.length > 1 && (
        <div className="flex gap-2 text-sm">
          {locales.map((l) => (
            <Link
              key={l.id}
              href={`/caja?local=${l.id}`}
              className={`rounded-lg border px-3 py-1.5 ${
                l.id === localId
                  ? "border-[var(--brand-600)] bg-[var(--brand-600)] text-white"
                  : "border-neutral-300"
              }`}
            >
              {l.nombre}
            </Link>
          ))}
        </div>
      )}

      {localId && estado ? (
        <CajaPanel tenantId={session.tenantId!} localId={localId} estado={estado} movimientos={movimientos} />
      ) : (
        <p className="text-sm text-neutral-500">No hay locales configurados.</p>
      )}
    </main>
  );
}
