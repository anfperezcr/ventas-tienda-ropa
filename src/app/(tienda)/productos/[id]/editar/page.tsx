import { notFound } from "next/navigation";
import { requireOwner } from "@/lib/auth/guards";
import { listarCategorias } from "@/lib/categorias/data";
import { listarLocales } from "@/lib/locales/data";
import { obtenerProducto } from "@/lib/productos/data";
import { actualizarProducto, ajustarStock } from "@/lib/productos/actions";
import { ProductoForm } from "@/components/productos/ProductoForm";
import { AjustarStockForm } from "@/components/productos/AjustarStockForm";
import { NuevaCategoriaForm } from "@/components/productos/NuevaCategoriaForm";

export default async function EditarProductoPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await requireOwner();
  const { id } = await params;
  const productoId = Number(id);

  const [producto, categorias, locales] = await Promise.all([
    obtenerProducto(session.tenantId!, productoId),
    listarCategorias(session.tenantId!),
    listarLocales(session.tenantId!),
  ]);

  if (!producto) notFound();

  return (
    <main className="mx-auto flex w-full max-w-4xl flex-1 flex-col gap-6 p-6">
      <ProductoForm
        action={actualizarProducto.bind(null, productoId)}
        categorias={categorias}
        locales={locales}
        producto={producto}
      />
      <AjustarStockForm
        stockActual={producto.stock}
        action={ajustarStock.bind(null, productoId)}
      />
      <NuevaCategoriaForm />
    </main>
  );
}
