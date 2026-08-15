import { CrearTenantForm } from "@/components/super-admin/CrearTenantForm";
import { requireSuperAdmin } from "@/lib/auth/guards";

export default async function NuevoTenantPage() {
  await requireSuperAdmin();

  return (
    <main className="mx-auto flex w-full max-w-4xl flex-1 flex-col p-6">
      <CrearTenantForm />
    </main>
  );
}
