import { requireOwner } from "@/lib/auth/guards";
import { obtenerConfiguracion } from "@/lib/configuracion/data";
import { ConfiguracionForm } from "@/components/configuracion/ConfiguracionForm";

export default async function ConfiguracionPage() {
  const session = await requireOwner();
  const configuracion = await obtenerConfiguracion(session.tenantId!);

  return (
    <main className="mx-auto flex w-full max-w-5xl flex-1 flex-col gap-4 p-6">
      <ConfiguracionForm configuracion={configuracion} />
    </main>
  );
}
