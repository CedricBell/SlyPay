"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { apiFetch } from "@/lib/api";
import { createClient } from "@/lib/supabase/client";
import { useEffect, useState } from "react";

const links = [
  { href: "/dashboard", label: "Home", short: "Home" },
  { href: "/recommend", label: "Now", short: "Now" },
  { href: "/cards", label: "My cards", short: "My cards" },
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
      ? "border-violet-500/40 bg-violet-500/15 text-violet-950 shadow-sm dark:border-violet-500/30 dark:bg-violet-500/10 dark:text-violet-50"
      : "border-transparent text-zinc-600 hover:border-zinc-300/60 hover:bg-white/60 dark:text-zinc-300 dark:hover:border-zinc-600 dark:hover:bg-zinc-900/60";
  };

  return (
    <>
      <header className="pointer-events-auto sticky top-0 z-50 border-b border-zinc-200/60 bg-[var(--surface)]/85 backdrop-blur-xl dark:border-zinc-800/60">
        <div className="mx-auto flex max-w-5xl items-center justify-between gap-3 px-4 py-3">
          <Link
            href={authed ? "/dashboard" : "/"}
            aria-label="SlyPay home"
            className="pointer-events-auto group flex shrink-0 items-center gap-2.5"
          >
            <Image
              src="/assets/logoSeul.png"
              alt=""
              width={36}
              height={36}
              aria-hidden
              className="h-9 w-9 shrink-0 rounded-xl bg-white object-contain p-0.5 shadow-md ring-1 ring-zinc-200/80 transition group-hover:scale-[1.03] group-active:scale-[0.98] dark:bg-zinc-900 dark:ring-zinc-700/80"
              priority
            />
            <span className="bg-gradient-to-r from-violet-700 via-blue-600 to-violet-700 bg-clip-text text-lg font-semibold tracking-tight text-transparent dark:from-violet-300 dark:via-blue-300 dark:to-violet-300 sm:text-xl">
              SlyPay
            </span>
          </Link>

          {!isAuthPage && authed && (
            <nav className="pointer-events-auto hidden min-w-0 flex-1 items-center justify-end gap-1 md:flex">
              {links.map((l) => (
                <Link
                  key={l.href}
                  href={l.href}
                  className={`pointer-events-auto rounded-xl border px-3 py-2 text-sm font-medium transition ${navLinkClass(l.href)}`}
                >
                  {l.label}
                </Link>
              ))}
              {isAdmin && (
                <Link
                  href="/admin/users"
                  className={`pointer-events-auto rounded-xl border px-3 py-2 text-sm font-medium transition ${navLinkClass("/admin", { admin: true })}`}
                >
                  Admin
                </Link>
              )}
              <button
                type="button"
                onClick={() => void logout()}
                className="pointer-events-auto rounded-xl px-3 py-2 text-sm text-zinc-500 transition hover:bg-zinc-100 hover:text-zinc-900 dark:hover:bg-zinc-900 dark:hover:text-white"
              >
                Log out
              </button>
            </nav>
          )}
        </div>
      </header>

      {authed && !isAuthPage && (
        <nav
          className="pointer-events-auto fixed bottom-0 left-0 right-0 z-50 border-t border-zinc-200/70 bg-[var(--surface)]/95 px-2 pb-[max(0.5rem,env(safe-area-inset-bottom))] pt-2 backdrop-blur-xl dark:border-zinc-800/70 md:hidden"
          aria-label="Primary"
        >
          <div className="mx-auto flex max-w-lg items-stretch justify-between gap-1">
            {links.map((l) => (
              <Link
                key={l.href}
                href={l.href}
                className={`pointer-events-auto flex min-h-[3rem] min-w-0 flex-1 flex-col items-center justify-center rounded-2xl border px-0.5 text-center text-[11px] font-semibold leading-tight transition active:scale-[0.97] sm:text-xs ${navLinkClass(l.href)}`}
              >
                {l.short}
              </Link>
            ))}
            {isAdmin && (
              <Link
                href="/admin/users"
                className={`pointer-events-auto flex min-h-[3rem] flex-1 flex-col items-center justify-center rounded-2xl border text-xs font-semibold transition active:scale-[0.97] ${navLinkClass("/admin", { admin: true })}`}
              >
                Admin
              </Link>
            )}
            <button
              type="button"
              onClick={() => void logout()}
              className="pointer-events-auto flex min-h-[3rem] flex-1 flex-col items-center justify-center rounded-2xl border border-transparent text-xs font-semibold text-zinc-500 transition hover:bg-zinc-100 dark:hover:bg-zinc-900"
            >
              Out
            </button>
          </div>
        </nav>
      )}
    </>
  );
}
