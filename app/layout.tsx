import "./globals.css";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { getSession, getAllowedSections } from "@/lib/auth";
import { getCurrentCompany } from "@/lib/current-company";
import { sectionForPath, isAdminOnlySection } from "@/lib/sections";
import { getLabels } from "@/lib/labels";
import Nav from "@/components/Nav";
import Splash from "@/components/Splash";
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
  // The company list and the sign-in screen are full-screen pages: no menu, no app frame.
  const onPicker = pathname.startsWith("/companies") || pathname.startsWith("/login");
  const session = onPicker ? null : await getSession();
  const company = session ? await getCurrentCompany() : undefined;
  const allowed = session ? await getAllowedSections(session) : null;
  if (session?.mustChangePassword && !pathname.startsWith("/account")) redirect("/account");
  const labels = session ? await getLabels() : { client: "Clients", project: "Projects" };
  const section = sectionForPath(pathname);
  const denied =
    !!session && !!section && ((!!allowed && !allowed.includes(section)) || (session.role !== "ADMIN" && isAdminOnlySection(section)));
  return (
    <html lang="en" className="h-full antialiased" suppressHydrationWarning>
      <body className="min-h-full bg-background text-foreground" style={{ fontFamily: "system-ui, -apple-system, Segoe UI, Roboto, sans-serif" }}>
        {/* Already shown in this window: hide the splash before the first paint, so a reload does not flash it. */}
        <script dangerouslySetInnerHTML={{ __html: `try{if(sessionStorage.getItem("accounts-manager.splash-seen")==="1")document.documentElement.setAttribute("data-splash-seen","")}catch(e){}` }} />
        <Splash />
        {session && <Nav user={session} company={company} allowed={allowed} labels={labels} />}
        {session ? (
          // The page itself never scrolls: only this area does, so its scrollbar sits under the top bar, beside the menu.
          <main className="fixed bottom-0 left-56 right-0 top-12 overflow-y-auto px-6 pb-6 print:static print:overflow-visible print:p-0">
            <div className="app-main mx-auto max-w-[1800px]">{denied ? <NoAccessPage /> : children}</div>
          </main>
        ) : (
          <main className="mx-auto max-w-[1400px] p-6">{children}</main>
        )}
      </body>
    </html>
  );
}
