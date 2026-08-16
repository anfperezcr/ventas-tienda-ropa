// Iconos de línea (stroke, sin relleno) para /caja -- mismo estilo que
// src/components/dashboard/iconos.tsx, reemplazan los emoji nativos que
// antes se usaban acá (renderizan a todo color según el set tipográfico
// del sistema operativo, se veían "demasiado coloridos" comparado con el
// mockup de referencia).
export type IconoProps = { className?: string };

function Base({ className, children }: IconoProps & { children: React.ReactNode }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.75}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      {children}
    </svg>
  );
}

export function IconoTarjeta(p: IconoProps) {
  return (
    <Base {...p}>
      <rect x="2.5" y="5.5" width="19" height="13" rx="2" />
      <path d="M2.5 10h19" />
      <path d="M6 14.5h4" />
    </Base>
  );
}

export function IconoCarrito(p: IconoProps) {
  return (
    <Base {...p}>
      <path d="M3 4h2l2.4 12.2a2 2 0 0 0 2 1.6h7.2a2 2 0 0 0 2-1.6L21 8H6" />
      <circle cx="9" cy="20" r="1.4" fill="currentColor" stroke="none" />
      <circle cx="17" cy="20" r="1.4" fill="currentColor" stroke="none" />
    </Base>
  );
}

export function IconoBillete(p: IconoProps) {
  return (
    <Base {...p}>
      <rect x="2.5" y="6.5" width="19" height="11" rx="2" />
      <circle cx="12" cy="12" r="2.5" />
      <path d="M5.5 9v.01M18.5 15v.01" />
    </Base>
  );
}

export function IconoUsuario(p: IconoProps) {
  return (
    <Base {...p}>
      <circle cx="12" cy="8" r="3.5" />
      <path d="M4.5 20a7.5 7.5 0 0 1 15 0" />
    </Base>
  );
}

export function IconoMoneda(p: IconoProps) {
  return (
    <Base {...p}>
      <circle cx="12" cy="12" r="8.5" />
      <path d="M12 6.5v11" />
      <path d="M15 9.2c-.4-.9-1.5-1.5-2.8-1.5-1.7 0-3 .9-3 2.3 0 3 5.6 1.3 5.6 4.3 0 1.4-1.4 2.3-3.1 2.3-1.4 0-2.6-.6-3.1-1.6" />
    </Base>
  );
}

export function IconoCandadoAbierto(p: IconoProps) {
  return (
    <Base {...p}>
      <rect x="4.5" y="10.5" width="15" height="10" rx="2" />
      <path d="M8 10.5V7a4 4 0 0 1 7.5-2" />
    </Base>
  );
}

export function IconoCandado(p: IconoProps) {
  return (
    <Base {...p}>
      <rect x="4.5" y="10.5" width="15" height="10" rx="2" />
      <path d="M8 10.5V7a4 4 0 0 1 8 0v3.5" />
    </Base>
  );
}

export function IconoDescarga(p: IconoProps) {
  return (
    <Base {...p}>
      <path d="M12 3v12" />
      <path d="M7 10l5 5 5-5" />
      <path d="M4 19h16" />
    </Base>
  );
}

export function IconoFlechaArriba(p: IconoProps) {
  return (
    <Base {...p}>
      <path d="M12 19V5" />
      <path d="M6 11l6-6 6 6" />
    </Base>
  );
}

export function IconoBombilla(p: IconoProps) {
  return (
    <Base {...p}>
      <path d="M9 18h6" />
      <path d="M10 21h4" />
      <path d="M12 3a6 6 0 0 0-3.5 10.9c.6.4.9 1.1.9 1.9v.2h5.2v-.2c0-.8.4-1.5.9-1.9A6 6 0 0 0 12 3Z" />
    </Base>
  );
}
