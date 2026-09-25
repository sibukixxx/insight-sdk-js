// Verifies the published shape of the package from a clean consumer:
// npm pack → install the tarball into a temp project outside this repo →
// type-check and run imports of "@sibukixxx/insight-sdk" and
// "@sibukixxx/insight-sdk/analytical". Nothing is published.
//
//   npm run verify:pack
import { execFileSync } from "node:child_process";
import { mkdtempSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

const repo = resolve(new URL("..", import.meta.url).pathname);
const run = (cmd, args, cwd) => execFileSync(cmd, args, { cwd, stdio: ["ignore", "pipe", "inherit"], encoding: "utf8" });

const packed = JSON.parse(run("npm", ["pack", "--json", "--pack-destination", tmpdir()], repo))[0];
const tarball = join(tmpdir(), packed.filename);
const files = packed.files.map((f) => f.path);
for (const required of ["dist/index.js", "dist/index.d.ts", "dist/analytical.js", "dist/analytical.d.ts", "package.json", "README.md"]) {
  if (!files.includes(required)) throw new Error(`tarball is missing ${required}`);
}

const consumer = mkdtempSync(join(tmpdir(), "insight-sdk-consumer-"));
try {
  writeFileSync(join(consumer, "package.json"), JSON.stringify({ name: "consumer", private: true, type: "module" }));
  run("npm", ["install", "--silent", "--no-audit", "--no-fund", tarball, `typescript@${readTypeScript()}`, "@types/node@^22.18.0"], consumer);
  writeFileSync(join(consumer, "check.ts"), [
    'import { InsightClient, InsightError } from "@sibukixxx/insight-sdk";',
    'import { validateAnalyticalArtifact } from "@sibukixxx/insight-sdk/analytical";',
    'const c: InsightClient = new InsightClient({ baseUrl: "http://127.0.0.1:1" });',
    "void c; void InsightError; void validateAnalyticalArtifact;",
    "",
  ].join("\n"));
  writeFileSync(join(consumer, "tsconfig.json"), JSON.stringify({
    compilerOptions: { target: "ES2022", module: "NodeNext", moduleResolution: "NodeNext", strict: true, noEmit: true, skipLibCheck: false, types: ["node"] },
    files: ["check.ts"],
  }));
  run("npx", ["tsc", "-p", "tsconfig.json"], consumer);
  writeFileSync(join(consumer, "run.mjs"), [
    'const root = await import("@sibukixxx/insight-sdk");',
    'const analytical = await import("@sibukixxx/insight-sdk/analytical");',
    'if (typeof root.InsightClient !== "function") throw new Error("InsightClient export missing");',
    'if (typeof analytical.validateAnalyticalArtifact !== "function") throw new Error("analytical export missing");',
    'console.log("runtime imports ok:", Object.keys(root).length, "root exports,", Object.keys(analytical).length, "analytical exports");',
    "",
  ].join("\n"));
  process.stdout.write(run("node", ["run.mjs"], consumer));
  console.log(`verify:pack ok — ${packed.filename} (${packed.entryCount} files, ${packed.size} bytes) installs, type-checks and imports from a clean project`);
} finally {
  rmSync(consumer, { recursive: true, force: true });
  rmSync(tarball, { force: true });
}

function readTypeScript() {
  return JSON.parse(run("node", ["-p", "JSON.stringify(require('./package.json').devDependencies)"], repo)).typescript;
}
