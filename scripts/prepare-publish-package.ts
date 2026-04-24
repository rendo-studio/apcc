import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

interface Options {
  outputPath: string;
  packageName?: string;
}

function packageRoot(): string {
  return path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
}

function parseArgs(argv: string[]): Options {
  let outputPath: string | null = null;
  let packageName: string | undefined;

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--out") {
      outputPath = argv[index + 1] ?? null;
      index += 1;
      continue;
    }
    if (arg === "--name") {
      packageName = argv[index + 1] ?? undefined;
      index += 1;
      continue;
    }
    throw new Error(`Unknown argument: ${arg}`);
  }

  if (!outputPath) {
    throw new Error("Missing required --out <path>.");
  }

  return {
    outputPath,
    packageName
  };
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  const root = packageRoot();
  const outputRoot = path.resolve(process.cwd(), options.outputPath);
  const packageJsonPath = path.join(root, "package.json");
  const npmReadmePath = path.join(root, "assets", "npm-readme.md");

  const packageJson = JSON.parse(await fs.readFile(packageJsonPath, "utf8")) as Record<string, unknown>;
  if (options.packageName) {
    packageJson.name = options.packageName;
  }

  await fs.rm(outputRoot, { recursive: true, force: true, maxRetries: 5, retryDelay: 200 });
  await fs.mkdir(outputRoot, { recursive: true });

  await Promise.all([
    fs.copyFile(path.join(root, "LICENSE"), path.join(outputRoot, "LICENSE")),
    fs.copyFile(npmReadmePath, path.join(outputRoot, "README.md")),
    fs.writeFile(path.join(outputRoot, "package.json"), `${JSON.stringify(packageJson, null, 2)}\n`, "utf8"),
    fs.cp(path.join(root, "dist"), path.join(outputRoot, "dist"), { recursive: true, force: true }),
    fs.cp(path.join(root, "assets"), path.join(outputRoot, "assets"), { recursive: true, force: true }),
    fs.cp(path.join(root, "docs", "public"), path.join(outputRoot, "docs", "public"), { recursive: true, force: true })
  ]);

  process.stdout.write(
    `${JSON.stringify(
      {
        outputRoot,
        packageName: packageJson.name
      },
      null,
      2
    )}\n`
  );
}

await main();
