# CLAUDE.md — SaaS de Ventas y Stock para Tiendas de Ropa

Este archivo es el contexto de referencia del proyecto. Léelo completo antes de empezar cualquier fase nueva. Si algo cambia durante el desarrollo, actualízalo.

---

## 1. Qué es este proyecto

Una aplicación de punto de venta (POS) + inventario para tiendas de ropa (jeans, blusas, chaquetas, sacos), vendida como **SaaS por suscripción**: un mismo sistema atiende a **varios negocios clientes** (tenants), cada uno con sus propios locales, productos, empleados y datos — completamente aislados entre sí.

Yo (el desarrollador) actúo como **super-admin** de la plataforma: doy de alta tiendas nuevas, controlo el estado de pago de cada una, y puedo suspender el acceso si no pagan la suscripción (30.000 COP/mes, cobro manual, sin pasarela).

Existe un proyecto hermano previo, mono-tienda (para un negocio familiar con dos locales), del cual se reusa la mayoría de la lógica de negocio (ventas, stock, caja). Este proyecto le agrega una capa de multi-tenancy y control de suscripción encima.

---

## 2. Contexto de negocio (aplica a cada tienda/tenant)

- Cada tienda cliente puede tener uno o varios locales físicos.
- Vende chaquetas, sacos, jeans, blusas (categorías extensibles).
- Pagos en tienda: efectivo (principal), Nequi, Daviplata, o **mixto** (parte efectivo + parte digital). Los pagos digitales no se integran por API — solo se registran manualmente como control interno.
- Empleados a veces mayores de 60 años → interfaz **muy simple, táctil, botones grandes**.
- El PC del mostrador suele tener **pantalla táctil**.
- Los locales **no tienen internet fijo garantizado** → el sistema debe funcionar sin conexión y sincronizar cuando haya wifi.
- Presupuesto de infraestructura: **$0**. Solo herramientas/planes gratuitos (Supabase free, Vercel free).

---

## 3. Roles y permisos (3 niveles)

### `super_admin` (yo, la plataforma)
- Ve todos los tenants (tiendas clientes) y su estado de suscripción.
- Crea tenants nuevos (y su primer usuario `owner`).
- Marca pagos recibidos, suspende o reactiva acceso manualmente.
- Ve métricas globales (cuántos tenants activos, ingreso proyectado).
- **No** opera ventas ni ve el detalle operativo interno de cada tienda (solo lo administrativo/suscripción).

### `owner` (dueño de la tienda cliente)
- CRUD completo de productos (crear, editar, eliminar, ajustar stock) — **solo de su tenant**.
- Ve ventas de sus locales (consolidado o filtrado por local).
- Ve desglose diario por método de pago.
- Ve ranking de clientes de su tienda.
- Ve y registra movimientos de caja.
- Crea usuarios empleados y les asigna local.
- Configura personalización de su tienda (nombre, color, logo, mensaje de recibo).
- Acceso desde celular, tablet o PC, desde cualquier lugar (una vez sincronizado).

### `empleado`
- Registra ventas (uno o varios productos, pago único o mixto).
- Ve stock disponible de su local.
- Ve alertas de stock bajo.
- Abre/cierra caja de su turno.
- **No** ve reportes de otros empleados, ranking de clientes, ni gestión de usuarios/productos.

**Regla de aislamiento:** un `owner` o `empleado` de un tenant JAMÁS debe poder ver ni modificar datos de otro tenant. Esto se garantiza a nivel de base de datos (Row Level Security), no solo con condicionales en el frontend.

---

## 4. Arquitectura técnica

| Componente | Tecnología | Motivo |
|---|---|---|
| Frontend | Next.js (React 19) + Tailwind | Un solo código sirve para PC, tablet y celular; PWA instalable |
| Backend / API | Next.js API routes | Simplicidad, todo en un solo proyecto |
| Base de datos | **Un único proyecto Supabase (Postgres) compartido**, con `tenant_id` en cada tabla y Row Level Security (RLS) activado | Con plan gratis, un proyecto por cliente no escala (se acaba el cupo gratuito rápido). RLS aísla los datos aunque haya un bug en el frontend |
| Auth | Casera: tabla `usuarios` + `password_hash` (bcrypt) + sesión por JWT firmado (no Supabase Auth) | Empleados usan "usuario" simple, no email; no hay auto-registro, las cuentas las crea el owner o el super_admin |
| Hosting | Vercel (plan gratuito) | Deploy único, HTTPS automático, sirve a todos los tenants |
| Modo offline | IndexedDB (local) + cola de sincronización a Supabase | El mostrador no puede depender de tener internet en el momento |
| Instalación | PWA (Progressive Web App) | Se instala desde el navegador en cualquier dispositivo, sin tienda de apps |
| Impresora térmica + cajón de dinero | Servicio puente local (Node.js) corriendo en el PC del mostrador (Windows) | Un navegador no le habla directo al hardware; solo aplica a mostradores con PC, no a tablets/celulares |
| Imágenes de producto | Supabase Storage, bucket `productos` (público, solo lectura) | Foto real subida desde el dispositivo, no solo URL pegada a mano; ver detalle abajo |

**Subida de imágenes (Storage):** canal aparte de la conexión Postgres de
arriba (usa la API REST de Supabase, no `postgres.js`). Como el auth es
casero (no Supabase Auth), las políticas RLS de `storage.objects` no
aplican -- en su lugar, **solo código server-only** (`src/lib/storage/`)
sube o borra objetos, usando la service role key (nunca en un archivo
`"use client"`, nunca en el navegador). El aislamiento por tenant se hace
por convención de ruta (`productos/{tenantId}/{uuid}.ext`), no por
política de Storage -- el bucket es público de solo lectura porque son
solo fotos de producto, no datos de negocio. Antes de subir, el archivo
se redimensiona/recomprime en `<canvas>` en el navegador (máx ~1600px,
JPEG ~80%) para estirar el 1GB del free tier de Supabase Storage. Al
reemplazar o quitar una imagen, la anterior se borra de Storage
best-effort (no bloquea el guardado si falla) -- solo si esa URL vive en
nuestro bucket, nunca si es un link externo pegado a mano.

**Regla de oro offline-first:** ninguna acción del mostrador (venta, apertura de caja, alerta de stock) puede depender de tener internet en ese momento. Internet solo se usa para: (1) el primer login de cada dispositivo, y (2) sincronizar/ver reportes remotos.

**Regla de oro multi-tenant:** toda tabla con datos de una tienda lleva `tenant_id`. Toda política RLS filtra por ese campo. Sin excepciones, ni siquiera "temporalmente" durante desarrollo.

---

## 5. Modelo de datos

```
tenants
  id (uuid), nombre_negocio, slug, activo, creado_en

suscripciones
  id, tenant_id, estado (activo | vencido | suspendido),
  fecha_ultimo_pago, fecha_vencimiento, monto, metodo_pago,
  dias_gracia, notas, actualizado_por

configuracion_tenant
  tenant_id, nombre_negocio, color_primario, logo_url,
  mensaje_recibo   -- default: "Gracias por su compra, bendiciones"

locales
  id, tenant_id, nombre

usuarios
  id, tenant_id (null para super_admin), nombre, usuario,
  password_hash, rol (super_admin | owner | empleado), local_id
  -- usuario único POR tenant_id (no global); los super_admin (tenant_id
  -- null) son únicos entre sí vía índice parcial

categorias
  id, tenant_id, nombre, tallas_sugeridas
  -- tabla configurable por tenant, NO enum fijo: cada tienda define sus
  -- propias categorías (ver patrón de RLS §12)

productos
  id, tenant_id, nombre, categoria_id (FK compuesta a categorias),
  talla, precio, stock, stock_minimo, local_id

ventas
  id, tenant_id, fecha, hora, usuario_id, cliente_id, local_id,
  total, descuento, id_venta_publico   -- el que se imprime en el recibo

detalle_venta
  id, tenant_id, venta_id, producto_id, cantidad, precio_unitario

pagos
  id, tenant_id, venta_id, metodo (efectivo | nequi | daviplata), monto

clientes
  id, tenant_id, nombre, telefono, total_comprado_historico

movimientos_caja
  id, tenant_id, local_id, tipo (apertura | cierre | retiro | pago_distribuidor),
  monto, motivo, usuario_id, fecha
```

Notas:
- Un pago mixto = 2+ filas en `pagos` para la misma `venta_id`.
- `descuento` es un monto fijo en COP aplicado al total de la venta completa (no por línea de producto) — `total` ya queda neto del descuento, y `descuento` se guarda aparte solo para mostrarlo en el recibo. Se valida dentro de `registrar_venta` (nunca puede ser mayor al subtotal).
- `stock_minimo` por defecto 5, editable por el owner.
- Cada `cliente` (comprador final) tiene un id único que se imprime en su recibo.
- El JWT de sesión lleva `{ usuario_id, rol, tenant_id }`. Todo endpoint de API valida y filtra por ese `tenant_id` (excepto los endpoints exclusivos de `super_admin`).
- `tenant_id` está denormalizado incluso en tablas hijas (`detalle_venta`, `pagos`) para que sus políticas RLS no dependan de un join — ver el patrón completo en §12.

---

## 6. Control de suscripción (gate de acceso)

- Al hacer login, si el usuario es `owner` o `empleado`, se valida `suscripciones.estado` de su `tenant_id` antes de emitir el JWT.
- Si está `vencido`: dar un periodo de gracia antes de bloquear. Es **configurable por tenant** (`suscripciones.dias_gracia`, se fija al crear el tenant desde `/super-admin/tenants/nuevo`, default 5 días) — no una constante global, porque cada tenant se da de alta en una fecha distinta y el negocio puede querer tratarlos distinto (ej. periodo de prueba más largo para un cliente nuevo).
- Si está `suspendido` (bloqueo manual del super_admin): no se permite login, sin excepción.
- El pago no se cobra por pasarela — es 100% manual. El super_admin marca "pago recibido" en su panel, lo cual recalcula `fecha_vencimiento` (+30 días).
- El super_admin puede forzar bloqueo o reactivación en cualquier momento, independiente de la fecha.

---

## 7. Recibo (formato esperado)

Debe incluir:
- Nombre del negocio (de `configuracion_tenant`)
- Nombre del cliente (de `clientes`)
- Fecha y hora
- ID único de venta (`id_venta_publico`)
- Vendedor y local donde se hizo la venta
- Detalle de productos (nombre, talla, cantidad, precio)
- Subtotal y descuento (solo si `descuento > 0`)
- Desglose de pago: efectivo / Nequi / Daviplata / mixto, mostrando cuánto de cada uno, y el cambio si lo hay
- Mensaje personalizable, default: "Gracias por su compra, bendiciones"
- Logo del negocio (`configuracion_tenant.logo_url`), si el tenant subió uno

Implementado en `VentaForm.tsx` como una pantalla de confirmación con
botón "Imprimir recibo" (`window.print()` + CSS `@media print` que aísla
`#recibo-imprimible`, ver `globals.css`) — no depende del puente
ESC/POS de Fase 8 (que todavía no existe), funciona con cualquier
impresora/diálogo de impresión del sistema operativo. Solo se construye
para ventas confirmadas online (con `id_venta_publico` real); una venta
guardada sin conexión mantiene el mensaje corto de "se sincronizará" hasta
que de verdad tenga un ticket.

---

## 8. PWA, dispositivos e instalación

No hay tienda de apps. El flujo de onboarding de un cliente nuevo:

1. El super_admin crea el tenant y el primer usuario `owner` desde su panel.
2. Se le comparte al cliente el link de la app (misma URL para todos los tenants).
3. El cliente abre el link en su navegador: Chrome/Edge en Android o PC, **Safari obligatorio en iOS** (es el único que soporta instalar PWA ahí).
4. El navegador ofrece "Instalar app" / "Agregar a inicio" — queda como ícono, pantalla completa, sin barra de navegador.
5. El primer login **requiere internet sí o sí**: ahí se descarga y cachea el app shell (service worker) y se guarda localmente el `tenant_id` del dispositivo.
6. De ahí en adelante funciona offline para lo esencial (vender, stock, caja) y sincroniza solo cuando hay wifi.

Consideraciones por dispositivo:
- **PC con Windows**: obligatorio si ese mostrador usa impresora térmica + cajón de dinero (el servicio puente Node.js solo corre en Windows).
- **Tablet/celular (Android o iOS)**: funciona bien para reportes, configuración, y ventas sin impresión física.
- **iOS**: Safari es más agresivo liberando almacenamiento en segundo plano — menos confiable que Android/Windows para offline prolongado. Sirve bien para uso ocasional (owner revisando reportes).

Recomendación operativa: mostrador con impresora física → PC Windows obligatorio. Mostrador sin impresora o consulta del dueño → cualquier dispositivo sirve.

Cada dispositivo queda "amarrado" a un solo `tenant_id` tras su primer login — no hay riesgo real de mezclar datos de tiendas distintas en un mismo mostrador físico. Aun así, el backend revalida el `tenant_id` del JWT en cada sincronización, nunca confía ciegamente en lo que manda el cliente offline.

---

## 9. Hardware confirmado (impresora y cajón)

- **Impresora térmica**: 3Bumen PrintPro 369, conectada por Bluetooth (aparece emparejada como `POS58DA98B`, 58mm). Windows asigna un puerto COM al emparejarla (ej. `COM3`). El servicio puente escribe bytes ESC/POS directo a ese puerto. Probado, imprime correctamente.
- **Cajón de dinero**: CP col-pos, se abre vía cable RJ11/kick-out desde la impresora (sin fuente de poder propia). Requiere **pin 5** del RJ11 (no el pin 2, que es el más común) y la duración máxima de pulso — ya configurados como default en el servicio puente. Funciona tanto por Bluetooth como por USB.
- Este hardware específico es el que ya se probó en el proyecto hermano (mono-tienda). Cada nuevo tenant puede tener modelos distintos — documentar por tenant si aplica.

---

## 10. Fases de construcción (orden recomendado)

1. **Base multi-tenant**: tablas `tenants`, `suscripciones`, `configuracion_tenant`; agregar `tenant_id` a tablas existentes; activar RLS; login con JWT (`tenant_id` + `rol`).
2. **Panel super-admin**: lista de tenants, estado de pago, activar/suspender, marcar pago, crear tenant nuevo.
3. **Lógica de negocio central**: productos, ventas multi-producto, pago único/mixto, descuento de stock, caja (apertura/cierre/retiros), siempre filtrado por `tenant_id`.
4. **Reportes**: ventas del día por método de pago, ranking de clientes, filtro por local/consolidado (solo `owner`).
5. **Personalización por tenant**: panel de configuración (nombre, color, logo, mensaje de recibo) + tema dinámico vía CSS variables.
6. **Gate de suscripción**: bloqueo/gracia al hacer login según `suscripciones.estado`.
7. **Offline + PWA**: IndexedDB, cola de sincronización con `tenant_id`, service worker, instalación como PWA.
8. **Hardware real**: servicio puente para impresora y cajón (reusar el ya probado en el proyecto hermano).

Trabajar **una fase a la vez**. No pedir todo el proyecto de un tirón.

---

## 11. Notas de entorno técnico

- **Next.js 16 + React 19**: hay APIs recientes (ej. `cookies()`, `headers()`, `params` async en rutas dinámicas) que pueden diferir de lo que haya en el entrenamiento del modelo. Antes de escribir rutas, middleware o server components, revisar `node_modules/next/dist/docs/` si hay dudas sobre la API vigente.
- **Auth**: Supabase se usa solo como base de datos Postgres (no Supabase Auth). Login casero con `password_hash` (bcrypt) + JWT.
- **RLS es la prioridad #1 de seguridad**: antes de dar acceso a un cliente real, probar explícitamente que un `owner`/`empleado` de un tenant no puede ver ni un dato de otro tenant, ni manipulando IDs directamente por API.

---

## 12. Patrón de RLS (JWT propio, sin Supabase Auth)

El auth de este proyecto es casero (tabla `usuarios` + JWT firmado), no
Supabase Auth — por lo tanto las políticas RLS **no pueden** depender de
`auth.jwt()` / `auth.uid()` (esas funciones solo existen bajo Supabase
Auth). En su lugar se usa el patrón de **variable de sesión por
transacción**, verificado contra el pooler de Supabase (Supavisor) en modo
transacción antes de escribir la primera migración.

### Dos roles Postgres (no confundir con `usuarios.rol`)

- **`app_tenant`**: usado por toda operación de `owner`/`empleado`. Rol
  normal (sin superuser, sin `bypassrls`, no dueño de las tablas) — RLS lo
  alcanza de lleno.
- **`app_platform`**: usado solo por operaciones de `super_admin`
  (gestión de `tenants`/`suscripciones`/`configuracion_tenant`, y resolver
  `tenant_id` a partir de `slug` en el login, antes de que exista un
  tenant en sesión). Tiene `bypassrls` — análogo al `service_role` del
  proyecto hermano, pero de alcance mínimo (solo esas tablas de
  plataforma en la práctica, aunque técnicamente puede ver todo).

Ambos roles se crean **sin password** en la migración (`create role ...
with login;`) — la password real se setea a mano con `alter role ... with
password '...';` en el SQL Editor de Supabase, una sola vez, y nunca se
escribe en el repo.

### Conexión: `<rol>.<project-ref>` en el pooler

Para conectar por Supavisor en modo transacción (puerto 6543, el que usa
runtime serverless en Vercel) el usuario de conexión lleva el project ref
como sufijo: `app_tenant.<project-ref>`, no solo `app_tenant`. Omitir esto
da `FATAL: Tenant or user not found`. El host/región y el project ref
salen de *Project Settings > Database > Connection string* en el
dashboard de Supabase.

### Patrón de conexión por request

Cada operación tenant-scoped abre una transacción explícita, hace
`select set_config('app.tenant_id', $1, true)` (scoped a esa transacción
por el tercer argumento `true` = local) y ejecuta las queries dentro de
esa misma transacción — compatible con pooler en modo transacción porque
todo corre sobre una sola conexión mientras dura el callback. En código,
esto vive en `src/lib/db/tenant.ts`, exportado únicamente como
`withTenant(tenantId, fn)` — **no existe** un cliente `app_tenant`
exportado sin pasar por ahí, para que no haya forma de tocar la base con
ese rol sin fijar primero el tenant.

### Plantilla de política (fail-closed)

```sql
alter table <tabla> enable row level security;

create policy tenant_isolation_select on <tabla>
  for select using (tenant_id = nullif(current_setting('app.tenant_id', true), '')::uuid);

create policy tenant_isolation_insert on <tabla>
  for insert with check (tenant_id = nullif(current_setting('app.tenant_id', true), '')::uuid);

create policy tenant_isolation_update on <tabla>
  for update
  using (tenant_id = nullif(current_setting('app.tenant_id', true), '')::uuid)
  with check (tenant_id = nullif(current_setting('app.tenant_id', true), '')::uuid);

create policy tenant_isolation_delete on <tabla>
  for delete using (tenant_id = nullif(current_setting('app.tenant_id', true), '')::uuid);
```

`current_setting(..., true)` debería devolver `null` en vez de error si
no se llamó `set_config` — en la práctica, en el pooler de Supabase
devuelve `''` (string vacío) cuando nunca se fijó en la transacción, y
`''::uuid` sí lanza error en vez de dar `null` (confirmado con
`scripts/verificar-rls.ts`). Por eso el `nullif(..., '')` antes del cast:
colapsa tanto `null` como `''` a `null`, y `tenant_id = null` es `false`,
así que sin el `SET LOCAL` no se ve ni se escribe ninguna fila (falla
cerrado, no abierto) en vez de tirar un error de tipo.

RLS **no reemplaza** los `GRANT` de tabla: cada tabla tenant-scoped lleva
también `grant select, insert, delete on <tabla> to app_tenant;` explícito
— no basta con la política. Y el `UPDATE` se otorga por columna
(`revoke update on <tabla> from app_tenant; grant update (<columnas>) on
<tabla> to app_tenant;`), excluyendo siempre `tenant_id` (para que ninguna
fila pueda "cambiar de tenant" desde la app) y, en `productos`, excluyendo
también `stock` (solo se mueve vía funciones `security definer` auditadas
como `registrar_venta`, nunca por `UPDATE` directo).

### Integridad cruzada por FK compuesta

Cada tabla padre tenant-scoped tiene `unique (tenant_id, id)`, y las
tablas hijas referencian `(tenant_id, padre_id)` en vez de solo
`padre_id` — así ni un bug de aplicación puede asociar, por ejemplo, una
venta con un producto de otro tenant, aunque la política RLS fallara.

### Funciones `security definer`

Cuando una función necesita tocar una columna que `app_tenant` no puede
editar por `GRANT` (ej. `productos.stock` en `registrar_venta`), la
función corre `security definer` — lo cual significa que **ya no hay RLS
automático** dentro de ella (el dueño de la función la bypassa). Por eso
toda función `security definer` valida `tenant_id` explícitamente en cada
fila que toca (no solo `local_id` o el resto de columnas de negocio), y
lleva `set search_path = ''` con todas las tablas calificadas
(`public.productos`, etc.) para cerrar el hueco clásico de secuestro de
`search_path`.

---

## 13. Fuera de alcance (por ahora)

- Integración real por pasarela de pago (ni para la suscripción de 30.000/mes, ni para Nequi/Daviplata de las ventas — todo se registra manualmente).
- Facturación electrónica / DIAN.
- App nativa fuera del navegador (se usa PWA).
- Subdominios personalizados por tenant (login + `tenant_id` en JWT es suficiente por ahora).
- Todo el backend de escritorio del proyecto hermano (Electron + SQLite dual-backend, `electron-builder`, auto-update): este proyecto es 100% hosteado, sin modo desktop. Se reusa la lógica de negocio del hermano, pero nunca esa capa.

---

## 14. Cómo trabajar en este proyecto (para Claude Code)

- Antes de escribir código de una fase nueva, releer este archivo completo.
- Reusar la lógica de negocio del proyecto hermano (mono-tienda) cuando exista — no reescribir desde cero, solo agregarle el filtro `tenant_id`.
- Cada endpoint de API nuevo: primero validar el JWT y el `tenant_id`, después ejecutar la query.
- Cada tabla nueva con datos de negocio: agregar `tenant_id` + política RLS antes de darla por terminada.
- Si algo de este documento queda desactualizado durante el desarrollo (decisiones nuevas, hardware distinto, cambios de alcance), actualizar este archivo en el mismo commit.