import { cp, readdir } from "node:fs/promises";
import path from "node:path";

const nextAppOutputDirs = [
  path.join(process.cwd(), ".next/static/chunks/app"),
  path.join(process.cwd(), ".next/server/app")
];
const duplicateSuffixPattern = / \d+$/;

let fixedCount = 0;

async function main() {
  for (const directory of nextAppOutputDirs) {
    await normalizeDuplicateChunkDirs(directory);
  }

  if (fixedCount > 0) {
    console.log(`Normalized ${fixedCount} Next app output director${fixedCount === 1 ? "y" : "ies"}.`);
  }
}

async function normalizeDuplicateChunkDirs(directory) {
  let entries;

  try {
    entries = await readdir(directory, { withFileTypes: true });
  } catch {
    return;
  }

  for (const entry of entries) {
    if (!entry.isDirectory()) {
      continue;
    }

    const sourcePath = path.join(directory, entry.name);

    if (duplicateSuffixPattern.test(entry.name)) {
      const targetPath = path.join(directory, entry.name.replace(duplicateSuffixPattern, ""));
      await cp(sourcePath, targetPath, { recursive: true, force: true });
      fixedCount += 1;
      continue;
    }

    await normalizeDuplicateChunkDirs(sourcePath);
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
