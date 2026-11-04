// Plain sync helpers for turning a reporting year into an "as of" cutoff --
// split out of reporting-year.ts because a "use server" file may only export
// async functions (these aren't Server Actions, just pure date math).

/** True if `year` is the real current calendar year (vs. a past year being browsed). */
export function isCurrentCalendarYear(year: number): boolean {
  return year === new Date().getFullYear();
}

/** Dec 31 of `year`, or null if `year` is the current calendar year -- the "as of" cutoff for point-in-time reports (null = no cutoff, as of now). */
export function reportingYearCutoffDate(year: number): string | null {
  if (isCurrentCalendarYear(year)) return null;
  return `${year}-12-31`;
}
