import { existsSync, readFileSync } from "node:fs";
import { readdir, stat } from "node:fs/promises";
import path from "node:path";
import { gzipSync } from "node:zlib";

const root = process.cwd();
const nextDir = path.join(root, ".next");
const assetRoots = [
  { label: "client chunks", dir: path.join(nextDir, "static", "chunks") },
  { label: "client css", dir: path.join(nextDir, "static", "css") }
];
const extensions = new Set([".js", ".css"]);

if (!existsSync(nextDir)) {
  console.error(".next klasoru bulunamadi. Once `npm run build` calistirin.");
  process.exit(1);
}

const assets = [];

for (const assetRoot of assetRoots) {
  await collectAssets(assetRoot.dir, assetRoot.label);
}

if (assets.length === 0) {
  console.log("Analiz edilecek client asset bulunamadi.");
  process.exit(0);
}

assets.sort((a, b) => b.size - a.size);

const totalSize = assets.reduce((sum, asset) => sum + asset.size, 0);
const totalGzipSize = assets.reduce((sum, asset) => sum + asset.gzipSize, 0);

console.log("\nClient bundle ozeti");
console.log("-------------------");
console.log(`Toplam asset: ${assets.length}`);
console.log(`Toplam boyut: ${formatBytes(totalSize)}`);
console.log(`Toplam gzip:  ${formatBytes(totalGzipSize)}`);
console.log("\nEn buyuk 20 client asset");
console.log("------------------------");

for (const asset of assets.slice(0, 20)) {
  console.log(
    `${formatBytes(asset.size).padStart(10)}  ${formatBytes(asset.gzipSize).padStart(10)} gzip  ${asset.group.padEnd(
      13
    )}  ${asset.relativePath}`
  );
}

async function collectAssets(directory, group) {
  if (!existsSync(directory)) return;

  const entries = await readdir(directory, { withFileTypes: true });

  for (const entry of entries) {
    const fullPath = path.join(directory, entry.name);

    if (entry.isDirectory()) {
      await collectAssets(fullPath, group);
      continue;
    }

    if (!entry.isFile() || !extensions.has(path.extname(entry.name))) {
      continue;
    }

    const fileStat = await stat(fullPath);
    const content = readFileSync(fullPath);
    assets.push({
      group,
      relativePath: path.relative(root, fullPath),
      size: fileStat.size,
      gzipSize: gzipSync(content).length
    });
  }
}

function formatBytes(value) {
  if (value < 1024) return `${value} B`;
  const kib = value / 1024;
  if (kib < 1024) return `${kib.toFixed(1)} KB`;
  return `${(kib / 1024).toFixed(2)} MB`;
}
