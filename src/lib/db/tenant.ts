import postgres from "postgres";

// Cliente del rol app_tenant. Módulo-privado a propósito: no se exporta,
// para que la única forma de tocar la base con este rol sea withTenant(),
// que primero fija app.tenant_id en la transacción. Ver el patrón
// completo de RLS con JWT propio en CLAUDE.md §12.
let sql: postgres.Sql | null = null;

function getSql(): postgres.Sql {
  if (!sql) {
    const url = process.env.DATABASE_URL_TENANT;
    if (!url) throw new Error("Falta la variable de entorno DATABASE_URL_TENANT");
    // prepare: false -- requerido para compatibilidad con el pooler de
    // Supabase (Supavisor) en modo transacción.
    sql = postgres(url, { prepare: false });
  }
  return sql;
}

// Abre una transacción, fija app.tenant_id para esa transacción (RLS lo
// lee vía current_setting('app.tenant_id', true)) y corre fn dentro de
// ella. Toda query de owner/empleado debe pasar por aquí.
export async function withTenant<T>(
  tenantId: string,
  fn: (tx: postgres.TransactionSql) => Promise<T>
): Promise<T> {
  // postgres.js tipa begin() como Promise<UnwrapPromiseArray<T>>, que TS
  // no puede probar estructuralmente igual a Promise<T> para un T
  // genérico -- son el mismo tipo en runtime para todo T que no sea un
  // array de promesas (nuestro caso), así que el cast es seguro.
  return getSql().begin(async (tx) => {
    await tx`select set_config('app.tenant_id', ${tenantId}, true)`;
    return fn(tx);
  }) as Promise<T>;
}
