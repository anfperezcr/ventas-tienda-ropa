import { requireOwner } from "@/lib/auth/guards";
import { listarLocales } from "@/lib/locales/data";
import { NuevoLocalForm } from "@/components/locales/NuevoLocalForm";

export default async function LocalesPage() {
  const session = await requireOwner();
  const locales = await listarLocales(session.tenantId!);

  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col gap-4 p-6">
      <h1 className="text-xl font-semibold">Locales</h1>

      <ul className="flex flex-col gap-2">
        {locales.map((l) => (
          <li key={l.id} className="rounded-lg border border-neutral-200 px-3 py-2 text-sm">
            {l.nombre}
          </li>
        ))}
      </ul>

      <NuevoLocalForm />
    </main>
  );
}
