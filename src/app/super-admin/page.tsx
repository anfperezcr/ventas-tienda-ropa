import Link from "next/link";
import { requireSuperAdmin } from "@/lib/auth/guards";
import { listarTenants } from "@/lib/tenants/data";
import { PanelTenants } from "@/components/tenants/PanelTenants";

export default async function SuperAdminPage() {
  await requireSuperAdmin();
  const tenants = await listarTenants();

  return (
    <main className="mx-auto flex w-full max-w-5xl flex-1 flex-col gap-6 p-6">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold">Tenants</h1>
        <Link
          href="/super-admin/tenants/nuevo"
          className="rounded-lg bg-[var(--brand-600)] px-4 py-2 text-sm font-medium text-white"
        >
          Nuevo tenant
        </Link>
      </div>

      <PanelTenants tenants={tenants} />
    </main>
  );
}
