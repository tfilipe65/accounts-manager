// The audit log: who signed in, who changed users and bank accounts, and so on.
// Never throws -- a failure to log must not stop the thing being logged.

import { query } from "./db";

export async function writeAudit(user: { id: number; username: string } | null, action: string, detail?: string): Promise<void> {
  try {
    await query("INSERT INTO audit_log (user_id, username, action, detail) VALUES ($1,$2,$3,$4)", [
      user && user.id > 0 ? user.id : null,
      user?.username ?? null,
      action,
      detail ?? null,
    ]);
  } catch {
    // ignore
  }
}
