import path from "node:path";
import { fileURLToPath } from "node:url";

import { build } from "@rendo-studio/aclip";

function packageRoot(): string {
  return path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
}

async function main() {
  const root = packageRoot();
  const outDir = path.join(root, "dist", "bin");

  await build("./src/cli/bundled-app.ts:createBundledApp", {
    projectRoot: root,
    outDir
  });
}

await main();
