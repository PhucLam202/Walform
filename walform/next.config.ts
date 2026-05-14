import type { NextConfig } from "next";
import path from "path";

const nextConfig: NextConfig = {
  serverExternalPackages: ['@mysten/walrus', '@mysten/walrus-wasm'],
  turbopack: {
    root: path.resolve(__dirname),
  },
};

export default nextConfig;
