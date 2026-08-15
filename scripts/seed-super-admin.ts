import bcrypt from "bcryptjs";
import { withPlatform } from "../src/lib/db/platform";

// No hay auto-registro (CLAUDE.md §8): el primer super_admin hay que
// crearlo a mano una sola vez. De ahí en adelante, el panel (Fase 2) crea
// tenants nuevos, pero super_admin en sí no se auto-crea desde la UI.
process.loadEnvFile(".env.local");

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`Falta la variable de entorno ${name}`);
  return value;
}

const SUPERADMIN = {
  nombre: requireEnv("SEED_SUPERADMIN_NOMBRE"),
  usuario: requireEnv("SEED_SUPERADMIN_USUARIO"),
  password: requireEnv("SEED_SUPERADMIN_PASSWORD"),
};

async function seed() {
  const passwordHash = await bcrypt.hash(SUPERADMIN.password, 10);

  const resultado = await withPlatform(async (tx) => {
    const [usuario] = await tx<{ id: number }[]>`
      insert into usuarios (tenant_id, nombre, usuario, password_hash, rol)
      values (null, ${SUPERADMIN.nombre}, ${SUPERADMIN.usuario}, ${passwordHash}, 'super_admin')
      returning id
    `;
    return { usuarioId: usuario.id };
  });

  console.log("super_admin creado:", resultado);
  console.log(`Login: /super-admin/login con usuario "${SUPERADMIN.usuario}"`);
}

seed()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
