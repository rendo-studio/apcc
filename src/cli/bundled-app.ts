import type { AclipApp, RunIo } from "@rendo-studio/aclip";

import { createApp } from "./app.js";
import { runAppWithRenderedIo } from "./runtime-runner.js";

function wrapBundledRun(app: AclipApp): AclipApp {
  const originalRun = app.run.bind(app);

  app.run = (argv: string[] = process.argv.slice(2), io?: RunIo) => {
    return runAppWithRenderedIo(originalRun, argv, io);
  };

  return app;
}

export function createBundledApp(): AclipApp {
  return wrapBundledRun(createApp());
}
