"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";
import { usePathname } from "next/navigation";
import { TouchKeyboard } from "./TouchKeyboard";
import { determinarTipoTeclado, obtenerEtiquetaCampo } from "@/lib/touchKeyboard/eligibility";
import {
  leerModoGuardado,
  guardarModo,
  obtenerSnapshotServidor,
  suscribirModoGuardado,
} from "@/lib/touchKeyboard/storage";
import { setNativeInputValue } from "@/lib/touchKeyboard/nativeValue";
import type { ModoEntrada, TipoTeclado } from "@/lib/touchKeyboard/types";

type TouchKeyboardContextValue = {
  modo: ModoEntrada;
  setModo: (modo: ModoEntrada) => void;
  isOpen: boolean;
  keyboardType: TipoTeclado | null;
  closeKeyboard: () => void;
};

const TouchKeyboardContext = createContext<TouchKeyboardContextValue | null>(null);

export function useTouchKeyboard(): TouchKeyboardContextValue {
  const ctx = useContext(TouchKeyboardContext);
  if (!ctx) {
    throw new Error("useTouchKeyboard debe usarse dentro de <TouchKeyboardProvider>");
  }
  return ctx;
}

type ElementoEditable = HTMLInputElement | HTMLTextAreaElement;

// Guarda el inputMode real del campo antes de sobreescribirlo con "none"
// (la técnica estándar para suprimir el teclado nativo del SO mientras
// nuestro teclado virtual controla el campo -- MDN: inputmode="none").
// Vive como atributo en el propio elemento, no en un estado del Provider,
// así la restauración es correcta sin importar el orden en que el foco
// se mueva entre varios campos elegibles.
const ATRIBUTO_INPUTMODE_ORIGINAL = "data-touch-kb-inputmode-original";

function restaurarInputMode(el: ElementoEditable) {
  const original = el.getAttribute(ATRIBUTO_INPUTMODE_ORIGINAL);
  if (original === null) return;
  if (original === "") {
    el.removeAttribute("inputmode");
  } else {
    el.setAttribute("inputmode", original);
  }
  el.removeAttribute(ATRIBUTO_INPUTMODE_ORIGINAL);
}

export function TouchKeyboardProvider({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  // useSyncExternalStore -- lectura segura de localStorage entre servidor
  // (getServerSnapshot fijo en "keyboard") y cliente, sin el patrón manual
  // "useState + setState en un effect de montaje" que las reglas nuevas de
  // react-hooks (estilo React Compiler) marcan como cascading render.
  const modo = useSyncExternalStore(suscribirModoGuardado, leerModoGuardado, obtenerSnapshotServidor);

  const [isOpen, setIsOpen] = useState(false);
  const [keyboardType, setKeyboardType] = useState<TipoTeclado | null>(null);
  const [valorActual, setValorActual] = useState("");
  const [esMoneda, setEsMoneda] = useState(false);
  const [etiquetaCampo, setEtiquetaCampo] = useState("");

  const activeInputRef = useRef<ElementoEditable | null>(null);
  const panelRef = useRef<HTMLDivElement | null>(null);

  const desligarInputActivo = useCallback(() => {
    const el = activeInputRef.current;
    if (!el) return;
    restaurarInputMode(el);
    activeInputRef.current = null;
  }, []);

  const closeKeyboard = useCallback(() => {
    setIsOpen(false);
    setKeyboardType(null);
    desligarInputActivo();
  }, [desligarInputActivo]);

  // El cierre al cambiar de modo se resuelve acá, como reacción directa a
  // la acción del usuario -- no como un efecto separado observando
  // (modo, isOpen), que las reglas nuevas de react-hooks no permiten
  // resolver con un setState síncrono dentro del efecto.
  const setModo = useCallback(
    (nuevo: ModoEntrada) => {
      if (nuevo !== "touch") closeKeyboard();
      guardarModo(nuevo);
    },
    [closeKeyboard]
  );

  const confirmar = useCallback(() => {
    const el = activeInputRef.current;
    el?.dispatchEvent(new Event("change", { bubbles: true }));
    closeKeyboard();
    // Blur explícito: si solo cerráramos nuestro panel sin quitar el foco,
    // el campo seguiría enfocado con su inputMode ya restaurado y el
    // teclado nativo del SO podría aparecer de golpe justo al cerrar el
    // nuestro. Un blur evita ese parpadeo.
    el?.blur();
  }, [closeKeyboard]);

  // -- Escritura sobre el input real (nunca un <div> simulado, ticket §32) --

  const insertarTexto = useCallback((texto: string, forzarAlFinal: boolean) => {
    const el = activeInputRef.current;
    if (!el) return;
    const largo = el.value.length;
    const inicio = forzarAlFinal ? largo : (el.selectionStart ?? largo);
    const fin = forzarAlFinal ? largo : (el.selectionEnd ?? largo);
    const nuevoValor = el.value.slice(0, inicio) + texto + el.value.slice(fin);
    setNativeInputValue(el, nuevoValor);
    const nuevaPosicion = inicio + texto.length;
    el.setSelectionRange(nuevaPosicion, nuevaPosicion);
    setValorActual(el.value);
  }, []);

  const borrarAnterior = useCallback((forzarAlFinal: boolean) => {
    const el = activeInputRef.current;
    if (!el) return;
    const largo = el.value.length;
    const inicio = forzarAlFinal ? largo : (el.selectionStart ?? largo);
    const fin = forzarAlFinal ? largo : (el.selectionEnd ?? largo);
    let nuevoValor: string;
    let nuevaPosicion: number;
    if (inicio === fin) {
      if (inicio === 0) return;
      nuevoValor = el.value.slice(0, inicio - 1) + el.value.slice(fin);
      nuevaPosicion = inicio - 1;
    } else {
      nuevoValor = el.value.slice(0, inicio) + el.value.slice(fin);
      nuevaPosicion = inicio;
    }
    setNativeInputValue(el, nuevoValor);
    el.setSelectionRange(nuevaPosicion, nuevaPosicion);
    setValorActual(el.value);
  }, []);

  const limpiarTodo = useCallback(() => {
    const el = activeInputRef.current;
    if (!el) return;
    setNativeInputValue(el, "");
    el.setSelectionRange(0, 0);
    setValorActual("");
  }, []);

  // -- Listener global de foco: hace que CUALQUIER input/textarea elegible
  // de la app (existente o futuro) funcione con el teclado virtual sin
  // tocar cada formulario -- arquitectura pedida en el ticket §5. --
  useEffect(() => {
    if (modo !== "touch") return;

    function activar(el: ElementoEditable) {
      const tipo = determinarTipoTeclado(el);
      if (!tipo) return;

      if (activeInputRef.current && activeInputRef.current !== el) {
        restaurarInputMode(activeInputRef.current);
      }

      if (!el.hasAttribute(ATRIBUTO_INPUTMODE_ORIGINAL)) {
        el.setAttribute(ATRIBUTO_INPUTMODE_ORIGINAL, el.getAttribute("inputmode") ?? "");
      }
      el.setAttribute("inputmode", "none");

      activeInputRef.current = el;
      setValorActual(el.value);
      setEsMoneda(el.dataset.tecladoMoneda === "true");
      setEtiquetaCampo(obtenerEtiquetaCampo(el));
      setKeyboardType(tipo);
      setIsOpen(true);
    }

    function onFocusIn(e: FocusEvent) {
      const el = e.target;
      if (el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement) {
        activar(el);
      }
    }

    function onFocusOut(e: FocusEvent) {
      const siguiente = e.relatedTarget;
      // El foco se movió hacia una tecla del propio panel -- no es un
      // "abandono" real del campo, el teclado sigue operando sobre él.
      if (siguiente instanceof Node && panelRef.current?.contains(siguiente)) return;
      // Se resuelve en el siguiente tick: si el usuario tocó otro input
      // elegible, onFocusIn ya habrá reasignado activeInputRef para
      // cuando este timeout corra, y el check de abajo lo detecta.
      window.setTimeout(() => {
        const actual = activeInputRef.current;
        if (!actual) return;
        if (document.activeElement === actual) return;
        if (panelRef.current?.contains(document.activeElement)) return;
        closeKeyboard();
      }, 0);
    }

    // También sincroniza el valor mostrado si algo más (no el teclado)
    // cambia el value del input activo mientras está enfocado.
    function onInput(e: Event) {
      if (e.target === activeInputRef.current) {
        setValorActual((e.target as ElementoEditable).value);
      }
    }

    document.addEventListener("focusin", onFocusIn);
    document.addEventListener("focusout", onFocusOut);
    document.addEventListener("input", onInput);
    return () => {
      document.removeEventListener("focusin", onFocusIn);
      document.removeEventListener("focusout", onFocusOut);
      document.removeEventListener("input", onInput);
    };
  }, [modo, closeKeyboard]);

  // Cierra al navegar a otra ruta (ticket §17) -- reacciona a una señal
  // externa (el pathname del router), no a un estado local derivable, por
  // eso sigue viviendo en un efecto.
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- cierre reactivo a la navegación (señal externa), no hay forma de resolverlo desde un manejador de evento local
    closeKeyboard();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- se dispara a propósito solo con el cambio de pathname
  }, [pathname]);

  // Cierra ante cualquier envío de formulario (fase de captura, antes de
  // que el formulario navegue o se recargue) -- red de seguridad además
  // del blur explícito de confirmar().
  useEffect(() => {
    function onSubmit() {
      closeKeyboard();
    }
    document.addEventListener("submit", onSubmit, true);
    return () => document.removeEventListener("submit", onSubmit, true);
  }, [closeKeyboard]);

  // Solo numeric/tel insertan siempre al final (estilo calculadora, tal
  // como pide el ticket §10 para montos: "1 → 10 → 100 → 1.000"); text
  // respeta la posición real del cursor (ticket §16).
  const alFinal = keyboardType === "numeric" || keyboardType === "tel";

  return (
    <TouchKeyboardContext.Provider value={{ modo, setModo, isOpen, keyboardType, closeKeyboard }}>
      {children}
      {modo === "touch" && isOpen && keyboardType && (
        <TouchKeyboard
          ref={panelRef}
          keyboardType={keyboardType}
          value={valorActual}
          esMoneda={esMoneda}
          etiqueta={etiquetaCampo}
          onDigit={(d) => insertarTexto(d, alFinal)}
          onInsertText={(t) => insertarTexto(t, false)}
          onBackspace={() => borrarAnterior(alFinal)}
          onClear={limpiarTodo}
          onConfirm={confirmar}
          onClose={closeKeyboard}
        />
      )}
    </TouchKeyboardContext.Provider>
  );
}
