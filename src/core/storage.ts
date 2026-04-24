import fs from "node:fs/promises";
import path from "node:path";
import { parse, stringify } from "yaml";

async function ensureParent(filePath: string) {
  await fs.mkdir(path.dirname(filePath), { recursive: true });
}

export async function readText(filePath: string): Promise<string> {
  return fs.readFile(filePath, "utf8");
}

export async function writeText(filePath: string, content: string): Promise<void> {
  await ensureParent(filePath);
  await fs.writeFile(filePath, content, "utf8");
}

export async function readYamlFile<T>(filePath: string): Promise<T> {
  const content = await readText(filePath);
  return parse(content) as T;
}

export async function writeYamlFile(filePath: string, value: unknown): Promise<void> {
  const content = stringify(value, {
    indent: 2,
    lineWidth: 0
  });

  await writeText(filePath, content);
}
