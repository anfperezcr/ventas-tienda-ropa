import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { SESSION_COOKIE, verifySession } from "@/lib/auth/session";

// Next.js 16 renombró middleware.ts -> proxy.ts (ver
// node_modules/next/dist/docs/01-app/03-api-reference/03-file-conventions/proxy.md).
export async function proxy(request: NextRequest) {
  const token = request.cookies.get(SESSION_COOKIE)?.value;
  const session = token ? await verifySession(token) : null;

  const esSuperAdmin = request.nextUrl.pathname.startsWith("/super-admin");

  if (!session) {
    return NextResponse.redirect(
      new URL(esSuperAdmin ? "/super-admin/login" : "/", request.url)
    );
  }

  // Segunda capa además del rol -- cada Server Action de super_admin
  // repite este chequeo (src/lib/auth/guards.ts) por si se invoca sin
  // pasar por esta ruta.
  if (esSuperAdmin && session.rol !== "super_admin") {
    return NextResponse.redirect(new URL("/", request.url));
  }

  return NextResponse.next();
}

// /super-admin/login queda fuera a propósito (es la página de login de
// esa zona, no puede exigir sesión para poder mostrarse).
export const config = {
  matcher: [
    "/dashboard/:path*",
    "/productos/:path*",
    "/venta/:path*",
    "/caja/:path*",
    "/sincronizacion/:path*",
    "/reportes/:path*",
    "/locales/:path*",
    "/usuarios/:path*",
    "/configuracion/:path*",
    "/super-admin",
    "/super-admin/((?!login).*)",
  ],
};
