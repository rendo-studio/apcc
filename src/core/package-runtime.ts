import path from "node:path";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

function resolveCurrentModulePath(): string {
  if (typeof __filename === "string" && __filename.length > 0) {
    return __filename;
  }

  const metaUrl = import.meta.url;
  if (typeof metaUrl === "string" && metaUrl.startsWith("file:")) {
    return fileURLToPath(metaUrl);
  }

  if (process.argv[1]) {
    return path.resolve(process.argv[1]);
  }

  return path.resolve(".");
}

export function getApccPackageRoot(): string {
  return path.resolve(path.dirname(resolveCurrentModulePath()), "../..");
}

export function getApccPackageFile(...segments: string[]): string {
  return path.join(getApccPackageRoot(), ...segments);
}

export function getCurrentModulePath(): string {
  return resolveCurrentModulePath();
}

let cachedPackageVersion: string | null = null;

export function getApccPackageVersion(): string {
  if (cachedPackageVersion) {
    return cachedPackageVersion;
  }

  const packageJson = JSON.parse(readFileSync(getApccPackageFile("package.json"), "utf8")) as {
    version?: string;
  };
  cachedPackageVersion = packageJson.version ?? "0.1.0";
  return cachedPackageVersion;
}
