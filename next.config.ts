import type { NextConfig } from "next";

const nextConfig: NextConfig = {
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
