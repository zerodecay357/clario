import { Suspense } from "react";
import Link from "next/link";
import { LoginForm } from "./login-form";

export default function LoginPage() {
  return (
    <main className="mx-auto flex w-full max-w-sm flex-1 flex-col justify-center gap-8 px-6 py-16">
      <div>
        <Link href="/" className="text-sm text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100">
          ← Clario
        </Link>
        <h1 className="mt-4 text-2xl font-semibold tracking-tight">Sign in</h1>
      </div>
      <Suspense>
        <LoginForm />
      </Suspense>
    </main>
  );
}
