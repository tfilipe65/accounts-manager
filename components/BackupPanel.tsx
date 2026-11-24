"use client";

import { useActionState } from "react";
import { backupNowAction, restoreBackupAction } from "@/lib/actions/backup-actions";
import type { BackupInfo } from "@/lib/backup";

type Result = { error?: string; success?: boolean; message?: string } | undefined;

function when(iso: string): string {
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? iso : d.toLocaleString("en-GB", { dateStyle: "medium", timeStyle: "short" });
}

const size = (b: number) => (b > 1048576 ? `${(b / 1048576).toFixed(1)} MB` : `${Math.max(1, Math.round(b / 1024))} KB`);

export default function BackupPanel({ backups, folder }: { backups: BackupInfo[]; folder: string }) {
  const [now, nowAction, nowPending] = useActionState(backupNowAction, undefined as Result);
  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-4 rounded-lg border border-line bg-surface p-4">
        <form action={nowAction}>
          <button type="submit" disabled={nowPending} className="rounded-md bg-primary px-4 py-2 text-sm font-semibold text-white hover:bg-primary-dark disabled:opacity-60">
            {nowPending ? "Backing up…" : "Back up now"}
          </button>
        </form>
        <p className="flex-1 text-sm text-neutral-600">
          This company&apos;s data lives only on this PC. A copy is made automatically the first time it is opened each day. To be safe against a lost or broken PC,
          copy the folder below to a USB stick or OneDrive now and then.
        </p>
      </div>
      {now?.error && <p className="text-sm text-red-700">{now.error}</p>}
      {now?.success && <p className="text-sm text-green-700">{now.message}</p>}
      <p className="break-all rounded bg-background px-3 py-2 font-mono text-xs text-neutral-700">{folder}</p>

      <div className="max-h-80 overflow-auto rounded-lg border border-line bg-surface">
        <table className="w-full text-sm">
          <thead className="sticky top-0">
            <tr className="border-b border-line bg-background text-left text-xs font-semibold uppercase tracking-wide text-neutral-600">
              <th className="px-4 py-2">When</th>
              <th className="px-4 py-2">File</th>
              <th className="px-4 py-2 text-right">Size</th>
              <th className="px-4 py-2" />
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {backups.map((b) => (
              <BackupRow key={b.file} backup={b} />
            ))}
            {backups.length === 0 && (
              <tr>
                <td colSpan={4} className="px-4 py-4 text-center text-neutral-500">
                  No backups yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function BackupRow({ backup }: { backup: BackupInfo }) {
  const [state, action, pending] = useActionState(restoreBackupAction.bind(null, backup.file), undefined as Result);
  return (
    <tr className="align-top">
      <td className="whitespace-nowrap px-4 py-1.5">{when(backup.at)}</td>
      <td className="px-4 py-1.5 text-xs text-neutral-600">{backup.file}</td>
      <td className="px-4 py-1.5 text-right text-neutral-600">{size(backup.bytes)}</td>
      <td className="px-4 py-1.5 text-right">
        <div className="flex items-center justify-end gap-3">
          <a href={`/settings/backup/download?file=${encodeURIComponent(backup.file)}`} className="text-xs text-primary hover:underline">
            Download
          </a>
          <form
            action={(fd) => {
              if (!confirm("Replace this company's current data with this backup? What is there now is backed up first, so you can go back.")) return;
              action(fd);
            }}
          >
            <button type="submit" disabled={pending} className="text-xs text-neutral-500 hover:text-red-700">
              {pending ? "Restoring…" : "Restore"}
            </button>
          </form>
        </div>
        {state?.error && <p className="mt-1 text-xs text-red-700">{state.error}</p>}
        {state?.success && <p className="mt-1 text-xs text-green-700">{state.message}</p>}
      </td>
    </tr>
  );
}
