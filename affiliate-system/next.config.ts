import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  allowedDevOrigins: ["*.trycloudflare.com"],
  async rewrites() {
    return [
      { source: "/uploads/:path*", destination: "/api/uploads/:path*" },
    ]
  },
};

export default nextConfig;
