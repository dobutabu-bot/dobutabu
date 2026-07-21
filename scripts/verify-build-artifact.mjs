import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative } from "node:path";

const buildRoot = ".next";
const requiredFiles = [
  ".next/BUILD_ID",
  ".next/routes-manifest.json",
  ".next/server/app-paths-manifest.json"
];
const requiredRoutes = [
  "/api/health/route",
  "/api/reports/monthly/pdf/route",
  "/login/page",
  "/(app)/dashboard/page"
];

const failures = [];

for (const file of requiredFiles) {
  if (!existsSync(file) || statSync(file).size === 0) failures.push(`Eksik veya bos: ${file}`);
}

if (existsSync(".next/server/app-paths-manifest.json")) {
  const manifest = JSON.parse(readFileSync(".next/server/app-paths-manifest.json", "utf8"));
  for (const route of requiredRoutes) {
    if (!Object.hasOwn(manifest, route)) failures.push(`Build route eksik: ${route}`);
  }
}

const files = existsSync(buildRoot) ? walk(buildRoot) : [];
const javascriptCount = files.filter((file) => file.endsWith(".js") && statSync(file).size > 0).length;
const cssCount = files.filter((file) => file.endsWith(".css") && statSync(file).size > 0).length;

if (javascriptCount === 0) failures.push("Build artifact icinde JavaScript chunk bulunamadi.");
if (cssCount === 0) failures.push("Build artifact icinde CSS chunk bulunamadi.");

for (const file of files) {
  const normalized = relative(buildRoot, file).replaceAll("\\", "/");
  const baseName = normalized.split("/").at(-1) ?? normalized;
  if (
    baseName === ".env" ||
    baseName.startsWith(".env.") ||
    /\.(db|sqlite|sqlite3|db-wal|db-shm|db-journal)$/i.test(baseName)
  ) {
    failures.push(`Build artifact private dosya iceriyor: ${normalized}`);
  }
}

if (failures.length > 0) {
  console.error("FAIL: Production build artifact dogrulanamadi.");
  failures.forEach((failure) => console.error(`- ${failure}`));
  process.exit(1);
}

console.log(
  `PASS: Build artifact dogrulandi (${javascriptCount} JS, ${cssCount} CSS, ${requiredRoutes.length} kritik route).`
);

function walk(directory) {
  const result = [];
  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    const absolute = join(directory, entry.name);
    if (entry.isDirectory()) result.push(...walk(absolute));
    else if (entry.isFile()) result.push(absolute);
  }
  return result;
}
