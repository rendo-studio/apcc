import { buildPrebuiltSiteShellArtifact } from "../src/core/site.js";

const artifactRoot = await buildPrebuiltSiteShellArtifact();

console.log(
  JSON.stringify(
    {
      artifactRoot
    },
    null,
    2
  )
);
