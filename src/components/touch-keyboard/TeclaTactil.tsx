"use client";

type Variante = "default" | "accent" | "muted";

const ESTILOS: Record<Variante, string> = {
  default: "border-neutral-300 bg-white text-neutral-900 active:bg-neutral-100",
  accent: "border-[var(--brand-600)] bg-[var(--brand-600)] text-white active:opacity-90",
  muted: "border-neutral-300 bg-neutral-100 text-neutral-600 active:bg-neutral-200",
};

export function TeclaTactil({
  onPress,
  children,
  className = "",
  ariaLabel,
  variante = "default",
}: {
  onPress: () => void;
  children: React.ReactNode;
  className?: string;
  ariaLabel?: string;
  variante?: Variante;
}) {
  return (
    <button
      type="button"
      aria-label={ariaLabel}
      // preventDefault en pointerdown evita que el botón robe el foco del
      // input activo -- así el teclado nunca se cierra por accidente al
      // tocar sus propias teclas (ticket §17).
      onPointerDown={(e) => e.preventDefault()}
      onClick={onPress}
      className={`flex min-h-14 select-none items-center justify-center rounded-xl border text-lg font-semibold shadow-sm transition-colors sm:min-h-16 sm:text-xl ${ESTILOS[variante]} ${className}`}
    >
      {children}
    </button>
  );
}
