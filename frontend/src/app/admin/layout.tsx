"use client";

import Image from "next/image";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { apiFetch, ApiError } from "@/lib/api";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { FadeIn } from "@/components/motion";
import { Button, buttonVariants } from "@/components/ui/button";
import { SurfaceCard } from "@/components/ui/surface-card";
import { cn } from "@/lib/utils";

const adminLinks = [
  { href: "/admin/users", label: "Utilisateurs" },
  { href: "/admin/credit-cards", label: "Catalogue cartes" },
  { href: "/admin/card-catalog", label: "Intel catalogue" },
];

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const router = useRouter();
  const pathname = usePathname();
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
      <FadeIn className="py-16 text-center text-sm text-muted-foreground">
        Vérification des droits admin…
      </FadeIn>
    );
  }

  return (
    <FadeIn className="space-y-8">
      <SurfaceCard className="flex flex-wrap items-center justify-between gap-4 px-5 py-4">
        <div className="flex min-w-0 flex-1 flex-wrap items-start gap-4">
          <Image
            src="/assets/LogoComplet.png"
            alt=""
            width={140}
            height={36}
            className="h-8 w-auto shrink-0 object-contain opacity-90"
            aria-hidden
          />
          <div className="min-w-0 space-y-2">
            <h1 className="text-xl font-semibold tracking-tight">
              Administration
            </h1>
            <nav className="flex flex-wrap gap-2">
              {adminLinks.map((l) => (
                <Link
                  key={l.href}
                  href={l.href}
                  className={cn(
                    buttonVariants({
                      variant: pathname.startsWith(l.href) ? "default" : "outline",
                      size: "sm",
                    }),
                  )}
                >
                  {l.label}
                </Link>
              ))}
            </nav>
          </div>
        </div>
        <Button variant="outline" asChild>
          <Link href="/dashboard">← Retour app</Link>
        </Button>
      </SurfaceCard>
      {children}
    </FadeIn>
  );
}
