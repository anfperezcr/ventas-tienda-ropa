import { SignJWT, jwtVerify } from "jose";

export const SESSION_COOKIE = "session";
const SESSION_DURATION = "30d";

export type Rol = "super_admin" | "owner" | "empleado";

export type SessionPayload = {
  usuarioId: number;
  usuario: string;
  nombre: string;
  rol: Rol;
  // null solo para super_admin.
  tenantId: string | null;
  localId: number | null;
};

function getSecret() {
  const secret = process.env.SESSION_SECRET;
  if (!secret) throw new Error("Falta la variable de entorno SESSION_SECRET");
  return new TextEncoder().encode(secret);
}

export async function signSession(payload: SessionPayload) {
  return new SignJWT({ ...payload })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(SESSION_DURATION)
    .sign(getSecret());
}

export async function verifySession(token: string): Promise<SessionPayload | null> {
  try {
    const { payload } = await jwtVerify(token, getSecret());
    return payload as unknown as SessionPayload;
  } catch {
    return null;
  }
}
