import "./globals.css";
import { getSession } from "@/lib/auth";
import Nav from "@/components/Nav";

export const metadata = {
  title: "Accounts Manager",
  description: "Teia Firme Lda bookkeeping",
};

export const viewport = {
  themeColor: "#1b4b66",
};

export default async function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  const session = await getSession();
  return (
    <html lang="en" className="h-full antialiased">
      <body className="min-h-full bg-background text-foreground" style={{ fontFamily: "system-ui, -apple-system, Segoe UI, Roboto, sans-serif" }}>
        {session && <Nav user={session} />}
        <main className={session ? "ml-56 max-w-[1800px] p-6" : "mx-auto max-w-[1400px] p-6"}>{children}</main>
      </body>
    </html>
  );
}
