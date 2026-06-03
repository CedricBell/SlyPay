"use client";

import Image from "next/image";
import { useState } from "react";
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

export default function RegisterPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
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
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
      });
      if (error) {
        setErr(error.message);
        return;
      }
      if (data.session) {
        router.refresh();
        router.push("/dashboard");
        return;
      }
      setInfo(
        "Check your email to confirm your account, then sign in. (You can disable email confirmation in the Supabase dashboard for local dev.)",
      );
    } catch {
      setErr("Something went wrong");
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
        eyebrow="Join SlyPay"
        title="Create account"
        description="Password must be at least 8 characters (or per your Supabase policy)."
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
            />
          </Field>
          <Field label="Password">
            <Input
              className={inputClassName}
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              minLength={8}
              required
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
            {loading ? "Creating…" : "Register"}
          </Button>
        </form>
      </SurfaceCard>
      <p className="text-center text-sm text-muted-foreground">
        Already have an account?{" "}
        <Link
          href="/login"
          className="font-semibold text-primary hover:underline"
        >
          Sign in
        </Link>
      </p>
    </FadeIn>
  );
}
