import Link from "next/link";
import { requireOwner } from "@/lib/auth/guards";
import { listarLocales } from "@/lib/locales/data";
import { obtenerVentasDelDia, obtenerRankingClientes } from "@/lib/reportes/data";

const METODO_LABEL: Record<string, string> = {
  efectivo: "Efectivo",
  nequi: "Nequi",
  daviplata: "Daviplata",
};

// Si el localId de la URL no pertenece al tenant (validado dentro de
// data.ts), se degrada a consolidado en vez de tirarle un 500 al owner
// por una URL vieja o mal copiada.
async function cargarReportes(tenantId: string, localId: number | undefined) {
  try {
    return {
      localId,
      ventasDelDia: await obtenerVentasDelDia(tenantId, { localId }),
      ranking: await obtenerRankingClientes(tenantId, { localId }),
    };
  } catch {
    return {
      localId: undefined,
      ventasDelDia: await obtenerVentasDelDia(tenantId, {}),
      ranking: await obtenerRankingClientes(tenantId, {}),
    };
  }
}

export default async function ReportesPage({
  searchParams,
}: {
  searchParams: Promise<{ local?: string }>;
}) {
  const session = await requireOwner();
  const { local } = await searchParams;
  const localIdParam = Number(local) || undefined;

  const [locales, { localId, ventasDelDia, ranking }] = await Promise.all([
    listarLocales(session.tenantId!),
    cargarReportes(session.tenantId!, localIdParam),
  ]);

  return (
    <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-6 p-6">
      <h1 className="text-xl font-semibold">Reportes</h1>

      {locales.length > 1 && (
        <div className="flex flex-wrap gap-2 text-sm">
          <Link
            href="/reportes"
            className={`rounded-lg border px-3 py-1.5 ${
              !localId
                ? "border-[var(--brand-600)] bg-[var(--brand-600)] text-white"
                : "border-neutral-300"
            }`}
          >
            Consolidado
          </Link>
          {locales.map((l) => (
            <Link
              key={l.id}
              href={`/reportes?local=${l.id}`}
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

      <div className="rounded-2xl border border-neutral-200 p-6">
        <h2 className="mb-4 font-semibold">Ventas de hoy</h2>
        <div className="grid grid-cols-2 gap-4 text-center">
          <div>
            <div className="text-2xl font-semibold">{ventasDelDia.totalVentas}</div>
            <div className="text-xs text-neutral-500">Ventas</div>
          </div>
          <div>
            <div className="text-2xl font-semibold">
              ${ventasDelDia.totalMonto.toLocaleString("es-CO")}
            </div>
            <div className="text-xs text-neutral-500">Total</div>
          </div>
        </div>
        <table className="mt-4 w-full text-sm">
          <tbody>
            {ventasDelDia.porMetodo.map((m) => (
              <tr key={m.metodo} className="border-t border-neutral-100">
                <td className="py-2">{METODO_LABEL[m.metodo] ?? m.metodo}</td>
                <td className="py-2 text-right">${m.monto.toLocaleString("es-CO")}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="rounded-2xl border border-neutral-200 p-6">
        <h2 className="mb-4 font-semibold">Ranking de clientes</h2>
        {ranking.length === 0 && (
          <p className="text-sm text-neutral-500">Todavía no hay compras registradas.</p>
        )}
        {ranking.length > 0 && (
          <table className="w-full text-sm">
            <tbody>
              {ranking.map((c, i) => (
                <tr key={c.id} className="border-t border-neutral-100">
                  <td className="py-2 text-neutral-400">{i + 1}</td>
                  <td className="py-2">{c.nombre}</td>
                  <td className="py-2 text-neutral-500">{c.telefono}</td>
                  <td className="py-2 text-right font-medium">
                    ${c.total.toLocaleString("es-CO")}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </main>
  );
}
