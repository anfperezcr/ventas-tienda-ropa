import { NextResponse } from "next/server";
import { platformSql } from "@/lib/db/platform";
import { withTenant } from "@/lib/db/tenant";
import { verifyPassword } from "@/lib/auth/password";
import { SESSION_COOKIE, signSession, type Rol } from "@/lib/auth/session";
import { evaluarAcceso } from "@/lib/suscripciones/gate";

type UsuarioAuth = {
  id: number;
  tenant_id: string | null;
  nombre: string;
  usuario: string;
  password_hash: string;
  rol: Rol;
  local_id: number | null;
  activo: boolean;
};

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  if (
    !body ||
    typeof body.usuario !== "string" ||
    typeof body.password !== "string"
  ) {
    return NextResponse.json({ error: "Datos inválidos" }, { status: 400 });
  }

  const { usuario, password } = body;
  const slug: string | null = typeof body.slug === "string" ? body.slug : null;

  let user: UsuarioAuth | null = null;

  if (slug) {
    // Login de owner/empleado: el slug identifica el tenant, el usuario
    // ya no es único global (CLAUDE.md §12 / ajuste del usuario).
    const tenantRows = await platformSql()<{ id: string }[]>`
      select id from tenants where slug = ${slug}
    `;
    const tenant = tenantRows[0];
    if (!tenant) {
      return NextResponse.json({ error: "Tienda no encontrada" }, { status: 404 });
    }

    user = await withTenant(tenant.id, async (tx) => {
      const rows = await tx<UsuarioAuth[]>`
        select id, tenant_id, nombre, usuario, password_hash, rol, local_id, activo
        from usuarios
        where usuario = ${usuario}
      `;
      return rows[0] ?? null;
    });
  } else {
    // Login de super_admin: sin slug, tenant_id null.
    const rows = await platformSql()<UsuarioAuth[]>`
      select id, tenant_id, nombre, usuario, password_hash, rol, local_id, activo
      from usuarios
      where usuario = ${usuario} and tenant_id is null and rol = 'super_admin'
    `;
    user = rows[0] ?? null;
  }

  if (!user || !(await verifyPassword(password, user.password_hash))) {
    return NextResponse.json(
      { error: "Usuario o contraseña incorrectos" },
      { status: 401 }
    );
  }

  if (!user.activo) {
    return NextResponse.json(
      { error: "Este usuario está desactivado" },
      { status: 403 }
    );
  }

  if (user.rol !== "super_admin" && user.tenant_id) {
    const acceso = await evaluarAcceso(user.tenant_id);
    if (acceso === "bloqueado") {
      return NextResponse.json(
        { error: "La suscripción de esta tienda está vencida o suspendida" },
        { status: 403 }
      );
    }
  }

  const token = await signSession({
    usuarioId: user.id,
    usuario: user.usuario,
    nombre: user.nombre,
    rol: user.rol,
    tenantId: user.tenant_id,
    localId: user.local_id,
  });

  const response = NextResponse.json({
    usuarioId: user.id,
    usuario: user.usuario,
    nombre: user.nombre,
    rol: user.rol,
    tenantId: user.tenant_id,
    localId: user.local_id,
  });

  response.cookies.set(SESSION_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 30,
  });

  return response;
}
