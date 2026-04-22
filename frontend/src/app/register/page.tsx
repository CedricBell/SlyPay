"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

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
    <div className="motion-enter mx-auto max-w-md space-y-8 py-8 md:py-12">
      <div className="space-y-2 text-center sm:text-left">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-emerald-600 dark:text-emerald-400">
          Join SlyPay
        </p>
        <h1 className="text-3xl font-semibold tracking-tight">Create account</h1>
        <p className="text-sm text-zinc-600 dark:text-zinc-400">
          Password must be at least 8 characters (or per your Supabase policy).
        </p>
      </div>
      <form
        onSubmit={submit}
        className="space-y-5 rounded-3xl border border-zinc-200/70 bg-[var(--surface)] p-6 shadow-lg backdrop-blur-xl dark:border-zinc-800/80"
      >
        <div>
          <label className="mb-2 block text-sm font-medium text-zinc-800 dark:text-zinc-100">
            Email
          </label>
          <input
            className="w-full rounded-2xl border border-zinc-200/80 bg-white/90 px-4 py-3 text-zinc-900 outline-none ring-emerald-500/30 focus:ring-2 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-50"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
        </div>
        <div>
          <label className="mb-2 block text-sm font-medium text-zinc-800 dark:text-zinc-100">
            Password
          </label>
          <input
            className="w-full rounded-2xl border border-zinc-200/80 bg-white/90 px-4 py-3 text-zinc-900 outline-none ring-emerald-500/30 focus:ring-2 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-50"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            minLength={8}
            required
          />
        </div>
        {err && (
          <p className="text-sm text-red-600 dark:text-red-400">{err}</p>
        )}
        {info && (
          <p className="text-sm text-zinc-700 dark:text-zinc-300">{info}</p>
        )}
        <button
          type="submit"
          disabled={loading}
          className="w-full rounded-2xl bg-gradient-to-r from-emerald-600 to-teal-600 py-3 text-sm font-semibold text-white shadow-md transition hover:brightness-110 active:scale-[0.99] disabled:opacity-60"
        >
          {loading ? "Creating…" : "Register"}
        </button>
      </form>
      <p className="text-center text-sm text-zinc-600 dark:text-zinc-400">
        Already have an account?{" "}
        <Link
          href="/login"
          className="font-semibold text-emerald-600 hover:underline dark:text-emerald-400"
        >
          Sign in
        </Link>
      </p>
    </div>
  );
}
