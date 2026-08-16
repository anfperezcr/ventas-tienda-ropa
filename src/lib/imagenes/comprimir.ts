// Redimensiona y recomprime en <canvas> antes de subir -- el free tier de
// Supabase Storage es 1GB total, así que esto importa de verdad, no es
// solo optimización cosmética. JPEG (no WEBP) para máxima compatibilidad
// de codificación vía canvas.toBlob en todos los navegadores, incluido
// Safari (requisito de iOS para instalar la PWA, CLAUDE.md sección 8).
const DIMENSION_MAXIMA = 1600;
const CALIDAD = 0.8;

export async function comprimirImagen(archivo: File): Promise<File> {
  let bitmap: ImageBitmap;
  try {
    bitmap = await createImageBitmap(archivo);
  } catch {
    // Formato que el navegador no puede decodificar como bitmap -- se
    // sube tal cual, el servidor igual valida tipo/tamaño.
    return archivo;
  }

  const escala = Math.min(1, DIMENSION_MAXIMA / Math.max(bitmap.width, bitmap.height));
  const ancho = Math.round(bitmap.width * escala);
  const alto = Math.round(bitmap.height * escala);

  const canvas = document.createElement("canvas");
  canvas.width = ancho;
  canvas.height = alto;
  const ctx = canvas.getContext("2d");
  if (!ctx) return archivo;

  ctx.drawImage(bitmap, 0, 0, ancho, alto);
  bitmap.close();

  const blob = await new Promise<Blob | null>((resolve) =>
    canvas.toBlob(resolve, "image/jpeg", CALIDAD)
  );
  if (!blob) return archivo;

  const nombre = archivo.name.replace(/\.\w+$/, "") + ".jpg";
  return new File([blob], nombre, { type: "image/jpeg" });
}
