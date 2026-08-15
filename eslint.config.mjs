import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  globalIgnores([
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    // Copia de solo lectura del proyecto hermano, usada como referencia
    // (ver CLAUDE.md) -- nunca se lintea, modifica ni despliega.
    "reference/**",
  ]),
]);

export default eslintConfig;
