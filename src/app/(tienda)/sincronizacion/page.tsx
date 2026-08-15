import { requireTenantSession } from "@/lib/auth/guards";
import { SincronizacionView } from "@/components/sincronizacion/SincronizacionView";

export default async function SincronizacionPage() {
  const session = await requireTenantSession();

  return (
    <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-4 p-6">
      <h1 className="text-xl font-semibold">Sincronización</h1>
      <SincronizacionView tenantId={session.tenantId!} />
    </main>
  );
}
