import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "export",
  basePath: "/modules/ghalocafe",
  images: {
    unoptimized: true, // Requerido para exportación estática
  },
};

export default nextConfig;
