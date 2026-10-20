import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    id: "/crm/intake",
    name: "SmartCRM Scanner",
    short_name: "SmartCRM",
    description: "Camera-first business card intake and intelligence",
    start_url: "/crm/intake",
    scope: "/",
    display: "standalone",
    background_color: "#090d16",
    theme_color: "#090d16",
    icons: [
      {
        src: "/icon-192.png",
        sizes: "192x192",
        type: "image/png",
      },
      {
        src: "/icon-512.png",
        sizes: "512x512",
        type: "image/png",
      },
    ],
    share_target: {
      action: "/crm/intake/share",
      method: "POST",
      enctype: "multipart/form-data",
      params: {
        files: [{ name: "file", accept: ["image/*", "application/pdf"] }],
      },
    },
  };
}
