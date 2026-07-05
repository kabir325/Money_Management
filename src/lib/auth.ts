import { createHash } from "node:crypto";
import { cookies } from "next/headers";

export const AUTH_COOKIE = "mm-auth";

export function getPasswordFingerprint(password: string) {
  return createHash("sha256")
    .update(`${password}:money-management`)
    .digest("hex");
}

export async function getIsAuthenticated() {
  const configuredPassword = process.env.APP_PASSWORD;
  if (!configuredPassword) {
    return false;
  }

  const cookieStore = await cookies();
  const authCookie = cookieStore.get(AUTH_COOKIE)?.value;

  return authCookie === getPasswordFingerprint(configuredPassword);
}
