import { withTenant } from "@/lib/db/tenant";

export type Categoria = {
  id: number;
  nombre: string;
  tallasSugeridas: string[];
};

type CategoriaRow = {
  id: number;
  nombre: string;
  tallas_sugeridas: string[];
};

export async function listarCategorias(tenantId: string): Promise<Categoria[]> {
  return withTenant(tenantId, async (tx) => {
    const rows = await tx<CategoriaRow[]>`
      select id, nombre, tallas_sugeridas
      from categorias
      order by nombre
    `;
    return rows.map((row) => ({
      id: row.id,
      nombre: row.nombre,
      tallasSugeridas: row.tallas_sugeridas,
    }));
  });
}
