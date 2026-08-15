import Link from "next/link";
import { requireTenantSession } from "@/lib/auth/guards";
import { listarProductos } from "@/lib/productos/data";
import { listarCategorias } from "@/lib/categorias/data";
import { CatalogoProductos } from "@/components/productos/CatalogoProductos";

export default async function ProductosPage() {
  const session = await requireTenantSession();

  // Un empleado vendiendo en el mostrador no debe ver productos que no
  // puede vender -- confunde frente a un cliente. El owner sigue viendo
  // inactivos porque gestionarlos (reactivar, auditar) es su trabajo.
  const productos = await listarProductos(session, {
    soloActivos: session.rol === "empleado",
  });
  const categorias = session.rol === "owner" ? await listarCategorias(session.tenantId!) : [];

  return (
    <main className="mx-auto flex w-full max-w-6xl flex-1 flex-col gap-4 p-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold">Productos</h1>
          <p className="text-sm text-neutral-500">
            {session.rol === "owner"
              ? "Administra tu catálogo y stock"
              : "Consulta el stock de tu local"}
          </p>
        </div>
        {session.rol === "owner" && (
          <Link
            href="/productos/nuevo"
            className="rounded-lg bg-[var(--brand-600)] px-4 py-2 text-sm font-medium text-white"
          >
            + Nuevo producto
          </Link>
        )}
      </div>

      <CatalogoProductos
        productos={productos}
        categorias={categorias}
        rol={session.rol === "owner" ? "owner" : "empleado"}
      />
    </main>
  );
}
