import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Required by Walrus SDK — prevents Next.js from bundling WASM modules server-side
  serverExternalPackages: ['@mysten/walrus', '@mysten/walrus-wasm'],
};

export default nextConfig;
