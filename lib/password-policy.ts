// One rule for every password in the app (company users, the administrator, resets).

export const MIN_PASSWORD_LENGTH = 8;

/** Returns a message when the password is not acceptable, otherwise null. */
export function passwordProblem(password: string): string | null {
  if (password.length < MIN_PASSWORD_LENGTH) return `The password needs at least ${MIN_PASSWORD_LENGTH} characters.`;
  if (!/[A-Za-z]/.test(password) || !/[0-9]/.test(password)) return "Use both letters and numbers in the password.";
  return null;
}
