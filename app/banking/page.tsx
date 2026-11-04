import Link from "next/link";
import {
  listBankAccounts,
  listBankTransactions,
  listOpenSalesInvoiceOptions,
  listOpenPurchaseInvoiceOptions,
} from "@/lib/actions/banking-actions";
import { deleteBankTransactionAction } from "@/lib/actions/banking-form-actions";
import { listAccountOptions } from "@/lib/actions/reference-actions";
import { getEffectiveReportingYear } from "@/lib/reporting-year";
import { getClosedThroughYear } from "@/lib/year-close";
import { formatDate, formatMoney as fmt } from "@/lib/formatters";
import BankingEntryForm from "@/components/BankingEntryForm";

export default async function BankingPage({ searchParams }: { searchParams: Promise<{ account?: string; all?: string }> }) {
  const { account, all } = await searchParams;
  const showAll = all === "1";
  const year = await getEffectiveReportingYear();
  const bankAccounts = await listBankAccounts();
  const active = bankAccounts.find((b) => b.key === account) ?? bankAccounts[0];

  const [transactions, accounts, salesInvoices, purchaseInvoices, closedThroughYear] = await Promise.all([
    listBankTransactions(active.id, showAll ? undefined : year),
    listAccountOptions(),
    listOpenSalesInvoiceOptions(),
    listOpenPurchaseInvoiceOptions(),
    getClosedThroughYear(),
  ]);

  // When the transaction list is filtered to just `year`, the running
  // balance can't start from the account's true inception opening_balance
  // (that would ignore every year in between) -- it needs to start from the
  // balance as it stood at the end of the PRIOR year instead.
  const broughtForward = showAll
    ? active.opening_balance
    : ((await listBankAccounts(`${year - 1}-12-31`)).find((b) => b.key === active.key) ?? active).balance;
  let running = broughtForward;

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold text-primary">Banking &amp; Cash</h1>
        <Link
          href={showAll ? `/banking?account=${active.key}` : `/banking?account=${active.key}&all=1`}
          className="text-sm text-primary hover:underline"
        >
          {showAll ? `Show ${year} only` : "Show all years"}
        </Link>
      </div>

      <div className="flex gap-2">
        {bankAccounts.map((b) => (
          <Link
            key={b.id}
            href={`/banking?account=${b.key}${showAll ? "&all=1" : ""}`}
            className={`rounded-md border px-3 py-1.5 text-sm ${
              b.id === active.id ? "border-primary bg-primary text-white" : "border-line bg-surface hover:bg-background"
            }`}
          >
            {b.name}
          </Link>
        ))}
      </div>

      <div className="flex items-center justify-between rounded-lg border border-line bg-surface p-4">
        <span className="text-sm text-neutral-600">
          {active.name} &middot; account {active.account_no} &middot; opening balance {fmt(active.opening_balance)}
        </span>
        <span className="text-lg font-semibold text-primary">Balance: {fmt(active.balance)}</span>
      </div>

      <BankingEntryForm
        bankAccountId={active.id}
        accounts={accounts}
        salesInvoices={salesInvoices}
        purchaseInvoices={purchaseInvoices}
        closedThroughYear={closedThroughYear}
      />

      <div className="overflow-x-auto rounded-lg border border-line bg-surface">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-line bg-background text-left text-xs font-semibold uppercase tracking-wide text-neutral-600">
              <th className="px-4 py-2">Date</th>
              <th className="px-4 py-2">Description</th>
              <th className="px-4 py-2">Linked to</th>
              <th className="px-4 py-2 text-right">In</th>
              <th className="px-4 py-2 text-right">Out</th>
              <th className="px-4 py-2 text-right">Balance</th>
              <th className="px-4 py-2" />
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            <tr className="bg-background text-neutral-600">
              <td className="px-4 py-2" colSpan={5}>
                {showAll ? "Opening balance" : `Balance brought forward (before ${year})`}
              </td>
              <td className="px-4 py-2 text-right font-semibold">{fmt(broughtForward)}</td>
              <td />
            </tr>
            {transactions.map((t) => {
              running += t.in_amount + t.in_vat - t.out_amount - t.out_vat;
              return (
                <tr key={t.id} className="hover:bg-background">
                  <td className="px-4 py-2">{formatDate(t.payment_date)}</td>
                  <td className="px-4 py-2">{t.description}</td>
                  <td className="px-4 py-2 text-neutral-600">{t.link_label}</td>
                  <td className="px-4 py-2 text-right text-debit">{t.in_amount + t.in_vat > 0 ? fmt(t.in_amount + t.in_vat) : ""}</td>
                  <td className="px-4 py-2 text-right text-credit">{t.out_amount + t.out_vat > 0 ? fmt(t.out_amount + t.out_vat) : ""}</td>
                  <td className="px-4 py-2 text-right font-medium">{fmt(running)}</td>
                  <td className="px-4 py-2 text-right">
                    <div className="flex items-center justify-end gap-3">
                      <Link href={`/banking/${t.id}`} className="text-xs text-primary hover:underline">
                        Edit
                      </Link>
                      <form action={deleteBankTransactionAction.bind(null, t.id, active.key)}>
                        <button type="submit" className="text-xs text-neutral-500 hover:text-red-700">
                          Delete
                        </button>
                      </form>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
