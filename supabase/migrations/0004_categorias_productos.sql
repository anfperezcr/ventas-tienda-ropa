-- Fase 1: categorías (configurables por tenant, no enum fijo) y productos.
-- Ejecutar una sola vez en Supabase Dashboard > SQL Editor.

create table if not exists categorias (
  id bigint generated always as identity primary key,
  tenant_id uuid not null references tenants (id),
  nombre text not null,
  tallas_sugeridas text[] not null default '{}',
  created_at timestamptz not null default now(),
  unique (tenant_id, id),
  unique (tenant_id, nombre)
);

alter table categorias enable row level security;

create policy tenant_isolation_select on categorias
  for select using (tenant_id = nullif(current_setting('app.tenant_id', true), '')::uuid);
create policy tenant_isolation_insert on categorias
  for insert with check (tenant_id = nullif(current_setting('app.tenant_id', true), '')::uuid);
create policy tenant_isolation_update on categorias
  for update
  using (tenant_id = nullif(current_setting('app.tenant_id', true), '')::uuid)
  with check (tenant_id = nullif(current_setting('app.tenant_id', true), '')::uuid);
create policy tenant_isolation_delete on categorias
  for delete using (tenant_id = nullif(current_setting('app.tenant_id', true), '')::uuid);

grant select, insert, delete on categorias to app_tenant;
revoke update on categorias from app_tenant;
grant update (nombre, tallas_sugeridas) on categorias to app_tenant;

grant select, insert, update, delete on categorias to app_platform;

create table if not exists productos (
  id bigint generated always as identity primary key,
  tenant_id uuid not null references tenants (id),
  nombre text not null,
  categoria_id bigint not null,
  talla text not null,
  precio integer not null check (precio >= 0),
  stock integer not null default 0 check (stock >= 0),
  stock_minimo integer not null default 5 check (stock_minimo >= 0),
  local_id bigint not null,
  activo boolean not null default true,
  imagen_url text,
  created_at timestamptz not null default now(),
  unique (tenant_id, id),
  constraint productos_categoria_tenant_fk
    foreign key (tenant_id, categoria_id) references categorias (tenant_id, id),
  constraint productos_local_tenant_fk
    foreign key (tenant_id, local_id) references locales (tenant_id, id)
);

create index if not exists productos_tenant_local_idx on productos (tenant_id, local_id);

alter table productos enable row level security;

create policy tenant_isolation_select on productos
  for select using (tenant_id = nullif(current_setting('app.tenant_id', true), '')::uuid);
create policy tenant_isolation_insert on productos
  for insert with check (tenant_id = nullif(current_setting('app.tenant_id', true), '')::uuid);
create policy tenant_isolation_update on productos
  for update
  using (tenant_id = nullif(current_setting('app.tenant_id', true), '')::uuid)
  with check (tenant_id = nullif(current_setting('app.tenant_id', true), '')::uuid);
create policy tenant_isolation_delete on productos
  for delete using (tenant_id = nullif(current_setting('app.tenant_id', true), '')::uuid);

grant select, insert, delete on productos to app_tenant;
revoke update on productos from app_tenant;
-- stock queda AFUERA: solo se mueve vía funciones security definer
-- auditadas (registrar_venta en 0005, registrar_devolucion/ajustar_stock
-- en Fase 3) -- ver CLAUDE.md §12.
grant update (nombre, categoria_id, talla, precio, stock_minimo, local_id, activo, imagen_url)
  on productos to app_tenant;

grant select, insert, update, delete on productos to app_platform;
