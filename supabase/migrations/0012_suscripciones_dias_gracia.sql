-- Días de gracia configurables por tenant (antes era una constante global
-- fija en código, src/lib/suscripciones/estado.ts). El default 5 preserva
-- el comportamiento actual para todos los tenants ya existentes.
-- Ejecutar una sola vez en Supabase Dashboard > SQL Editor.

alter table suscripciones
  add column if not exists dias_gracia integer not null default 5 check (dias_gracia >= 0);
