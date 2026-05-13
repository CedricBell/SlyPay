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
    background_color: "#09090f",
    theme_color: "#6d28d9",
    categories: ["finance", "productivity"],
    icons: [
      {
        src: "/assets/logoSeul.png",
        type: "image/png",
        sizes: "192x192",
        purpose: "any",
      },
      {
        src: "/assets/logoSeul.png",
        type: "image/png",
        sizes: "512x512",
        purpose: "any",
      },
    ],
  };
}

