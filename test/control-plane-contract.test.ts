import fs from "node:fs/promises";
import path from "node:path";

import { describe, expect, it } from "vitest";

import { renderControlPlaneContractMarkdown } from "../src/core/control-plane-contract.js";
import { DOCS_LANGUAGES, TASK_STATUSES } from "../src/core/types.js";

describe("control-plane contract doc", () => {
  it("keeps the published public contract guide synced with the runtime-backed generator", async () => {
    const expected = renderControlPlaneContractMarkdown();
    const filePath = path.join(process.cwd(), "docs", "public", "control-plane-contract.md");
    const actual = await fs.readFile(filePath, "utf8");

    expect(actual).toBe(expected);
  });

  it("renders current runtime value domains into the published contract", () => {
    const markdown = renderControlPlaneContractMarkdown();

    for (const status of TASK_STATUSES) {
      expect(markdown).toContain(`\`${status}\``);
    }
    for (const docsLanguage of DOCS_LANGUAGES) {
      expect(markdown).toContain(`\`${docsLanguage}\``);
    }
  });
});
