-- Fase 2: rastro de quién y cuándo suspendió/reactivó un tenant.
-- Ejecutar una sola vez en Supabase Dashboard > SQL Editor.
--
-- Mismo criterio que suscripciones.actualizado_por (migración 0002):
-- guarda el usuario (texto) del super_admin en sesión, no su id.

alter table tenants
  add column if not exists activo_actualizado_por text,
  add column if not exists activo_actualizado_en timestamptz;

-- app_platform ya tiene select/insert/update/delete completo sobre
-- tenants desde 0001 -- estas columnas nuevas quedan cubiertas sin
-- grants adicionales. app_tenant sigue sin ningún acceso a esta tabla
-- (revoke all en 0001).
