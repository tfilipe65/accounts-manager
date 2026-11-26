// The first digit of an account number is its group (1 Income ... 9 Financing and tax). Each group has a colour
// (used in the account lists) and a plain-language meaning of Debit and Credit (used in the Debit/Credit help).

export type AccountGroup = {
  label: string;
  rgb: string;
  /** What a Debit does to an account of this group, in plain words. */
  debit: string;
  /** What a Credit does. */
  credit: string;
};

export const ACCOUNT_GROUPS: Record<number, AccountGroup> = {
  1: { label: "Income", rgb: "37, 99, 235", debit: "income goes down (a refund or discount given)", credit: "income goes up (a sale)" },
  2: { label: "Cost of sales", rgb: "234, 88, 12", debit: "a cost is added", credit: "a cost goes down (a refund or return)" },
  3: { label: "Expenses", rgb: "249, 115, 22", debit: "an expense is added", credit: "an expense goes down (a refund)" },
  4: { label: "Current assets", rgb: "22, 163, 74", debit: "goes up (money or value comes in)", credit: "goes down (money or value goes out)" },
  5: { label: "Fixed assets", rgb: "13, 148, 136", debit: "goes up (something is bought)", credit: "goes down (sold or written off)" },
  6: { label: "Liabilities", rgb: "202, 138, 4", debit: "you owe less (you pay it off)", credit: "you owe more" },
  7: { label: "Loans", rgb: "161, 98, 7", debit: "you owe less (a repayment)", credit: "you owe more (you borrow)" },
  8: { label: "Equity", rgb: "147, 51, 234", debit: "owners' money goes down (a withdrawal or a loss)", credit: "owners' money goes up (money put in or a profit)" },
  9: { label: "Financing & tax", rgb: "219, 39, 119", debit: "a cost is added (interest, tax)", credit: "a cost goes down (a refund)" },
};

export const groupOf = (accountNo: number): AccountGroup | undefined => ACCOUNT_GROUPS[Math.floor(accountNo / 1000)];
