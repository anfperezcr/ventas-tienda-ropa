import type { TipoTeclado } from "./types";

type ElementoEditable = HTMLInputElement | HTMLTextAreaElement;

// "none" es el valor que el propio TouchKeyboardProvider escribe en el
// input mientras lo controla (ver ATRIBUTO_INPUTMODE_ORIGINAL) -- si un
// segundo focusin lo vuelve a leer no debe interpretarlo como "sin
// teclado", por eso se filtra acá antes de mirar el atributo.
const TIPOS_VALIDOS: TipoTeclado[] = ["numeric", "text", "tel", "email", "url", "search"];

const TYPES_EXCLUIDOS = new Set([
  "password",
  "color",
  "checkbox",
  "radio",
  "range",
  "file",
  "hidden",
  "date",
  "time",
  "datetime-local",
  "month",
  "week",
  "number",
]);

// Único punto de la app que decide "¿este campo es candidato al teclado
// virtual, y de qué tipo?" -- reusa inputMode/type tal como ya quedaron
// en el pase anterior (VentaForm, CajaPanel, ProductoForm, etc.), no
// inventa una taxonomía nueva ni requiere tocar cada formulario.
export function determinarTipoTeclado(el: ElementoEditable): TipoTeclado | null {
  if (el.disabled || el.readOnly) return null;

  if (el instanceof HTMLInputElement && TYPES_EXCLUIDOS.has(el.type)) {
    return null;
  }

  const modo = el.getAttribute("inputmode");
  if (modo && modo !== "none" && TIPOS_VALIDOS.includes(modo as TipoTeclado)) {
    return modo as TipoTeclado;
  }

  // Fallback por type nativo -- por si algún input futuro se agrega sin
  // seguir la convención de inputMode explícito.
  if (el instanceof HTMLInputElement) {
    if (el.type === "tel") return "tel";
    if (el.type === "email") return "email";
    if (el.type === "url") return "url";
    if (el.type === "search") return "search";
    if (el.type === "text") return "text";
    return null;
  }

  // <textarea> no tiene `type` -- siempre es texto libre.
  return "text";
}

// Solo los nodos de texto que son hijos DIRECTOS del <label> -- varios
// labels del proyecto envuelven, además del input, un <span> de texto de
// ayuda después (ej. "Días de período de gracia" en CrearTenantForm),
// y label.textContent los concatenaría todos en una sola etiqueta larga
// y confusa. Un nodo de texto directo no incluye lo que cuelga de un
// elemento hijo como ese <span>.
function textoDirectoDeLabel(label: HTMLLabelElement): string {
  let texto = "";
  for (const nodo of Array.from(label.childNodes)) {
    if (nodo.nodeType === Node.TEXT_NODE) texto += nodo.textContent;
  }
  return texto.trim();
}

// Contexto para el eco de valor del teclado virtual (modal centrado que
// tapa el input real -- sin esto el usuario pierde de vista qué campo
// está llenando). `.labels` es la API nativa del DOM para el <label> que
// envuelve o referencia un input, sin importar el patrón usado en el
// formulario; placeholder es el respaldo para inputs sin <label> (ej. la
// búsqueda de productos en VentaForm).
export function obtenerEtiquetaCampo(el: ElementoEditable): string {
  const label = el.labels?.[0];
  const textoLabel = label ? textoDirectoDeLabel(label) : "";
  if (textoLabel) return textoLabel;
  if (el instanceof HTMLInputElement && el.placeholder) return el.placeholder;
  return "";
}
