import fs from "fs";
import path from "path";
import type { NextConfig } from "next";

const { version } = JSON.parse(fs.readFileSync(path.join(__dirname, "package.json"), "utf8")) as { version: string };

const nextConfig: NextConfig = {
  // Shown beside the app name so a screen always says which build it is.
  env: { NEXT_PUBLIC_APP_VERSION: version },
  // The desktop installer ships a self-contained server (BUILD_STANDALONE=1, set by
  // scripts/prepare-desktop.mjs); ordinary `next dev` / `next build` leave this off.
  output: process.env.BUILD_STANDALONE === "1" ? "standalone" : undefined,
  // The embedded database loads its WebAssembly files from node_modules at run time.
  serverExternalPackages: ["@electric-sql/pglite"],
  // The server bundle must carry only what the app needs. The file tracer follows the project folder
  // (the app reads its schema and seed from a folder at run time), so without this it would copy the
  // installer's own previous build output, the Rust target folder and the Excel documents into it.
  outputFileTracingExcludes: {
    "/*": ["./desktop-bundle/**", "./src-tauri/**", "./docs/**", "./db/**", "./.claude/**", "./scripts/**"],
  },
  // An unrelated stray package-lock.json in C:\Users\tony\ otherwise makes
  // Turbopack misdetect that as the workspace root instead of this project.
  turbopack: {
    root: path.join(__dirname),
  },
};

export default nextConfig;
