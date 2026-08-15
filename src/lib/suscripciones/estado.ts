// Lógica pura de "¿este tenant puede entrar?" -- sin acceso a base de
// datos, para que el gate de login (gate.ts) y el badge del panel de
// super_admin (tenants/data.ts) nunca se desalineen calculándolo cada
// uno por su cuenta.
export type EstadoAcceso = "ok" | "gracia" | "bloqueado";

export function calcularEstadoAcceso(input: {
  tenantActivo: boolean;
  suscripcionEstado: string | null;
  fechaVencimiento: string | null;
  // Configurable por tenant desde /super-admin/tenants/nuevo (CLAUDE.md
  // §6) -- antes era una constante global fija acá mismo.
  diasGracia: number;
}): EstadoAcceso {
  if (!input.tenantActivo) return "bloqueado";
  if (!input.suscripcionEstado || !input.fechaVencimiento) return "bloqueado";
  if (input.suscripcionEstado === "suspendido") return "bloqueado";

  const vencimiento = new Date(input.fechaVencimiento);
  const limiteGracia = new Date(vencimiento);
  limiteGracia.setDate(limiteGracia.getDate() + input.diasGracia);
  const ahora = new Date();

  if (ahora <= vencimiento) return "ok";
  return ahora <= limiteGracia ? "gracia" : "bloqueado";
}
