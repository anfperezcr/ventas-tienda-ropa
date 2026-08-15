import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Ventas y Stock",
    short_name: "Ventas y Stock",
    description: "POS + inventario multi-tenant para tiendas de ropa",
    start_url: "/",
    scope: "/",
    display: "standalone",
    orientation: "any",
    background_color: "#f6f7f7",
    theme_color: "#115e59",
    lang: "es",
    icons: [
      {
        src: "/icon",
        sizes: "512x512",
        type: "image/png",
        purpose: "any",
      },
    ],
  };
}
