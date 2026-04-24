#!/usr/bin/env node

import { app } from "../cli/app.js";
import { renderCapturedOutput, stripGlobalJsonFlag } from "../cli/output-renderer.js";

async function main() {
  const { argv, json } = stripGlobalJsonFlag(process.argv.slice(2));
  const stdoutChunks: string[] = [];
  const stderrChunks: string[] = [];

  const exitCode = await app.run(argv, {
    stdout: (text) => {
      stdoutChunks.push(text);
    },
    stderr: (text) => {
      stderrChunks.push(text);
    }
  });

  const stdout = stdoutChunks.join("");
  const stderr = stderrChunks.join("");

  if (json) {
    if (stdout) {
      process.stdout.write(stdout);
    }
    if (stderr) {
      process.stderr.write(stderr);
    }
    process.exitCode = exitCode;
    return;
  }

  const renderedStdout = renderCapturedOutput(stdout, "stdout");
  const renderedStderr = renderCapturedOutput(stderr, "stderr");

  if (renderedStdout) {
    process.stdout.write(renderedStdout);
  }
  if (renderedStderr) {
    process.stderr.write(renderedStderr);
  }

  process.exitCode = exitCode;
}

void main();
