import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Helps container/Vercel deployments by emitting a self-contained server bundle.
  output: "standalone",
  // Ensure server runtime can resolve firebase-admin normally (avoid Turbopack hashed externals).
  serverExternalPackages: ["firebase-admin"],
};

export default nextConfig;
