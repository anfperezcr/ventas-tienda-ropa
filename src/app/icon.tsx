import { ImageResponse } from "next/og";

// Ícono genérico generado en build (sin assets externos) -- sirve tanto
// de favicon como del ícono grande del manifest (público, sin marca por
// tenant todavía; ver Fase 5 para el branding dentro de la app).
export const size = { width: 512, height: 512 };
export const contentType = "image/png";

export default function Icon() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "#115e59",
          color: "white",
          fontSize: 280,
          fontWeight: 700,
          fontFamily: "sans-serif",
        }}
      >
        V
      </div>
    ),
    { ...size }
  );
}
