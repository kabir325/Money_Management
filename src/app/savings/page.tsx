import { AuthForm } from "@/components/auth-form";
import { SavingsPanel } from "@/components/savings-panel";
import { isAuthenticated } from "@/app/actions/auth";

export default async function SavingsPage() {
  const authenticated = await isAuthenticated();

  return authenticated ? <SavingsPanel /> : <AuthForm />;
}
