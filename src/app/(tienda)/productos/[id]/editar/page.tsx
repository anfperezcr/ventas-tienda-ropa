import { notFound } from "next/navigation";
import { requireOwner } from "@/lib/auth/guards";
import { listarCategorias } from "@/lib/categorias/data";
import { listarLocales } from "@/lib/locales/data";
import { obtenerProducto, listarVariantesGrupo } from "@/lib/productos/data";
import { ajustarStock } from "@/lib/productos/actions";
import { EditarProductoForm } from "@/components/productos/EditarProductoForm";
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

  const producto = await obtenerProducto(session.tenantId!, productoId);
  if (!producto) notFound();

  const [variantes, categorias, locales] = await Promise.all([
    listarVariantesGrupo(session.tenantId!, producto.nombre, producto.categoriaId),
    listarCategorias(session.tenantId!),
    listarLocales(session.tenantId!),
  ]);

  return (
    <main className="mx-auto flex w-full max-w-5xl flex-1 flex-col gap-6 p-6">
      <EditarProductoForm variantes={variantes} categorias={categorias} locales={locales} />

      {/* Ajuste puntual con motivo libre, escapado a la talla específica
          desde la que se entró a esta pantalla -- distinto de "Guardar
          cambios" de arriba, que usa un motivo genérico fijo para todo
          el lote. Sirve para dejar registrado un porqué real (conteo
          físico, producto dañado, etc.) fuera de una edición masiva. */}
      <AjustarStockForm
        stockActual={producto.stock}
        talla={producto.talla}
        action={ajustarStock.bind(null, productoId)}
      />
      <NuevaCategoriaForm />
    </main>
  );
}
