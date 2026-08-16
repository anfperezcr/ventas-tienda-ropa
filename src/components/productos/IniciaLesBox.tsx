import { iniciales } from "@/lib/iniciales";

export function IniciaLesBox({ nombre, className }: { nombre: string; className: string }) {
  return (
    <div
      className={`flex shrink-0 items-center justify-center rounded-lg text-sm font-semibold ${className}`}
      style={{
        backgroundColor: "color-mix(in srgb, var(--brand-600) 12%, white)",
        color: "var(--brand-600)",
      }}
    >
      {nombre.trim() ? iniciales(nombre) : "?"}
    </div>
  );
}
