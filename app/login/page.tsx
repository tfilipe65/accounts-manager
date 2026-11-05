import LoginForm from "./LoginForm";
import SetupForm from "./SetupForm";
import { hasAnyUser } from "@/lib/auth";

export const dynamic = "force-dynamic";

export default async function LoginPage() {
  const needsSetup = !(await hasAnyUser());
  return (
    <div className="flex min-h-screen items-center justify-center bg-primary-dark p-6">
      <div className="w-full max-w-sm rounded-lg bg-surface p-8 shadow-lg">
        <h1 className="mb-1 text-2xl font-semibold text-primary">Accounts Manager</h1>
        <p className="mb-6 text-sm text-neutral-600">
          {needsSetup
            ? "Teia Firme Lda — first start. Create the administrator account."
            : "Teia Firme Lda — sign in to continue."}
        </p>
        {needsSetup ? <SetupForm /> : <LoginForm />}
      </div>
    </div>
  );
}
