#!/usr/bin/env node

import { app } from "../cli/app.js";
import { runRenderedApp } from "../cli/runtime-runner.js";

async function main() {
  process.exitCode = await runRenderedApp(app);
}

void main();
