"use client";

import { useState } from "react";
import { useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

// Hidden until the Google provider is enabled in Supabase (Auth → Providers).
const GOOGLE_ENABLED = process.env.NEXT_PUBLIC_GOOGLE_AUTH === "1";

export function LoginForm() {
  const params = useSearchParams();
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<"idle" | "sending" | "sent" | "error">(
    params.get("error") ? "error" : "idle",
  );
  const redirectTo = () => `${window.location.origin}/auth/callback`;

  async function sendMagicLink(e: React.FormEvent) {
    e.preventDefault();
    setStatus("sending");
    const { error } = await createClient().auth.signInWithOtp({
      email,
      options: { emailRedirectTo: redirectTo() },
    });
    setStatus(error ? "error" : "sent");
  }

  async function signInWithGoogle() {
    await createClient().auth.signInWithOAuth({ provider: "google", options: { redirectTo: redirectTo() } });
  }

  if (status === "sent") {
    return (
      <p className="rounded-xl bg-emerald-50 p-4 text-sm text-emerald-900 dark:bg-emerald-950 dark:text-emerald-100">
        Check <span className="font-medium">{email}</span> for a sign-in link.
      </p>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      {GOOGLE_ENABLED && (
        <>
      <button
        onClick={signInWithGoogle}
        className="h-11 rounded-xl border border-black/10 font-medium transition hover:bg-black/5 dark:border-white/15 dark:hover:bg-white/5"
      >
        Continue with Google
      </button>
      <div className="flex items-center gap-3 text-xs text-zinc-500">
        <span className="h-px flex-1 bg-black/10 dark:bg-white/10" /> or <span className="h-px flex-1 bg-black/10 dark:bg-white/10" />
      </div>
        </>
      )}
      <form onSubmit={sendMagicLink} className="flex flex-col gap-3">
        <input
          type="email"
          required
          placeholder="you@iitd.ac.in"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="h-11 rounded-xl border border-black/10 bg-transparent px-4 outline-none focus:border-black/40 dark:border-white/15 dark:focus:border-white/40"
        />
        <button
          disabled={status === "sending"}
          className="h-11 rounded-xl bg-zinc-900 font-medium text-white transition hover:bg-zinc-700 disabled:opacity-60 dark:bg-white dark:text-zinc-900 dark:hover:bg-zinc-200"
        >
          {status === "sending" ? "Sending…" : "Email me a sign-in link"}
        </button>
      </form>
      {status === "error" && <p className="text-sm text-red-600">Sign-in failed. Please try again.</p>}
    </div>
  );
}
