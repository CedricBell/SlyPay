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
      <div className="py-12 text-center text-sm text-zinc-500">
        Vérification des droits admin…
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-zinc-200 pb-4 dark:border-zinc-800">
        <div>
          <h1 className="text-xl font-semibold">Administration</h1>
          <p className="text-sm text-zinc-600 dark:text-zinc-400">
            Comptes utilisateurs
          </p>
        </div>
        <Link
          href="/dashboard"
          className="text-sm font-medium text-emerald-600 hover:underline"
        >
          ← Retour app
        </Link>
      </div>
      {children}
    </div>
  );
}
