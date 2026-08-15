import { requireOwner } from "@/lib/auth/guards";
import { listarCategorias } from "@/lib/categorias/data";
import { listarLocales } from "@/lib/locales/data";
import { crearProducto } from "@/lib/productos/actions";
import { ProductoForm } from "@/components/productos/ProductoForm";
import { NuevaCategoriaForm } from "@/components/productos/NuevaCategoriaForm";

export default async function NuevoProductoPage() {
  const session = await requireOwner();
  const [categorias, locales] = await Promise.all([
    listarCategorias(session.tenantId!),
    listarLocales(session.tenantId!),
  ]);

  return (
    <main className="mx-auto flex w-full max-w-4xl flex-1 flex-col gap-6 p-6">
      <ProductoForm action={crearProducto} categorias={categorias} locales={locales} />
      <NuevaCategoriaForm />
    </main>
  );
}
