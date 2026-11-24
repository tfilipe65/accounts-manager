import "./globals.css";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { getSession, getAllowedSections } from "@/lib/auth";
import { getCurrentCompany } from "@/lib/current-company";
import { sectionForPath } from "@/lib/sections";
import { getLabels } from "@/lib/labels";
import Nav from "@/components/Nav";
import NoAccessPage from "@/app/no-access/page";

export const metadata = {
  title: "Accounts Manager",
  description: "Bookkeeping for the Algarve Builders companies",
};

export const viewport = {
  themeColor: "#1b4b66",
};

export default async function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  const pathname = (await headers()).get("x-pathname") ?? "";
  const onPicker = pathname.startsWith("/companies");
  const session = onPicker ? null : await getSession();
  const company = session ? await getCurrentCompany() : undefined;
  const allowed = session ? await getAllowedSections(session) : null;
  if (session?.mustChangePassword && !pathname.startsWith("/account")) redirect("/account");
  const labels = session ? await getLabels() : { client: "Clients", project: "Projects" };
  const section = sectionForPath(pathname);
  const denied = !!session && !!allowed && !!section && !allowed.includes(section);
  return (
    <html lang="en" className="h-full antialiased">
      <body className="min-h-full bg-background text-foreground" style={{ fontFamily: "system-ui, -apple-system, Segoe UI, Roboto, sans-serif" }}>
        {session && <Nav user={session} company={company} allowed={allowed} labels={labels} />}
        <main className={session ? "ml-56 max-w-[1800px] p-6 print:ml-0 print:p-0" : "mx-auto max-w-[1400px] p-6"}>{denied ? <NoAccessPage /> : children}</main>
      </body>
    </html>
  );
}
