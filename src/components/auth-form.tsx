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
      <div className="w-full max-w-sm rounded-[28px] border border-white/60 bg-white/85 p-6 shadow-[0_20px_80px_rgba(15,23,42,0.12)] backdrop-blur">
        <div className="space-y-2">
          <p className="text-sm font-medium uppercase tracking-[0.28em] text-violet-600">
            Salary Cycle Dashboard
          </p>
          <h1 className="text-3xl font-semibold tracking-tight text-slate-900">
            Manage expenses and savings in one place
          </h1>
          <p className="text-sm leading-6 text-slate-600">
            This app is password protected and optimized for phones, with charts,
            category tracking, and savings visibility.
          </p>
        </div>

        <form action={formAction} className="mt-8 space-y-4">
          <label className="block space-y-2">
            <span className="text-sm font-medium text-slate-700">Password</span>
            <input
              type="password"
              name="password"
              required
              placeholder="Enter app password"
              className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-base text-slate-900 outline-none transition focus:border-violet-400 focus:bg-white"
            />
          </label>

          {state.error ? (
            <p className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
              {state.error}
            </p>
          ) : null}

          <button
            type="submit"
            disabled={pending}
            className="w-full rounded-2xl bg-slate-950 px-4 py-3 text-base font-semibold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-70"
          >
            {pending ? "Unlocking..." : "Unlock dashboard"}
          </button>
        </form>

        <div className="mt-6 rounded-2xl bg-slate-950 px-4 py-4 text-sm text-slate-200">
          <p className="font-medium text-white">Deploy note</p>
          <p className="mt-1 leading-6 text-slate-300">
            Set <code>APP_PASSWORD</code> in Vercel to enable login.
          </p>
        </div>
      </div>
    </div>
  );
}
