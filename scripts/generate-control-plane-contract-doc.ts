import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { renderControlPlaneContractMarkdown } from "../src/core/control-plane-contract.js";

function packageRoot(): string {
  return path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
}

async function main() {
  const root = packageRoot();
  const outputPath = path.join(root, "docs", "public", "control-plane-contract.md");
  const markdown = renderControlPlaneContractMarkdown();

  await fs.writeFile(outputPath, markdown, "utf8");

  process.stdout.write(
    `${JSON.stringify(
      {
        outputPath,
        bytes: Buffer.byteLength(markdown, "utf8")
      },
      null,
      2
    )}\n`
  );
}

await main();
