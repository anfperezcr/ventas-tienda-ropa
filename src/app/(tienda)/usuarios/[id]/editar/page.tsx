import { notFound } from "next/navigation";
import { requireOwner } from "@/lib/auth/guards";
import { listarLocales } from "@/lib/locales/data";
import { obtenerEmpleado } from "@/lib/usuarios/data";
import { actualizarEmpleado } from "@/lib/usuarios/actions";
import { EmpleadoForm } from "@/components/usuarios/EmpleadoForm";

export default async function EditarEmpleadoPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await requireOwner();
  const { id } = await params;
  const empleadoId = Number(id);

  const [empleado, locales] = await Promise.all([
    obtenerEmpleado(session.tenantId!, empleadoId),
    listarLocales(session.tenantId!),
  ]);

  if (!empleado) notFound();

  return (
    <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-6 p-6">
      <EmpleadoForm
        action={actualizarEmpleado.bind(null, empleadoId)}
        locales={locales}
        empleado={empleado}
      />
    </main>
  );
}
