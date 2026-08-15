-- Fase 1: movimientos de caja (apertura, cierre, retiro, pago a distribuidor).
-- Ejecutar una sola vez en Supabase Dashboard > SQL Editor.
--
-- A diferencia de ventas, cada movimiento de caja es una fila de auditoría
-- independiente sin invariantes cruzadas entre filas (el check de signo de
-- `monto` ya lo garantiza la tabla) -- no necesita una función security
-- definer, pero sí es de solo lectura/inserción: una vez registrado un
-- movimiento no se edita ni se borra, se corrige con un movimiento nuevo.

create table if not exists movimientos_caja (
  id bigint generated always as identity primary key,
  tenant_id uuid not null references tenants (id),
  local_id bigint not null,
  tipo text not null check (tipo in ('apertura', 'cierre', 'retiro', 'pago_distribuidor')),
  monto integer not null,
  motivo text,
  usuario_id bigint not null,
  fecha timestamptz not null default now(),
  unique (tenant_id, id),
  constraint movimientos_caja_local_tenant_fk
    foreign key (tenant_id, local_id) references locales (tenant_id, id),
  constraint movimientos_caja_usuario_tenant_fk
    foreign key (tenant_id, usuario_id) references usuarios (tenant_id, id),
  constraint monto_valido check (
    (tipo in ('apertura', 'cierre') and monto >= 0) or
    (tipo in ('retiro', 'pago_distribuidor') and monto > 0)
  )
);

create index if not exists movimientos_caja_tenant_local_idx on movimientos_caja (tenant_id, local_id);
create index if not exists movimientos_caja_tenant_local_fecha_idx on movimientos_caja (tenant_id, local_id, fecha);

alter table movimientos_caja enable row level security;

create policy tenant_isolation_select on movimientos_caja
  for select using (tenant_id = nullif(current_setting('app.tenant_id', true), '')::uuid);
create policy tenant_isolation_insert on movimientos_caja
  for insert with check (tenant_id = nullif(current_setting('app.tenant_id', true), '')::uuid);

grant select, insert on movimientos_caja to app_tenant;
revoke update, delete on movimientos_caja from app_tenant;

grant select, insert, update, delete on movimientos_caja to app_platform;
