import Link from "next/link";
import type { CSSProperties } from "react";
import { requireTenantSession } from "@/lib/auth/guards";
import { obtenerConfiguracion } from "@/lib/configuracion/data";
import { listarProductos } from "@/lib/productos/data";
import { StockBajoBanner } from "@/components/StockBajoBanner";
import { SyncProvider } from "@/components/offline/SyncProvider";
import { IndicadorMetodoEntrada } from "@/components/touch-keyboard/IndicadorMetodoEntrada";

export default async function TiendaLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await requireTenantSession();
  const [configuracion, stockBajoInicial] = await Promise.all([
    obtenerConfiguracion(session.tenantId!),
    listarProductos(session, { soloActivos: true, soloStockBajo: true }),
  ]);

  return (
    <div
      className="flex flex-1 flex-col"
      style={{ "--brand-600": configuracion.colorPrimario } as CSSProperties}
    >
      <SyncProvider tenantId={session.tenantId!} />
      <nav className="flex items-center justify-between border-b border-neutral-200 px-4 py-3 text-sm">
        <div className="flex items-center gap-4 font-medium">
          {configuracion.logoUrl && (
            // eslint-disable-next-line @next/next/no-img-element -- URL externa arbitraria del owner, sin dominios configurados para next/image
            <img
              src={configuracion.logoUrl}
              alt=""
              className="h-6 w-6 rounded object-cover"
            />
          )}
          <span>{configuracion.nombreNegocio}</span>
          <Link href="/venta">Vender</Link>
          <Link href="/productos">Productos</Link>
          <Link href="/caja">Caja</Link>
          <Link href="/sincronizacion">Sincronización</Link>
          {session.rol === "owner" && <Link href="/reportes">Reportes</Link>}
          {session.rol === "owner" && <Link href="/locales">Locales</Link>}
          {session.rol === "owner" && <Link href="/usuarios">Usuarios</Link>}
          {session.rol === "owner" && <Link href="/configuracion">Configuración</Link>}
        </div>
        <div className="flex items-center gap-3">
          <IndicadorMetodoEntrada />
          <span className="text-neutral-500">
            {session.nombre} · {session.rol}
          </span>
          <form action="/api/logout" method="post">
            <button
              type="submit"
              className="rounded-lg border border-neutral-300 px-3 py-1.5"
            >
              Cerrar sesión
            </button>
          </form>
        </div>
      </nav>
      <StockBajoBanner tenantId={session.tenantId!} initial={stockBajoInicial} />
      {children}
    </div>
  );
}
