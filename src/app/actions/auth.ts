"use server";

import { cookies } from "next/headers";
import { AUTH_COOKIE, getIsAuthenticated, getPasswordFingerprint } from "@/lib/auth";

export type LoginState = {
  error?: string;
  success?: boolean;
};

export async function login(
  _previousState: LoginState,
  formData: FormData,
): Promise<LoginState> {
  const configuredPassword = process.env.APP_PASSWORD;
  const submittedPassword = String(formData.get("password") ?? "");

  if (!configuredPassword) {
    return {
      error: "APP_PASSWORD is missing. Add it in your Vercel or local environment.",
    };
  }

  if (submittedPassword !== configuredPassword) {
    return {
      error: "Incorrect password. Please try again.",
    };
  }

  const cookieStore = await cookies();
  cookieStore.set(AUTH_COOKIE, getPasswordFingerprint(configuredPassword), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 24 * 30,
  });

  return { success: true };
}

export async function logout() {
  const cookieStore = await cookies();
  cookieStore.delete(AUTH_COOKIE);
}

export async function isAuthenticated() {
  return getIsAuthenticated();
}
