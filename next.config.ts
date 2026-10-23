import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Pin the workspace root so a stray lockfile in a parent folder is not picked up.
  turbopack: { root: process.cwd() },
  // Produce a minimal server bundle for Docker / container runtimes.
  output: "standalone",
  async redirects() {
    return [
      {
        source: "/deals",
        destination: "/opportunities",
        permanent: true,
      },
      {
        source: "/deals/:id",
        destination: "/opportunities/:id",
        permanent: true,
      },
    ];
  },
};

export default nextConfig;
