import path from "node:path";
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // The repository root also holds a lockfile; pin the workspace to this app so
  // Next.js does not infer the parent directory as the project root.
  turbopack: {
    root: path.resolve(import.meta.dirname),
  },
  experimental: {
    serverActions: {
      // En testrapport (PDF eller foto) läses via en server action. Vercel tar
      // högst 4,5 MB per anrop; bilder skalas ned i webbläsaren innan.
      bodySizeLimit: "4mb",
    },
  },
};

export default nextConfig;
