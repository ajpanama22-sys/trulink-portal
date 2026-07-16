import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    appDir: false,   // 👈 esto desactiva el App Router
  },
};

export default nextConfig;
