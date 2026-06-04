import type { NextConfig } from "next";

/**
 * When set (see `npm run dev:webpack`), we attach a `webpack` hook. Omit it for
 * `next dev --turbopack` so Next does not load webpack customization at dev
 * startup (faster "Ready", no "Webpack is configured while Turbopack is not").
 * `next build` never sets this env — production keeps default webpack caching.
 */
const webpackDevDisableFsCache =
  process.env.NEXT_WEBPACK_DISABLE_FS_CACHE === "1";

const nextConfig: NextConfig = {
  output: "standalone",
  /**
   * Keep heavy / fragile deps out of the webpack graph:
   * - @anthropic-ai/sdk, @supabase*: avoid vendor-chunks resolution bugs
   * - pdf-parse: v1 runs a debug block when `module.parent` is falsy (bundled) → ENOENT on ./test/data/05-versions-space.pdf
   */
  serverExternalPackages: [
    "@anthropic-ai/sdk",
    "@supabase/supabase-js",
    "@supabase/ssr",
    "pdf-parse",
  ],
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "placehold.co" },
      { protocol: "https", hostname: "creditcards.chase.com" },
      { protocol: "https", hostname: "www.americanexpress.com" },
      { protocol: "https", hostname: "americanexpress.com" },
      { protocol: "https", hostname: "www.citi.com" },
      { protocol: "https", hostname: "ecm.capitalone.com" },
      { protocol: "https", hostname: "www.capitalone.com" },
      { protocol: "https", hostname: "www.discover.com" },
      { protocol: "https", hostname: "www.apple.com" },
      { protocol: "https", hostname: "www.biltrewards.com" },
      { protocol: "https", hostname: "www.wellsfargo.com" },
      { protocol: "https", hostname: "www.bankofamerica.com" },
      { protocol: "https", hostname: "www.usbank.com" },
    ],
  },
  /** Declares Turbopack-aware config so dev + warnings stay aligned with `next dev --turbopack`. */
  turbopack: {},
};

if (webpackDevDisableFsCache) {
  nextConfig.webpack = (config, { dev }) => {
    if (dev) {
      // Avoid PackFileCacheStrategy ENOENT (rename *.pack.gz_) when HMR or multiple
      // processes touch `.next/cache/webpack` (webpack dev only).
      config.cache = false;
    }
    return config;
  };
}

export default nextConfig;
