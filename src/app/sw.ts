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
// cachean acá, viven en IndexedDB (Fase 7.2+). A diferencia del hermano,
// no hay regla de runtime caching para imágenes de Supabase Storage --
// Fase 3 decidió no tener bucket de storage, logos/imágenes son URLs
// externas sueltas.
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
