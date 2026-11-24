"use client";

export default function PrintButton({ label = "Print / save as PDF" }: { label?: string }) {
  return (
    <button
      type="button"
      onClick={() => window.print()}
      className="rounded-md border border-line bg-surface px-3 py-1.5 text-sm font-medium text-primary hover:bg-background print:hidden"
    >
      {label}
    </button>
  );
}
