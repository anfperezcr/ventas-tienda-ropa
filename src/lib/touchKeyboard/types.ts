// "automatic" queda documentado a propósito pero sin implementar todavía
// (CLAUDE.md-adjacent: no construir por adelantado lo que no se pidió con
// firmeza) -- el ticket permite dejarlo fuera si agrega complejidad, pero
// pide preparar el tipo para no tener que romper el contrato de
// localStorage/Context el día que se agregue.
export type ModoEntrada = "touch" | "keyboard" | "automatic";

// Mapea 1:1 con los valores de inputMode que ya usa toda la app (ver
// pase anterior de inputMode/type en VentaForm, CajaPanel, ProductoForm,
// etc.) -- el teclado táctil no inventa una taxonomía nueva, reutiliza la
// que ya existe en el HTML.
export type TipoTeclado = "numeric" | "text" | "tel" | "email" | "url" | "search";

export type EstadoTecladoTactil = {
  modo: ModoEntrada;
  isOpen: boolean;
  keyboardType: TipoTeclado | null;
};
