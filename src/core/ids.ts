const CONTROL_PLANE_ID_PATTERN = /^[a-z0-9](?:[a-z0-9-]{0,94}[a-z0-9])?$/;

export function assertControlPlaneId(id: string, label: string): void {
  if (id === "root") {
    throw new Error(`${label} id "root" is reserved.`);
  }

  if (!CONTROL_PLANE_ID_PATTERN.test(id)) {
    throw new Error(
      `${label} id "${id}" must use lowercase letters, numbers, and hyphens, and must start and end with a letter or number.`
    );
  }
}
