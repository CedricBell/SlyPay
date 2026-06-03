"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { apiFetch, ApiError } from "@/lib/api";
import { WalletOptimizationPanel } from "@/components/wallet-optimization-panel";
import { FadeIn } from "@/components/motion";
import { PageHeader } from "@/components/page-header";
import { StatusMessage } from "@/components/status-message";
import { Button } from "@/components/ui/button";
import { Field, inputClassName } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { SurfaceCard } from "@/components/ui/surface-card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import type { WalletOptimizationScore } from "@/lib/wallet-optimization-score";

type MeResponse = {
  id: string;
  email: string;
  firstName: string | null;
  lastName: string | null;
  optimization: WalletOptimizationScore;
};

export default function AccountPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);

  const [email, setEmail] = useState("");
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [optimization, setOptimization] = useState<WalletOptimizationScore>({
    overallPercent: 0,
    hasCards: false,
    categories: [],
  });

  const [newEmail, setNewEmail] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [currentPassword, setCurrentPassword] = useState("");
  const [savingProfile, setSavingProfile] = useState(false);
  const [savingEmail, setSavingEmail] = useState(false);
  const [savingPassword, setSavingPassword] = useState(false);

  const load = useCallback(async () => {
    const me = await apiFetch<MeResponse>("/auth/me");
    setEmail(me.email);
    setNewEmail(me.email);
    setFirstName(me.firstName ?? "");
    setLastName(me.lastName ?? "");
    setOptimization(me.optimization);
  }, []);

  useEffect(() => {
    (async () => {
      try {
        await load();
      } catch (e) {
        if (e instanceof ApiError && e.status === 401) {
          router.replace("/login");
          return;
        }
        setErr("Could not load account");
      } finally {
        setLoading(false);
      }
    })();
  }, [load, router]);

  const saveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setErr(null);
    setMsg(null);
    setSavingProfile(true);
    try {
      await apiFetch("/auth/me", {
        method: "PATCH",
        body: JSON.stringify({ firstName, lastName }),
      });
      setMsg("Profile updated.");
    } catch (e) {
      if (e instanceof ApiError) setErr(e.message);
      else setErr("Could not save profile");
    } finally {
      setSavingProfile(false);
    }
  };

  const saveEmail = async (e: React.FormEvent) => {
    e.preventDefault();
    setErr(null);
    setMsg(null);
    if (newEmail.trim().toLowerCase() === email.toLowerCase()) {
      setMsg("Email unchanged.");
      return;
    }
    setSavingEmail(true);
    try {
      const supabase = createClient();
      const { error } = await supabase.auth.updateUser({
        email: newEmail.trim(),
      });
      if (error) {
        setErr(error.message);
        return;
      }
      setMsg(
        "Confirmation sent to your new address. Your login email updates after you confirm.",
      );
    } catch {
      setErr("Could not update email");
    } finally {
      setSavingEmail(false);
    }
  };

  const savePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setErr(null);
    setMsg(null);
    if (newPassword.length < 8) {
      setErr("Password must be at least 8 characters.");
      return;
    }
    if (newPassword !== confirmPassword) {
      setErr("Passwords do not match.");
      return;
    }
    setSavingPassword(true);
    try {
      const supabase = createClient();
      const { error: signInErr } = await supabase.auth.signInWithPassword({
        email,
        password: currentPassword,
      });
      if (signInErr) {
        setErr("Current password is incorrect.");
        return;
      }
      const { error } = await supabase.auth.updateUser({ password: newPassword });
      if (error) {
        setErr(error.message);
        return;
      }
      setNewPassword("");
      setConfirmPassword("");
      setCurrentPassword("");
      setMsg("Password updated.");
    } catch {
      setErr("Could not update password");
    } finally {
      setSavingPassword(false);
    }
  };

  if (loading) {
    return (
      <div className="py-16 text-center text-sm text-muted-foreground">
        Loading account…
      </div>
    );
  }

  return (
    <FadeIn className="mx-auto max-w-2xl space-y-8">
      <PageHeader
        eyebrow="Account"
        title="Settings"
        description="Manage your profile, sign-in details, and see how optimized your wallet is."
      />

      {err ? <StatusMessage variant="error">{err}</StatusMessage> : null}
      {msg ? <StatusMessage variant="info">{msg}</StatusMessage> : null}

      <Tabs defaultValue="profile" className="gap-6">
        <TabsList className="w-full sm:w-auto">
          <TabsTrigger value="profile">Profile</TabsTrigger>
          <TabsTrigger value="security">Security</TabsTrigger>
          <TabsTrigger value="optimization">Wallet score</TabsTrigger>
        </TabsList>

        <TabsContent value="profile" className="mt-0">
          <SurfaceCard className="p-5 sm:p-6">
            <form onSubmit={saveProfile} className="space-y-5">
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="First name">
                  <Input
                    className={inputClassName}
                    value={firstName}
                    onChange={(e) => setFirstName(e.target.value)}
                    autoComplete="given-name"
                  />
                </Field>
                <Field label="Last name">
                  <Input
                    className={inputClassName}
                    value={lastName}
                    onChange={(e) => setLastName(e.target.value)}
                    autoComplete="family-name"
                  />
                </Field>
              </div>
              <Field label="Email" hint="Change email in the Security tab.">
                <Input
                  className={inputClassName}
                  type="email"
                  value={email}
                  disabled
                />
              </Field>
              <Button
                type="submit"
                variant="gradient"
                disabled={savingProfile}
              >
                {savingProfile ? "Saving…" : "Save profile"}
              </Button>
            </form>
          </SurfaceCard>
        </TabsContent>

        <TabsContent value="security" className="mt-0 space-y-5">
          <SurfaceCard className="p-5 sm:p-6">
            <h2 className="text-sm font-semibold">Email address</h2>
            <p className="mt-1 text-xs text-muted-foreground">
              Supabase sends a confirmation link to the new address.
            </p>
            <form onSubmit={saveEmail} className="mt-4 space-y-4">
              <Field label="New email">
                <Input
                  className={inputClassName}
                  type="email"
                  value={newEmail}
                  onChange={(e) => setNewEmail(e.target.value)}
                  required
                />
              </Field>
              <Button type="submit" variant="gradient" disabled={savingEmail}>
                {savingEmail ? "Sending…" : "Update email"}
              </Button>
            </form>
          </SurfaceCard>

          <SurfaceCard className="p-5 sm:p-6">
            <h2 className="text-sm font-semibold">Password</h2>
            <form onSubmit={savePassword} className="mt-4 space-y-4">
              <Field label="Current password">
                <Input
                  className={inputClassName}
                  type="password"
                  value={currentPassword}
                  onChange={(e) => setCurrentPassword(e.target.value)}
                  required
                  autoComplete="current-password"
                />
              </Field>
              <Field label="New password">
                <Input
                  className={inputClassName}
                  type="password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  minLength={8}
                  required
                  autoComplete="new-password"
                />
              </Field>
              <Field label="Confirm new password">
                <Input
                  className={inputClassName}
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  minLength={8}
                  required
                  autoComplete="new-password"
                />
              </Field>
              <Button
                type="submit"
                variant="gradient"
                disabled={savingPassword}
              >
                {savingPassword ? "Updating…" : "Change password"}
              </Button>
            </form>
          </SurfaceCard>
        </TabsContent>

        <TabsContent value="optimization" className="mt-0">
          <WalletOptimizationPanel optimization={optimization} />
        </TabsContent>
      </Tabs>
    </FadeIn>
  );
}
