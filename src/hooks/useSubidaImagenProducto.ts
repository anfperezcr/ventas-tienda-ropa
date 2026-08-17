"use client";

import { subirImagenProducto } from "@/lib/productos/actions";
import { useSubidaImagen } from "./useSubidaImagen";

export function useSubidaImagenProducto(valorInicial: string | null) {
  return useSubidaImagen(valorInicial, subirImagenProducto);
}
