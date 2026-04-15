"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { apiFetch } from "@/lib/api";
import { createClient } from "@/lib/supabase/client";
import { useEffect, useState } from "react";

const links = [
  { href: "/dashboard", label: "Dashboard" },
  { href: "/recommend", label: "Recommend" },
  { href: "/cards", label: "Cards" },
];

export function NavBar() {
  const pathname = usePathname();
  const router = useRouter();
  const [authed, setAuthed] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);

  useEffect(() => {
    let cancelled = false;
    apiFetch<{ role: string }>("/auth/me")
      .then((m) => {
        if (!cancelled) {
          setAuthed(true);
          setIsAdmin(m.role === "ADMIN");
        }
      })
      .catch(() => {
        if (!cancelled) {
          setAuthed(false);
          setIsAdmin(false);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [pathname]);

  const logout = async () => {
    const supabase = createClient();
    await supabase.auth.signOut();
    setAuthed(false);
    setIsAdmin(false);
    router.refresh();
    router.push("/login");
  };

  const isAuthPage = pathname === "/login" || pathname === "/register";

  return (
    <header className="border-b border-zinc-200 bg-white/80 backdrop-blur dark:border-zinc-800 dark:bg-zinc-950/80">
      <div className="mx-auto flex max-w-5xl items-center justify-between gap-4 px-4 py-3">
        <Link href={authed ? "/dashboard" : "/"} className="font-semibold tracking-tight">
          SpendLess
        </Link>
        {!isAuthPage && (
          <nav className="flex flex-1 items-center justify-end gap-1 sm:gap-3">
            {authed &&
              links.map((l) => (
                <Link
                  key={l.href}
                  href={l.href}
                  className={`rounded-md px-2 py-1 text-sm sm:px-3 ${
                    pathname === l.href
                      ? "bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900"
                      : "text-zinc-600 hover:bg-zinc-100 dark:text-zinc-300 dark:hover:bg-zinc-900"
                  }`}
                >
                  {l.label}
                </Link>
              ))}
            {authed && isAdmin && (
              <Link
                href="/admin/users"
                className={`rounded-md px-2 py-1 text-sm sm:px-3 ${
                  pathname.startsWith("/admin")
                    ? "bg-amber-100 text-amber-950 dark:bg-amber-900/40 dark:text-amber-100"
                    : "text-amber-800 hover:bg-amber-50 dark:text-amber-200 dark:hover:bg-amber-950/30"
                }`}
              >
                Admin
              </Link>
            )}
            {authed ? (
              <button
                type="button"
                onClick={() => void logout()}
                className="rounded-md px-2 py-1 text-sm text-zinc-500 hover:text-zinc-900 dark:hover:text-white sm:px-3"
              >
                Log out
              </button>
            ) : (
              <Link
                href="/login"
                className="rounded-md bg-emerald-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-emerald-700"
              >
                Sign in
              </Link>
            )}
          </nav>
        )}
      </div>
    </header>
  );
}
