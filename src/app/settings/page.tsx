import { AuthForm } from "@/components/auth-form";
import { SettingsPanel } from "@/components/settings-panel";
import { isAuthenticated } from "@/app/actions/auth";

export default async function SettingsPage() {
  const authenticated = await isAuthenticated();

  return authenticated ? <SettingsPanel /> : <AuthForm />;
}
