import Link from "next/link";
import { requireTenantSession } from "@/lib/auth/guards";
import { listarProductos } from "@/lib/productos/data";
import { listarLocales } from "@/lib/locales/data";
import { obtenerConfiguracion } from "@/lib/configuracion/data";
import { VentaForm } from "@/components/venta/VentaForm";

export default async function VentaPage({
  searchParams,
}: {
  searchParams: Promise<{ local?: string }>;
}) {
  const session = await requireTenantSession();
  const { local } = await searchParams;

  // Se pide siempre (no solo para owner con selector) -- también hace
  // falta para resolver el nombre del local actual en el recibo cuando
  // quien vende es un empleado con local fijo.
  const [locales, configuracion] = await Promise.all([
    listarLocales(session.tenantId!),
    obtenerConfiguracion(session.tenantId!),
  ]);
  const localId =
    session.rol === "empleado" ? (session.localId ?? undefined) : Number(local) || locales[0]?.id;
  const localNombre = locales.find((l) => l.id === localId)?.nombre ?? "";

  const productos = localId
    ? await listarProductos(session, { localId, soloActivos: true })
    : [];

  return (
    <main className="mx-auto flex w-full max-w-6xl flex-1 flex-col gap-4 p-6">
      <h1 className="text-xl font-semibold">Vender</h1>

      {session.rol === "owner" && locales.length > 1 && (
        <div className="flex gap-2 text-sm">
          {locales.map((l) => (
            <Link
              key={l.id}
              href={`/venta?local=${l.id}`}
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

      {localId ? (
        <VentaForm
          localId={localId}
          localNombre={localNombre}
          productos={productos}
          tenantId={session.tenantId!}
          vendedorNombre={session.nombre}
          configuracion={configuracion}
        />
      ) : (
        <p className="text-sm text-neutral-500">No hay locales configurados.</p>
      )}
    </main>
  );
}
