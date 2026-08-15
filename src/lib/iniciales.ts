// Iniciales para la tarjeta de un producto sin foto -- imagenUrl casi
// nunca viene lleno en la práctica (ver /venta, Fase 8-previa), así que
// este es el diseño normal en cualquier lugar donde se liste un
// producto, no un fallback de una imagen rota. Compartido entre
// VentaForm y CatalogoProductos.
export function iniciales(nombre: string): string {
  const partes = nombre.trim().split(/\s+/).filter(Boolean);
  if (partes.length >= 2) return (partes[0][0] + partes[1][0]).toUpperCase();
  return (partes[0] ?? "").slice(0, 2).toUpperCase();
}
