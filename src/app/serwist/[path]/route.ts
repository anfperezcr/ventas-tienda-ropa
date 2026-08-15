import { createSerwistRoute } from "@serwist/turbopack";

// @serwist/turbopack (a diferencia de @serwist/next con webpack) no
// escribe un public/sw.js estático -- sirve el service worker compilado
// vía este Route Handler dinámico. Sin este archivo, /serwist/sw.js
// (el swUrl que usa SerwistProvider en layout.tsx) da 404.
const revision = crypto.randomUUID();

export const { dynamic, dynamicParams, revalidate, generateStaticParams, GET } =
  createSerwistRoute({
    additionalPrecacheEntries: [{ url: "/~offline", revision }],
    swSrc: "src/app/sw.ts",
    useNativeEsbuild: true,
  });
