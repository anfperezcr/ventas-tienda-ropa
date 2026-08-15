import { requireOwner } from "@/lib/auth/guards";
import { listarLocales } from "@/lib/locales/data";
import { crearEmpleado } from "@/lib/usuarios/actions";
import { EmpleadoForm } from "@/components/usuarios/EmpleadoForm";

export default async function NuevoEmpleadoPage() {
  const session = await requireOwner();
  const locales = await listarLocales(session.tenantId!);

  return (
    <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-6 p-6">
      <EmpleadoForm action={crearEmpleado} locales={locales} />
    </main>
  );
}
