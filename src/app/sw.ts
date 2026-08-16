import { defaultCache } from "@serwist/turbopack/worker";
import type { PrecacheEntry, SerwistGlobalConfig } from "serwist";
import { Serwist } from "serwist";

declare global {
  interface WorkerGlobalScope extends SerwistGlobalConfig {
    __SW_MANIFEST: (PrecacheEntry | string)[] | undefined;
  }
}

declare const self: ServiceWorkerGlobalScope;

// Precachea el shell de la app (HTML/JS/CSS) para que la PWA pueda abrir
// sin conexión -- las respuestas de datos (productos, ventas, etc.) NO se
// cachean acá, viven en IndexedDB (Fase 7.2+). Sí existe un bucket de
// Supabase Storage para fotos de producto (src/lib/storage/), pero
// todavía no hay regla de runtime caching para esas imágenes -- quedan
// sirviéndose directo de la red cuando hay conexión; agregarla es trabajo
// aparte, no bloqueante para el flujo offline esencial (vender/stock/caja).
const serwist = new Serwist({
  precacheEntries: self.__SW_MANIFEST,
  skipWaiting: true,
  clientsClaim: true,
  navigationPreload: true,
  runtimeCaching: defaultCache,
  fallbacks: {
    entries: [
      {
        url: "/~offline",
        matcher: ({ request }) => request.destination === "document",
      },
    ],
  },
});

serwist.addEventListeners();
