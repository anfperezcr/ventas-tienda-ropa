// Iconos de línea (stroke, sin relleno) para /configuracion -- mismo
// estilo que src/components/dashboard/iconos.tsx y
// src/components/caja/IconosCaja.tsx, reemplazan los emoji nativos que
// antes se usaban acá (renderizan a todo color según el set tipográfico
// del sistema operativo).
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

export function IconoEdificio(p: IconoProps) {
  return (
    <Base {...p}>
      <rect x="4" y="3" width="12" height="18" rx="1" />
      <path d="M16 8h4v13h-4" />
      <path d="M7.5 7h1M11.5 7h1M7.5 11h1M11.5 11h1M7.5 15h1M11.5 15h1" />
      <path d="M9 21v-4h2v4" />
    </Base>
  );
}

export function IconoPaleta(p: IconoProps) {
  return (
    <Base {...p}>
      <path d="M12 3a9 8 0 1 0 0 16c1 0 1.5-.6 1.5-1.4 0-.4-.2-.7-.4-1a1.4 1.4 0 0 1 1-2.4H16a4 4 0 0 0 4-4c0-4-3.6-7.2-8-7.2Z" />
      <circle cx="7.2" cy="11" r="1.1" fill="currentColor" stroke="none" />
      <circle cx="9.8" cy="7.2" r="1.1" fill="currentColor" stroke="none" />
      <circle cx="14.5" cy="7.2" r="1.1" fill="currentColor" stroke="none" />
    </Base>
  );
}

export function IconoOjo(p: IconoProps) {
  return (
    <Base {...p}>
      <path d="M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12Z" />
      <circle cx="12" cy="12" r="2.6" />
    </Base>
  );
}

export function IconoGuardar(p: IconoProps) {
  return (
    <Base {...p}>
      <path d="M4.5 4.5h12l3 3v12h-15Z" />
      <path d="M7.5 4.5v5h7v-5" />
      <path d="M7.5 20v-6h9v6" />
    </Base>
  );
}
