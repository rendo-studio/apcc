import { readText, writeText } from "./storage.js";

function escapeRegex(input: string): string {
  return input.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function normalizeBlock(body: string): string {
  return body.trimEnd() + "\n";
}

export async function replaceSectionContent(
  filePath: string,
  heading: string,
  body: string
): Promise<void> {
  const source = await readText(filePath);
  const lines = source.split(/\r?\n/);
  const headingLine = `## ${heading}`;
  const startIndex = lines.findIndex((line) => line.trim() === headingLine);

  if (startIndex === -1) {
    throw new Error(`Section "## ${heading}" not found in ${filePath}`);
  }

  let endIndex = lines.length;
  for (let index = startIndex + 1; index < lines.length; index += 1) {
    if (lines[index].startsWith("## ")) {
      endIndex = index;
      break;
    }
  }

  const replacement = [headingLine, "", ...normalizeBlock(body).trimEnd().split("\n"), ""];
  const updatedLines = [
    ...lines.slice(0, startIndex),
    ...replacement,
    ...lines.slice(endIndex)
  ];

  const nextContent = `${updatedLines.join("\n").trimEnd()}\n`;
  await writeText(filePath, nextContent);
}

export function renderBulletList(items: string[]): string {
  if (items.length === 0) {
    return "- 暂无";
  }

  return items.map((item) => `- ${item}`).join("\n");
}
