"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { FadeIn } from "@/components/motion";
import { PageHeader } from "@/components/page-header";
import { StatusMessage } from "@/components/status-message";
import { Button } from "@/components/ui/button";
import { Field, inputClassName } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { SurfaceCard } from "@/components/ui/surface-card";

export default function ResetPasswordPage() {
  const router = useRouter();
  const [ready, setReady] = useState(false);
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const supabase = createClient();
    void supabase.auth.getSession().then(({ data }) => {
      if (data.session) setReady(true);
    });
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event) => {
      if (event === "PASSWORD_RECOVERY" || event === "SIGNED_IN") {
        setReady(true);
      }
    });
    return () => subscription.unsubscribe();
  }, []);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErr(null);
    if (password.length < 8) {
      setErr("Password must be at least 8 characters.");
      return;
    }
    if (password !== confirm) {
      setErr("Passwords do not match.");
      return;
    }
    setLoading(true);
    try {
      const supabase = createClient();
      const { error } = await supabase.auth.updateUser({ password });
      if (error) {
        setErr(error.message);
        return;
      }
      router.refresh();
      router.push("/dashboard");
    } catch {
      setErr("Could not reset password");
    } finally {
      setLoading(false);
    }
  };

  return (
    <FadeIn className="mx-auto max-w-md space-y-8 py-8 md:py-12">
      <PageHeader
        eyebrow="Account recovery"
        title="Choose a new password"
        description={
          ready
            ? "Enter your new password below."
            : "Open the link from your email to continue."
        }
        className="text-center sm:text-left"
      />
      <SurfaceCard className="p-6 shadow-lg">
        {ready ? (
          <form onSubmit={submit} className="space-y-5">
            <Field label="New password">
              <Input
                className={inputClassName}
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                minLength={8}
                required
                autoComplete="new-password"
              />
            </Field>
            <Field label="Confirm password">
              <Input
                className={inputClassName}
                type="password"
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                minLength={8}
                required
                autoComplete="new-password"
              />
            </Field>
            {err ? <StatusMessage variant="error">{err}</StatusMessage> : null}
            <Button
              type="submit"
              variant="gradient"
              size="xl"
              className="w-full"
              disabled={loading}
            >
              {loading ? "Saving…" : "Update password"}
            </Button>
          </form>
        ) : (
          <StatusMessage variant="warning">
            Waiting for a valid recovery session. Request a new link from{" "}
            <Link href="/forgot-password" className="font-semibold underline">
              forgot password
            </Link>
            .
          </StatusMessage>
        )}
      </SurfaceCard>
    </FadeIn>
  );
}
