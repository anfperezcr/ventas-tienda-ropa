const OFFSET_BOGOTA_MS = 5 * 60 * 60 * 1000;

// Bogotá es UTC-5 todo el año (sin horario de verano). offsetDias permite
// pedir el rango de un día distinto a hoy (ej. -1 = ayer) sin duplicar en
// cada consumidor la lógica de límites de día en hora local.
export function rangoDiaBogota(offsetDias = 0): { inicio: Date; fin: Date } {
  const ahoraBogota = new Date(Date.now() - OFFSET_BOGOTA_MS);
  const inicioBogotaMs = Date.UTC(
    ahoraBogota.getUTCFullYear(),
    ahoraBogota.getUTCMonth(),
    ahoraBogota.getUTCDate() + offsetDias
  );
  const inicio = new Date(inicioBogotaMs + OFFSET_BOGOTA_MS);
  const fin = new Date(inicio.getTime() + 24 * 60 * 60 * 1000);
  return { inicio, fin };
}
