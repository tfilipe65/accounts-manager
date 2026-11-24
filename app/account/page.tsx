import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import ChangePasswordForm from "./ChangePasswordForm";

export const dynamic = "force-dynamic";

export default async function AccountPage() {
  const session = await getSession();
  if (!session) redirect("/login");
  return (
    <div className="flex max-w-md flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold text-primary">My account</h1>
        <p className="text-sm text-neutral-600">
          {session.name} ({session.username}) &middot; {session.role === "ADMIN" ? "Administrator" : "User"}
        </p>
      </div>
      {session.mustChangePassword && (
        <p className="rounded-md border border-accent bg-amber-50 p-3 text-sm text-neutral-800">
          The administrator asked you to choose a new password before carrying on.
        </p>
      )}
      {session.id > 0 ? (
        <ChangePasswordForm />
      ) : (
        <p className="text-sm text-neutral-600">You are signed in as the master administrator. Change that password where you created it, on the company list.</p>
      )}
    </div>
  );
}
