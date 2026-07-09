import "dotenv/config";

import { existsSync } from "node:fs";
import { dirname, extname, isAbsolute, join, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { registerHooks } from "node:module";

const rootDir = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const sourceDir = join(rootDir, "src");
const extensions = [".ts", ".tsx", ".js", ".mjs", ".cjs"];

registerHooks({
  resolve(specifier, context, nextResolve) {
    if (specifier.startsWith("@/")) {
      const resolved = resolveCandidate(join(sourceDir, specifier.slice(2)));
      if (resolved) return { url: pathToFileURL(resolved).href, shortCircuit: true };
    }

    if ((specifier.startsWith("./") || specifier.startsWith("../")) && context.parentURL?.startsWith("file:")) {
      const resolved = resolveCandidate(resolve(dirname(fileURLToPath(context.parentURL)), specifier));
      if (resolved) return { url: pathToFileURL(resolved).href, shortCircuit: true };
    }

    if (isAbsolute(specifier)) {
      const resolved = resolveCandidate(specifier);
      if (resolved) return { url: pathToFileURL(resolved).href, shortCircuit: true };
    }

    return nextResolve(specifier, context);
  }
});

function resolveCandidate(basePath) {
  if (extname(basePath) && existsSync(basePath)) return basePath;

  for (const extension of extensions) {
    const candidate = `${basePath}${extension}`;
    if (existsSync(candidate)) return candidate;
  }

  for (const extension of extensions) {
    const candidate = join(basePath, `index${extension}`);
    if (existsSync(candidate)) return candidate;
  }

  return null;
}
