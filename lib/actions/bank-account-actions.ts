"use server";

// Managing the bank accounts and cash boxes themselves (the registers are in banking-actions.ts).
// Any number can exist. Each one is tied to its own ledger account in the chart of accounts: a new
// bank account gets one created for it (or can adopt an unused cash account that is already there).

import { revalidatePath } from "next/cache";
import { query, queryOne, withTransaction } from "@/lib/db";
import { requireAdminForAction } from "@/lib/auth";
import { assertYearOpen } from "@/lib/year-close";
import { writeAudit } from "@/lib/audit";

export type BankAccountInput = {
  name: string;
  bank_name: string | null;
  iban: string | null;
  notes: string | null;
  is_cash: boolean;
};

export type NewBankAccountInput = BankAccountInput & {
  /** Use this existing, unlinked chart account instead of creating one. */
  chart_account_no: number | null;
  opening_balance: number;
  opening_date: string;
  /** The account the opening balance is set against (usually Capital). Needed when opening_balance is not zero. */
  opening_counter_account_no: number | null;
};

/** Cash-type chart accounts not yet linked to any bank account -- candidates for "use an existing account". */
export async function listUnlinkedCashAccounts(): Promise<{ account_no: number; name: string }[]> {
  await requireAdminForAction();
  return query<{ account_no: number; name: string }>(
    `SELECT a.account_no, a.name FROM accounts a
     WHERE a.subgroup_no = 10 AND NOT EXISTS (SELECT 1 FROM bank_accounts ba WHERE ba.account_no = a.account_no)
     ORDER BY a.account_no`
  );
}

export async function createBankAccount(input: NewBankAccountInput): Promise<number> {
  const session = await requireAdminForAction();
  const name = input.name.trim();
  if (!name) throw new Error("Enter a name for the account.");
  if (input.opening_balance !== 0) {
    if (!input.opening_counter_account_no) throw new Error("Choose the account the opening balance is set against (for example Capital).");
    if (!input.opening_date) throw new Error("Enter the date of the opening balance.");
    await assertYearOpen(input.opening_date, session);
  }

  const id = await withTransaction(async (tx) => {
    let accountNo = input.chart_account_no;
    if (accountNo != null) {
      const taken = await tx.query("SELECT 1 FROM bank_accounts WHERE account_no = $1", [accountNo]);
      if (taken.rows.length) throw new Error(`Chart account ${accountNo} is already used by another bank account.`);
      const exists = await tx.query("SELECT 1 FROM accounts WHERE account_no = $1", [accountNo]);
      if (!exists.rows.length) throw new Error(`Chart account ${accountNo} does not exist.`);
    } else {
      const free = await tx.query<{ n: number }>(
        "SELECT n FROM generate_series(101, 999) n WHERE NOT EXISTS (SELECT 1 FROM accounts WHERE account_no = n) ORDER BY n LIMIT 1"
      );
      if (!free.rows[0]) throw new Error("No free account number left between 101 and 999.");
      accountNo = free.rows[0].n;
      await tx.query("INSERT INTO accounts (account_no, name, subgroup_no, is_reserved) VALUES ($1, $2, 10, true)", [accountNo, name]);
    }
    await tx.query("UPDATE accounts SET is_reserved = true WHERE account_no = $1", [accountNo]);

    const placeholderKey = `NEW-${crypto.randomUUID()}`;
    const created = await tx.query<{ id: number }>(
      `INSERT INTO bank_accounts (key, name, account_no, is_cash, bank_name, iban, notes)
       VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING id`,
      [placeholderKey, name, accountNo, input.is_cash, input.bank_name, input.iban, input.notes]
    );
    const newId = created.rows[0].id;
    await tx.query("UPDATE bank_accounts SET key = $2 WHERE id = $1", [newId, `ACC${newId}`]);

    if (input.opening_balance !== 0 && input.opening_counter_account_no) {
      const amount = Math.abs(input.opening_balance);
      const bankIsDebit = input.opening_balance > 0;
      const label = `Opening balance - ${name}`;
      await tx.query(
        "INSERT INTO opening_balances (date, account_no, description, debit, credit) VALUES ($1,$2,$3,$4,$5)",
        [input.opening_date, accountNo, label, bankIsDebit ? amount : 0, bankIsDebit ? 0 : amount]
      );
      await tx.query(
        "INSERT INTO opening_balances (date, account_no, description, debit, credit) VALUES ($1,$2,$3,$4,$5)",
        [input.opening_date, input.opening_counter_account_no, label, bankIsDebit ? 0 : amount, bankIsDebit ? amount : 0]
      );
    }
    return newId;
  });

  await writeAudit(session, "bank-account.create", `${name} (#${id})`);
  revalidatePath("/banking");
  revalidatePath("/opening-balance");
  revalidatePath("/chart-of-accounts");
  return id;
}

export async function updateBankAccount(id: number, input: BankAccountInput): Promise<void> {
  const session = await requireAdminForAction();
  const name = input.name.trim();
  if (!name) throw new Error("Enter a name for the account.");
  await withTransaction(async (tx) => {
    const row = await tx.query<{ account_no: number }>(
      `UPDATE bank_accounts SET name=$2, bank_name=$3, iban=$4, notes=$5, is_cash=$6 WHERE id=$1 RETURNING account_no`,
      [id, name, input.bank_name, input.iban, input.notes, input.is_cash]
    );
    if (!row.rows[0]) throw new Error("That bank account no longer exists.");
    // Keep the ledger account's name in step with the bank account.
    await tx.query("UPDATE accounts SET name = $2 WHERE account_no = $1", [row.rows[0].account_no, name]);
  });
  await writeAudit(session, "bank-account.update", `${name} (#${id})`);
  revalidatePath("/banking");
  revalidatePath("/chart-of-accounts");
}

/** Close an account (hide it from the register tabs and the entry forms). Its history stays in every report. */
export async function setBankAccountActive(id: number, active: boolean): Promise<void> {
  const session = await requireAdminForAction();
  if (!active) {
    const bal = await queryOne<{ balance: string; name: string }>(
      `SELECT ba.name,
              COALESCE((SELECT SUM(debit - credit) FROM opening_balances WHERE account_no = ba.account_no), 0)
            + COALESCE((SELECT SUM(in_amount + in_vat - out_amount - out_vat) FROM bank_transactions WHERE bank_account_id = ba.id), 0) AS balance
       FROM bank_accounts ba WHERE ba.id = $1`,
      [id]
    );
    if (bal && Math.abs(Number(bal.balance)) >= 0.005) {
      throw new Error(`${bal.name} still holds a balance. Transfer it to another account before closing this one.`);
    }
    const remaining = await queryOne<{ n: string }>("SELECT COUNT(*) AS n FROM bank_accounts WHERE active AND id <> $1", [id]);
    if (Number(remaining?.n ?? 0) === 0) throw new Error("At least one bank account has to stay open.");
  }
  await query("UPDATE bank_accounts SET active = $2 WHERE id = $1", [id, active]);
  await writeAudit(session, active ? "bank-account.reopen" : "bank-account.close", `#${id}`);
  revalidatePath("/banking");
}

/** Remove an account that has never been used. */
export async function deleteBankAccount(id: number): Promise<void> {
  const session = await requireAdminForAction();
  const used = await queryOne<{ n: string }>("SELECT COUNT(*) AS n FROM bank_transactions WHERE bank_account_id = $1", [id]);
  if (Number(used?.n ?? 0) > 0) throw new Error("This account has transactions, so it can only be closed, not deleted.");
  const row = await queryOne<{ account_no: number; name: string }>("DELETE FROM bank_accounts WHERE id = $1 RETURNING account_no, name", [id]);
  if (row) {
    // Drop its ledger account too when nothing else points at it; if something does, leave it be.
    try {
      await query("DELETE FROM accounts WHERE account_no = $1", [row.account_no]);
    } catch {
      /* still referenced (opening balance, journal ...) -- keep the account */
    }
    await writeAudit(session, "bank-account.delete", `${row.name} (#${id})`);
  }
  revalidatePath("/banking");
  revalidatePath("/chart-of-accounts");
}
