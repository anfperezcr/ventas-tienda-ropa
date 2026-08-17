"use client";

import { subirLogo } from "@/lib/configuracion/actions";
import { useSubidaImagen } from "./useSubidaImagen";

export function useSubidaLogo(valorInicial: string | null) {
  return useSubidaImagen(valorInicial, subirLogo);
}
