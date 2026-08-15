-- Fase 7.4: idempotencia para movimientos de caja encolados offline (mismo
-- criterio que 0010_ventas_client_ref.sql para ventas). A diferencia de
-- registrar_venta, los movimientos de caja son inserts planos en código
-- de aplicación (no una función RPC) -- la idempotencia se implementa en
-- src/lib/caja/actions.ts con un select previo por client_ref, ya scoped
-- por RLS al tenant en sesión (no security definer, no hace falta repetir
-- tenant_id a mano en la query).
-- Ejecutar una sola vez en Supabase Dashboard > SQL Editor.

alter table movimientos_caja add column if not exists client_ref text;

-- unique(tenant_id, client_ref), mismo criterio compuesto que ventas.
alter table movimientos_caja
  add constraint movimientos_caja_tenant_client_ref_uniq unique (tenant_id, client_ref);
