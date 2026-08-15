// Identificador generado en el cliente para hacer idempotente cualquier
// escritura que pueda encolarse offline y reintentarse al sincronizar
// (ventas y movimientos de caja, Fase 7.3/7.4). Compartido entre
// VentaForm y CajaPanel para no duplicar el fallback sin crypto.randomUUID.
export function generarClientRef(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) return crypto.randomUUID();
  return `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}
