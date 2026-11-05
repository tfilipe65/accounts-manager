// Builds the web app as a self-contained Next server and gathers everything the installer carries
// into desktop-bundle/ (git-ignored):
//   node.exe                 the Node runtime the app server runs on
//   server/                  Next standalone output (server.js, .next, node_modules ...)
//   db/seed.sql, db/profiles/ first-run data of a new company (built by scripts/build-seed.mjs)
//   supabase/migrations/     the schema, applied to the local database on start
// Run by `npm run desktop:build`; tauri.conf.json bundles desktop-bundle/ as resources.
import { spawnSync } from "child_process";
import { cpSync, existsSync, mkdirSync, rmSync, copyFileSync } from "fs";
import path from "path";
import { fileURLToPath } from "url";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const out = path.join(root, "desktop-bundle");
const run = (cmd, args, env = {}) => {
  const r = spawnSync(cmd, args, { cwd: root, stdio: "inherit", shell: process.platform === "win32", env: { ...process.env, ...env } });
  if (r.status !== 0) throw new Error(`${cmd} ${args.join(" ")} failed`);
};

if (!existsSync(path.join(root, "db", "seed.sql"))) {
  console.log("db/seed.sql is missing: building it from the workbook files first.");
  run("node", ["scripts/build-seed.mjs"]);
}

run("npx", ["next", "build"], { BUILD_STANDALONE: "1" });

rmSync(out, { recursive: true, force: true });
mkdirSync(out, { recursive: true });
cpSync(path.join(root, ".next", "standalone"), path.join(out, "server"), { recursive: true });
cpSync(path.join(root, ".next", "static"), path.join(out, "server", ".next", "static"), { recursive: true });
if (existsSync(path.join(root, "public"))) cpSync(path.join(root, "public"), path.join(out, "server", "public"), { recursive: true });
cpSync(path.join(root, "supabase", "migrations"), path.join(out, "supabase", "migrations"), { recursive: true });
mkdirSync(path.join(out, "db"), { recursive: true });
copyFileSync(path.join(root, "db", "seed.sql"), path.join(out, "db", "seed.sql"));
cpSync(path.join(root, "db", "profiles"), path.join(out, "db", "profiles"), { recursive: true });
copyFileSync(process.execPath, path.join(out, process.platform === "win32" ? "node.exe" : "node"));
console.log("desktop-bundle ready:", out);
