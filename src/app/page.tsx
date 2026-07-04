import { AuthForm } from "@/components/auth-form";
import { Dashboard } from "@/components/dashboard";
import { isAuthenticated } from "@/app/actions/auth";

export default async function Home() {
  const authenticated = await isAuthenticated();

  return authenticated ? <Dashboard /> : <AuthForm />;
}
