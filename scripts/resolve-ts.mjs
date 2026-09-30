import { existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

export async function resolve(specifier, context, nextResolve) {
  const isRelative = specifier.startsWith(".");
  const hasExtension = /\.(ts|js|json|mjs|cjs)$/.test(specifier);
  if (isRelative && !hasExtension && context.parentURL) {
    const parent = dirname(fileURLToPath(context.parentURL));
    const candidate = join(parent, `${specifier}.ts`);
    if (existsSync(candidate)) {
      return nextResolve(pathToFileURL(candidate).href, context);
    }
  }
  return nextResolve(specifier, context);
}
