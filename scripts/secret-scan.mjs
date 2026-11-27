#!/usr/bin/env node
// Pre-commit secret scan. Blocks committing .env files and obvious tokens.
// Run manually with `npm run secret-scan` (scans staged files) or `--all` (scans tracked files).
import { execSync } from "node:child_process";
import { readFileSync, existsSync } from "node:fs";

const all = process.argv.includes("--all");
const list = execSync(all ? "git ls-files" : "git diff --cached --name-only --diff-filter=ACMR", {
  encoding: "utf8",
})
  .split("\n")
  .map((s) => s.trim())
  .filter(Boolean);

const forbiddenFile = /(^|\/)(\.env(\..+)?|\.dev\.vars|.*\.env|.*\.pem|.*\.jks|.*\.keystore)$/i;
const allowedFile = /(^|\/)\.env\.example$/i;

const patterns = [
  { name: "JWT / Turso token", re: /eyJ[A-Za-z0-9_-]{10,}\.eyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}/ },
  { name: "libsql URL with token", re: /libsql:\/\/[^\s"']+\?authToken=/ },
  { name: "Shop live API key", re: /\bbwl_live_[A-Za-z0-9]{20,}/ },
  { name: "Resend key", re: /\bre_[A-Za-z0-9]{20,}/ },
  { name: "Vercel token", re: /\bvercel_[A-Za-z0-9]{20,}/i },
  { name: "GitHub token", re: /\bgh[pousr]_[A-Za-z0-9]{30,}/ },
  { name: "Private key", re: /-----BEGIN (RSA |EC |OPENSSH )?PRIVATE KEY-----/ },
];

const problems = [];
for (const file of list) {
  if (forbiddenFile.test(file) && !allowedFile.test(file)) {
    problems.push(`${file}: secret file type must not be committed`);
    continue;
  }
  if (!existsSync(file)) continue;
  let text;
  try {
    const buf = readFileSync(file);
    if (buf.includes(0)) continue; // binary
    text = buf.toString("utf8");
  } catch {
    continue;
  }
  for (const { name, re } of patterns) {
    if (re.test(text)) problems.push(`${file}: looks like it contains a ${name}`);
  }
}

if (problems.length) {
  console.error("\n✖ Secret scan failed:\n  " + problems.join("\n  "));
  console.error("\nRemove the secret (keep it in a gitignored .env) and try again.\n");
  process.exit(1);
}
console.log(`✓ Secret scan passed (${list.length} file${list.length === 1 ? "" : "s"})`);
