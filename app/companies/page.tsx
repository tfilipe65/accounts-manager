import { listCompanies } from "@/lib/companies";
import { getMaster, hasMasterAdmin } from "@/lib/master-admin";
import { openCompanyAction, masterLogoutAction } from "@/lib/actions/company-actions";
import { AddCompanyForm, DemoDataForms, MasterLoginForm, SetupMasterForm } from "./MasterForms";

export const dynamic = "force-dynamic";

export default async function CompaniesPage() {
  const companies = listCompanies();
  const master = await getMaster();
  const masterExists = hasMasterAdmin();

  return (
    <div className="mx-auto flex max-w-4xl flex-col gap-8 py-8">
      <div>
        <h1 className="text-2xl font-semibold text-primary">Accounts Manager</h1>
        <p className="text-sm text-neutral-600">
          {master ? `Signed in as administrator ${master.name}. Choose a company to open it.` : "Choose a company, then sign in with your login for it."}
        </p>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        {companies.map((c) => (
          <form key={c.slug} action={openCompanyAction.bind(null, c.slug)}>
            <button
              type="submit"
              className="flex w-full flex-col items-start gap-1 rounded-lg border border-line bg-surface p-5 text-left shadow-sm hover:border-primary hover:shadow"
            >
              <span className="flex items-center gap-2 text-lg font-semibold text-primary">
                {c.name}
                {c.test && <span className="rounded bg-amber-100 px-1.5 py-0.5 text-[11px] font-semibold uppercase text-amber-800">Test</span>}
              </span>
              <span className="text-sm text-neutral-600">{c.description}</span>
            </button>
          </form>
        ))}
      </div>

      <section className="rounded-lg border border-line bg-surface p-5">
        {master ? (
          <div className="flex flex-col gap-4">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold text-primary">Add a company</h2>
              <form action={masterLogoutAction}>
                <button type="submit" className="rounded-md border border-line px-3 py-1.5 text-sm hover:bg-background">
                  Administrator sign out
                </button>
              </form>
            </div>
            <AddCompanyForm />
            <DemoDataForms />
          </div>
        ) : masterExists ? (
          <div className="flex max-w-sm flex-col gap-3">
            <h2 className="text-lg font-semibold text-primary">Administrator</h2>
            <p className="text-sm text-neutral-600">The administrator can open any company and add new ones.</p>
            <MasterLoginForm />
          </div>
        ) : (
          <div className="flex max-w-sm flex-col gap-3">
            <h2 className="text-lg font-semibold text-primary">Create the administrator account</h2>
            <p className="text-sm text-neutral-600">
              First start. This login sits above all the companies: it can open any of them and add new ones. Each company has its own
              separate users, set up inside it.
            </p>
            <SetupMasterForm />
          </div>
        )}
      </section>
    </div>
  );
}
