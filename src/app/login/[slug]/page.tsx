import type { CSSProperties } from "react";
import { LoginForm } from "@/components/auth/LoginForm";
import { obtenerBrandingPorSlug } from "@/lib/configuracion/data";

export default async function LoginPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const branding = await obtenerBrandingPorSlug(slug);

  return (
    <main
      className="flex flex-1 flex-col items-center justify-center gap-4 p-4"
      style={
        branding ? ({ "--brand-600": branding.colorPrimario } as CSSProperties) : undefined
      }
    >
      {branding && (
        <div className="flex flex-col items-center gap-2">
          {branding.logoUrl && (
            // eslint-disable-next-line @next/next/no-img-element -- URL externa arbitraria del owner
            <img
              src={branding.logoUrl}
              alt=""
              className="h-12 w-12 rounded object-cover"
            />
          )}
          <h1 className="text-lg font-semibold">{branding.nombreNegocio}</h1>
        </div>
      )}
      <LoginForm slug={slug} />
    </main>
  );
}
