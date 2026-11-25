"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { postPayrollFormAction } from "@/lib/actions/payroll-form-actions";
import { computePayroll, duodecimo, DEFAULT_EMPLOYEE_SS, DEFAULT_EMPLOYER_SS, DEFAULT_IRS } from "@/lib/payroll";
import { confirmClosedYearWrite } from "@/lib/year-close-client";
import { formatMoney as fmt } from "@/lib/formatters";

type FormState = { error?: string; success?: boolean } | undefined;

/** Post one month's pay for an employee: shows what the entry will contain before it is saved. */
export default function PayrollForm({
  employeeId,
  defaultGross,
  defaultDate,
  banks,
  closedThroughYear,
}: {
  employeeId: number;
  defaultGross: number | null;
  defaultDate: string;
  banks: { id: number; name: string }[];
  closedThroughYear: number | null;
}) {
  const [state, action, pending] = useActionState(postPayrollFormAction.bind(null, employeeId), undefined as FormState);
  const [base, setBase] = useState(defaultGross != null ? String(defaultGross) : "");
  // Holiday and Christmas pay as duodecimos: a twelfth of a month's salary each, paid with the monthly salary.
  const [useHoliday, setUseHoliday] = useState(true);
  const [useXmas, setUseXmas] = useState(true);
  const [holiday, setHoliday] = useState<string | null>(null);
  const [xmas, setXmas] = useState<string | null>(null);
  const baseN = Number(base) || 0;
  const holidayN = useHoliday ? (holiday != null ? Number(holiday) || 0 : duodecimo(baseN)) : 0;
  const xmasN = useXmas ? (xmas != null ? Number(xmas) || 0 : duodecimo(baseN)) : 0;
  const gross = String(Math.round((baseN + holidayN + xmasN) * 100) / 100);
  const detail = [
    `salary ${fmt(baseN)}`,
    holidayN ? `holiday duodecimo ${fmt(holidayN)}` : "",
    xmasN ? `Christmas duodecimo ${fmt(xmasN)}` : "",
  ].filter(Boolean).join(" + ");
  const [irs, setIrs] = useState(String(DEFAULT_IRS * 100));
  const [empSs, setEmpSs] = useState(String(DEFAULT_EMPLOYEE_SS * 100));
  const [erSs, setErSs] = useState(String(+(DEFAULT_EMPLOYER_SS * 100).toFixed(2)));
  const formRef = useRef<HTMLFormElement>(null);
  useEffect(() => {
    if (state?.success) formRef.current?.reset();
  }, [state]);

  const f = computePayroll(Number(gross) || 0, (Number(irs) || 0) / 100, (Number(empSs) || 0) / 100, (Number(erSs) || 0) / 100);

  return (
    <form
      ref={formRef}
      action={(fd) => {
        if (!confirmClosedYearWrite(String(fd.get("date") || ""), closedThroughYear)) return;
        action(fd);
      }}
      className="flex flex-col gap-3 rounded-lg border border-line bg-surface p-4"
    >
      <div className="grid grid-cols-2 gap-3 md:grid-cols-6">
        <Field label="Pay date">
          <input type="date" name="date" defaultValue={defaultDate} required className="input" />
        </Field>
        <Field label="Monthly salary">
          <input type="number" step="0.01" value={base} onChange={(e) => setBase(e.target.value)} required className="input" />
          <input type="hidden" name="gross" value={gross} />
          <input type="hidden" name="gross_detail" value={holidayN || xmasN ? detail : ""} />
        </Field>
        <Field label="IRS withheld %">
          <input type="number" step="0.01" name="irs_perc" value={irs} onChange={(e) => setIrs(e.target.value)} className="input" />
        </Field>
        <Field label="Employee social sec. %">
          <input type="number" step="0.01" name="employee_ss_perc" value={empSs} onChange={(e) => setEmpSs(e.target.value)} className="input" />
        </Field>
        <Field label="Employer social sec. %">
          <input type="number" step="0.01" name="employer_ss_perc" value={erSs} onChange={(e) => setErSs(e.target.value)} className="input" />
        </Field>
        <Field label="Pay the net pay from">
          <select name="pay_from_bank_account_id" defaultValue="" className="input">
            <option value="">Not yet (leave it owing)</option>
            {banks.map((b) => (
              <option key={b.id} value={b.id}>
                {b.name}
              </option>
            ))}
          </select>
        </Field>
      </div>

      <div className="grid grid-cols-1 gap-3 rounded bg-background p-3 text-sm md:grid-cols-3">
        <div className="flex items-center gap-2">
          <label className="flex items-center gap-2">
            <input type="checkbox" checked={useHoliday} onChange={(e) => setUseHoliday(e.target.checked)} />
            Holiday pay (duodecimo)
          </label>
          <input type="number" step="0.01" disabled={!useHoliday} value={useHoliday ? (holiday ?? String(duodecimo(baseN))) : ""} onChange={(e) => setHoliday(e.target.value)} className="input w-28" />
        </div>
        <div className="flex items-center gap-2">
          <label className="flex items-center gap-2">
            <input type="checkbox" checked={useXmas} onChange={(e) => setUseXmas(e.target.checked)} />
            Christmas pay (duodecimo)
          </label>
          <input type="number" step="0.01" disabled={!useXmas} value={useXmas ? (xmas ?? String(duodecimo(baseN))) : ""} onChange={(e) => setXmas(e.target.value)} className="input w-28" />
        </div>
        <div className="text-neutral-700">
          Gross pay this month: <span className="font-semibold text-primary">{fmt(Number(gross))}</span>
          <div className="text-[11px] text-neutral-500">A twelfth of a month&rsquo;s salary each, paid with the salary. Untick if they are paid as lump sums in June and November.</div>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-2 rounded bg-background p-3 text-sm md:grid-cols-5">
        <Figure label="Cost to the business" value={fmt(f.cost)} note="gross + employer social security" />
        <Figure label="Net pay to the employee" value={fmt(f.net)} note="gross - IRS - employee social security" />
        <Figure label="Owed for IRS" value={fmt(f.irs)} note="to the State" />
        <Figure label="Owed for social security" value={fmt(f.totalSs)} note="employee + employer share" />
        <Figure label="Employer social security" value={fmt(f.employerSs)} note="a cost of the business" />
      </div>

      {state?.error && <p className="text-sm text-red-700">{state.error}</p>}
      {state?.success && <p className="text-sm text-green-700">Payroll posted.</p>}
      <div className="flex items-center gap-4">
        <button type="submit" disabled={pending} className="rounded-md bg-primary px-4 py-2 text-sm font-semibold text-white hover:bg-primary-dark disabled:opacity-60">
          {pending ? "Posting…" : "Post payroll"}
        </button>
        <span className="text-xs text-neutral-500">
          Wages and social security become costs; what is owed to staff and the State is held on the balance sheet until you pay it. Pay the State on the
          Banks &amp; Cash page with a split payment (&ldquo;Pay the State&rdquo;).
        </span>
      </div>
    </form>
  );
}

function Figure({ label, value, note }: { label: string; value: string; note: string }) {
  return (
    <div className="flex flex-col">
      <span className="text-[11px] font-semibold uppercase tracking-wide text-neutral-500">{label}</span>
      <span className="font-semibold text-primary">{value}</span>
      <span className="text-[11px] text-neutral-500">{note}</span>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1">
      <label className="text-xs font-semibold uppercase tracking-wide text-neutral-600">{label}</label>
      {children}
    </div>
  );
}
