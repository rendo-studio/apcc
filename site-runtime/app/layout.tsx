import type { ReactNode } from "react";

import { SiteClientShell } from "../components/site/site-provider";
import "./global.css";

export default function Layout({ children }: { children: ReactNode }) {
  return (
    <html suppressHydrationWarning>
      <body>
        <SiteClientShell>{children}</SiteClientShell>
      </body>
    </html>
  );
}
