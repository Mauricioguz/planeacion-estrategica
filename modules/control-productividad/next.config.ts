import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone", // Necesario para el Dockerfile multi-stage
  basePath: "/modules/control-productividad",
};

export default nextConfig;
