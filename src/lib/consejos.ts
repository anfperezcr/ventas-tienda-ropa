// Contenido estático rotativo, NO un análisis de los datos del negocio
// -- ninguno de estos tips depende de lo que muestra el resto del
// dashboard. Rota por día del año (determinístico, estable durante el
// día) en vez de aleatorio en cada carga, para que no "parpadee" al
// refrescar la página.
const CONSEJOS = [
  "Revisa tus ventas por método de pago para tomar mejores decisiones y aumentar tus ingresos.",
  "Cuenta el efectivo antes de cerrar caja -- un conteo diario evita sorpresas al fin de mes.",
  "Los productos con stock bajo pueden significar ventas perdidas -- revisa el catálogo seguido.",
  "Un cliente recurrente vale más que uno nuevo -- guarda el teléfono al registrar la venta.",
  "Registra el motivo de cada retiro de caja -- te ayuda a recordar en qué se fue el efectivo.",
];

function diaDelAnio(fecha: Date): number {
  const inicio = Date.UTC(fecha.getUTCFullYear(), 0, 0);
  const hoy = Date.UTC(fecha.getUTCFullYear(), fecha.getUTCMonth(), fecha.getUTCDate());
  return Math.floor((hoy - inicio) / 86_400_000);
}

export function obtenerConsejoDelDia(fecha: Date = new Date()): string {
  return CONSEJOS[diaDelAnio(fecha) % CONSEJOS.length];
}
