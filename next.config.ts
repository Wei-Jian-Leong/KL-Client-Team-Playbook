import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  async rewrites() {
    return [
      { source: "/knowledge-files/:path*", destination: "/api/knowledge-files/:path*" },
    ];
  },
  experimental: {
    proxyClientMaxBodySize: "500mb",
    serverActions: {
      bodySizeLimit: "10mb",
    },
  },
};

export default nextConfig;
