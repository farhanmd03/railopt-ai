import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Standalone output is only required for Docker container images.
  // On Vercel, Next.js natively builds serverless artifacts without standalone mode.
  output:
    process.env.DOCKER_BUILD === "true" || process.env.BUILD_STANDALONE === "true"
      ? "standalone"
      : undefined,
};

export default nextConfig;
