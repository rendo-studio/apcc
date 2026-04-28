import type { AclipApp, RunIo } from "@rendo-studio/aclip";

import { renderCapturedOutput, stripGlobalJsonFlag } from "./output-renderer.js";

function defaultIo(): RunIo {
  return {
    stdout: (text) => process.stdout.write(text),
    stderr: (text) => process.stderr.write(text)
  };
}

export async function runAppWithRenderedIo(
  run: (argv: string[], io: RunIo) => Promise<number>,
  argv: string[] = process.argv.slice(2),
  io: RunIo = defaultIo()
): Promise<number> {
  const { argv: nextArgv, json } = stripGlobalJsonFlag(argv);
  const stdoutChunks: string[] = [];
  const stderrChunks: string[] = [];

  const exitCode = await run(nextArgv, {
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
      io.stdout(stdout);
    }
    if (stderr) {
      io.stderr(stderr);
    }
    return exitCode;
  }

  const renderedStdout = renderCapturedOutput(stdout, "stdout");
  const renderedStderr = renderCapturedOutput(stderr, "stderr");

  if (renderedStdout) {
    io.stdout(renderedStdout);
  }
  if (renderedStderr) {
    io.stderr(renderedStderr);
  }

  return exitCode;
}

export async function runRenderedApp(
  app: AclipApp,
  argv: string[] = process.argv.slice(2),
  io: RunIo = defaultIo()
): Promise<number> {
  return runAppWithRenderedIo(app.run.bind(app), argv, io);
}
