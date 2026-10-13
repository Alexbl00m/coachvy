import { existsSync } from "node:fs";
import { fileURLToPath, pathToFileURL } from "node:url";

const SRC = fileURLToPath(new URL("../../src/", import.meta.url));

export async function resolve(specifier, context, next) {
  if (specifier === "server-only") {
    return { url: "data:text/javascript,", shortCircuit: true };
  }
  const spec = specifier.startsWith("@/")
    ? SRC + specifier.slice(2)
    : specifier;
  const local = spec.startsWith("/") || spec.startsWith(".");
  if (local && !/\.(m?js|ts|json)$/.test(spec)) {
    const base = spec.startsWith(".")
      ? new URL(spec, context.parentURL)
      : pathToFileURL(spec);
    for (const ext of [".ts", ".tsx", "/index.ts"]) {
      const path = fileURLToPath(base) + ext;
      if (existsSync(path)) return next(pathToFileURL(path).href, context);
    }
  }
  return next(spec.startsWith("/") ? pathToFileURL(spec).href : spec, context);
}
