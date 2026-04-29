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

export class YamlFileParseError extends Error {
  readonly filePath: string;
  readonly parseMessage: string;

  constructor(filePath: string, parseMessage: string) {
    super(`Failed to parse YAML file ${filePath}: ${parseMessage}`);
    this.name = "YamlFileParseError";
    this.filePath = filePath;
    this.parseMessage = parseMessage;
  }
}

export function isYamlFileParseError(error: unknown): error is YamlFileParseError {
  return error instanceof YamlFileParseError;
}

export function isFileNotFoundError(error: unknown): error is NodeJS.ErrnoException {
  return error instanceof Error && "code" in error && error.code === "ENOENT";
}

export async function readYamlFile<T>(filePath: string): Promise<T> {
  const content = await readText(filePath);
  try {
    return parse(content) as T;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new YamlFileParseError(filePath, message);
  }
}

export async function writeYamlFile(filePath: string, value: unknown): Promise<void> {
  const content = stringify(value, {
    indent: 2,
    lineWidth: 0
  });

  await writeText(filePath, content);
}