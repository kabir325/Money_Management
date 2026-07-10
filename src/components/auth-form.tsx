"use client";

import { useActionState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { login, type LoginState } from "@/app/actions/auth";

const initialState: LoginState = {};

export function AuthForm() {
  const router = useRouter();
  const [state, formAction, pending] = useActionState(login, initialState);

  useEffect(() => {
    if (state.success) {
      router.refresh();
    }
  }, [router, state.success]);

  return (
    <div className="flex min-h-screen items-center justify-center px-4 py-10">
      <div className="w-full max-w-sm rounded-[24px] border border-slate-700/70 bg-[linear-gradient(180deg,rgba(16,24,39,0.98),rgba(8,17,31,0.98))] p-6 shadow-[0_20px_60px_rgba(2,6,23,0.45)] backdrop-blur">
        <div className="space-y-2">
          <p className="text-xs font-semibold uppercase tracking-[0.24em] text-sky-300">
            Secure Access
          </p>
          <h1 className="text-3xl font-semibold tracking-tight text-slate-50">
            Personal Finance Portal
          </h1>
          <p className="text-sm leading-6 text-slate-400">
            Sign in to view balances, spending, savings, salary activity, and loan
            progress in one protected workspace.
          </p>
        </div>

        <form action={formAction} className="mt-8 space-y-4">
          <label className="block space-y-2">
            <span className="text-sm font-medium text-slate-300">Password</span>
            <input
              type="password"
              name="password"
              required
              placeholder="Enter app password"
              className="w-full rounded-2xl border border-slate-700 bg-slate-900/90 px-4 py-3 text-base text-slate-100 outline-none transition placeholder:text-slate-500 focus:border-sky-600 focus:bg-slate-950"
            />
          </label>

          {state.error ? (
            <p className="rounded-2xl border border-rose-500/20 bg-rose-500/10 px-4 py-3 text-sm text-rose-300">
              {state.error}
            </p>
          ) : null}

          <button
            type="submit"
            disabled={pending}
            className="w-full rounded-2xl bg-sky-600 px-4 py-3 text-base font-semibold text-white transition hover:bg-sky-500 disabled:cursor-not-allowed disabled:opacity-70"
          >
            {pending ? "Signing in..." : "Enter portal"}
          </button>
        </form>

        <div className="mt-6 rounded-2xl border border-slate-800 bg-slate-900/90 px-4 py-4 text-sm text-slate-200">
          <p className="font-medium text-white">Deployment</p>
          <p className="mt-1 leading-6 text-slate-400">
            Set <code>APP_PASSWORD</code> in Vercel to enable login.
          </p>
        </div>
      </div>
    </div>
  );
}
