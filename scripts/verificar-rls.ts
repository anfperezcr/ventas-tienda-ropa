import postgres from "postgres";
import { withPlatform } from "../src/lib/db/platform";

// Verificación manual de aislamiento RLS (CLAUDE.md §11: "RLS es la
// prioridad #1 de seguridad, probar explícitamente"). No hay framework de
// tests en este proyecto (tampoco lo había en el hermano) -- este script
// imprime PASS/FAIL por caso y sale con código distinto de 0 si algo
// falla.
//
// A propósito NO importa src/lib/db/tenant.ts (ese cliente es
// intencionalmente privado, solo accesible vía withTenant()) -- para
// poder probar el caso "sin SET LOCAL" abre su propia conexión con
// DATABASE_URL_TENANT directamente, como lo haría un DBA probando el rol
// por fuera de la aplicación.
process.loadEnvFile(".env.local");

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`Falta la variable de entorno ${name}`);
  return value;
}

type Resultado = { nombre: string; ok: boolean };
const resultados: Resultado[] = [];

function check(nombre: string, ok: boolean) {
  resultados.push({ nombre, ok });
  console.log(`${ok ? "PASS" : "FAIL"} - ${nombre}`);
}

async function crearTenantDePrueba(sufijo: string) {
  return withPlatform(async (tx) => {
    const [tenant] = await tx<{ id: string }[]>`
      insert into tenants (nombre_negocio, slug)
      values (${"RLS test " + sufijo}, ${"rls-test-" + sufijo + "-" + Date.now()})
      returning id
    `;
    const [local] = await tx<{ id: number }[]>`
      insert into locales (tenant_id, nombre) values (${tenant.id}, 'Principal') returning id
    `;
    const [categoria] = await tx<{ id: number }[]>`
      insert into categorias (tenant_id, nombre) values (${tenant.id}, 'general') returning id
    `;
    const [producto] = await tx<{ id: number }[]>`
      insert into productos (tenant_id, nombre, categoria_id, talla, precio, local_id)
      values (${tenant.id}, ${"Producto " + sufijo}, ${categoria.id}, 'Única', 10000, ${local.id})
      returning id
    `;
    return {
      tenantId: tenant.id,
      localId: local.id,
      categoriaId: categoria.id,
      productoId: producto.id,
    };
  });
}

async function limpiarTenant(tenantId: string) {
  await withPlatform(async (tx) => {
    await tx`delete from productos where tenant_id = ${tenantId}`;
    await tx`delete from categorias where tenant_id = ${tenantId}`;
    await tx`delete from locales where tenant_id = ${tenantId}`;
    await tx`delete from tenants where id = ${tenantId}`;
  });
}

async function main() {
  const a = await crearTenantDePrueba("a");
  const b = await crearTenantDePrueba("b");

  const sqlTenant = postgres(requireEnv("DATABASE_URL_TENANT"), { prepare: false });

  try {
    // (a) Con app.tenant_id = A, solo se ven filas de A.
    await sqlTenant.begin(async (tx) => {
      await tx`select set_config('app.tenant_id', ${a.tenantId}, true)`;
      const rows = await tx<{ id: number }[]>`select id from productos`;
      const soloA = rows.length === 1 && rows[0].id === a.productoId;
      check("Aislamiento de filas (solo ve su propio tenant)", soloA);
    });

    // (b) Insertar un producto con tenant_id de A pero local_id de B debe
    // fallar por la FK compuesta, aunque la política RLS lo dejara pasar.
    let fkFallo = false;
    try {
      await sqlTenant.begin(async (tx) => {
        await tx`select set_config('app.tenant_id', ${a.tenantId}, true)`;
        await tx`
          insert into productos (tenant_id, nombre, categoria_id, talla, precio, local_id)
          values (${a.tenantId}, 'cruzado', ${a.categoriaId}, 'Única', 1000, ${b.localId})
        `;
      });
    } catch {
      fkFallo = true;
    }
    check("FK compuesta bloquea local de otro tenant", fkFallo);

    // (c) Sin SET LOCAL, current_setting(..., true) es null -> 0 filas
    // (falla cerrado, no abierto).
    await sqlTenant.begin(async (tx) => {
      const rows = await tx<{ id: number }[]>`select id from productos`;
      check("Fail-closed sin SET LOCAL (0 filas)", rows.length === 0);
    });
  } finally {
    await sqlTenant.end();
    await limpiarTenant(a.tenantId);
    await limpiarTenant(b.tenantId);
  }

  const fallos = resultados.filter((r) => !r.ok);
  if (fallos.length > 0) {
    console.error(`\n${fallos.length} caso(s) fallaron.`);
    process.exit(1);
  }
  console.log("\nTodos los casos de aislamiento pasaron.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
