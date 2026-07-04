import type { NextConfig } from "next";

/**
 * Why `next dev --webpack` / `next build --webpack` (scripts in
 * package.json) instead of Turbopack:
 *
 *   - The repo relies on a few transitive packages that have not
 *     finished their Turbopack adoption (notably some Clerk +
 *     Convex dev-mode integrations). Keeping the Webpack
 *     bundler for both dev and build gives us one consistent
 *     path that does not silently break on every dependency
 *     bump.
 *   - AGENTS.md mentions Turbopack as the preferred bundler.
 *     Once the upstream packages finish the migration, switch
 *     the scripts back to `next dev` / `next build` to get
 *     Turbopack's faster cold-start times back.
 */
const nextConfig: NextConfig = {
  poweredByHeader: false,
  experimental: {
    optimizePackageImports: ["@phosphor-icons/react"],
  },
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "**.convex.cloud",
      },
      {
        protocol: "https",
        hostname: "img.clerk.com",
      },
    ],
  },
};

export default nextConfig;
