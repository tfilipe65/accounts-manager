// Payroll arithmetic (Portugal), kept apart from the server actions so the form can show the same
// figures as the entry it will post. The rates are the usual ones and can be changed on every run.
//
//   Gross pay                          cost of the business (wages)
//   Employer social security (TSU)     cost of the business, about 23.75% of gross
//   Employee social security           withheld from the employee, 11% of gross
//   IRS withholding                    withheld from the employee, depends on the person (set per run)
//   Net pay                            gross - IRS - employee social security: what the employee receives
//
// The business owes the State the IRS withheld and ALL the social security (employee + employer share).

export const DEFAULT_EMPLOYEE_SS = 0.11;
export const DEFAULT_EMPLOYER_SS = 0.2375;
export const DEFAULT_IRS = 0.1;

export type PayrollFigures = {
  gross: number;
  irs: number;
  employeeSs: number;
  employerSs: number;
  net: number;
  /** Everything the business pays the social security: the employee's and the employer's share. */
  totalSs: number;
  /** What the pay costs the business: gross plus employer social security. */
  cost: number;
};

/**
 * Holiday pay and Christmas pay as duodecimos: instead of two lump sums a year (each one month's pay), a twelfth of
 * each is paid with every month's salary. They are ordinary pay for tax and social security, so they simply add to
 * the gross of that month and need no set-aside account.
 */
export function duodecimo(monthlySalary: number): number {
  return Math.round((monthlySalary / 12 + Number.EPSILON) * 100) / 100;
}

const r2 = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100;

export function computePayroll(gross: number, irsPerc: number, employeeSsPerc: number, employerSsPerc: number): PayrollFigures {
  const g = r2(gross);
  const irs = r2(g * irsPerc);
  const employeeSs = r2(g * employeeSsPerc);
  const employerSs = r2(g * employerSsPerc);
  return { gross: g, irs, employeeSs, employerSs, net: r2(g - irs - employeeSs), totalSs: r2(employeeSs + employerSs), cost: r2(g + employerSs) };
}
