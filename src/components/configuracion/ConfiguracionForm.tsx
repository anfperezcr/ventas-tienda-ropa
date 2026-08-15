"use client";

import { useActionState, useState } from "react";
import {
  actualizarConfiguracion,
  type ConfiguracionFormState,
} from "@/lib/configuracion/actions";
import type { Configuracion } from "@/lib/configuracion/data";
import { iniciales } from "@/lib/iniciales";

const initialState: ConfiguracionFormState = { error: null };
const HEX_REGEX = /^#[0-9a-fA-F]{6}$/;

export function ConfiguracionForm({ configuracion }: { configuracion: Configuracion }) {
  const [state, formAction, pending] = useActionState(actualizarConfiguracion, initialState);

  const [nombreNegocio, setNombreNegocio] = useState(configuracion.nombreNegocio);
  const [colorPrimario, setColorPrimario] = useState(configuracion.colorPrimario);
  const [colorTexto, setColorTexto] = useState(configuracion.colorPrimario);
  const [logoUrl, setLogoUrl] = useState(configuracion.logoUrl ?? "");
  const [logoError, setLogoError] = useState(false);
  const [mensajeRecibo, setMensajeRecibo] = useState(configuracion.mensajeRecibo);

  function restablecer() {
    setNombreNegocio(configuracion.nombreNegocio);
    setColorPrimario(configuracion.colorPrimario);
    setColorTexto(configuracion.colorPrimario);
    setLogoUrl(configuracion.logoUrl ?? "");
    setLogoError(false);
    setMensajeRecibo(configuracion.mensajeRecibo);
  }

  return (
    <form action={formAction} className="flex w-full flex-col gap-4">
      <div>
        <h1 className="text-xl font-semibold">Configuración</h1>
        <p className="text-sm text-neutral-500">Personaliza la información y apariencia de tu negocio</p>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[3fr_2fr]">
        <div className="flex flex-col gap-4">
          <div className="rounded-2xl border border-neutral-200 p-4">
            <h2 className="mb-3 font-semibold">Información del negocio</h2>
            <label className="flex flex-col gap-1 text-sm">
              Nombre del negocio
              <input
                type="text"
                inputMode="text"
                name="nombreNegocio"
                value={nombreNegocio}
                onChange={(e) => setNombreNegocio(e.target.value)}
                className="rounded-lg border border-neutral-300 px-4 py-3 text-lg"
                required
              />
            </label>
          </div>

          <div className="rounded-2xl border border-neutral-200 p-4">
            <h2 className="mb-3 font-semibold">Identidad visual</h2>
            <label className="flex flex-col gap-1 text-sm">
              Color primario
              <div className="flex gap-2">
                <input
                  name="colorPrimario"
                  type="color"
                  value={colorPrimario}
                  onChange={(e) => {
                    setColorPrimario(e.target.value);
                    setColorTexto(e.target.value);
                  }}
                  className="h-12 w-16 rounded-lg border border-neutral-300"
                />
                <input
                  type="text"
                  inputMode="text"
                  value={colorTexto}
                  onChange={(e) => {
                    const val = e.target.value;
                    setColorTexto(val);
                    if (HEX_REGEX.test(val)) setColorPrimario(val);
                  }}
                  placeholder="#000000"
                  className="flex-1 rounded-lg border border-neutral-300 px-4 py-3 text-lg uppercase"
                />
              </div>
            </label>

            <label className="mt-3 flex flex-col gap-1 text-sm">
              Logo (URL, opcional)
              <input
                type="url"
                inputMode="url"
                name="logoUrl"
                value={logoUrl}
                onChange={(e) => {
                  setLogoUrl(e.target.value);
                  setLogoError(false);
                }}
                placeholder="https://..."
                className="rounded-lg border border-neutral-300 px-4 py-3 text-lg"
              />
            </label>
            {logoUrl.trim() && (
              <button
                type="button"
                onClick={() => {
                  setLogoUrl("");
                  setLogoError(false);
                }}
                className="mt-2 text-sm text-red-600"
              >
                Quitar logo
              </button>
            )}
          </div>

          <div className="rounded-2xl border border-neutral-200 p-4">
            <h2 className="mb-3 font-semibold">Recibo</h2>
            <label className="flex flex-col gap-1 text-sm">
              Mensaje de recibo
              <textarea
                inputMode="text"
                name="mensajeRecibo"
                value={mensajeRecibo}
                onChange={(e) => setMensajeRecibo(e.target.value)}
                rows={3}
                className="rounded-lg border border-neutral-300 px-4 py-3 text-lg"
                required
              />
            </label>
          </div>
        </div>

        <div className="flex flex-col gap-4">
          <div className="rounded-2xl border border-neutral-200 p-4">
            <h2 className="mb-3 font-semibold">Vista previa</h2>
            <div
              className="flex items-center gap-3 rounded-xl border p-4"
              style={{ borderColor: colorPrimario }}
            >
              {logoUrl.trim() && !logoError ? (
                // eslint-disable-next-line @next/next/no-img-element -- URL externa arbitraria del owner, sin dominios configurados para next/image
                <img
                  key={logoUrl.trim()}
                  src={logoUrl.trim()}
                  alt=""
                  className="h-12 w-12 rounded-lg object-cover"
                  onError={() => setLogoError(true)}
                />
              ) : (
                <div
                  className="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg text-sm font-semibold text-white"
                  style={{ backgroundColor: colorPrimario }}
                >
                  {nombreNegocio.trim() ? iniciales(nombreNegocio) : "?"}
                </div>
              )}
              <span className="font-semibold" style={{ color: colorPrimario }}>
                {nombreNegocio.trim() || "Nombre del negocio"}
              </span>
            </div>
          </div>
        </div>
      </div>

      {state.error && <p className="text-sm text-red-600">{state.error}</p>}

      <div className="flex gap-2">
        <button
          type="button"
          onClick={restablecer}
          className="rounded-lg border border-neutral-300 px-4 py-3 text-lg font-medium"
        >
          Restablecer valores
        </button>
        <button
          type="submit"
          disabled={pending}
          className="flex-1 rounded-lg bg-[var(--brand-600)] px-4 py-3 text-lg font-medium text-white disabled:opacity-60"
        >
          {pending ? "Guardando..." : "Guardar cambios"}
        </button>
      </div>
    </form>
  );
}
