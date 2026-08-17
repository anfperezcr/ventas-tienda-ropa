// Tallas "letra" reconocidas -- mismo set que ORDEN_TALLA en VentaForm.tsx
// (porteo del proyecto hermano). Se normalizan a mayúscula porque son un
// código fijo (S/M/L/...), no texto libre.
const TALLAS_LETRA = new Set(["XS", "S", "M", "L", "XL", "XXL"]);

// Normaliza el valor de talla que se guarda en `productos.talla`, para que
// "M"/"m", "L"/"l", "unica"/"Única"/"UNICA" etc. dejen de crear variantes
// duplicadas de un mismo producto (ver detectar-tallas-duplicadas.ts).
// Las tallas numéricas (30/32/34) se dejan tal cual -- no tienen una forma
// canónica de mayúscula/minúscula que aplicar.
export function normalizarTalla(valor: string): string {
  const t = valor.trim();
  if (!t) return t;

  const mayus = t.toUpperCase();
  if (TALLAS_LETRA.has(mayus)) return mayus;

  // "Unica" sin tilde es la forma que ya existe en los datos reales
  // (confirmado contra la base) -- se usa como canónica sin importar si
  // el owner escribió "única", "UNICA", "Unica", etc.
  const sinTilde = t
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase();
  if (sinTilde === "unica") return "Unica";

  return t;
}
