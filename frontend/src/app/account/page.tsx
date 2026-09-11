"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { UserRound } from "lucide-react";
import { toast } from "sonner";
import { createClient } from "@/lib/supabase/client";
import { apiFetch, ApiError, invalidateApiCache } from "@/lib/api";
import { useAppData } from "@/lib/app-data";
import { FadeIn } from "@/components/motion";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { Field, inputClassName } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { SurfaceCard } from "@/components/ui/surface-card";
import { cn } from "@/lib/utils";

type FormSnapshot = {
  firstName: string;
  lastName: string;
  email: string;
  currentPassword: string;
  newPassword: string;
  confirmPassword: string;
};

function displayName(first: string, last: string, email: string): string {
  const full = [first.trim(), last.trim()].filter(Boolean).join(" ");
  if (full) return full;
  return email.split("@")[0] ?? "Account";
}

function initials(first: string, last: string, email: string): string {
  const f = first.trim()[0];
  const l = last.trim()[0];
  if (f && l) return `${f}${l}`.toUpperCase();
  if (f) return f.toUpperCase();
  const e = email.trim()[0];
  return e ? e.toUpperCase() : "?";
}

const ACCOUNT_TOAST_MS = 3000;

export default function AccountPage() {
  const router = useRouter();
  const { me, meReady, refreshMe } = useAppData();
  const [saving, setSaving] = useState(false);

  const [loginEmail, setLoginEmail] = useState("");
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [snapshot, setSnapshot] = useState<FormSnapshot | null>(null);

  const applySnapshot = useCallback((s: FormSnapshot) => {
    setFirstName(s.firstName);
    setLastName(s.lastName);
    setEmail(s.email);
    setCurrentPassword(s.currentPassword);
    setNewPassword(s.newPassword);
    setConfirmPassword(s.confirmPassword);
  }, []);

  useEffect(() => {
    if (!meReady) return;
    if (!me) {
      router.replace("/login");
      return;
    }
    setLoginEmail(me.email);
    const s: FormSnapshot = {
      firstName: me.firstName ?? "",
      lastName: me.lastName ?? "",
      email: me.email,
      currentPassword: "",
      newPassword: "",
      confirmPassword: "",
    };
    applySnapshot(s);
    setSnapshot(s);
  }, [me, meReady, applySnapshot, router]);

  const isDirty = useMemo(() => {
    if (!snapshot) return false;
    return (
      firstName !== snapshot.firstName ||
      lastName !== snapshot.lastName ||
      email.trim().toLowerCase() !== snapshot.email.toLowerCase() ||
      newPassword.length > 0 ||
      currentPassword.length > 0 ||
      confirmPassword.length > 0
    );
  }, [
    snapshot,
    firstName,
    lastName,
    email,
    newPassword,
    currentPassword,
    confirmPassword,
  ]);

  const cancel = () => {
    if (!snapshot) return;
    applySnapshot(snapshot);
  };

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!snapshot) return;

    const wantsProfile =
      firstName !== snapshot.firstName || lastName !== snapshot.lastName;
    const wantsEmail =
      email.trim().toLowerCase() !== snapshot.email.toLowerCase();
    const wantsPassword = newPassword.length > 0;

    if (!wantsProfile && !wantsEmail && !wantsPassword) {
      toast.warning("No changes to save.", { duration: ACCOUNT_TOAST_MS });
      return;
    }

    if (wantsPassword) {
      if (newPassword.length < 8) {
        toast.error("Password must be at least 8 characters.", {
          duration: ACCOUNT_TOAST_MS,
        });
        return;
      }
      if (newPassword !== confirmPassword) {
        toast.error("New passwords do not match.", {
          duration: ACCOUNT_TOAST_MS,
        });
        return;
      }
      if (!currentPassword) {
        toast.error("Enter your current password to set a new one.", {
          duration: ACCOUNT_TOAST_MS,
        });
        return;
      }
    }

    setSaving(true);
    const messages: string[] = [];

    try {
      if (wantsProfile) {
        await apiFetch("/auth/me", {
          method: "PATCH",
          body: JSON.stringify({ firstName, lastName }),
        });
        messages.push("Profile saved");
      }

      const supabase = createClient();

      if (wantsEmail) {
        const { error } = await supabase.auth.updateUser({
          email: email.trim(),
        });
        if (error) {
          toast.error(error.message, { duration: ACCOUNT_TOAST_MS });
          return;
        }
        messages.push(
          "Confirmation email sent — your login updates after you confirm",
        );
      }

      if (wantsPassword) {
        const { error: signInErr } = await supabase.auth.signInWithPassword({
          email: loginEmail,
          password: currentPassword,
        });
        if (signInErr) {
          toast.error("Current password is incorrect.", {
            duration: ACCOUNT_TOAST_MS,
          });
          return;
        }
        const { error } = await supabase.auth.updateUser({
          password: newPassword,
        });
        if (error) {
          toast.error(error.message, { duration: ACCOUNT_TOAST_MS });
          return;
        }
        messages.push("Password updated");
      }

      const next: FormSnapshot = {
        firstName,
        lastName,
        email: wantsEmail ? snapshot.email : email.trim(),
        currentPassword: "",
        newPassword: "",
        confirmPassword: "",
      };
      setSnapshot(next);
      applySnapshot(next);
      invalidateApiCache("/auth/me");
      void refreshMe(true);
      toast.success(messages.join(". ") + ".", { duration: ACCOUNT_TOAST_MS });
    } catch (e) {
      if (e instanceof ApiError) {
        toast.error(e.message, { duration: ACCOUNT_TOAST_MS });
      } else {
        toast.error("Could not save changes", { duration: ACCOUNT_TOAST_MS });
      }
    } finally {
      setSaving(false);
    }
  };

  if (!meReady || !snapshot) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center">
        <p className="text-sm text-muted-foreground">Loading account…</p>
      </div>
    );
  }

  const name = displayName(firstName, lastName, loginEmail || me?.email || "");
  const abbr = initials(firstName, lastName, loginEmail);

  return (
    <FadeIn className="mx-auto w-full max-w-5xl space-y-6 pb-10 sm:space-y-8">
      <PageHeader
        eyebrow="Account"
        title="Your profile"
        description="Update your name, email, and password in one place."
        className="max-w-3xl"
      />

      <div
        className={cn(
          "flex flex-col gap-4 rounded-2xl border border-border/60 bg-card/50 p-4 sm:flex-row sm:items-center sm:gap-5 sm:p-5",
          "backdrop-blur-sm md:rounded-3xl md:p-6",
        )}
      >
        <div
          className={cn(
            "flex size-14 shrink-0 items-center justify-center rounded-2xl sm:size-16",
            "bg-gradient-to-br from-violet-600/90 to-blue-600/90 text-lg font-semibold text-white shadow-lg shadow-violet-500/25 sm:text-xl",
          )}
          aria-hidden
        >
          {abbr.length <= 2 ? (
            abbr
          ) : (
            <UserRound className="size-7 sm:size-8" strokeWidth={2} />
          )}
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-lg font-semibold tracking-tight sm:text-xl">{name}</p>
          <p className="mt-0.5 break-all text-sm text-muted-foreground sm:text-base">
            {loginEmail}
          </p>
        </div>
      </div>

      <SurfaceCard disableMotion className="overflow-hidden p-0">
        <form onSubmit={save}>
          <div className="grid divide-y divide-border/60 lg:grid-cols-2 lg:divide-x lg:divide-y-0">
            <section className="space-y-5 p-5 sm:p-8 lg:p-10">
            <div>
              <h2 className="text-sm font-semibold text-foreground">
                Personal information
              </h2>
              <p className="mt-1 text-xs text-muted-foreground sm:text-sm">
                How we address you in the app.
              </p>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="First name">
                <Input
                  className={inputClassName}
                  value={firstName}
                  onChange={(e) => setFirstName(e.target.value)}
                  autoComplete="given-name"
                  placeholder="Jane"
                />
              </Field>
              <Field label="Last name">
                <Input
                  className={inputClassName}
                  value={lastName}
                  onChange={(e) => setLastName(e.target.value)}
                  autoComplete="family-name"
                  placeholder="Doe"
                />
              </Field>
            </div>
            <Field
              label="Email address"
              hint="If you change your email, we send a confirmation link to the new address."
            >
              <Input
                className={inputClassName}
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                autoComplete="email"
                required
              />
            </Field>
            </section>

            <section className="space-y-5 p-5 sm:p-8 lg:p-10">
            <div>
              <h2 className="text-sm font-semibold text-foreground">
                Password
              </h2>
              <p className="mt-1 text-xs text-muted-foreground sm:text-sm">
                Leave new password fields empty to keep your current password.
              </p>
            </div>
            <div className="space-y-4">
              <Field label="Current password">
                <Input
                  className={inputClassName}
                  type="password"
                  value={currentPassword}
                  onChange={(e) => setCurrentPassword(e.target.value)}
                  autoComplete="current-password"
                  placeholder="Required only when changing password"
                />
              </Field>
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="New password">
                  <Input
                    className={inputClassName}
                    type="password"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    minLength={8}
                    autoComplete="new-password"
                    placeholder="Min. 8 characters"
                  />
                </Field>
                <Field label="Confirm new password">
                  <Input
                    className={inputClassName}
                    type="password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    minLength={8}
                    autoComplete="new-password"
                  />
                </Field>
              </div>
            </div>
            </section>
          </div>

          <div className="flex flex-col-reverse gap-3 border-t border-border/60 bg-muted/30 p-5 sm:flex-row sm:items-center sm:justify-end sm:gap-4 sm:p-8 lg:px-10">
            <Button
              type="button"
              variant="outline"
              size="lg"
              className="rounded-2xl sm:min-w-[7.5rem]"
              disabled={saving || !isDirty}
              onClick={cancel}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              variant="gradient"
              size="lg"
              className="rounded-2xl sm:min-w-[7.5rem]"
              disabled={saving || !isDirty}
            >
              {saving ? "Saving…" : "Save changes"}
            </Button>
          </div>
        </form>
      </SurfaceCard>
    </FadeIn>
  );
}
