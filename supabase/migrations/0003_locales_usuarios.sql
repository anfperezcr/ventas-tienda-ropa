-- Fase 1: locales y usuarios, con login casero (no Supabase Auth).
-- Ejecutar una sola vez en Supabase Dashboard > SQL Editor.

create table if not exists locales (
  id bigint generated always as identity primary key,
  tenant_id uuid not null references tenants (id),
  nombre text not null,
  created_at timestamptz not null default now(),
  unique (tenant_id, id),
  unique (tenant_id, nombre)
);

alter table locales enable row level security;

create policy tenant_isolation_select on locales
  for select using (tenant_id = nullif(current_setting('app.tenant_id', true), '')::uuid);
create policy tenant_isolation_insert on locales
  for insert with check (tenant_id = nullif(current_setting('app.tenant_id', true), '')::uuid);
create policy tenant_isolation_update on locales
  for update
  using (tenant_id = nullif(current_setting('app.tenant_id', true), '')::uuid)
  with check (tenant_id = nullif(current_setting('app.tenant_id', true), '')::uuid);
create policy tenant_isolation_delete on locales
  for delete using (tenant_id = nullif(current_setting('app.tenant_id', true), '')::uuid);

grant select, insert, delete on locales to app_tenant;
revoke update on locales from app_tenant;
grant update (nombre) on locales to app_tenant;

grant select, insert, update, delete on locales to app_platform;

-- tenant_id null SOLO para super_admin (usuario de plataforma, sin tienda
-- asociada). owner/empleado siempre llevan tenant_id.
create table if not exists usuarios (
  id bigint generated always as identity primary key,
  tenant_id uuid references tenants (id),
  nombre text not null,
  usuario text not null,
  password_hash text not null,
  rol text not null check (rol in ('super_admin', 'owner', 'empleado')),
  local_id bigint,
  activo boolean not null default true,
  created_at timestamptz not null default now(),
  unique (tenant_id, id),
  constraint usuarios_local_tenant_fk
    foreign key (tenant_id, local_id) references locales (tenant_id, id),
  constraint usuarios_rol_tenant_chk check (
    (rol = 'super_admin' and tenant_id is null) or
    (rol in ('owner', 'empleado') and tenant_id is not null)
  )
);

-- usuario único POR tenant (ajuste del usuario: en el hermano era único
-- global, ahí rompería con varios clientes). Los super_admin (tenant_id
-- null) necesitan su propio índice único parcial porque NULL != NULL no
-- lo cubre el constraint compuesto.
alter table usuarios add constraint usuarios_tenant_usuario_uniq unique (tenant_id, usuario);
create unique index usuarios_usuario_super_admin_uidx on usuarios (usuario) where tenant_id is null;

alter table usuarios enable row level security;

-- Estas políticas también protegen a los super_admin "gratis": tenant_id
-- es null en esas filas, y null = current_setting(...)::uuid nunca es
-- true, así que app_tenant jamás los ve.
create policy tenant_isolation_select on usuarios
  for select using (tenant_id = nullif(current_setting('app.tenant_id', true), '')::uuid);
create policy tenant_isolation_insert on usuarios
  for insert with check (tenant_id = nullif(current_setting('app.tenant_id', true), '')::uuid);
create policy tenant_isolation_update on usuarios
  for update
  using (tenant_id = nullif(current_setting('app.tenant_id', true), '')::uuid)
  with check (tenant_id = nullif(current_setting('app.tenant_id', true), '')::uuid);
create policy tenant_isolation_delete on usuarios
  for delete using (tenant_id = nullif(current_setting('app.tenant_id', true), '')::uuid);

grant select, insert, delete on usuarios to app_tenant;
revoke update on usuarios from app_tenant;
grant update (nombre, usuario, password_hash, rol, local_id, activo) on usuarios to app_tenant;

grant select, insert, update, delete on usuarios to app_platform;
