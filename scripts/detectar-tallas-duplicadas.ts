import { platformSql } from "../src/lib/db/platform";

// Detección permanente (solo lectura) de variantes de producto duplicadas
// por diferencia de mayúscula/minúscula en la talla -- ej. una fila
// "M" y otra "m" del mismo nombre+categoría+local, tratadas como tallas
// distintas antes de normalizarTalla() (src/lib/productos/talla.ts).
//
// A partir de la normalización en guardarGrupoProducto, esto ya no puede
// pasar con productos NUEVOS o editados -- este script existe para los
// que ya estaban duplicados en la base ANTES de ese cambio. Nunca fusiona
// ni borra nada solo, porque una fusión automática (ej. "quedarse con la
// fila de más stock") podría borrar historial real de ventas/ajustes que
// vive en la OTRA fila -- ver CLAUDE.md y el caso real ya encontrado
// (Chaqueta Impermeable, tenant slugtiendatest: la fila con MENOS stock
// tenía 2 ventas registradas y la de más stock, cero). Por eso la salida
// muestra el historial de cada fila explícitamente, para que la fusión la
// decida una persona viendo el caso completo.
process.loadEnvFile(".env.local");

type FilaProducto = {
  tenant_id: string;
  nombre_negocio: string;
  categoria_nombre: string;
  local_nombre: string;
  nombre: string;
  id: number;
  talla: string;
  stock: number;
  activo: boolean;
};

type Grupo = {
  clave: string;
  tenantNombre: string;
  categoriaNombre: string;
  localNombre: string;
  productoNombre: string;
  filas: FilaProducto[];
};

async function main() {
  const sql = platformSql();
  const filas = await sql<FilaProducto[]>`
    select
      p.tenant_id, t.nombre_negocio, c.nombre as categoria_nombre,
      l.nombre as local_nombre, p.nombre, p.id, p.talla, p.stock, p.activo
    from productos p
    join tenants t on t.id = p.tenant_id
    join categorias c on c.tenant_id = p.tenant_id and c.id = p.categoria_id
    join locales l on l.tenant_id = p.tenant_id and l.id = p.local_id
    order by p.tenant_id, lower(trim(p.nombre)), c.nombre, l.nombre
  `;

  // Agrupa por tenant + nombre (normalizado) + categoría + local, y
  // dentro de cada grupo, por talla normalizada (minúscula, sin espacios).
  // Un grupo de talla con más de una talla CRUDA distinta es un conflicto.
  const gruposPorClave = new Map<string, Grupo>();
  for (const f of filas) {
    const claveGrupo = [
      f.tenant_id,
      f.nombre.trim().toLowerCase(),
      f.categoria_nombre,
      f.local_nombre,
    ].join("|");
    const claveTalla = `${claveGrupo}|${f.talla.trim().toLowerCase()}`;

    if (!gruposPorClave.has(claveTalla)) {
      gruposPorClave.set(claveTalla, {
        clave: claveTalla,
        tenantNombre: f.nombre_negocio,
        categoriaNombre: f.categoria_nombre,
        localNombre: f.local_nombre,
        productoNombre: f.nombre,
        filas: [],
      });
    }
    gruposPorClave.get(claveTalla)!.filas.push(f);
  }

  const conflictos = [...gruposPorClave.values()].filter(
    (g) => new Set(g.filas.map((f) => f.talla)).size > 1
  );

  if (conflictos.length === 0) {
    console.log("No se encontraron variantes duplicadas por mayúscula/minúscula de talla.");
    return;
  }

  console.log(`${conflictos.length} conflicto(s) encontrado(s):\n`);

  for (const grupo of conflictos) {
    console.log(
      `--- ${grupo.tenantNombre} / ${grupo.productoNombre} / ${grupo.categoriaNombre} / ${grupo.localNombre} ---`
    );

    const conHistorial = await Promise.all(
      grupo.filas.map(async (f) => {
        const [ventas] = await sql<{ n: string }[]>`
          select count(*) as n from detalle_venta where producto_id = ${f.id}
        `;
        const [ajustes] = await sql<{ n: string }[]>`
          select count(*) as n from ajustes_stock where producto_id = ${f.id}
        `;
        const ventasN = Number(ventas.n);
        const ajustesN = Number(ajustes.n);
        return { fila: f, ventasN, ajustesN, totalHistorial: ventasN + ajustesN };
      })
    );

    const maxHistorial = Math.max(...conHistorial.map((c) => c.totalHistorial));

    for (const c of conHistorial) {
      const esLaDeMasHistorial = c.totalHistorial === maxHistorial && maxHistorial > 0;
      console.log(
        `  id=${c.fila.id}  talla="${c.fila.talla}"  stock=${c.fila.stock}  activo=${c.fila.activo}` +
          `  ventas=${c.ventasN}  ajustes=${c.ajustesN}  historial_total=${c.totalHistorial}` +
          (esLaDeMasHistorial ? "  <-- MÁS HISTORIAL REAL" : "")
      );
    }
    console.log("");
  }

  console.log(
    "Ningún dato se modificó. Decide manualmente, caso por caso, cuál fila conservar" +
      " -- prioriza la de MÁS historial real (ventas/ajustes), no la de más stock."
  );
}

// El pool de `postgres` mantiene el proceso vivo (conexión idle, sin
// unref) -- salida explícita para que el script termine solo en vez de
// colgarse esperando más queries.
main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
