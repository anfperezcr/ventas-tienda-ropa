// inputMode="numeric" solo sugiere el teclado nativo -- no impide pegar
// texto ni escribir con un teclado físico. Los campos controlados que
// convierten el valor a Number() en cada tecla (para recalcular en vivo,
// ej. cambio en /venta) necesitan este filtro para no terminar en NaN
// mientras el usuario escribe. Los campos de solo FormData (sin onChange)
// no lo necesitan: ya se validan server-side con Number.isInteger/isFinite.
export function soloDigitos(valor: string): string {
  return valor.replace(/\D/g, "");
}
