import { notFound } from "next/navigation";
import JournalEntryForm from "@/components/JournalEntryForm";
import { getJournalEntry } from "@/lib/actions/journal-actions";
import { updateJournalEntryFormAction } from "@/lib/actions/journal-form-actions";
import { listAllAccountOptions } from "@/lib/actions/reference-actions";
import { getClosedThroughYear } from "@/lib/year-close";

export default async function EditJournalEntryPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const entryId = Number(id);
  const [entry, accounts, closedThroughYear] = await Promise.all([getJournalEntry(entryId), listAllAccountOptions(), getClosedThroughYear()]);
  if (!entry) notFound();

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-2xl font-semibold text-primary">Edit journal entry</h1>
      <JournalEntryForm
        accounts={accounts}
        initial={entry}
        action={updateJournalEntryFormAction.bind(null, entryId)}
        submitLabel="Save entry"
        closedThroughYear={closedThroughYear}
      />
    </div>
  );
}
