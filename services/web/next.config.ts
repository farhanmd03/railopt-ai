import type { NextConfig } from "next";

const BACKEND_URL = (
  process.env.INTERNAL_API_URL ||
  process.env.BACKEND_URL ||
  process.env.NEXT_PUBLIC_API_BASE_URL ||
  "https://railopt-ai-36j3.onrender.com"
).replace(/\/+$/, "");

const nextConfig: NextConfig = {
  // Standalone output is only required for Docker container images.
  // On Vercel, Next.js natively builds serverless artifacts without standalone mode.
  output:
    process.env.DOCKER_BUILD === "true" || process.env.BUILD_STANDALONE === "true"
      ? "standalone"
      : undefined,
  async rewrites() {
    return [
      {
        source: "/api/v1/:path*",
        destination: `${BACKEND_URL}/api/v1/:path*`,
      },
    ];
  },
};

export default nextConfig;
