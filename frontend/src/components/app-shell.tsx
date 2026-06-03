"use client";

import type { ReactNode } from "react";
import { AppBackground } from "@/components/app-background";
import { NavBar } from "@/components/NavBar";
import { PageTransition } from "@/components/page-transition";
import { SessionTimeoutGuard } from "@/components/session-timeout-guard";

export function AppShell({ children }: { children: ReactNode }) {
  return (
    <>
      <AppBackground />
      <SessionTimeoutGuard />
      <div className="relative z-[1] flex min-h-dvh flex-col">
        <NavBar />
        <PageTransition>
          <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-8 pb-32 md:pb-10">
            {children}
          </main>
        </PageTransition>
      </div>
    </>
  );
}
