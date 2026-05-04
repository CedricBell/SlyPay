import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "SlyPay",
    short_name: "SlyPay",
    description:
      "Geolocate nearby stores, get the best card for rewards and cashback, then pay with Apple Pay or Google Pay.",
    start_url: "/recommend",
    scope: "/",
    display: "standalone",
    orientation: "portrait",
    background_color: "#09090b",
    theme_color: "#10b981",
    categories: ["finance", "productivity"],
    icons: [
      {
        src: "/icon-192.svg",
        type: "image/svg+xml",
        sizes: "192x192",
      },
      {
        src: "/icon-512.svg",
        type: "image/svg+xml",
        sizes: "512x512",
      },
    ],
  };
}

