"use client";

import Image from "next/image";
import { useSearchParams } from "next/navigation";
import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { readAuthApiError } from "@/lib/api";
import {
  sessionExpiryMessage,
  type SessionExpiryReason,
} from "@/lib/session-timeout";
import { FadeIn } from "@/components/motion";
import { PageHeader } from "@/components/page-header";
import { StatusMessage } from "@/components/status-message";
import { Button } from "@/components/ui/button";
import { Field, inputClassName } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { SurfaceCard } from "@/components/ui/surface-card";

const LOGIN_QUERY_ERRORS: Record<string, string> = {
  auth_callback:
    "Sign-in with the provider could not be completed. Try again or use email and password.",
};

function loginMessageFromAuthApi(body: {
  message: string;
  reason?: string;
  code?: string;
}): string {
  if (
    body.reason === "idle" ||
    body.reason === "max_age" ||
    body.reason === "missing"
  ) {
    return sessionExpiryMessage(body.reason);
  }
  if (body.code === "inactive") {
    return body.message;
  }
  return body.message;
}

export function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const sessionReason = searchParams.get("reason");
  const queryError = searchParams.get("error");
  const queryErrorMessage = queryError
    ? (LOGIN_QUERY_ERRORS[queryError] ?? `Sign-in error (${queryError})`)
    : null;
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErr(null);
    setLoading(true);
    try {
      const loginRes = await fetch("/api/v1/auth/login", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.trim(), password }),
      });

      if (!loginRes.ok) {
        const apiErr = await readAuthApiError(loginRes);
        setErr(loginMessageFromAuthApi(apiErr));
        return;
      }

      router.refresh();

      const meRes = await fetch("/api/v1/auth/me", { credentials: "include" });
      if (!meRes.ok) {
        const apiErr = await readAuthApiError(meRes);
        setErr(loginMessageFromAuthApi(apiErr));
        await fetch("/api/v1/auth/logout", {
          method: "POST",
          credentials: "include",
        });
        return;
      }

      router.push("/dashboard");
    } catch (cause) {
      setErr(
        cause instanceof Error && cause.message
          ? cause.message
          : "Something went wrong",
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <FadeIn className="mx-auto max-w-md space-y-8 py-8 md:py-12">
      <div className="flex justify-center sm:justify-start">
        <Image
          src="/assets/logoavecSlyPay.png"
          alt="SlyPay"
          width={260}
          height={110}
          className="h-auto max-h-24 w-auto max-w-full object-contain"
          priority
        />
      </div>
      <PageHeader
        eyebrow="Welcome back"
        title="Sign in"
        description="Use the account you created in Supabase Auth (email / password)."
        className="text-center sm:text-left"
      />
      <SurfaceCard className="p-6 shadow-lg">
        {queryErrorMessage ? (
          <StatusMessage variant="error" className="mb-4">
            {queryErrorMessage}
          </StatusMessage>
        ) : null}
        {sessionReason === "idle" ||
        sessionReason === "max_age" ||
        sessionReason === "missing" ? (
          <StatusMessage variant="warning" className="mb-4">
            {sessionExpiryMessage(
              sessionReason as SessionExpiryReason,
            )}
          </StatusMessage>
        ) : null}
        <form onSubmit={submit} className="space-y-5">
          <Field label="Email">
            <Input
              className={inputClassName}
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </Field>
          <Field label="Password">
            <Input
              className={inputClassName}
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
          </Field>
          <p className="text-right text-sm">
            <Link
              href="/forgot-password"
              className="font-medium text-primary hover:underline"
            >
              Forgot password?
            </Link>
          </p>
          {err ? <StatusMessage variant="error">{err}</StatusMessage> : null}
          <Button
            type="submit"
            variant="gradient"
            size="xl"
            className="w-full"
            disabled={loading}
          >
            {loading ? "Signing in…" : "Sign in"}
          </Button>
        </form>
      </SurfaceCard>
      <p className="text-center text-sm text-muted-foreground">
        No account?{" "}
        <Link
          href="/register"
          className="font-semibold text-primary hover:underline"
        >
          Register
        </Link>
      </p>
    </FadeIn>
  );
}

export function LoginFormFallback() {
  return (
    <div className="mx-auto max-w-md space-y-8 py-8 md:py-12">
      <div className="h-24 animate-pulse rounded-2xl bg-muted/50" />
      <div className="space-y-2">
        <div className="h-4 w-24 animate-pulse rounded bg-muted/50" />
        <div className="h-8 w-40 animate-pulse rounded bg-muted/50" />
      </div>
      <div className="h-72 animate-pulse rounded-3xl bg-muted/40" />
    </div>
  );
}
