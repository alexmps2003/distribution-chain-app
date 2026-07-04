"use client";

import Image from "next/image";
import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import {
  brandInputClassName,
  brandPrimaryButtonClassName,
} from "@/components/distribio/brand";
import { supabase } from "@/lib/supabase-client";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [errorMessage, setErrorMessage] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setErrorMessage("");
    setIsLoading(true);

    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      setErrorMessage(error.message);
      setIsLoading(false);
    } else {
      router.push("/");
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-100 px-6 py-10 text-zinc-950">
      <div className="w-full max-w-md rounded-2xl border border-zinc-200/80 bg-white/95 p-8 shadow-sm shadow-zinc-950/[0.04]">
        <div className="mb-8">
          <div className="inline-flex items-center gap-2.5 text-zinc-950">
            <span className="inline-flex size-11 items-center justify-center rounded-2xl bg-[#0f77a8]/10 ring-1 ring-[#0f77a8]/15">
              <Image
                src="/icon.png"
                alt="Distribio"
                width={28}
                height={28}
                className="rounded-lg"
                priority
              />
            </span>
            <span className="flex flex-col leading-none">
              <span className="text-lg font-bold">Distribio</span>
              <span className="mt-1 text-[10px] font-semibold uppercase tracking-[0.22em] text-[#0f77a8]">
                Distribution Chain
              </span>
            </span>
          </div>

          <div className="mt-8">
            <h1 className="text-3xl font-semibold tracking-tight">
              Welcome back
            </h1>
            <p className="mt-2 text-sm leading-6 text-zinc-600">
              Sign in to continue.
            </p>
          </div>
        </div>

        <form onSubmit={handleSubmit} noValidate className="grid gap-4">
          {errorMessage ? (
            <div className="rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-700">
              {errorMessage}
            </div>
          ) : null}

          <label className="flex flex-col gap-2 text-sm font-medium text-zinc-800">
            Email
            <input
              name="email"
              type="email"
              autoComplete="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              className={brandInputClassName}
            />
          </label>

          <label className="flex flex-col gap-2 text-sm font-medium text-zinc-800">
            Password
            <input
              name="password"
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              className={brandInputClassName}
            />
          </label>

          <button
            type="submit"
            disabled={isLoading}
            className={`${brandPrimaryButtonClassName} mt-2 disabled:cursor-not-allowed disabled:bg-zinc-400`}
          >
            {isLoading ? "Signing in..." : "Login"}
          </button>
        </form>
      </div>
    </main>
  );
}
