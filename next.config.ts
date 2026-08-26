import path from "node:path";
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // The repository root also holds a lockfile; pin the workspace to this app so
  // Next.js does not infer the parent directory as the project root.
  turbopack: {
    root: path.resolve(import.meta.dirname),
  },
};

export default nextConfig;
