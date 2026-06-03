"use client";

import { useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { FadeIn } from "@/components/motion";
import { PageHeader } from "@/components/page-header";
import { StatusMessage } from "@/components/status-message";
import { Button } from "@/components/ui/button";
import { Field, inputClassName } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { SurfaceCard } from "@/components/ui/surface-card";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErr(null);
    setInfo(null);
    setLoading(true);
    try {
      const supabase = createClient();
      const origin =
        typeof window !== "undefined" ? window.location.origin : "";
      const { error } = await supabase.auth.resetPasswordForEmail(
        email.trim(),
        {
          redirectTo: `${origin}/auth/callback?next=/reset-password`,
        },
      );
      if (error) {
        setErr(error.message);
        return;
      }
      setInfo(
        "If an account exists for this email, you will receive a reset link shortly.",
      );
    } catch {
      setErr("Something went wrong");
    } finally {
      setLoading(false);
    }
  };

  return (
    <FadeIn className="mx-auto max-w-md space-y-8 py-8 md:py-12">
      <PageHeader
        eyebrow="Account recovery"
        title="Forgot password"
        description="Enter your email and we will send you a link to choose a new password."
        className="text-center sm:text-left"
      />
      <SurfaceCard className="p-6 shadow-lg">
        <form onSubmit={submit} className="space-y-5">
          <Field label="Email">
            <Input
              className={inputClassName}
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              autoComplete="email"
            />
          </Field>
          {err ? <StatusMessage variant="error">{err}</StatusMessage> : null}
          {info ? <StatusMessage variant="info">{info}</StatusMessage> : null}
          <Button
            type="submit"
            variant="gradient"
            size="xl"
            className="w-full"
            disabled={loading}
          >
            {loading ? "Sending…" : "Send reset link"}
          </Button>
        </form>
      </SurfaceCard>
      <p className="text-center text-sm text-muted-foreground">
        <Link href="/login" className="font-semibold text-primary hover:underline">
          Back to sign in
        </Link>
      </p>
    </FadeIn>
  );
}
