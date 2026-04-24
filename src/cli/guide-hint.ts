export const GUIDE_HINT = "Run `apcc guide workflow` for the canonical Agent-first APCC Workflow Guide.";

export function withGuideHint(description: string): string {
  return `${description.trim()} ${GUIDE_HINT}`;
}
