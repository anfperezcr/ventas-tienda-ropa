import Link from "next/link";
import { requireTenantSession } from "@/lib/auth/guards";
import { obtenerResumenDashboard } from "@/lib/dashboard/data";
import { iniciales } from "@/lib/iniciales";
import { DashboardPanel } from "@/components/dashboard/DashboardPanel";
import {
  IconoVender,
  IconoProductos,
  IconoCaja,
  IconoReportes,
  IconoLocales,
  IconoUsuarios,
  IconoConfiguracion,
  IconoCampana,
  IconoPuntos,
  IconoChevron,
} from "@/components/dashboard/iconos";

const TARJETAS = [
  { href: "/venta", titulo: "Vender", descripcion: "Registrar una nueva venta", Icono: IconoVender, soloOwner: false },
  { href: "/productos", titulo: "Productos", descripcion: "Catálogo e inventario", Icono: IconoProductos, soloOwner: false },
  { href: "/caja", titulo: "Caja", descripcion: "Turno, retiros y cierre", Icono: IconoCaja, soloOwner: false },
  { href: "/reportes", titulo: "Reportes", descripcion: "Ventas y ranking de clientes", Icono: IconoReportes, soloOwner: true },
  { href: "/locales", titulo: "Locales", descripcion: "Gestiona tus locales", Icono: IconoLocales, soloOwner: true },
  { href: "/usuarios", titulo: "Usuarios", descripcion: "Empleados y accesos", Icono: IconoUsuarios, soloOwner: true },
  { href: "/configuracion", titulo: "Configuración", descripcion: "Nombre, color, logo, recibo", Icono: IconoConfiguracion, soloOwner: true },
] as const;

export default async function DashboardPage() {
  const session = await requireTenantSession();
  const resumen = await obtenerResumenDashboard(session);
  const tarjetas = TARJETAS.filter((t) => !t.soloOwner || session.rol === "owner");

  return (
    <main className="mx-auto flex w-full max-w-5xl flex-1 flex-col gap-6 p-6">
      <header className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold">¡Bienvenido, {session.nombre}!</h1>
          <p className="text-sm text-neutral-500">Esto es lo que pasa hoy en tu tienda.</p>
        </div>

        {/* Sin funcionalidad todavía -- estilo "próximamente" a propósito
            (bordes punteados, colores apagados, cursor deshabilitado) para
            que no se confundan con controles reales. */}
        <div className="flex items-center gap-2">
          <button
            type="button"
            disabled
            title="Próximamente"
            className="cursor-not-allowed rounded-lg border border-dashed border-neutral-200 p-2 text-neutral-300"
          >
            <IconoCampana className="h-4 w-4" />
          </button>
          <button
            type="button"
            disabled
            title="Próximamente"
            className="cursor-not-allowed rounded-lg border border-dashed border-neutral-200 p-2 text-neutral-300"
          >
            <IconoPuntos className="h-4 w-4" />
          </button>
          <span title="Próximamente" className="cursor-not-allowed text-sm text-neutral-300">
            Ayuda
          </span>
          <div
            title="Próximamente"
            className="flex cursor-not-allowed items-center gap-1 rounded-lg border border-dashed border-neutral-200 px-2 py-1.5"
          >
            <span className="flex h-6 w-6 items-center justify-center rounded-full bg-neutral-100 text-xs text-neutral-400">
              {iniciales(session.nombre)}
            </span>
            <IconoChevron className="h-3 w-3 text-neutral-300" />
          </div>
        </div>
      </header>

      <section className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {tarjetas.map(({ href, titulo, descripcion, Icono }) => (
          <Link
            key={href}
            href={href}
            className="flex items-start gap-3 rounded-xl border border-neutral-200 p-4 transition hover:border-[var(--brand-600)]"
          >
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-[var(--brand-600)]/10 text-[var(--brand-600)]">
              <Icono className="h-5 w-5" />
            </span>
            <span>
              <span className="block font-medium">{titulo}</span>
              <span className="block text-xs text-neutral-500">{descripcion}</span>
            </span>
          </Link>
        ))}
      </section>

      <DashboardPanel resumen={resumen} />
    </main>
  );
}
