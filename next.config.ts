import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  typescript: {
    // Skip type checking during production build
    ignoreBuildErrors: true,
  },
  eslint: {
    // Skip ESLint during production build
    ignoreDuringBuilds: true,
  },
};

export default nextConfig;
