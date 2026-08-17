"use client";

import { useActionState, useRef, useState } from "react";
import {
  actualizarConfiguracion,
  type ConfiguracionFormState,
} from "@/lib/configuracion/actions";
import type { Configuracion } from "@/lib/configuracion/data";
import { iniciales } from "@/lib/iniciales";
import { useSubidaLogo } from "@/hooks/useSubidaLogo";
import { IconoConfiguracion, IconoRecibo } from "@/components/dashboard/iconos";
import { IconoEdificio, IconoPaleta, IconoOjo, IconoGuardar } from "./IconosConfiguracion";
import { SelectorMetodoEntrada } from "./SelectorMetodoEntrada";

const initialState: ConfiguracionFormState = { error: null };
const HEX_REGEX = /^#[0-9a-fA-F]{6}$/;

const MENSAJE_ESTADO: Record<string, string> = {
  comprimiendo: "Comprimiendo imagen...",
  subiendo: "Subiendo imagen...",
};

export function ConfiguracionForm({ configuracion }: { configuracion: Configuracion }) {
  const [state, formAction, pending] = useActionState(actualizarConfiguracion, initialState);
  const inputArchivoRef = useRef<HTMLInputElement>(null);

  const [nombreNegocio, setNombreNegocio] = useState(configuracion.nombreNegocio);
  const [colorPrimario, setColorPrimario] = useState(configuracion.colorPrimario);
  const [colorTexto, setColorTexto] = useState(configuracion.colorPrimario);
  const [modoLogo, setModoLogo] = useState<"archivo" | "url">("archivo");
  const [logoErrorCarga, setLogoErrorCarga] = useState(false);
  const [mensajeRecibo, setMensajeRecibo] = useState(configuracion.mensajeRecibo);

  const logo = useSubidaLogo(configuracion.logoUrl ?? null);

  function restablecer() {
    setNombreNegocio(configuracion.nombreNegocio);
    setColorPrimario(configuracion.colorPrimario);
    setColorTexto(configuracion.colorPrimario);
    setModoLogo("archivo");
    setLogoErrorCarga(false);
    logo.establecerUrlDirecta(configuracion.logoUrl ?? "");
    setMensajeRecibo(configuracion.mensajeRecibo);
  }

  const mostrandoLogo = logo.urlMostrada?.trim() && !logoErrorCarga;

  return (
    <form action={formAction} className="flex w-full flex-col gap-4">
      <input type="hidden" name="logoUrl" value={logo.imagenGuardada ?? ""} />
      <input type="hidden" name="logoUrlAnterior" value={configuracion.logoUrl ?? ""} />

      <div className="flex items-center gap-3">
        <div
          className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl"
          style={{ backgroundColor: "color-mix(in srgb, var(--brand-600) 12%, white)" }}
        >
          <IconoConfiguracion className="h-6 w-6 text-[var(--brand-600)]" />
        </div>
        <div>
          <h1 className="text-xl font-semibold">Configuración</h1>
          <p className="text-sm text-neutral-500">
            Personaliza la información y apariencia de tu negocio.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[3fr_2fr]">
        <div className="flex flex-col gap-4">
          <div className="rounded-2xl border border-neutral-200 p-4">
            <h2 className="mb-3 flex items-center gap-2 font-semibold">
              <IconoEdificio className="h-5 w-5 text-neutral-500" /> Información del negocio
            </h2>
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
            <h2 className="mb-3 flex items-center gap-2 font-semibold">
              <IconoPaleta className="h-5 w-5 text-neutral-500" /> Identidad visual
            </h2>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <label className="flex min-w-0 flex-col gap-1 text-sm">
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
                    className="h-12 w-14 shrink-0 rounded-lg border border-neutral-300"
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
                    className="min-w-0 flex-1 rounded-lg border border-neutral-300 px-4 py-3 text-lg uppercase"
                  />
                </div>
                <span className="text-xs text-neutral-500">
                  Color que representa tu marca en toda la aplicación.
                </span>
              </label>

              <div className="flex flex-col gap-1 text-sm">
                Logo del negocio
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => setModoLogo("archivo")}
                    className={`flex-1 rounded-lg border px-3 py-2 text-sm font-medium ${
                      modoLogo === "archivo"
                        ? "border-[var(--brand-600)] text-[var(--brand-600)]"
                        : "border-neutral-300 text-neutral-600"
                    }`}
                  >
                    Desde mi dispositivo
                  </button>
                  <button
                    type="button"
                    onClick={() => setModoLogo("url")}
                    className={`flex-1 rounded-lg border px-3 py-2 text-sm font-medium ${
                      modoLogo === "url"
                        ? "border-[var(--brand-600)] text-[var(--brand-600)]"
                        : "border-neutral-300 text-neutral-600"
                    }`}
                  >
                    Desde URL
                  </button>
                </div>

                {modoLogo === "archivo" ? (
                  <div>
                    <input
                      ref={inputArchivoRef}
                      type="file"
                      accept="image/jpeg,image/png,image/webp"
                      className="hidden"
                      onChange={(e) => {
                        const archivo = e.target.files?.[0];
                        setLogoErrorCarga(false);
                        if (archivo) logo.manejarArchivo(archivo);
                        e.target.value = "";
                      }}
                    />
                    <button
                      type="button"
                      onClick={() => inputArchivoRef.current?.click()}
                      className="w-full rounded-lg border border-dashed border-neutral-300 px-4 py-3 text-left text-sm text-neutral-600"
                    >
                      Elegir imagen (JPG, PNG o WEBP, máx 5MB)
                    </button>
                  </div>
                ) : (
                  <input
                    type="url"
                    inputMode="url"
                    defaultValue={logo.imagenGuardada ?? ""}
                    onChange={(e) => {
                      setLogoErrorCarga(false);
                      logo.establecerUrlDirecta(e.target.value);
                    }}
                    placeholder="https://..."
                    className="w-full rounded-lg border border-neutral-300 px-4 py-3 text-lg"
                  />
                )}

                {(logo.estado === "comprimiendo" || logo.estado === "subiendo") && (
                  <p className="text-xs text-neutral-500">{MENSAJE_ESTADO[logo.estado]}</p>
                )}
                {logo.estado === "error" && (
                  <p className="text-xs text-red-600">{logo.error}</p>
                )}
                <span className="text-xs text-neutral-500">
                  Se usará en impresiones y reportes.
                </span>
              </div>
            </div>
            {logo.imagenGuardada && (
              <button
                type="button"
                onClick={() => {
                  logo.quitarImagen();
                  setLogoErrorCarga(false);
                }}
                className="mt-2 text-sm text-red-600"
              >
                Quitar logo
              </button>
            )}
          </div>

          <div className="rounded-2xl border border-neutral-200 p-4">
            <h2 className="mb-3 flex items-center gap-2 font-semibold">
              <IconoRecibo className="h-5 w-5 text-neutral-500" /> Recibo
            </h2>
            <label className="flex flex-col gap-1 text-sm">
              Mensaje de recibo
              <textarea
                inputMode="text"
                name="mensajeRecibo"
                value={mensajeRecibo}
                onChange={(e) => setMensajeRecibo(e.target.value.slice(0, 500))}
                rows={4}
                maxLength={500}
                className="rounded-lg border border-neutral-300 px-4 py-3 text-lg"
                required
              />
              <span className="flex items-center justify-between text-xs text-neutral-500">
                <span>Este mensaje se mostrará al final del recibo de venta.</span>
                <span>{mensajeRecibo.length}/500</span>
              </span>
            </label>
          </div>
        </div>

        <div className="flex flex-col gap-4">
          <div className="rounded-2xl border border-neutral-200 p-4">
            <h2 className="mb-1 flex items-center gap-2 font-semibold">
              <IconoOjo className="h-5 w-5 text-neutral-500" /> Vista previa
            </h2>
            <p className="mb-3 text-xs text-neutral-500">
              Así se verá tu negocio en la aplicación y documentos.
            </p>
            <div
              className="flex items-center gap-3 rounded-xl border p-4"
              style={{
                borderColor: colorPrimario,
                backgroundColor: `color-mix(in srgb, ${colorPrimario} 10%, white)`,
              }}
            >
              {mostrandoLogo ? (
                // eslint-disable-next-line @next/next/no-img-element -- preview local (object URL) o URL externa, sin dominios configurados para next/image
                <img
                  key={logo.urlMostrada}
                  src={logo.urlMostrada!}
                  alt=""
                  className="h-12 w-12 rounded-lg object-cover"
                  onError={() => setLogoErrorCarga(true)}
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
            <p
              className="mt-2 flex items-center gap-1.5 text-xs"
              style={{ color: colorPrimario }}
            >
              <span
                className="h-1.5 w-1.5 rounded-full"
                style={{ backgroundColor: colorPrimario }}
                aria-hidden="true"
              />
              Vista de ejemplo
            </p>
          </div>

          <SelectorMetodoEntrada />
        </div>
      </div>

      {state.error && <p className="text-sm text-red-600">{state.error}</p>}

      <div className="flex flex-col gap-2 sm:flex-row">
        <button
          type="button"
          onClick={restablecer}
          className="flex items-center gap-3 rounded-lg border border-neutral-300 px-4 py-3 text-left"
        >
          <span className="text-lg" aria-hidden="true">
            ↺
          </span>
          <span>
            <span className="block text-sm font-medium">Restablecer valores</span>
            <span className="block text-xs text-neutral-500">
              Volver a la configuración predeterminada
            </span>
          </span>
        </button>
        <button
          type="submit"
          disabled={pending || logo.estado === "comprimiendo" || logo.estado === "subiendo"}
          className="flex flex-1 items-center justify-center gap-3 rounded-lg bg-[var(--brand-600)] px-4 py-3 text-white disabled:opacity-60"
        >
          <IconoGuardar className="h-5 w-5" />
          <span>
            <span className="block text-sm font-medium">
              {pending ? "Guardando..." : "Guardar cambios"}
            </span>
            <span className="block text-xs opacity-80">Aplicar y guardar la configuración</span>
          </span>
        </button>
      </div>
    </form>
  );
}
