import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Plesk/Passenger deploy: build locally, ship the minimal standalone server.
  output: "standalone",
  poweredByHeader: false,
  experimental: {
    serverActions: {
      bodySizeLimit: "10mb",
    },
  },
};

export default nextConfig;

