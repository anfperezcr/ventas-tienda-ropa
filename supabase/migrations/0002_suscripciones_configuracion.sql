-- Fase 1: suscripción (gate de acceso) y configuración por tenant.
-- Ejecutar una sola vez en Supabase Dashboard > SQL Editor.

-- Una fila activa por tenant. estado/fecha_vencimiento controlan el gate
-- de login (CLAUDE.md §6): 'vencido' da periodo de gracia de 5 días tras
-- fecha_vencimiento, 'suspendido' bloquea sin excepción.
create table if not exists suscripciones (
  id bigint generated always as identity primary key,
  tenant_id uuid not null unique references tenants (id),
  estado text not null check (estado in ('activo', 'vencido', 'suspendido')),
  fecha_ultimo_pago date,
  fecha_vencimiento date not null,
  monto integer not null default 30000 check (monto >= 0),
  metodo_pago text,
  notas text,
  actualizado_por text,
  actualizado_en timestamptz not null default now()
);

alter table suscripciones enable row level security;

-- Exclusiva de plataforma -- el propio tenant nunca debe poder leer ni
-- mucho menos escribir su estado de pago.
revoke all on suscripciones from app_tenant;

grant select, insert, update, delete on suscripciones to app_platform;

-- Personalización de la tienda: a diferencia de tenants/suscripciones,
-- esto SÍ lo edita el owner (CLAUDE.md §3: "Configura personalización de
-- su tienda"), así que lleva el patrón normal de RLS por tenant_id.
create table if not exists configuracion_tenant (
  tenant_id uuid primary key references tenants (id),
  nombre_negocio text not null,
  color_primario text not null default '#000000',
  logo_url text,
  mensaje_recibo text not null default 'Gracias por su compra, bendiciones'
);

alter table configuracion_tenant enable row level security;

create policy tenant_isolation_select on configuracion_tenant
  for select using (tenant_id = nullif(current_setting('app.tenant_id', true), '')::uuid);

create policy tenant_isolation_update on configuracion_tenant
  for update
  using (tenant_id = nullif(current_setting('app.tenant_id', true), '')::uuid)
  with check (tenant_id = nullif(current_setting('app.tenant_id', true), '')::uuid);

-- Sin insert/delete para app_tenant: la fila la crea app_platform al
-- aprovisionar el tenant (seed-tenant.ts / futuro panel de super_admin);
-- el owner solo la lee y actualiza sus propios campos de personalización.
grant select on configuracion_tenant to app_tenant;
revoke update on configuracion_tenant from app_tenant;
grant update (nombre_negocio, color_primario, logo_url, mensaje_recibo)
  on configuracion_tenant to app_tenant;
revoke insert, delete on configuracion_tenant from app_tenant;

grant select, insert, update, delete on configuracion_tenant to app_platform;
