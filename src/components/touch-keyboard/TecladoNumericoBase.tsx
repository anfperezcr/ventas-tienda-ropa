"use client";

import { TeclaTactil } from "./TeclaTactil";

const DIGITOS = ["1", "2", "3", "4", "5", "6", "7", "8", "9"];

// Grid de dígitos compartido entre NumericKeyboard (dinero) y
// PhoneKeyboard (teléfono) -- ambos mockups del ticket difieren solo en
// la fila inferior (dinero: 00/0/⌫; teléfono: 0 centrado + ⌫/✓ aparte),
// así que solo esa parte varía por `variante`.
export function TecladoNumericoBase({
  variante,
  onDigito,
  onBorrar,
  onConfirmar,
}: {
  variante: "dinero" | "telefono";
  onDigito: (d: string) => void;
  onBorrar: () => void;
  onConfirmar: () => void;
}) {
  return (
    <div className="flex flex-col gap-2">
      <div className="grid grid-cols-3 gap-2 sm:gap-3">
        {DIGITOS.map((d) => (
          <TeclaTactil key={d} onPress={() => onDigito(d)} ariaLabel={`Dígito ${d}`}>
            {d}
          </TeclaTactil>
        ))}
        {variante === "dinero" ? (
          <>
            <TeclaTactil onPress={() => onDigito("00")} ariaLabel="Doble cero">
              00
            </TeclaTactil>
            <TeclaTactil onPress={() => onDigito("0")} ariaLabel="Dígito 0">
              0
            </TeclaTactil>
            <TeclaTactil onPress={onBorrar} variante="muted" ariaLabel="Borrar último dígito">
              ⌫
            </TeclaTactil>
          </>
        ) : (
          <>
            <span aria-hidden="true" />
            <TeclaTactil onPress={() => onDigito("0")} ariaLabel="Dígito 0">
              0
            </TeclaTactil>
            <span aria-hidden="true" />
          </>
        )}
      </div>

      {variante === "telefono" && (
        <div className="grid grid-cols-2 gap-2 sm:gap-3">
          <TeclaTactil onPress={onBorrar} variante="muted" ariaLabel="Borrar último dígito">
            ⌫
          </TeclaTactil>
          <TeclaTactil onPress={onConfirmar} variante="accent" ariaLabel="Confirmar">
            ✓
          </TeclaTactil>
        </div>
      )}
      {variante === "dinero" && (
        <TeclaTactil onPress={onConfirmar} variante="accent" ariaLabel="Confirmar" className="min-h-14 sm:min-h-16">
          ✓ LISTO
        </TeclaTactil>
      )}
    </div>
  );
}
