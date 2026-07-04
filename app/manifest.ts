import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Synedrix, The Personal Learning Operating System",
    short_name: "Synedrix",
    description:
      "Five systems, one state. The personal learning operating system for German Gymnasium students.",
    start_url: "/",
    display: "standalone",
    background_color: "#fafafa",
    theme_color: "#0d9488",
    icons: [
      {
        src: "/favicon.ico",
        sizes: "any",
        type: "image/x-icon",
      },
    ],
    categories: ["education", "productivity"],
  };
}
