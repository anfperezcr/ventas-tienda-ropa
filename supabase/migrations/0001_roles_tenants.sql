-- Fase 1: roles de aplicación y tabla de tenants.
-- Ejecutar una sola vez en Supabase Dashboard > SQL Editor.
--
-- Patrón completo (por qué dos roles, por qué SET LOCAL app.tenant_id en
-- vez de auth.jwt()) documentado en CLAUDE.md §12.
--
-- IMPORTANTE: después de correr esta migración, setear las passwords A
-- MANO en este mismo SQL Editor (nunca en un archivo del repo, nunca
-- pasadas en texto plano a Claude):
--   alter role app_tenant with password '<password-fuerte>';
--   alter role app_platform with password '<password-fuerte>';
-- Luego arma las cadenas de conexión del pooler en modo transacción
-- (puerto 6543) con el usuario "<rol>.<project-ref>" -- ver Project
-- Settings > Database > Connection string.

-- app_tenant: usado por toda operación de owner/empleado. Rol normal, sin
-- superuser ni bypassrls -- RLS lo alcanza de lleno.
create role app_tenant with login;

-- app_platform: usado solo por operaciones de super_admin (gestión de
-- tenants/suscripciones/configuracion_tenant, resolver tenant_id por slug
-- en el login, y scripts de bootstrap como seed-tenant). bypassrls,
-- análogo al service_role del proyecto hermano pero de uso restringido a
-- código server-side de plataforma -- nunca se expone a owner/empleado.
create role app_platform with login bypassrls;

-- Supabase puede revocar CONNECT/USAGE de PUBLIC por defecto -- no
-- asumir, otorgar explícito.
grant connect on database postgres to app_tenant, app_platform;
grant usage on schema public to app_tenant, app_platform;

create table if not exists tenants (
  id uuid primary key default gen_random_uuid(),
  nombre_negocio text not null,
  slug text not null unique,
  activo boolean not null default true,
  creado_en timestamptz not null default now()
);

alter table tenants enable row level security;

-- app_tenant no debe ver esta tabla en absoluto -- es el registro de
-- tenants en sí, exclusivo de plataforma. Explícito: no confiar en la
-- ausencia de políticas.
revoke all on tenants from app_tenant;

grant select, insert, update, delete on tenants to app_platform;
