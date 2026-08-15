// Iconos mínimos dibujados a mano (sin librería de iconos instalada) --
// mismo estilo (stroke, sin relleno) para las 7 tarjetas de acceso y los
// controles de header "próximamente".
type IconoProps = { className?: string };

function Base({ className, children }: IconoProps & { children: React.ReactNode }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.8}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      {children}
    </svg>
  );
}

export function IconoVender(p: IconoProps) {
  return (
    <Base {...p}>
      <path d="M6 6h15l-1.5 9h-12z" />
      <path d="M6 6 5 3H2" />
      <circle cx="9.5" cy="20" r="1.3" />
      <circle cx="18" cy="20" r="1.3" />
    </Base>
  );
}

export function IconoProductos(p: IconoProps) {
  return (
    <Base {...p}>
      <path d="M20.5 12.5 12.5 20.5a2 2 0 0 1-2.8 0l-6.2-6.2a2 2 0 0 1 0-2.8L11.5 3.5H19a1.5 1.5 0 0 1 1.5 1.5z" />
      <circle cx="15.5" cy="8.5" r="1.2" />
    </Base>
  );
}

export function IconoCaja(p: IconoProps) {
  return (
    <Base {...p}>
      <rect x="2.5" y="6" width="19" height="13" rx="2" />
      <path d="M2.5 10.5h19" />
      <path d="M8 6V4.5A1.5 1.5 0 0 1 9.5 3h5A1.5 1.5 0 0 1 16 4.5V6" />
    </Base>
  );
}

export function IconoReportes(p: IconoProps) {
  return (
    <Base {...p}>
      <path d="M4 20V10" />
      <path d="M12 20V4" />
      <path d="M20 20v-7" />
      <path d="M2.5 20h19" />
    </Base>
  );
}

export function IconoLocales(p: IconoProps) {
  return (
    <Base {...p}>
      <path d="M12 21s7-6.3 7-11.5a7 7 0 1 0-14 0C5 14.7 12 21 12 21z" />
      <circle cx="12" cy="9.5" r="2.3" />
    </Base>
  );
}

export function IconoUsuarios(p: IconoProps) {
  return (
    <Base {...p}>
      <circle cx="9" cy="8" r="3" />
      <path d="M3.5 20a5.5 5.5 0 0 1 11 0" />
      <circle cx="17.5" cy="9" r="2.3" />
      <path d="M15.5 12.3A5 5 0 0 1 20.5 20" />
    </Base>
  );
}

export function IconoConfiguracion(p: IconoProps) {
  return (
    <Base {...p}>
      <path d="M4 6h9" />
      <circle cx="16" cy="6" r="2" />
      <path d="M20 12h-6" />
      <circle cx="9" cy="12" r="2" />
      <path d="M4 18h9" />
      <circle cx="16" cy="18" r="2" />
    </Base>
  );
}

export function IconoCampana(p: IconoProps) {
  return (
    <Base {...p}>
      <path d="M6 10a6 6 0 0 1 12 0c0 4 1.5 5.5 1.5 5.5H4.5S6 14 6 10z" />
      <path d="M10 19a2 2 0 0 0 4 0" />
    </Base>
  );
}

export function IconoPuntos(p: IconoProps) {
  return (
    <Base {...p}>
      <circle cx="5" cy="12" r="1.2" fill="currentColor" stroke="none" />
      <circle cx="12" cy="12" r="1.2" fill="currentColor" stroke="none" />
      <circle cx="19" cy="12" r="1.2" fill="currentColor" stroke="none" />
    </Base>
  );
}

export function IconoChevron(p: IconoProps) {
  return (
    <Base {...p}>
      <path d="m6 9 6 6 6-6" />
    </Base>
  );
}
