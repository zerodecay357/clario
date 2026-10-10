import { Suspense } from "react";
import Link from "next/link";
import { getUser } from "@/lib/supabase/server";

export default function Home() {
  return (
    <Suspense fallback={<div className="flex-1" />}>
      <HomeContent />
    </Suspense>
  );
}

async function HomeContent() {
  const user = await getUser();
  return user ? <SignedIn email={user.email ?? ""} /> : <Landing />;
}

function Landing() {
  return (
    <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col justify-center gap-10 px-6 py-24">
      <div className="flex flex-col gap-5">
        <p className="text-sm font-medium text-zinc-500">For IIT Delhi students</p>
        <h1 className="text-4xl font-semibold leading-tight tracking-tight sm:text-5xl">
          Every deadline, from every course, in one place.
        </h1>
        <p className="text-lg leading-relaxed text-zinc-600 dark:text-zinc-400">
          Clario pulls your assignments and quizzes from Moodle and Moodle New, shows what&apos;s due today and in the
          next three days, and helps you decide what to work on first.
        </p>
      </div>
      <div className="flex flex-wrap items-center gap-4">
        <Link
          href="/login"
          className="flex h-12 items-center rounded-full bg-zinc-900 px-6 font-medium text-white transition hover:bg-zinc-700 dark:bg-white dark:text-zinc-900 dark:hover:bg-zinc-200"
        >
          Get started
        </Link>
        <span className="text-sm text-zinc-500">Free while in beta.</span>
      </div>
      <p className="border-t border-black/10 pt-6 text-sm leading-relaxed text-zinc-500 dark:border-white/10">
        Privacy: when you connect Moodle, your password is sent from your browser straight to IITD Moodle. Clario stores
        only an encrypted access token, which you can revoke at any time.
      </p>
    </main>
  );
}

function SignedIn({ email }: { email: string }) {
  return (
    <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-8 px-6 py-16">
      <header className="flex items-center justify-between">
        <span className="font-semibold tracking-tight">Clario</span>
        <form action="/auth/signout" method="post">
          <button className="text-sm text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100">Sign out</button>
        </form>
      </header>
      <section className="flex flex-col gap-3 rounded-2xl border border-black/10 p-6 dark:border-white/10">
        <h1 className="text-xl font-semibold">Hi {email}</h1>
        <p className="text-zinc-600 dark:text-zinc-400">
          Next step: connect Moodle to see your deadlines. <span className="text-zinc-400">(Coming in v0.1)</span>
        </p>
      </section>
    </main>
  );
}
