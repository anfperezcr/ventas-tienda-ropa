import { withTenant } from "@/lib/db/tenant";

export type Local = {
  id: number;
  nombre: string;
};

export async function listarLocales(tenantId: string): Promise<Local[]> {
  return withTenant(tenantId, async (tx) => {
    return tx<Local[]>`
      select id, nombre from locales order by nombre
    `;
  });
}
