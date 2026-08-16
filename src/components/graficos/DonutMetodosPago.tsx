// Compartido entre /caja y el dashboard (mismos 3 métodos de pago,
// mismo cálculo) -- se extrajo de CajaPanel.tsx cuando el dashboard
// necesitó exactamente el mismo donut, para no duplicar el cálculo de
// stroke-dasharray en dos archivos.
export const COLOR_EFECTIVO = "var(--brand-600)";
export const COLOR_NEQUI = "#7C3AED";
export const COLOR_DAVIPLATA = "#F97316";

export function DonutMetodosPago({
  efectivo,
  nequi,
  daviplata,
  className = "h-24 w-24",
}: {
  efectivo: number;
  nequi: number;
  daviplata: number;
  className?: string;
}) {
  const total = efectivo + nequi + daviplata;
  const R = 40;
  const C = 2 * Math.PI * R;

  const segmentos =
    total === 0
      ? []
      : [
          { color: COLOR_EFECTIVO, valor: efectivo },
          { color: COLOR_NEQUI, valor: nequi },
          { color: COLOR_DAVIPLATA, valor: daviplata },
        ].filter((s) => s.valor > 0);

  let acumulado = 0;

  return (
    <svg
      viewBox="0 0 100 100"
      className={`shrink-0 -rotate-90 ${className}`}
      role="img"
      aria-label="Ventas por método de pago"
    >
      <circle cx="50" cy="50" r={R} fill="none" stroke="var(--brand-100, #e5e7eb)" strokeWidth="12" />
      {segmentos.map((s, i) => {
        const frac = s.valor / total;
        const largo = frac * C;
        const offset = -((acumulado / total) * C);
        acumulado += s.valor;
        return (
          <circle
            key={i}
            cx="50"
            cy="50"
            r={R}
            fill="none"
            stroke={s.color}
            strokeWidth="12"
            strokeDasharray={`${largo} ${C - largo}`}
            strokeDashoffset={offset}
          />
        );
      })}
    </svg>
  );
}
