// React (y cualquier <form> nativo) solo se enteran de un cambio de valor
// si pasa por el setter nativo del elemento + un evento "input" real --
// asignar `el.value = x` a secas no dispara el onChange de un input
// controlado (React intercepta su propio setter). Esta es la técnica
// estándar para escribir en un input desde fuera de React sin reemplazar
// el <input> real por un <div> que lo simule (ticket §32).
export function setNativeInputValue(
  el: HTMLInputElement | HTMLTextAreaElement,
  value: string
): void {
  const proto =
    el instanceof HTMLTextAreaElement
      ? window.HTMLTextAreaElement.prototype
      : window.HTMLInputElement.prototype;
  const setter = Object.getOwnPropertyDescriptor(proto, "value")?.set;
  setter?.call(el, value);
  el.dispatchEvent(new Event("input", { bubbles: true }));
}
