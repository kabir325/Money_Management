"use server";

import { createHash } from "node:crypto";
import { cookies } from "next/headers";

const AUTH_COOKIE = "mm-auth";

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
  const configuredPassword = process.env.APP_PASSWORD;
  if (!configuredPassword) {
    return false;
  }

  const cookieStore = await cookies();
  const authCookie = cookieStore.get(AUTH_COOKIE)?.value;

  return authCookie === getPasswordFingerprint(configuredPassword);
}

function getPasswordFingerprint(password: string) {
  return createHash("sha256")
    .update(`${password}:money-management`)
    .digest("hex");
}
