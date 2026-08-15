-- Fase 1 (corrección): current_setting('app.tenant_id', true) puede
-- devolver '' (string vacío) en vez de null cuando nunca se llamó
-- set_config en la transacción -- detectado al correr
-- scripts/verificar-rls.ts (caso "fail-closed sin SET LOCAL"), que hasta
-- ahora tiraba "invalid input syntax for type uuid" en vez de devolver 0
-- filas. No afecta al tráfico normal de la app (withTenant() siempre
-- llama set_config primero), pero rompe la garantía de "falla cerrado"
-- documentada en CLAUDE.md §12 para cualquier acceso que no pase por ahí
-- (ej. una conexión manual con el rol app_tenant).
--
-- Fix: envolver con nullif(..., '') antes del cast, así tanto null como
-- '' colapsan a null -- nullif(null, '') también da null, así que es
-- seguro para ambos casos.
--
-- Ejecutar una sola vez en Supabase Dashboard > SQL Editor. Reemplaza
-- las políticas ya creadas por 0002-0006; los archivos fuente de esas
-- migraciones ya quedaron actualizados con la expresión corregida para
-- que un despliegue nuevo desde cero no tenga que pasar por este parche.

drop policy tenant_isolation_select on configuracion_tenant;
create policy tenant_isolation_select on configuracion_tenant
  for select using (tenant_id = nullif(current_setting('app.tenant_id', true), '')::uuid);
drop policy tenant_isolation_update on configuracion_tenant;
create policy tenant_isolation_update on configuracion_tenant
  for update
  using (tenant_id = nullif(current_setting('app.tenant_id', true), '')::uuid)
  with check (tenant_id = nullif(current_setting('app.tenant_id', true), '')::uuid);

drop policy tenant_isolation_select on locales;
create policy tenant_isolation_select on locales
  for select using (tenant_id = nullif(current_setting('app.tenant_id', true), '')::uuid);
drop policy tenant_isolation_insert on locales;
create policy tenant_isolation_insert on locales
  for insert with check (tenant_id = nullif(current_setting('app.tenant_id', true), '')::uuid);
drop policy tenant_isolation_update on locales;
create policy tenant_isolation_update on locales
  for update
  using (tenant_id = nullif(current_setting('app.tenant_id', true), '')::uuid)
  with check (tenant_id = nullif(current_setting('app.tenant_id', true), '')::uuid);
drop policy tenant_isolation_delete on locales;
create policy tenant_isolation_delete on locales
  for delete using (tenant_id = nullif(current_setting('app.tenant_id', true), '')::uuid);

drop policy tenant_isolation_select on usuarios;
create policy tenant_isolation_select on usuarios
  for select using (tenant_id = nullif(current_setting('app.tenant_id', true), '')::uuid);
drop policy tenant_isolation_insert on usuarios;
create policy tenant_isolation_insert on usuarios
  for insert with check (tenant_id = nullif(current_setting('app.tenant_id', true), '')::uuid);
drop policy tenant_isolation_update on usuarios;
create policy tenant_isolation_update on usuarios
  for update
  using (tenant_id = nullif(current_setting('app.tenant_id', true), '')::uuid)
  with check (tenant_id = nullif(current_setting('app.tenant_id', true), '')::uuid);
drop policy tenant_isolation_delete on usuarios;
create policy tenant_isolation_delete on usuarios
  for delete using (tenant_id = nullif(current_setting('app.tenant_id', true), '')::uuid);

drop policy tenant_isolation_select on categorias;
create policy tenant_isolation_select on categorias
  for select using (tenant_id = nullif(current_setting('app.tenant_id', true), '')::uuid);
drop policy tenant_isolation_insert on categorias;
create policy tenant_isolation_insert on categorias
  for insert with check (tenant_id = nullif(current_setting('app.tenant_id', true), '')::uuid);
drop policy tenant_isolation_update on categorias;
create policy tenant_isolation_update on categorias
  for update
  using (tenant_id = nullif(current_setting('app.tenant_id', true), '')::uuid)
  with check (tenant_id = nullif(current_setting('app.tenant_id', true), '')::uuid);
drop policy tenant_isolation_delete on categorias;
create policy tenant_isolation_delete on categorias
  for delete using (tenant_id = nullif(current_setting('app.tenant_id', true), '')::uuid);

drop policy tenant_isolation_select on productos;
create policy tenant_isolation_select on productos
  for select using (tenant_id = nullif(current_setting('app.tenant_id', true), '')::uuid);
drop policy tenant_isolation_insert on productos;
create policy tenant_isolation_insert on productos
  for insert with check (tenant_id = nullif(current_setting('app.tenant_id', true), '')::uuid);
drop policy tenant_isolation_update on productos;
create policy tenant_isolation_update on productos
  for update
  using (tenant_id = nullif(current_setting('app.tenant_id', true), '')::uuid)
  with check (tenant_id = nullif(current_setting('app.tenant_id', true), '')::uuid);
drop policy tenant_isolation_delete on productos;
create policy tenant_isolation_delete on productos
  for delete using (tenant_id = nullif(current_setting('app.tenant_id', true), '')::uuid);

drop policy tenant_isolation_select on clientes;
create policy tenant_isolation_select on clientes
  for select using (tenant_id = nullif(current_setting('app.tenant_id', true), '')::uuid);
drop policy tenant_isolation_insert on clientes;
create policy tenant_isolation_insert on clientes
  for insert with check (tenant_id = nullif(current_setting('app.tenant_id', true), '')::uuid);
drop policy tenant_isolation_update on clientes;
create policy tenant_isolation_update on clientes
  for update
  using (tenant_id = nullif(current_setting('app.tenant_id', true), '')::uuid)
  with check (tenant_id = nullif(current_setting('app.tenant_id', true), '')::uuid);
drop policy tenant_isolation_delete on clientes;
create policy tenant_isolation_delete on clientes
  for delete using (tenant_id = nullif(current_setting('app.tenant_id', true), '')::uuid);

drop policy tenant_isolation_select on ventas;
create policy tenant_isolation_select on ventas
  for select using (tenant_id = nullif(current_setting('app.tenant_id', true), '')::uuid);

drop policy tenant_isolation_select on detalle_venta;
create policy tenant_isolation_select on detalle_venta
  for select using (tenant_id = nullif(current_setting('app.tenant_id', true), '')::uuid);

drop policy tenant_isolation_select on pagos;
create policy tenant_isolation_select on pagos
  for select using (tenant_id = nullif(current_setting('app.tenant_id', true), '')::uuid);

drop policy tenant_isolation_select on movimientos_caja;
create policy tenant_isolation_select on movimientos_caja
  for select using (tenant_id = nullif(current_setting('app.tenant_id', true), '')::uuid);
drop policy tenant_isolation_insert on movimientos_caja;
create policy tenant_isolation_insert on movimientos_caja
  for insert with check (tenant_id = nullif(current_setting('app.tenant_id', true), '')::uuid);
