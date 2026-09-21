import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Wardrobe Assistant",
    short_name: "Wardrobe",
    description: "Outfits from the clothes you already own.",
    start_url: "/",
    display: "standalone",
    orientation: "portrait",
    background_color: "#faf9f7",
    theme_color: "#faf9f7",
    icons: [
      { src: "/icon.svg", sizes: "any", type: "image/svg+xml", purpose: "any" },
    ],
  };
}
