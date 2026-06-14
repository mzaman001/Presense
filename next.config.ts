import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Allow network access from the user's IP so JS chunks aren't blocked by Next.js CORS
  allowedDevOrigins: ['192.168.1.34'],
} as any;

export default nextConfig;
