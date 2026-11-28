import Link from "next/link";
import { Fragment } from "react";
import {
  listBankAccounts,
  listBankTransactions,
  listOpenSalesInvoiceOptions,
  listOpenPurchaseInvoiceOptions,
  getReconciliationFigures,
} from "@/lib/actions/banking-actions";
import { deleteBankTransactionAction } from "@/lib/actions/banking-form-actions";
import { listUnlinkedCashAccounts } from "@/lib/actions/bank-account-actions";
import { listEmployeeOptions } from "@/lib/actions/employee-actions";
import { listAccountOptions, listAllAccountOptions } from "@/lib/actions/reference-actions";
import { getSession } from "@/lib/auth";
import { accountNoByRole } from "@/lib/roles";
import { queryOne } from "@/lib/db";
import { groupRegister, partNote } from "@/lib/banking-group";
import { getEffectiveReportingYear } from "@/lib/reporting-year";
import { getClosedThroughYear } from "@/lib/year-close";
import { formatDate, formatMoney as fmt } from "@/lib/formatters";
import BankingEntryForm from "@/components/BankingEntryForm";
import BankAccountsPanel from "@/components/BankAccountsPanel";
import { TransferForm, ReconcilePanel, ReconcileToggle } from "@/components/BankTools";

export const dynamic = "force-dynamic";

export default async function BankingPage({ searchParams }: { searchParams: Promise<{ account?: string; all?: string }> }) {
  const { account, all } = await searchParams;
  const showAll = all === "1";
  const session = await getSession();
  const isAdmin = session?.role === "ADMIN";
  const year = await getEffectiveReportingYear();
  const everyAccount = await listBankAccounts(undefined, true);
  const bankAccounts = everyAccount.filter((b) => b.active);
  const active = bankAccounts.find((b) => b.key === account) ?? bankAccounts[0];

  if (!active) {
    return (
      <div className="flex flex-col gap-4">
        <h1 className="text-2xl font-semibold text-primary">Banks &amp; Cash</h1>
        <p className="text-sm text-neutral-600">There is no open bank account. {isAdmin ? "Reopen one below or add a new one." : "Ask the administrator to add one."}</p>
        {isAdmin && (
          <BankAccountsPanel accounts={everyAccount} unlinked={await listUnlinkedCashAccounts()} counters={[]} defaultCounter={null} defaultDate={`${year}-01-01`} />
        )}
      </div>
    );
  }

  const [transactions, accounts, salesInvoices, purchaseInvoices, closedThroughYear, employees, reconciliation, allAccountOptions, unlinked] = await Promise.all([
    listBankTransactions(active.id, showAll ? undefined : year),
    listAccountOptions(),
    listOpenSalesInvoiceOptions(),
    listOpenPurchaseInvoiceOptions(),
    getClosedThroughYear(),
    listEmployeeOptions(),
    getReconciliationFigures(active.id),
    isAdmin ? listAllAccountOptions() : Promise.resolve([]),
    isAdmin ? listUnlinkedCashAccounts() : Promise.resolve([]),
  ]);

  // When the transaction list is filtered to just this year, the running balance cannot start from
  // the account's inception opening balance (that would ignore every year in between). It starts
  // from the balance at the end of the PRIOR year instead.
  const broughtForward = showAll
    ? active.opening_balance
    : ((await listBankAccounts(`${year - 1}-12-31`, true)).find((b) => b.id === active.id) ?? active).balance;
  let running = broughtForward;

  const today = new Date().toISOString().slice(0, 10);
  const formDate = Number(today.slice(0, 4)) === year ? today : `${year}-12-31`;
  const counters = allAccountOptions.filter((a) => a.normal_balance === "credit");
  const capitalNo = await accountNoByRole("share_capital");
  const defaultCounter = counters.find((a) => a.account_no === capitalNo)?.account_no ?? null;

  // What the split window needs: the accounts its one-click starting points use, and the VAT rates.
  const [loanPrincipal, interestExpense, bankCharges, withholding, socialSecurity, rateRow] = await Promise.all([
    accountNoByRole("loan_principal"),
    accountNoByRole("interest_expense"),
    accountNoByRole("bank_charges"),
    accountNoByRole("withholding_payable"),
    accountNoByRole("social_security_payable"),
    queryOne<{ vat_rate_1: string | null; vat_rate_2: string | null; vat_rate_3: string | null; vat_rate_4: string | null }>(
      "SELECT vat_rate_1, vat_rate_2, vat_rate_3, vat_rate_4 FROM app_settings WHERE id = 1"
    ),
  ]);
  const splitProps = {
    vatRates: [rateRow?.vat_rate_1, rateRow?.vat_rate_2, rateRow?.vat_rate_3, rateRow?.vat_rate_4].filter((v) => v != null).map(Number),
    presets: { loanPrincipal, interestExpense, bankCharges, withholding, socialSecurity },
  };
  const register = groupRegister(transactions);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold text-primary">Banks &amp; Cash</h1>
        <div className="flex items-center gap-4 text-sm">
          <a href={`/banking/export?account=${active.key}${showAll ? "" : `&year=${year}`}`} className="text-primary hover:underline">
            Export statement (CSV)
          </a>
          <Link href={showAll ? `/banking?account=${active.key}` : `/banking?account=${active.key}&all=1`} className="text-primary hover:underline">
            {showAll ? `Show ${year} only` : "Show all years"}
          </Link>
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        {bankAccounts.map((b) => (
          <Link
            key={b.id}
            href={`/banking?account=${b.key}${showAll ? "&all=1" : ""}`}
            className={`rounded-md border px-3 py-1.5 text-sm ${
              b.id === active.id ? "border-primary bg-primary text-white" : "border-line bg-surface hover:bg-background"
            }`}
          >
            {b.name}
            <span className={`ml-2 text-xs ${b.id === active.id ? "text-white/70" : "text-neutral-500"}`}>{fmt(b.balance)}</span>
          </Link>
        ))}
      </div>

      <div className="flex items-center justify-between rounded-lg border border-line bg-surface p-4">
        <span className="text-sm text-neutral-600">
          {active.name}
          {active.bank_name ? ` (${active.bank_name})` : ""} &middot; account {active.account_no}
          {active.iban ? ` · ${active.iban}` : ""} &middot; opening balance {fmt(active.opening_balance)}
        </span>
        <span className="text-lg font-semibold text-primary">Balance: {fmt(active.balance)}</span>
      </div>

      {isAdmin && (
        <BankAccountsPanel accounts={everyAccount} unlinked={unlinked} counters={counters} defaultCounter={defaultCounter} defaultDate={`${year}-01-01`} />
      )}

      {bankAccounts.length > 1 && (
        <TransferForm accounts={bankAccounts.map((b) => ({ id: b.id, name: b.name }))} fromId={active.id} defaultDate={formDate} closedThroughYear={closedThroughYear} isAdmin={isAdmin} unlinked={unlinked} />
      )}

      <ReconcilePanel
        bankAccountId={active.id}
        bookBalance={reconciliation.bookBalance}
        reconciledBalance={reconciliation.reconciledBalance}
        unreconciledCount={reconciliation.unreconciledCount}
        defaultDate={formDate}
      />

      <BankingEntryForm
        bankAccountId={active.id}
        accounts={accounts}
        salesInvoices={salesInvoices}
        purchaseInvoices={purchaseInvoices}
        employees={employees}
        closedThroughYear={closedThroughYear}
        split={splitProps}
      />

      <div className="overflow-x-auto rounded-lg border border-line bg-surface">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-line bg-background text-left text-xs font-semibold uppercase tracking-wide text-neutral-600">
              <th className="px-3 py-2" title="Matched with the bank statement">
                Rec.
              </th>
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
              <td className="px-4 py-2" colSpan={6}>
                {showAll ? "Opening balance" : `Balance brought forward (before ${year})`}
              </td>
              <td className="px-4 py-2 text-right font-semibold">{fmt(broughtForward)}</td>
              <td />
            </tr>
            {register.map((item) => {
              if (item.type === "split") {
                running += item.net;
                const first = item.rows[0];
                return (
                  <Fragment key={item.splitId}>
                    <tr className="bg-background/60 hover:bg-background">
                      <td className="px-3 py-2">
                        <ReconcileToggle id={first.id} checked={item.reconciled} />
                      </td>
                      <td className="px-4 py-2">{formatDate(item.date)}</td>
                      <td className="px-4 py-2 font-medium">{item.description || "Split transaction"}</td>
                      <td className="px-4 py-2 text-neutral-600">
                        <span className="rounded bg-primary/10 px-1.5 py-0.5 text-xs font-medium text-primary">Split into {item.rows.length} parts</span>
                      </td>
                      <td className="px-4 py-2 text-right text-debit">{item.net > 0 ? fmt(item.net) : ""}</td>
                      <td className="px-4 py-2 text-right text-credit">{item.net < 0 ? fmt(-item.net) : ""}</td>
                      <td className="px-4 py-2 text-right font-medium">{fmt(running)}</td>
                      <td className="px-4 py-2 text-right">
                        <div className="flex items-center justify-end gap-3">
                          <Link href={`/banking/split/${item.splitId}`} className="text-xs text-primary hover:underline">
                            Edit split
                          </Link>
                          <form action={deleteBankTransactionAction.bind(null, first.id, active.key)}>
                            <button type="submit" className="text-xs text-neutral-500 hover:text-red-700">
                              Delete split
                            </button>
                          </form>
                        </div>
                      </td>
                    </tr>
                    {item.rows.map((p) => {
                      const part = p.in_amount + p.in_vat - p.out_amount - p.out_vat;
                      return (
                        <tr key={p.id} className="text-xs text-neutral-600">
                          <td />
                          <td />
                          <td className="py-1 pl-10 pr-4">{partNote(p)}</td>
                          <td className="px-4 py-1">
                            {p.link_label}
                            {p.employee_name && <span className="ml-1 rounded bg-background px-1.5 py-0.5">{p.employee_name}</span>}
                            {(p.in_vat > 0 || p.out_vat > 0) && <span className="ml-1 text-neutral-400">incl. VAT {fmt(p.in_vat + p.out_vat)}</span>}
                          </td>
                          <td className="px-4 py-1 text-right">{part > 0 ? fmt(part) : ""}</td>
                          <td className="px-4 py-1 text-right">{part < 0 ? fmt(-part) : ""}</td>
                          <td colSpan={2} />
                        </tr>
                      );
                    })}
                  </Fragment>
                );
              }
              const t = item.row;
              running += t.in_amount + t.in_vat - t.out_amount - t.out_vat;
              return (
                <tr key={t.id} className="hover:bg-background">
                  <td className="px-3 py-2">
                    <ReconcileToggle id={t.id} checked={t.reconciled} />
                  </td>
                  <td className="px-4 py-2">{formatDate(t.payment_date)}</td>
                  <td className="px-4 py-2">{t.description}</td>
                  <td className="px-4 py-2 text-neutral-600">
                    {t.link_label}
                    {t.employee_name && <span className="ml-1 rounded bg-background px-1.5 py-0.5 text-xs">{t.employee_name}</span>}
                  </td>
                  <td className="px-4 py-2 text-right text-debit">{t.in_amount + t.in_vat > 0 ? fmt(t.in_amount + t.in_vat) : ""}</td>
                  <td className="px-4 py-2 text-right text-credit">{t.out_amount + t.out_vat > 0 ? fmt(t.out_amount + t.out_vat) : ""}</td>
                  <td className="px-4 py-2 text-right font-medium">{fmt(running)}</td>
                  <td className="px-4 py-2 text-right">
                    <div className="flex items-center justify-end gap-3">
                      {!t.transfer_id && (
                        <Link href={`/banking/${t.id}`} className="text-xs text-primary hover:underline">
                          Edit
                        </Link>
                      )}
                      <form action={deleteBankTransactionAction.bind(null, t.id, active.key)}>
                        <button type="submit" className="text-xs text-neutral-500 hover:text-red-700">
                          {t.transfer_id ? "Delete transfer" : "Delete"}
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
