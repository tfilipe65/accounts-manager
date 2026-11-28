import Link from "next/link";
import { query } from "@/lib/db";
import { requireSession } from "@/lib/auth";
import { getCurrentCompany } from "@/lib/current-company";
import PrintButton from "@/components/PrintButton";

export const dynamic = "force-dynamic";

type Row = { group_no: number; group_name: string; subgroup_no: number; subgroup_name: string; normal_balance: string; accounts: string };

/** Just the subsections of the chart (the headings like "11 · Revenue"), without the accounts under them, to print. */
export default async function SubsectionsPage() {
  await requireSession();
  const company = await getCurrentCompany();
  const rows = await query<Row>(`
    SELECT g.group_no, g.name AS group_name, sg.subgroup_no, sg.name AS subgroup_name, sg.normal_balance,
           (SELECT COUNT(*) FROM accounts a WHERE a.subgroup_no = sg.subgroup_no) AS accounts
    FROM account_subgroups sg JOIN account_groups g ON g.group_no = sg.group_no
    ORDER BY g.group_no, sg.subgroup_no
  `);
  const groups = new Map<number, { name: string; items: Row[] }>();
  for (const r of rows) {
    if (!groups.has(r.group_no)) groups.set(r.group_no, { name: r.group_name, items: [] });
    groups.get(r.group_no)!.items.push(r);
  }

  return (
    <div className="flex flex-col gap-5 print:gap-4">
      <style>{"@media print { @page { size: A4; margin: 12mm; } }"}</style>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <Link href="/chart-of-accounts" className="text-sm text-primary hover:underline print:hidden">
            &larr; Chart of Accounts
          </Link>
          <h1 className="text-2xl font-semibold text-primary print:text-2xl">Chart of Accounts: subsections</h1>
          <p className="text-sm text-neutral-600">
            {company?.name ?? ""} &middot; {rows.length} subsections in {groups.size} groups &middot; Debit / Credit is the side that makes the account grow
          </p>
        </div>
        <PrintButton />
      </div>

      <div className="columns-1 gap-x-10 md:columns-2 print:columns-2 print:gap-x-8">
        {[...groups.entries()].map(([no, g]) => (
          <section key={no} className="mb-5 break-inside-avoid print:mb-5">
            <h2 className="border-b border-line pb-1 text-base font-semibold text-primary print:pb-1.5 print:text-lg">
              {no}. {g.name}
            </h2>
            <table className="w-full text-sm print:text-sm">
              <tbody className="divide-y divide-line">
                {g.items.map((r) => (
                  <tr key={r.subgroup_no}>
                    <td className="w-12 py-1 font-mono print:py-1.5 text-xs text-neutral-600">{r.subgroup_no}</td>
                    <td className="py-1 print:py-1.5">{r.subgroup_name}</td>
                    <td className="whitespace-nowrap py-1 pl-2 text-right text-xs text-neutral-500 print:py-1.5 print:text-sm">{r.normal_balance === "debit" ? "Debit" : "Credit"}</td>
                    <td className="w-16 whitespace-nowrap py-1 text-right text-xs text-neutral-500 print:py-1.5 print:text-sm">{Number(r.accounts)} acc.</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>
        ))}
      </div>
    </div>
  );
}
