"use client";

import type { ReactNode } from "react";

/** No route animation — avoids remount lag between tabs. */
export function PageTransition({ children }: { children: ReactNode }) {
  return <>{children}</>;
}
