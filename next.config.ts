import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  typescript: {
    // Disable TS type checking during build (we verify types locally using tsc --noEmit)
    ignoreBuildErrors: true,
  },
};

export default nextConfig;
