import { NextRequest } from "next/server";
import { getSession } from "@/lib/auth";
import { listBankAccounts, listBankTransactions } from "@/lib/actions/banking-actions";
import { csvResponse, toCsv } from "@/lib/csv";

// Statement export for one bank account: /banking/export?account=<key>[&year=2022]
export async function GET(req: NextRequest) {
  if (!(await getSession())) return new Response("Sign in first", { status: 401 });
  const key = req.nextUrl.searchParams.get("account");
  const yearParam = req.nextUrl.searchParams.get("year");
  const accounts = await listBankAccounts(undefined, true);
  const account = accounts.find((a) => a.key === key);
  if (!account) return new Response("Unknown account", { status: 404 });

  const year = yearParam ? Number(yearParam) : undefined;
  const rows = await listBankTransactions(account.id, year);
  const brought =
    year != null ? ((await listBankAccounts(`${year - 1}-12-31`, true)).find((a) => a.id === account.id)?.balance ?? 0) : account.opening_balance;
  let running = brought;
  const body = toCsv(
    ["Date", "Description", "Linked to", "Employee", "In", "Out", "Balance", "Reconciled"],
    [
      ["", year != null ? `Balance brought forward (before ${year})` : "Opening balance", "", "", "", "", brought.toFixed(2), ""],
      ...rows.map((t) => {
        const inn = t.in_amount + t.in_vat;
        const out = t.out_amount + t.out_vat;
        running += inn - out;
        return [t.payment_date, t.description, t.link_label, t.employee_name, inn ? inn.toFixed(2) : "", out ? out.toFixed(2) : "", running.toFixed(2), t.reconciled ? "Yes" : ""];
      }),
    ]
  );
  return csvResponse(`${account.name} ${year ?? "all years"}.csv`, body);
}
