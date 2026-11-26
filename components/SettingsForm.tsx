"use client";

import { useActionState } from "react";
import { updateSettingsFormAction } from "@/lib/actions/settings-form-actions";
import type { AppSettings } from "@/lib/actions/settings-actions";
import type { AccountOption } from "@/lib/actions/reference-actions";
import AccountSelect from "@/components/AccountSelect";

export default function SettingsForm({ initial, accounts }: { initial: AppSettings; accounts: AccountOption[] }) {
  const [state, formAction, pending] = useActionState(updateSettingsFormAction, undefined);

  return (
    <form action={formAction} className="flex flex-col gap-4 rounded-lg border border-line bg-surface p-6">
      <div className="grid grid-cols-2 gap-4 md:grid-cols-3">
        <Field label="Company Name">
          <input name="company_name" defaultValue={initial.company_name} required className="input" />
        </Field>
        <Field label="VAT Number">
          <input name="vat_number" defaultValue={initial.vat_number ?? ""} className="input" />
        </Field>
        <Field label="Address">
          <input name="address" defaultValue={initial.address ?? ""} className="input" />
        </Field>
        <Field label="ZIP">
          <input name="zip" defaultValue={initial.zip ?? ""} className="input" />
        </Field>
        <Field label="City">
          <input name="city" defaultValue={initial.city ?? ""} className="input" />
        </Field>
        <Field label="Country">
          <input name="country" defaultValue={initial.country ?? ""} className="input" />
        </Field>
        <Field label="Bank Name">
          <input name="bank_name" defaultValue={initial.bank_name ?? ""} className="input" />
        </Field>
        <Field label="IBAN">
          <input name="iban" defaultValue={initial.iban ?? ""} className="input" />
        </Field>
        <Field label="BIC">
          <input name="bic" defaultValue={initial.bic ?? ""} className="input" />
        </Field>
        <Field label="Telephone">
          <input name="telephone" defaultValue={initial.telephone ?? ""} className="input" />
        </Field>
        <Field label="Email">
          <input name="email" defaultValue={initial.email ?? ""} className="input" />
        </Field>
        <Field label="Website">
          <input name="website" defaultValue={initial.website ?? ""} className="input" />
        </Field>
        <Field label="Currency">
          <input name="currency" defaultValue={initial.currency} className="input" />
        </Field>
        <Field label="Date Format">
          <input name="date_format" defaultValue={initial.date_format} className="input" />
        </Field>
        <Field label="Fiscal Year Start Month">
          <input type="number" min={1} max={12} name="fiscal_year_start_month" defaultValue={initial.fiscal_year_start_month} className="input" />
        </Field>
        <Field label="Reporting Year">
          <input type="number" name="reporting_year" defaultValue={initial.reporting_year} className="input" />
        </Field>
        <Field label="Default payment terms (days)">
          <input type="number" min={0} name="payment_term_days" defaultValue={initial.payment_term_days} className="input" />
        </Field>
        <Field label="What you call your clients">
          <input name="client_label" defaultValue={initial.client_label} className="input" />
        </Field>
        <Field label="What you call your projects">
          <input name="project_label" defaultValue={initial.project_label} className="input" />
        </Field>
        <Field label="Interest expense account (for interest cover)">
          <AccountSelect accounts={accounts} name="account_no_interest_expense" defaultValue={initial.account_no_interest_expense ?? ""} blankLabel="None" />
        </Field>
        <Field label="VAT return is filed">
          <select name="vat_return_period" defaultValue={initial.vat_return_period} className="input">
            <option value="quarterly">Quarterly</option>
            <option value="monthly">Monthly</option>
          </select>
        </Field>
        <Field label="VAT Rate 1">
          <input type="number" step="any" name="vat_rate_1" defaultValue={initial.vat_rate_1} className="input" />
        </Field>
        <Field label="VAT Rate 2">
          <input type="number" step="any" name="vat_rate_2" defaultValue={initial.vat_rate_2} className="input" />
        </Field>
        <Field label="VAT Rate 3">
          <input type="number" step="any" name="vat_rate_3" defaultValue={initial.vat_rate_3} className="input" />
        </Field>
        <Field label="VAT Rate 4">
          <input type="number" step="any" name="vat_rate_4" defaultValue={initial.vat_rate_4 ?? ""} className="input" />
        </Field>
      </div>

      {state?.error && <p className="text-sm text-red-700">{state.error}</p>}
      {state?.success && <p className="text-sm text-debit">Saved.</p>}

      <div>
        <button
          type="submit"
          disabled={pending}
          className="rounded-md bg-primary px-4 py-2 text-sm font-semibold text-white hover:bg-primary-dark disabled:opacity-60"
        >
          {pending ? "Saving…" : "Save settings"}
        </button>
      </div>
    </form>
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
