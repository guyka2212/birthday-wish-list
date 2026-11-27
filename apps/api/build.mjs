// Builds a self-contained Vercel project in ./deploy:
//   deploy/api/index.mjs  – the bundled function (workspace code like @bwl/shared inlined)
//   deploy/package.json   – only the runtime deps esbuild leaves external (Vercel installs Linux binaries)
//   deploy/vercel.json    – routes every path to the function
// Deploy with:  npx vercel deploy --prod --cwd <a copy of apps/api/deploy outside the git repo>
// (from inside the repo Vercel attaches git metadata and may refuse commits by non-team authors).
import { build } from "esbuild";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";

const external = ["@node-rs/argon2", "@libsql/client"];
const pkg = JSON.parse(readFileSync("package.json", "utf8"));

mkdirSync("deploy/api", { recursive: true });
await build({
  entryPoints: ["src/vercel.ts"],
  outfile: "deploy/api/index.mjs",
  bundle: true,
  platform: "node",
  format: "esm",
  target: "node22",
  external,
  banner: { js: "import { createRequire } from 'module'; const require = createRequire(import.meta.url);" },
  logLevel: "info",
});

writeFileSync(
  "deploy/package.json",
  JSON.stringify(
    {
      name: "birthday-wish-list-api",
      private: true,
      type: "module",
      engines: { node: "22.x" },
      dependencies: Object.fromEntries(external.map((d) => [d, pkg.dependencies[d]])),
    },
    null,
    2,
  ) + "\n",
);

writeFileSync(
  "deploy/vercel.json",
  JSON.stringify(
    {
      $schema: "https://openapi.vercel.sh/vercel.json",
      framework: null,
      buildCommand: "",
      functions: { "api/index.mjs": { maxDuration: 15, memory: 1024 } },
      rewrites: [{ source: "/(.*)", destination: "/api/index.mjs" }],
    },
    null,
    2,
  ) + "\n",
);
writeFileSync("deploy/.vercelignore", ".env*\n.vercel\n");
console.log("deploy/ ready (deploy a copy outside the repo — see the note at the top)");
