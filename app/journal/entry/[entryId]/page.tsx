import { notFound } from "next/navigation";
import JournalEntryForm from "@/components/JournalEntryForm";
import { getJournalGroup } from "@/lib/actions/journal-actions";
import { listAllAccountOptions } from "@/lib/actions/reference-actions";
import { getClosedThroughYear } from "@/lib/year-close";
import { getRegisterDiffs } from "@/lib/actions/balance-diagnostics-actions";

export const dynamic = "force-dynamic";

export default async function EditJournalGroupPage({ params }: { params: Promise<{ entryId: string }> }) {
  const { entryId } = await params;
  const [lines, accounts, closedThroughYear, { journalDiff }] = await Promise.all([
    getJournalGroup(entryId),
    listAllAccountOptions(),
    getClosedThroughYear(),
    getRegisterDiffs(),
  ]);
  if (!lines) notFound();

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-2xl font-semibold text-primary">Edit multi-line journal entry</h1>
      <JournalEntryForm
        accounts={accounts}
        initialGroup={{ entryId, lines }}
        submitLabel="Save entry"
        closedThroughYear={closedThroughYear}
        registerDiff={journalDiff}
      />
    </div>
  );
}
