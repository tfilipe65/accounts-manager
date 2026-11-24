import Link from "next/link";
import { redirect } from "next/navigation";
import LoginForm from "./LoginForm";
import SetupForm from "./SetupForm";
import { hasAnyUser } from "@/lib/auth";
import { getCurrentCompany } from "@/lib/current-company";

export const dynamic = "force-dynamic";

export default async function LoginPage() {
  const company = await getCurrentCompany();
  if (!company) redirect("/companies");
  const needsSetup = !(await hasAnyUser());
  const name = company?.name ?? "Teia Firme Lda";
  return (
    <div className="flex min-h-screen items-center justify-center bg-primary-dark p-6">
      <div className="w-full max-w-sm rounded-lg bg-surface p-8 shadow-lg">
        <h1 className="mb-1 text-2xl font-semibold text-primary">Accounts Manager</h1>
        <p className="mb-6 text-sm text-neutral-600">
          {needsSetup
            ? `${name} — first start. Create this company's administrator account.`
            : `${name} — sign in to continue.`}
        </p>
        {needsSetup ? <SetupForm /> : <LoginForm />}
                  <Link href="/companies" className="mt-6 block text-center text-sm text-neutral-500 hover:text-primary">
            Choose another company
          </Link>
      </div>
    </div>
  );
}
