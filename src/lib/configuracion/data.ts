import { withTenant } from "@/lib/db/tenant";
import { platformSql } from "@/lib/db/platform";

export type Configuracion = {
  nombreNegocio: string;
  colorPrimario: string;
  logoUrl: string | null;
  mensajeRecibo: string;
};

export async function obtenerConfiguracion(tenantId: string): Promise<Configuracion> {
  return withTenant(tenantId, async (tx) => {
    const [row] = await tx<
      { nombre_negocio: string; color_primario: string; logo_url: string | null; mensaje_recibo: string }[]
    >`
      select nombre_negocio, color_primario, logo_url, mensaje_recibo
      from configuracion_tenant
    `;
    return {
      nombreNegocio: row.nombre_negocio,
      colorPrimario: row.color_primario,
      logoUrl: row.logo_url,
      mensajeRecibo: row.mensaje_recibo,
    };
  });
}

export type Branding = {
  nombreNegocio: string;
  colorPrimario: string;
  logoUrl: string | null;
};

// Se usa desde /login/[slug], antes de que exista sesión -- resuelve el
// tenant por slug vía app_platform (mismo cliente que ya usa
// POST /api/login). Si el slug no existe, null y la página cae al
// branding por defecto sin romper.
export async function obtenerBrandingPorSlug(slug: string): Promise<Branding | null> {
  const sql = platformSql();
  const rows = await sql<
    { nombre_negocio: string; color_primario: string; logo_url: string | null }[]
  >`
    select ct.nombre_negocio, ct.color_primario, ct.logo_url
    from tenants t
    join configuracion_tenant ct on ct.tenant_id = t.id
    where t.slug = ${slug}
  `;
  const row = rows[0];
  if (!row) return null;
  return {
    nombreNegocio: row.nombre_negocio,
    colorPrimario: row.color_primario,
    logoUrl: row.logo_url,
  };
}
