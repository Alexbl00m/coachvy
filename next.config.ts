import path from "node:path";
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // The repository root also holds a lockfile; pin the workspace to this app so
  // Next.js does not infer the parent directory as the project root.
  turbopack: {
    root: path.resolve(import.meta.dirname),
  },
  // Träningsfilosofin läses från docs/ i AI-anropen, så att filen är den enda
  // källan. Den följer med till servern.
  outputFileTracingIncludes: {
    "/**": ["./docs/traningsfilosofi.md"],
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
