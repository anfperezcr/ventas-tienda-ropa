import { randomUUID } from "node:crypto";
import { createClient } from "@supabase/supabase-js";

// Server-only: la service role key bypassa cualquier política de Storage,
// nunca debe importarse desde un archivo "use client" ni llegar al
// navegador. El aislamiento por tenant se hace en código de aplicación
// (path con tenantId), no con políticas RLS de storage.objects -- este
// proyecto no usa Supabase Auth, así que esas políticas no aplican (ver
// CLAUDE.md, sección de imágenes de producto).

const BUCKET = "productos";
const TAMANO_MAXIMO_BYTES = 5 * 1024 * 1024;
const EXTENSION_POR_TIPO: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
};

let cliente: ReturnType<typeof createClient> | null = null;
function obtenerCliente() {
  if (!cliente) {
    const url = process.env.SUPABASE_URL;
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!url || !key) {
      throw new Error("Falta configurar SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY");
    }
    cliente = createClient(url, key, { auth: { persistSession: false } });
  }
  return cliente;
}

function prefijoPublico(): string {
  return `${process.env.SUPABASE_URL}/storage/v1/object/public/${BUCKET}/`;
}

export type SubirImagenResultado = { ok: true; url: string } | { ok: false; error: string };

// Sube dentro de una "carpeta" (prefijo de ruta) del mismo bucket
// "productos" -- reusado tanto por fotos de producto (carpeta "productos",
// ruta productos/{tenantId}/{uuid}.ext) como por logos de tienda (carpeta
// "logos", ruta logos/{tenantId}/{uuid}.ext). Mismo bucket, mismo patrón
// de validación/compresión/subida; solo cambia el prefijo, para no crear
// un bucket nuevo por cada tipo de imagen (CLAUDE.md: "mismo patrón, no
// una fase nueva").
async function subirAStorage(
  carpeta: string,
  tenantId: string,
  archivo: File
): Promise<SubirImagenResultado> {
  const extension = EXTENSION_POR_TIPO[archivo.type];
  if (!extension) {
    return { ok: false, error: "Formato no soportado -- usa JPG, PNG o WEBP" };
  }
  if (archivo.size > TAMANO_MAXIMO_BYTES) {
    return { ok: false, error: "La imagen no puede pesar más de 5MB" };
  }

  const ruta = `${carpeta}/${tenantId}/${randomUUID()}.${extension}`;
  const { error } = await obtenerCliente()
    .storage.from(BUCKET)
    .upload(ruta, archivo, { contentType: archivo.type, upsert: false });

  if (error) {
    return { ok: false, error: "No se pudo subir la imagen, intenta de nuevo" };
  }

  const { data } = obtenerCliente().storage.from(BUCKET).getPublicUrl(ruta);
  return { ok: true, url: data.publicUrl };
}

// Best-effort, nunca lanza. Si la URL no vive en nuestro bucket (el owner
// pegó un link externo en vez de subir un archivo), no hace nada -- nunca
// intentamos borrar algo que no subimos nosotros. Sirve tanto para fotos
// de producto como para logos: la carpeta ya viene codificada en la URL.
async function borrarDeStorageSiPropia(url: string | null): Promise<void> {
  if (!url) return;
  const prefijo = prefijoPublico();
  if (!url.startsWith(prefijo)) return;

  const ruta = url.slice(prefijo.length);
  try {
    await obtenerCliente().storage.from(BUCKET).remove([ruta]);
  } catch {
    // Huérfano en Storage -- no es motivo para fallar nada más.
  }
}

export function subirImagenProductoStorage(
  tenantId: string,
  archivo: File
): Promise<SubirImagenResultado> {
  return subirAStorage("productos", tenantId, archivo);
}

export function subirLogoStorage(tenantId: string, archivo: File): Promise<SubirImagenResultado> {
  return subirAStorage("logos", tenantId, archivo);
}

export const borrarImagenProductoStorageSiPropia = borrarDeStorageSiPropia;
export const borrarLogoStorageSiPropia = borrarDeStorageSiPropia;
