"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { apiFetch } from "@/lib/api";
import { createClient } from "@/lib/supabase/client";
import { useEffect, useState } from "react";

const links = [
  { href: "/dashboard", label: "Home", short: "Home" },
  { href: "/recommend", label: "Now", short: "Now" },
  { href: "/cards", label: "Cards", short: "Cards" },
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

  const navLinkClass = (href: string, opts?: { admin?: boolean }) => {
    const active = opts?.admin
      ? pathname.startsWith("/admin")
      : pathname === href;
    if (opts?.admin) {
      return active
        ? "border-amber-400/50 bg-amber-500/15 text-amber-950 dark:text-amber-50"
        : "border-transparent text-amber-900/90 hover:border-amber-400/30 hover:bg-amber-500/10 dark:text-amber-200/90";
    }
    return active
      ? "border-emerald-500/40 bg-emerald-500/15 text-emerald-950 shadow-sm dark:border-emerald-500/30 dark:bg-emerald-500/10 dark:text-emerald-50"
      : "border-transparent text-zinc-600 hover:border-zinc-300/60 hover:bg-white/60 dark:text-zinc-300 dark:hover:border-zinc-600 dark:hover:bg-zinc-900/60";
  };

  return (
    <>
      <header className="sticky top-0 z-40 border-b border-zinc-200/60 bg-[var(--surface)]/85 backdrop-blur-xl dark:border-zinc-800/60">
        <div className="mx-auto flex max-w-5xl items-center justify-between gap-3 px-4 py-3">
          <Link
            href={authed ? "/dashboard" : "/"}
            className="group flex items-center gap-2 font-semibold tracking-tight"
          >
            <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-gradient-to-br from-emerald-500 to-teal-600 text-sm font-bold text-white shadow-md transition group-hover:scale-[1.03] group-active:scale-[0.98]">
              S
            </span>
            <span className="hidden sm:inline">SlyPay</span>
          </Link>
          {!isAuthPage && (
            <nav className="hidden flex-1 items-center justify-end gap-1 md:flex">
              {authed &&
                links.map((l) => (
                  <Link
                    key={l.href}
                    href={l.href}
                    className={`rounded-xl border px-3 py-2 text-sm font-medium transition ${navLinkClass(l.href)}`}
                  >
                    {l.label}
                  </Link>
                ))}
              {authed && isAdmin && (
                <Link
                  href="/admin/users"
                  className={`rounded-xl border px-3 py-2 text-sm font-medium transition ${navLinkClass("/admin", { admin: true })}`}
                >
                  Admin
                </Link>
              )}
              {authed ? (
                <button
                  type="button"
                  onClick={() => void logout()}
                  className="rounded-xl px-3 py-2 text-sm text-zinc-500 transition hover:bg-zinc-100 hover:text-zinc-900 dark:hover:bg-zinc-900 dark:hover:text-white"
                >
                  Log out
                </button>
              ) : (
                <Link
                  href="/login"
                  className="rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 px-4 py-2 text-sm font-semibold text-white shadow-md transition hover:brightness-110 active:scale-[0.98]"
                >
                  Sign in
                </Link>
              )}
            </nav>
          )}
          {!isAuthPage && !authed && (
            <Link
              href="/login"
              className="rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 px-4 py-2 text-sm font-semibold text-white shadow-md transition hover:brightness-110 active:scale-[0.98] md:hidden"
            >
              Sign in
            </Link>
          )}
        </div>
      </header>

      {authed && !isAuthPage && (
        <nav
          className="fixed bottom-0 left-0 right-0 z-40 border-t border-zinc-200/70 bg-[var(--surface)]/95 px-2 pb-[max(0.5rem,env(safe-area-inset-bottom))] pt-2 backdrop-blur-xl dark:border-zinc-800/70 md:hidden"
          aria-label="Primary"
        >
          <div className="mx-auto flex max-w-lg items-stretch justify-between gap-1">
            {links.map((l) => (
              <Link
                key={l.href}
                href={l.href}
                className={`flex min-h-[3rem] flex-1 flex-col items-center justify-center rounded-2xl border text-xs font-semibold transition active:scale-[0.97] ${navLinkClass(l.href)}`}
              >
                {l.short}
              </Link>
            ))}
            {isAdmin && (
              <Link
                href="/admin/users"
                className={`flex min-h-[3rem] flex-1 flex-col items-center justify-center rounded-2xl border text-xs font-semibold transition active:scale-[0.97] ${navLinkClass("/admin", { admin: true })}`}
              >
                Admin
              </Link>
            )}
            <button
              type="button"
              onClick={() => void logout()}
              className="flex min-h-[3rem] flex-1 flex-col items-center justify-center rounded-2xl border border-transparent text-xs font-semibold text-zinc-500 transition hover:bg-zinc-100 dark:hover:bg-zinc-900"
            >
              Out
            </button>
          </div>
        </nav>
      )}
    </>
  );
}
