import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Produce a minimal server bundle for Docker / container runtimes.
  output: "standalone",
};

export default nextConfig;
