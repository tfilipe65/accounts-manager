import fs from "fs";
import { NextRequest } from "next/server";
import { getSession } from "@/lib/auth";
import { getCurrentCompany } from "@/lib/current-company";
import { backupPath } from "@/lib/backup";

// Download one backup file of the open company: /settings/backup/download?file=<name>. Admin only.
export async function GET(req: NextRequest) {
  const session = await getSession();
  if (!session || session.role !== "ADMIN") return new Response("Administrators only", { status: 403 });
  const company = await getCurrentCompany();
  const file = req.nextUrl.searchParams.get("file") ?? "";
  const full = company ? backupPath(company.slug, file) : null;
  if (!full) return new Response("No such backup", { status: 404 });
  return new Response(fs.readFileSync(full), {
    headers: { "Content-Type": "application/gzip", "Content-Disposition": `attachment; filename="${file}"` },
  });
}
