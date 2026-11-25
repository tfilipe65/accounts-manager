"use server";

import { postPayroll, deletePayrollRun } from "@/lib/actions/payroll-actions";

export async function postPayrollFormAction(employeeId: number, _prev: { error?: string; success?: boolean } | undefined, fd: FormData) {
  const percent = (name: string) => Number(String(fd.get(name) || "0")) / 100;
  const bank = String(fd.get("pay_from_bank_account_id") || "");
  try {
    await postPayroll({
      employee_id: employeeId,
      date: String(fd.get("date") || ""),
      gross: Number(fd.get("gross") || 0),
      gross_detail: String(fd.get("gross_detail") || "") || null,
      irs_perc: percent("irs_perc"),
      employee_ss_perc: percent("employee_ss_perc"),
      employer_ss_perc: percent("employer_ss_perc"),
      pay_from_bank_account_id: bank ? Number(bank) : null,
    });
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Could not post the payroll." };
  }
  return { success: true };
}

export async function deletePayrollRunAction(entryId: string) {
  await deletePayrollRun(entryId);
}
