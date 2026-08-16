"use client";

import { useEffect, useRef, useState } from "react";
import { comprimirImagen } from "@/lib/imagenes/comprimir";
import { subirImagenProducto } from "@/lib/productos/actions";

const TIPOS_PERMITIDOS = new Set(["image/jpeg", "image/png", "image/webp"]);
const TAMANO_MAXIMO_BYTES = 5 * 1024 * 1024;

export type EstadoImagen = "idle" | "comprimiendo" | "subiendo" | "error";

// Maneja el ciclo completo de "elegir archivo -> comprimir -> subir" para
// el campo de imagen de un producto. Vista previa instantánea vía
// URL.createObjectURL (no espera a que termine la subida), y si la subida
// falla, imagenGuardada simplemente no cambia -- el formulario que use
// este hook sigue siendo guardable sin imagen, nunca se bloquea por un
// fallo puntual de red.
export function useSubidaImagenProducto(valorInicial: string | null) {
  const [imagenGuardada, setImagenGuardada] = useState(valorInicial);
  const [previewLocal, setPreviewLocal] = useState<string | null>(null);
  const [estado, setEstado] = useState<EstadoImagen>("idle");
  const [error, setError] = useState<string | null>(null);
  const previewRef = useRef<string | null>(null);

  useEffect(() => {
    return () => {
      if (previewRef.current) URL.revokeObjectURL(previewRef.current);
    };
  }, []);

  async function manejarArchivo(archivo: File) {
    if (!TIPOS_PERMITIDOS.has(archivo.type)) {
      setError("Formato no soportado -- usa JPG, PNG o WEBP");
      setEstado("error");
      return;
    }
    if (archivo.size > TAMANO_MAXIMO_BYTES) {
      setError("La imagen no puede pesar más de 5MB");
      setEstado("error");
      return;
    }

    setError(null);
    if (previewRef.current) URL.revokeObjectURL(previewRef.current);
    const objectUrl = URL.createObjectURL(archivo);
    previewRef.current = objectUrl;
    setPreviewLocal(objectUrl);
    setEstado("comprimiendo");

    try {
      const comprimida = await comprimirImagen(archivo);
      setEstado("subiendo");
      const formData = new FormData();
      formData.append("archivo", comprimida);
      const resultado = await subirImagenProducto(formData);
      if (!resultado.ok) {
        setError(resultado.error);
        setEstado("error");
        return;
      }
      setImagenGuardada(resultado.url);
      setEstado("idle");
    } catch {
      setError("No se pudo subir la imagen. Puedes guardar sin ella e intentar de nuevo después.");
      setEstado("error");
    }
  }

  function quitarImagen() {
    if (previewRef.current) {
      URL.revokeObjectURL(previewRef.current);
      previewRef.current = null;
    }
    setPreviewLocal(null);
    setImagenGuardada(null);
    setError(null);
    setEstado("idle");
  }

  // Camino alterno a manejarArchivo: pegar una URL externa a mano (mismo
  // campo imagen_url, sin pasar por Storage). Descarta cualquier preview
  // local de un archivo elegido antes, para que urlMostrada no se quede
  // pegada a un blob viejo.
  function establecerUrlDirecta(url: string) {
    if (previewRef.current) {
      URL.revokeObjectURL(previewRef.current);
      previewRef.current = null;
    }
    setPreviewLocal(null);
    setImagenGuardada(url.trim() || null);
    setError(null);
    setEstado("idle");
  }

  return {
    imagenGuardada, // lo que se manda a guardarGrupoProducto
    urlMostrada: previewLocal ?? imagenGuardada, // lo que se pinta en el <img>
    estado,
    error,
    manejarArchivo,
    establecerUrlDirecta,
    quitarImagen,
  };
}
