// Client-side courtesy warning before writing a closed-year date -- the
// server-side block (lib/year-close.ts's assertYearOpen) is what actually
// enforces this; this just stops anyone (Admin included) from submitting a
// closed-year date without a heads-up first. Returns true if the submit
// should proceed (date isn't in a closed year, or the user confirmed anyway).
export function confirmClosedYearWrite(dateStr: string | null | undefined, closedThroughYear: number | null): boolean {
  if (!dateStr || closedThroughYear == null) return true;
  const year = Number(dateStr.slice(0, 4));
  if (!Number.isFinite(year) || year > closedThroughYear) return true;
  return window.confirm(
    `${year} is closed (everything through ${closedThroughYear} is locked). Only an Admin can save this -- continue anyway?`
  );
}
