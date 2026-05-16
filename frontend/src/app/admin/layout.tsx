"use client";

import Image from "next/image";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { apiFetch, ApiError } from "@/lib/api";
import Link from "next/link";

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const router = useRouter();
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const me = await apiFetch<{ role: string }>("/auth/me");
        if (cancelled) return;
        if (me.role !== "ADMIN") {
          router.replace("/dashboard");
          return;
        }
        setReady(true);
      } catch (e) {
        if (cancelled) return;
        if (e instanceof ApiError && e.status === 401) {
          router.replace("/login");
          return;
        }
        router.replace("/dashboard");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [router]);

  if (!ready) {
    return (
      <div className="motion-enter py-16 text-center text-sm text-zinc-500">
        Vérification des droits admin…
      </div>
    );
  }

  return (
    <div className="motion-enter space-y-8">
      <div className="flex flex-wrap items-center justify-between gap-4 rounded-3xl border border-zinc-200/70 bg-[var(--surface)] px-5 py-4 shadow-sm backdrop-blur-xl dark:border-zinc-800/80">
        <div className="flex min-w-0 flex-1 flex-wrap items-start gap-4">
          <Image
            src="/assets/LogoComplet.png"
            alt=""
            width={140}
            height={36}
            className="h-8 w-auto shrink-0 object-contain opacity-90 dark:opacity-95"
            aria-hidden
          />
          <div className="min-w-0 space-y-2">
            <h1 className="text-xl font-semibold tracking-tight">Administration</h1>
          <nav className="flex flex-wrap gap-2 text-sm">
            <Link
              href="/admin/users"
              className="rounded-lg border border-zinc-200 px-3 py-1 font-medium text-zinc-800 hover:bg-zinc-50 dark:border-zinc-700 dark:text-zinc-200 dark:hover:bg-zinc-900"
            >
              Utilisateurs
            </Link>
            <Link
              href="/admin/credit-cards"
              className="rounded-lg border border-zinc-200 px-3 py-1 font-medium text-zinc-800 hover:bg-zinc-50 dark:border-zinc-700 dark:text-zinc-200 dark:hover:bg-zinc-900"
            >
              Cartes (toutes)
            </Link>
            <Link
              href="/admin/card-catalog"
              className="rounded-lg border border-zinc-200 px-3 py-1 font-medium text-zinc-800 hover:bg-zinc-50 dark:border-zinc-700 dark:text-zinc-200 dark:hover:bg-zinc-900"
            >
              Intel catalogue
            </Link>
          </nav>
          </div>
        </div>
        <Link
          href="/dashboard"
          className="rounded-xl border border-zinc-200/80 px-4 py-2 text-sm font-semibold text-violet-700 transition hover:bg-violet-500/10 dark:border-zinc-700 dark:text-violet-400 dark:hover:bg-violet-500/10"
        >
          ← Retour app
        </Link>
      </div>
      {children}
    </div>
  );
}
