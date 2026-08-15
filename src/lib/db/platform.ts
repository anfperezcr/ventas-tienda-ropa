import postgres from "postgres";

// Cliente del rol app_platform (bypassrls). Solo lo debe importar código
// server-side de super_admin (gestión de tenants/suscripciones, scripts
// de bootstrap) -- nunca una ruta expuesta a owner/empleado. Ver CLAUDE.md
// §12.
let sql: postgres.Sql | null = null;

function getSql(): postgres.Sql {
  if (!sql) {
    const url = process.env.DATABASE_URL_PLATFORM;
    if (!url) throw new Error("Falta la variable de entorno DATABASE_URL_PLATFORM");
    sql = postgres(url, { prepare: false });
  }
  return sql;
}

// Para queries sueltas (ej. resolver tenant_id por slug en el login).
export function platformSql(): postgres.Sql {
  return getSql();
}

// Para operaciones multi-tabla que necesitan atomicidad (ej. aprovisionar
// un tenant nuevo: tenants + suscripciones + configuracion_tenant juntos).
export async function withPlatform<T>(
  fn: (tx: postgres.TransactionSql) => Promise<T>
): Promise<T> {
  // Ver el comentario equivalente en src/lib/db/tenant.ts sobre el tipo
  // de retorno de begin().
  return getSql().begin(fn) as Promise<T>;
}
