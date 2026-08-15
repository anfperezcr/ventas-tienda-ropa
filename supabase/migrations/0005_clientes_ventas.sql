-- Fase 1: clientes, ventas, detalle_venta, pagos, y la función atómica
-- registrar_venta. Ejecutar una sola vez en Supabase Dashboard > SQL Editor.

create table if not exists clientes (
  id bigint generated always as identity primary key,
  tenant_id uuid not null references tenants (id),
  nombre text not null,
  telefono text not null,
  total_comprado_historico integer not null default 0,
  created_at timestamptz not null default now(),
  unique (tenant_id, id),
  unique (tenant_id, telefono)
);

alter table clientes enable row level security;

create policy tenant_isolation_select on clientes
  for select using (tenant_id = nullif(current_setting('app.tenant_id', true), '')::uuid);
create policy tenant_isolation_insert on clientes
  for insert with check (tenant_id = nullif(current_setting('app.tenant_id', true), '')::uuid);
create policy tenant_isolation_update on clientes
  for update
  using (tenant_id = nullif(current_setting('app.tenant_id', true), '')::uuid)
  with check (tenant_id = nullif(current_setting('app.tenant_id', true), '')::uuid);
create policy tenant_isolation_delete on clientes
  for delete using (tenant_id = nullif(current_setting('app.tenant_id', true), '')::uuid);

grant select, insert, delete on clientes to app_tenant;
revoke update on clientes from app_tenant;
-- total_comprado_historico queda afuera por la misma razón que
-- productos.stock: solo lo acumula registrar_venta, nunca un UPDATE
-- suelto de la app.
grant update (nombre, telefono) on clientes to app_tenant;

grant select, insert, update, delete on clientes to app_platform;

-- ventas/detalle_venta/pagos: app_tenant solo puede LEER. Toda escritura
-- pasa por registrar_venta (security definer) para que el descuento de
-- stock, la suma de pagos y el total de cliente sean atómicos -- un
-- INSERT suelto de la app se saltaría esas validaciones.
create table if not exists ventas (
  id bigint generated always as identity primary key,
  tenant_id uuid not null references tenants (id),
  fecha timestamptz not null default now(),
  usuario_id bigint not null,
  cliente_id bigint,
  local_id bigint not null,
  total integer not null check (total >= 0),
  id_venta_publico text not null default '',
  unique (tenant_id, id),
  unique (tenant_id, id_venta_publico),
  constraint ventas_usuario_tenant_fk
    foreign key (tenant_id, usuario_id) references usuarios (tenant_id, id),
  constraint ventas_cliente_tenant_fk
    foreign key (tenant_id, cliente_id) references clientes (tenant_id, id),
  constraint ventas_local_tenant_fk
    foreign key (tenant_id, local_id) references locales (tenant_id, id)
);

create index if not exists ventas_tenant_local_idx on ventas (tenant_id, local_id);

alter table ventas enable row level security;

create policy tenant_isolation_select on ventas
  for select using (tenant_id = nullif(current_setting('app.tenant_id', true), '')::uuid);

grant select on ventas to app_tenant;
revoke insert, update, delete on ventas from app_tenant;

grant select, insert, update, delete on ventas to app_platform;

create table if not exists detalle_venta (
  id bigint generated always as identity primary key,
  tenant_id uuid not null references tenants (id),
  venta_id bigint not null,
  producto_id bigint not null,
  cantidad integer not null check (cantidad > 0),
  precio_unitario integer not null check (precio_unitario >= 0),
  unique (tenant_id, id),
  constraint detalle_venta_venta_tenant_fk
    foreign key (tenant_id, venta_id) references ventas (tenant_id, id),
  constraint detalle_venta_producto_tenant_fk
    foreign key (tenant_id, producto_id) references productos (tenant_id, id)
);

create index if not exists detalle_venta_tenant_venta_idx on detalle_venta (tenant_id, venta_id);

alter table detalle_venta enable row level security;

create policy tenant_isolation_select on detalle_venta
  for select using (tenant_id = nullif(current_setting('app.tenant_id', true), '')::uuid);

grant select on detalle_venta to app_tenant;
revoke insert, update, delete on detalle_venta from app_tenant;

grant select, insert, update, delete on detalle_venta to app_platform;

create table if not exists pagos (
  id bigint generated always as identity primary key,
  tenant_id uuid not null references tenants (id),
  venta_id bigint not null,
  metodo text not null check (metodo in ('efectivo', 'nequi', 'daviplata')),
  monto integer not null check (monto > 0),
  unique (tenant_id, id),
  constraint pagos_venta_tenant_fk
    foreign key (tenant_id, venta_id) references ventas (tenant_id, id)
);

create index if not exists pagos_tenant_venta_idx on pagos (tenant_id, venta_id);

alter table pagos enable row level security;

create policy tenant_isolation_select on pagos
  for select using (tenant_id = nullif(current_setting('app.tenant_id', true), '')::uuid);

grant select on pagos to app_tenant;
revoke insert, update, delete on pagos from app_tenant;

grant select, insert, update, delete on pagos to app_platform;

-- Registra una venta completa de forma atómica: valida que
-- usuario/local/cliente/productos pertenezcan al tenant declarado
-- (security definer bypasa RLS, así que esta validación explícita es el
-- único control de aislamiento real dentro de la función -- ver
-- CLAUDE.md §12), valida stock, descuenta inventario, guarda los pagos
-- (uno o varios para pago mixto) y acumula el total en el histórico del
-- cliente.
create or replace function public.registrar_venta(
  p_tenant_id uuid,
  p_usuario_id bigint,
  p_local_id bigint,
  p_cliente_id bigint,
  p_items jsonb,
  p_pagos jsonb
) returns bigint
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_venta_id bigint;
  v_total integer := 0;
  v_pagos_total integer := 0;
  v_item jsonb;
  v_pago jsonb;
  v_stock integer;
  v_producto_tenant uuid;
  v_producto_local bigint;
begin
  if not exists (
    select 1 from public.usuarios
    where id = p_usuario_id and tenant_id = p_tenant_id
  ) then
    raise exception 'Usuario % no pertenece al tenant', p_usuario_id;
  end if;

  if not exists (
    select 1 from public.locales
    where id = p_local_id and tenant_id = p_tenant_id
  ) then
    raise exception 'Local % no pertenece al tenant', p_local_id;
  end if;

  if p_cliente_id is not null and not exists (
    select 1 from public.clientes
    where id = p_cliente_id and tenant_id = p_tenant_id
  ) then
    raise exception 'Cliente % no pertenece al tenant', p_cliente_id;
  end if;

  select coalesce(sum((i->>'cantidad')::integer * (i->>'precio_unitario')::integer), 0)
    into v_total
  from jsonb_array_elements(p_items) i;

  if v_total <= 0 then
    raise exception 'La venta debe tener al menos un producto';
  end if;

  select coalesce(sum((p->>'monto')::integer), 0) into v_pagos_total
  from jsonb_array_elements(p_pagos) p;

  if v_pagos_total != v_total then
    raise exception 'La suma de los pagos (%) no coincide con el total (%)', v_pagos_total, v_total;
  end if;

  insert into public.ventas (tenant_id, usuario_id, cliente_id, local_id, total, id_venta_publico)
  values (p_tenant_id, p_usuario_id, p_cliente_id, p_local_id, v_total, '')
  returning id into v_venta_id;

  update public.ventas
  set id_venta_publico = lpad(v_venta_id::text, 6, '0')
  where id = v_venta_id and tenant_id = p_tenant_id;

  for v_item in select * from jsonb_array_elements(p_items)
  loop
    select stock, tenant_id, local_id into v_stock, v_producto_tenant, v_producto_local
    from public.productos
    where id = (v_item->>'producto_id')::bigint
    for update;

    if v_stock is null then
      raise exception 'Producto % no existe', v_item->>'producto_id';
    end if;
    if v_producto_tenant != p_tenant_id then
      raise exception 'Producto % no pertenece a este tenant', v_item->>'producto_id';
    end if;
    if v_producto_local != p_local_id then
      raise exception 'Producto % no pertenece a este local', v_item->>'producto_id';
    end if;
    if v_stock < (v_item->>'cantidad')::integer then
      raise exception 'Stock insuficiente para producto %', v_item->>'producto_id';
    end if;

    insert into public.detalle_venta (tenant_id, venta_id, producto_id, cantidad, precio_unitario)
    values (
      p_tenant_id,
      v_venta_id,
      (v_item->>'producto_id')::bigint,
      (v_item->>'cantidad')::integer,
      (v_item->>'precio_unitario')::integer
    );

    update public.productos
    set stock = stock - (v_item->>'cantidad')::integer
    where id = (v_item->>'producto_id')::bigint and tenant_id = p_tenant_id;
  end loop;

  for v_pago in select * from jsonb_array_elements(p_pagos)
  loop
    insert into public.pagos (tenant_id, venta_id, metodo, monto)
    values (p_tenant_id, v_venta_id, v_pago->>'metodo', (v_pago->>'monto')::integer);
  end loop;

  if p_cliente_id is not null then
    update public.clientes
    set total_comprado_historico = total_comprado_historico + v_total
    where id = p_cliente_id and tenant_id = p_tenant_id;
  end if;

  return v_venta_id;
end;
$$;

-- Postgres otorga EXECUTE a PUBLIC por defecto en funciones nuevas --
-- revocarlo explícito y dárselo solo a app_tenant.
revoke all on function public.registrar_venta(uuid, bigint, bigint, bigint, jsonb, jsonb) from public;
grant execute on function public.registrar_venta(uuid, bigint, bigint, bigint, jsonb, jsonb) to app_tenant;
