import path from "path";
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Build a self-contained bundle for the office server, which runs the app
  // as a long-lived `next start` process rather than as serverless functions.
  // Gated on BUILD_STANDALONE so it is inert everywhere it is not wanted:
  // Netlify's Next runtime does its own packaging and must keep the default
  // output, and this app stays deployed there until the migration is tested.
  // Set BUILD_STANDALONE=1 in the server's .env before `npm run build`.
  output: process.env.BUILD_STANDALONE === "1" ? "standalone" : undefined,
  // `pg` resolves optional native/extra entry points (pg-native, pg-cloudflare)
  // at require time, which bundlers either fail on or silently stub. Keeping it
  // external means it loads from node_modules at runtime, same convention as
  // the sibling Employee Manager / Woodgrain Estimating apps.
  serverExternalPackages: ["pg"],
  // An unrelated stray package-lock.json in C:\Users\tony\ otherwise makes
  // Turbopack misdetect that as the workspace root instead of this project.
  turbopack: {
    root: path.join(__dirname),
  },
};

export default nextConfig;
