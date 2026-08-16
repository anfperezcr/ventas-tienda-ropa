// Exportación 100% client-side (Blob + <a download>) -- los datos ya
// están en memoria en el componente que llama a esto, no hace falta ida
// y vuelta al servidor para generar el archivo.

function escaparCampoCsv(valor: string): string {
  if (/[",\r\n]/.test(valor)) {
    return `"${valor.replace(/"/g, '""')}"`;
  }
  return valor;
}

export function generarCsv(encabezados: string[], filas: string[][]): string {
  const lineas = [encabezados, ...filas].map((fila) => fila.map(escaparCampoCsv).join(","));
  // BOM al inicio para que Excel detecte UTF-8 y no rompa tildes/ñ.
  return "﻿" + lineas.join("\r\n");
}

export function descargarCsv(nombreArchivo: string, contenidoCsv: string): void {
  const blob = new Blob([contenidoCsv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const enlace = document.createElement("a");
  enlace.href = url;
  enlace.download = nombreArchivo;
  document.body.appendChild(enlace);
  enlace.click();
  document.body.removeChild(enlace);
  URL.revokeObjectURL(url);
}
