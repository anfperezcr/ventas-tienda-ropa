-- Fase 3: ajuste manual de stock fuera de una venta (correcciones de
-- inventario, conteos físicos, etc).
-- Ejecutar una sola vez en Supabase Dashboard > SQL Editor.
--
-- productos.stock ya no acepta UPDATE directo de app_tenant desde
-- 0004_categorias_productos.sql -- la única forma de moverlo es esta
-- función security definer (mismo patrón que registrar_venta en
-- 0005_clientes_ventas.sql), con su propia tabla de auditoría.

create table if not exists ajustes_stock (
  id bigint generated always as identity primary key,
  tenant_id uuid not null references tenants (id),
  producto_id bigint not null,
  delta integer not null,
  stock_resultante integer not null,
  motivo text,
  usuario_id bigint not null,
  fecha timestamptz not null default now(),
  unique (tenant_id, id),
  constraint ajustes_stock_producto_tenant_fk
    foreign key (tenant_id, producto_id) references productos (tenant_id, id),
  constraint ajustes_stock_usuario_tenant_fk
    foreign key (tenant_id, usuario_id) references usuarios (tenant_id, id)
);

create index if not exists ajustes_stock_tenant_producto_idx on ajustes_stock (tenant_id, producto_id);

alter table ajustes_stock enable row level security;

create policy tenant_isolation_select on ajustes_stock
  for select using (tenant_id = nullif(current_setting('app.tenant_id', true), '')::uuid);

grant select on ajustes_stock to app_tenant;
-- Solo vía ajustar_stock() -- ni siquiera insert directo.
revoke insert, update, delete on ajustes_stock from app_tenant;

grant select, insert, update, delete on ajustes_stock to app_platform;

create or replace function public.ajustar_stock(
  p_tenant_id uuid,
  p_usuario_id bigint,
  p_producto_id bigint,
  p_delta integer,
  p_motivo text
) returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_tenant uuid;
  v_stock integer;
begin
  select tenant_id, stock into v_tenant, v_stock
  from public.productos
  where id = p_producto_id
  for update;

  if v_tenant is null or v_tenant != p_tenant_id then
    raise exception 'Producto % no pertenece a este tenant', p_producto_id;
  end if;

  if not exists (
    select 1 from public.usuarios
    where id = p_usuario_id and tenant_id = p_tenant_id
  ) then
    raise exception 'Usuario % no pertenece al tenant', p_usuario_id;
  end if;

  if v_stock + p_delta < 0 then
    raise exception 'El ajuste dejaría el stock en negativo';
  end if;

  update public.productos
  set stock = stock + p_delta
  where id = p_producto_id and tenant_id = p_tenant_id;

  insert into public.ajustes_stock (tenant_id, producto_id, delta, stock_resultante, motivo, usuario_id)
  values (p_tenant_id, p_producto_id, p_delta, v_stock + p_delta, p_motivo, p_usuario_id);

  return v_stock + p_delta;
end;
$$;

revoke all on function public.ajustar_stock(uuid, bigint, bigint, integer, text) from public;
grant execute on function public.ajustar_stock(uuid, bigint, bigint, integer, text) to app_tenant;
