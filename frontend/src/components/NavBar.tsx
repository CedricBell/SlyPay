"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { motion } from "framer-motion";
import {
  CreditCard,
  Home,
  LogOut,
  Shield,
  User,
  type LucideIcon,
} from "lucide-react";
import { useEffect, useState } from "react";
import { apiFetch } from "@/lib/api";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type NavLink = {
  href: string;
  label: string;
  short: string;
  icon: LucideIcon;
  admin?: boolean;
};

const links: NavLink[] = [
  { href: "/dashboard", label: "Home", short: "Home", icon: Home },
  { href: "/cards", label: "My cards", short: "Cards", icon: CreditCard },
  { href: "/account", label: "Account", short: "Account", icon: User },
];

function isActive(pathname: string, href: string, admin?: boolean) {
  if (admin) return pathname.startsWith("/admin");
  return pathname === href || (href !== "/dashboard" && pathname.startsWith(href));
}

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
    try {
      await fetch("/api/v1/auth/logout", { method: "POST", credentials: "include" });
    } catch {
      /* continue local sign-out */
    }
    const supabase = createClient();
    await supabase.auth.signOut();
    setAuthed(false);
    setIsAdmin(false);
    router.refresh();
    router.push("/login");
  };

  const isAuthPage = pathname === "/login" || pathname === "/register";
  const navItems: NavLink[] = [
    ...links,
    ...(isAdmin
      ? [
          {
            href: "/admin/users",
            label: "Admin",
            short: "Admin",
            icon: Shield,
            admin: true,
          } satisfies NavLink,
        ]
      : []),
  ];

  return (
    <>
      <header className="sticky top-0 z-50 px-4 pt-3 md:pt-4">
        <div
          className={cn(
            "mx-auto flex max-w-5xl items-center justify-between gap-3 rounded-2xl border border-white/50 px-4 py-2.5",
            "bg-white/55 shadow-[0_4px_24px_-8px_rgba(15,23,42,0.12)] backdrop-blur-2xl backdrop-saturate-150",
            "dark:border-white/[0.08] dark:bg-[rgba(12,12,20,0.65)] dark:shadow-[0_8px_32px_-12px_rgba(0,0,0,0.5)]",
          )}
        >
          <Link
            href={authed ? "/dashboard" : "/"}
            aria-label="SlyPay home"
            className="group flex shrink-0 items-center gap-2.5"
          >
            <motion.div
              whileHover={{ scale: 1.05, rotate: -3 }}
              whileTap={{ scale: 0.96 }}
              transition={{ type: "spring", stiffness: 400, damping: 22 }}
            >
              <Image
                src="/assets/logoSeul.png"
                alt=""
                width={36}
                height={36}
                aria-hidden
                className="size-9 rounded-xl bg-white object-contain p-0.5 shadow-md ring-1 ring-black/5 dark:bg-zinc-900 dark:ring-white/10"
                priority
              />
            </motion.div>
            <span className="bg-gradient-to-r from-violet-600 via-blue-600 to-violet-600 bg-clip-text text-lg font-bold tracking-tight text-transparent dark:from-violet-300 dark:via-blue-300 dark:to-violet-300">
              SlyPay
            </span>
          </Link>

          {!isAuthPage && authed && (
            <nav className="hidden items-center gap-0.5 md:flex">
              {navItems.map((l) => {
                const active = isActive(pathname, l.href, l.admin);
                const Icon = l.icon;
                return (
                  <Link
                    key={l.href}
                    href={l.href}
                    className={cn(
                      "relative flex items-center gap-2 rounded-xl px-3.5 py-2 text-sm font-medium transition-colors",
                      active
                        ? "text-primary"
                        : "text-muted-foreground hover:text-foreground",
                      l.admin && !active && "text-amber-800/80 dark:text-amber-200/80",
                    )}
                  >
                    {active && (
                      <motion.span
                        layoutId="desktop-nav-pill"
                        className={cn(
                          "absolute inset-0 rounded-xl",
                          l.admin
                            ? "bg-amber-500/15 ring-1 ring-amber-500/25"
                            : "bg-primary/12 ring-1 ring-primary/20",
                        )}
                        transition={{
                          type: "spring",
                          stiffness: 380,
                          damping: 28,
                        }}
                      />
                    )}
                    <Icon className="relative size-4 shrink-0" strokeWidth={2.25} />
                    <span className="relative">{l.label}</span>
                  </Link>
                );
              })}
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => void logout()}
                className="ml-1 text-muted-foreground hover:text-foreground"
              >
                <LogOut className="size-4" />
                <span className="sr-only md:not-sr-only md:ml-1.5">Log out</span>
              </Button>
            </nav>
          )}
        </div>
      </header>

      {authed && !isAuthPage && (
        <nav
          className="fixed bottom-4 left-1/2 z-50 w-[calc(100%-1.5rem)] max-w-md -translate-x-1/2 md:hidden"
          aria-label="Primary"
        >
          <div
            className={cn(
              "flex items-stretch gap-0.5 rounded-2xl border border-white/60 p-1",
              "bg-white/70 shadow-[0_12px_40px_-12px_rgba(15,23,42,0.25)] backdrop-blur-2xl backdrop-saturate-150",
              "dark:border-white/[0.1] dark:bg-[rgba(12,12,20,0.82)] dark:shadow-[0_16px_48px_-12px_rgba(0,0,0,0.65)]",
            )}
          >
            {navItems.map((l) => {
              const active = isActive(pathname, l.href, l.admin);
              const Icon = l.icon;
              return (
                <Link
                  key={l.href}
                  href={l.href}
                  className={cn(
                    "relative flex min-h-14 flex-1 flex-col items-center justify-center gap-0.5 rounded-xl px-1 py-1.5 text-[10px] font-semibold transition-colors",
                    active
                      ? "text-primary"
                      : "text-muted-foreground",
                    l.admin && !active && "text-amber-800/90 dark:text-amber-200/90",
                  )}
                >
                  {active && (
                    <motion.span
                      layoutId="mobile-nav-pill"
                      className={cn(
                        "absolute inset-0 rounded-xl",
                        l.admin
                          ? "bg-amber-500/15"
                          : "bg-primary/12",
                      )}
                      transition={{
                        type: "spring",
                        stiffness: 380,
                        damping: 28,
                      }}
                    />
                  )}
                  <motion.span
                    className="relative flex flex-col items-center gap-0.5"
                    whileTap={{ scale: 0.92 }}
                  >
                    <Icon className="size-5" strokeWidth={active ? 2.5 : 2} />
                    <span>{l.short}</span>
                  </motion.span>
                </Link>
              );
            })}
            <button
              type="button"
              onClick={() => void logout()}
              className="relative flex min-h-14 flex-1 flex-col items-center justify-center gap-0.5 rounded-xl px-1 py-1.5 text-[10px] font-semibold text-muted-foreground"
            >
              <motion.span
                className="flex flex-col items-center gap-0.5"
                whileTap={{ scale: 0.92 }}
              >
                <LogOut className="size-5" />
                <span>Out</span>
              </motion.span>
            </button>
          </div>
        </nav>
      )}
    </>
  );
}
