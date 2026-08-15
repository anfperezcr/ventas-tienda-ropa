import bcrypt from "bcryptjs";
import { withPlatform } from "../src/lib/db/platform";

// Mientras no exista el panel de super_admin (Fase 2), este script
// aprovisiona un tenant de prueba a mano. Requiere DATABASE_URL_PLATFORM
// en .env.local.
process.loadEnvFile(".env.local");

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`Falta la variable de entorno ${name}`);
  return value;
}

const TENANT = {
  slug: requireEnv("SEED_TENANT_SLUG"),
  nombreNegocio: requireEnv("SEED_TENANT_NOMBRE"),
};

const OWNER = {
  nombre: requireEnv("SEED_OWNER_NOMBRE"),
  usuario: requireEnv("SEED_OWNER_USUARIO"),
  password: requireEnv("SEED_OWNER_PASSWORD"),
};

async function seed() {
  const passwordHash = await bcrypt.hash(OWNER.password, 10);

  const resultado = await withPlatform(async (tx) => {
    const [tenant] = await tx<{ id: string }[]>`
      insert into tenants (nombre_negocio, slug)
      values (${TENANT.nombreNegocio}, ${TENANT.slug})
      returning id
    `;

    const hoy = new Date();
    const vencimiento = new Date(hoy);
    vencimiento.setDate(vencimiento.getDate() + 30);

    await tx`
      insert into suscripciones (tenant_id, estado, fecha_ultimo_pago, fecha_vencimiento, monto, metodo_pago)
      values (
        ${tenant.id},
        'activo',
        ${hoy.toISOString().slice(0, 10)},
        ${vencimiento.toISOString().slice(0, 10)},
        30000,
        'manual'
      )
    `;

    await tx`
      insert into configuracion_tenant (tenant_id, nombre_negocio)
      values (${tenant.id}, ${TENANT.nombreNegocio})
    `;

    const [local] = await tx<{ id: number }[]>`
      insert into locales (tenant_id, nombre)
      values (${tenant.id}, 'Principal')
      returning id
    `;

    const [owner] = await tx<{ id: number }[]>`
      insert into usuarios (tenant_id, nombre, usuario, password_hash, rol, local_id)
      values (${tenant.id}, ${OWNER.nombre}, ${OWNER.usuario}, ${passwordHash}, 'owner', ${local.id})
      returning id
    `;

    return { tenantId: tenant.id, localId: local.id, ownerId: owner.id };
  });

  console.log("Tenant creado:", resultado);
  console.log(`Login: /login/${TENANT.slug} con usuario "${OWNER.usuario}"`);
}

seed()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
