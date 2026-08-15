// Sin dependencias de servidor (nada de postgres/withTenant acá) -- lo
// importan tanto src/lib/caja/data.ts (server) como src/lib/offline/caja.ts
// (se usa desde componentes cliente), y un import server-only en un
// archivo que termina en el bundle del cliente rompería el build.

export type ItemBitacora = {
  clase: "venta" | "movimiento";
  fecha: string;
  tipo: string;
  descripcion: string;
  metodoOMotivo: string;
  monto: number;
  usuario: string | null;
};

export const METODO_LABEL: Record<string, string> = {
  efectivo: "Efectivo",
  nequi: "Nequi",
  daviplata: "Daviplata",
};

export const TIPO_MOVIMIENTO_LABEL: Record<string, string> = {
  apertura: "Apertura",
  cierre: "Cierre",
  retiro: "Retiro",
  pago_distribuidor: "Pago a distribuidor",
};
