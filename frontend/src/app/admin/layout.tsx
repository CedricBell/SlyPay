"use client";

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
        <div>
          <h1 className="text-xl font-semibold tracking-tight">Administration</h1>
          <p className="text-sm text-zinc-600 dark:text-zinc-400">
            Comptes utilisateurs
          </p>
        </div>
        <Link
          href="/dashboard"
          className="rounded-xl border border-zinc-200/80 px-4 py-2 text-sm font-semibold text-emerald-700 transition hover:bg-emerald-500/10 dark:border-zinc-700 dark:text-emerald-400 dark:hover:bg-emerald-500/10"
        >
          ← Retour app
        </Link>
      </div>
      {children}
    </div>
  );
}
