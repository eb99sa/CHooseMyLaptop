import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // three.js ships untranspiled ESM that some toolchains need help with.
  transpilePackages: ["three"],
};

export default nextConfig;
