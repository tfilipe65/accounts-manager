import { getChecks } from "@/lib/actions/checks-actions";
import { getEffectiveReportingYear } from "@/lib/reporting-year";
import { formatMoney as fmt } from "@/lib/formatters";

export const dynamic = "force-dynamic";

const BADGE = {
  ok: "bg-green-100 text-green-800",
  warn: "bg-amber-100 text-amber-800",
  error: "bg-red-100 text-red-800",
} as const;
const BADGE_TEXT = { ok: "OK", warn: "Look at this", error: "Fix this" } as const;

export default async function ChecksPage() {
  const year = await getEffectiveReportingYear();
  const c = await getChecks(year);

  return (
    <div className="flex flex-col gap-8">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-primary">Checks</h1>
          <p className="text-sm text-neutral-600">Do the books agree with themselves, and does anything look wrong? Reporting year {year}.</p>
        </div>
        <span className={`rounded-full px-3 py-1 text-sm font-semibold ${c.problems === 0 ? "bg-green-100 text-green-800" : "bg-amber-100 text-amber-800"}`}>
          {c.problems === 0 ? "Everything checks out" : `${c.problems} thing${c.problems === 1 ? "" : "s"} to look at`}
        </span>
      </div>

      <section className="flex flex-col gap-2">
        <h2 className="text-lg font-semibold text-primary">Reconciliations</h2>
        <p className="text-sm text-neutral-600">Each line works the same figure out two independent ways. A difference means something was posted somewhere unexpected.</p>
        <div className="overflow-x-auto rounded-lg border border-line bg-surface">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-line bg-background text-left text-xs font-semibold uppercase tracking-wide text-neutral-600">
                <th className="px-4 py-2">Check</th>
                <th className="px-4 py-2 text-right">One way</th>
                <th className="px-4 py-2 text-right">Another way</th>
                <th className="px-4 py-2 text-right">Difference</th>
                <th className="px-4 py-2" />
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {c.reconciliations.map((r) => {
                const ok = Math.abs(r.difference) < 0.005;
                return (
                  <tr key={r.label} className="align-top">
                    <td className="px-4 py-2 font-medium">
                      {r.label}
                      {!ok && r.note && <div className="mt-0.5 text-xs font-normal text-neutral-500">{r.note}</div>}
                    </td>
                    <td className="px-4 py-2 text-right">
                      {fmt(r.left)}
                      <div className="text-xs text-neutral-500">{r.leftLabel}</div>
                    </td>
                    <td className="px-4 py-2 text-right">
                      {fmt(r.right)}
                      <div className="text-xs text-neutral-500">{r.rightLabel}</div>
                    </td>
                    <td className={`px-4 py-2 text-right font-semibold ${ok ? "" : "text-credit"}`}>{ok ? "—" : fmt(r.difference)}</td>
                    <td className="px-4 py-2 text-right">
                      <span className={`rounded px-1.5 py-0.5 text-xs font-semibold ${ok ? BADGE.ok : BADGE.error}`}>{ok ? "Agrees" : "Differs"}</span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>

      <section className="flex flex-col gap-2">
        <h2 className="text-lg font-semibold text-primary">Entries that look wrong</h2>
        <div className="flex flex-col gap-3">
          {c.dataChecks.map((d) => (
            <div key={d.key} className="rounded-lg border border-line bg-surface p-4">
              <div className="flex items-center justify-between gap-3">
                <h3 className="text-sm font-semibold text-primary">{d.title}</h3>
                <span className={`rounded px-1.5 py-0.5 text-xs font-semibold ${BADGE[d.status]}`}>
                  {d.status === "ok" ? BADGE_TEXT.ok : `${BADGE_TEXT[d.status]} (${d.count})`}
                </span>
              </div>
              <p className="mt-1 text-sm text-neutral-600">{d.detail}</p>
              {d.examples.length > 0 && (
                <ul className="mt-2 list-disc pl-5 text-xs text-neutral-700">
                  {d.examples.map((e) => (
                    <li key={e}>{e}</li>
                  ))}
                  {d.count > d.examples.length && <li className="list-none text-neutral-500">…and {d.count - d.examples.length} more</li>}
                </ul>
              )}
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
