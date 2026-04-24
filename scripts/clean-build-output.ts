import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const distRoot = path.join(root, "dist");

for (const entry of ["bin", "cli", "core", "site-runtime-prebuilt"]) {
  await fs.rm(path.join(distRoot, entry), {
    recursive: true,
    force: true,
    maxRetries: 10,
    retryDelay: 200
  });
}
