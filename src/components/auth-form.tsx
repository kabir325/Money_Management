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
      <div className="w-full max-w-sm rounded-[28px] border border-slate-800 bg-[radial-gradient(circle_at_top_left,_rgba(99,102,241,0.18),_transparent_38%),linear-gradient(135deg,_rgba(15,23,42,0.98),_rgba(2,6,23,0.98))] p-6 shadow-[0_24px_80px_rgba(2,6,23,0.55)] backdrop-blur">
        <div className="space-y-2">
          <p className="text-sm font-medium uppercase tracking-[0.28em] text-violet-300">
            Salary Cycle Dashboard
          </p>
          <h1 className="text-3xl font-semibold tracking-tight text-slate-50">
            Manage expenses and savings in one place
          </h1>
          <p className="text-sm leading-6 text-slate-400">
            This app is password protected and optimized for phones, with charts,
            category tracking, and savings visibility.
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
              className="w-full rounded-2xl border border-slate-700 bg-slate-900 px-4 py-3 text-base text-slate-100 outline-none transition placeholder:text-slate-500 focus:border-violet-500 focus:bg-slate-950"
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
            className="w-full rounded-2xl bg-violet-600 px-4 py-3 text-base font-semibold text-white transition hover:bg-violet-500 disabled:cursor-not-allowed disabled:opacity-70"
          >
            {pending ? "Unlocking..." : "Unlock dashboard"}
          </button>
        </form>

        <div className="mt-6 rounded-2xl border border-slate-800 bg-slate-900 px-4 py-4 text-sm text-slate-200">
          <p className="font-medium text-white">Deploy note</p>
          <p className="mt-1 leading-6 text-slate-400">
            Set <code>APP_PASSWORD</code> in Vercel to enable login.
          </p>
        </div>
      </div>
    </div>
  );
}
