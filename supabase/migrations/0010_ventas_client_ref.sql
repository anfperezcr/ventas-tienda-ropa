-- Fase 7.3: idempotencia para ventas encoladas offline. Un client_ref
-- generado en el navegador (crypto.randomUUID()) identifica una venta de
-- forma única antes de que exista fila en el servidor -- si la misma
-- venta se reintenta sincronizar (ej. la respuesta del primer intento se
-- perdió pero sí se guardó), registrar_venta devuelve el id ya creado en
-- vez de insertar de nuevo.
-- Ejecutar una sola vez en Supabase Dashboard > SQL Editor.

alter table ventas add column if not exists client_ref text;

-- unique(tenant_id, client_ref) y no un unique global suelto -- mismo
-- criterio de constraint compuesta que el resto del schema desde Fase 1.
-- null no colisiona consigo mismo en un unique de Postgres, así que las
-- ventas sin client_ref (todo lo que no pasó por Fase 7.3, y cualquier
-- venta futura donde no se use) no se ven afectadas.
alter table ventas add constraint ventas_tenant_client_ref_uniq unique (tenant_id, client_ref);

-- create or replace no alcanza para "reemplazar" una función si cambia
-- la lista de parámetros -- Postgres la trataría como un overload nuevo
-- y dejaría la versión de 6 argumentos de Fase 1 viva y alcanzable. Se
-- elimina explícita antes de crear la versión de 7 argumentos.
drop function if exists public.registrar_venta(uuid, bigint, bigint, bigint, jsonb, jsonb);

create or replace function public.registrar_venta(
  p_tenant_id uuid,
  p_usuario_id bigint,
  p_local_id bigint,
  p_cliente_id bigint,
  p_items jsonb,
  p_pagos jsonb,
  p_client_ref text default null
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
  if p_client_ref is not null then
    select id into v_venta_id
    from public.ventas
    where tenant_id = p_tenant_id and client_ref = p_client_ref;

    if v_venta_id is not null then
      return v_venta_id;
    end if;
  end if;

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

  insert into public.ventas (tenant_id, usuario_id, cliente_id, local_id, total, id_venta_publico, client_ref)
  values (p_tenant_id, p_usuario_id, p_cliente_id, p_local_id, v_total, '', p_client_ref)
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

revoke all on function public.registrar_venta(uuid, bigint, bigint, bigint, jsonb, jsonb, text) from public;
grant execute on function public.registrar_venta(uuid, bigint, bigint, bigint, jsonb, jsonb, text) to app_tenant;
