// The master administrator: one login that sits above all companies. It is the only one that can add
// companies, and it can open any company as that company's admin. Each company still has its own
// separate users (Settings > Users inside the company). Stored in <data dir>\admin.json.

import fs from "fs";
import path from "path";
import bcrypt from "bcryptjs";
import { SignJWT, jwtVerify } from "jose";
import { cookies } from "next/headers";
import { dataDir } from "./data-dir";
import { authSecretKey } from "./authSecret";
import { MASTER_COOKIE } from "./company-cookie";

type MasterRecord = { username: string; name: string; passwordHash: string };
export type Master = { username: string; name: string };

const file = () => path.join(dataDir(), "admin.json");

function read(): MasterRecord | null {
  try {
    return JSON.parse(fs.readFileSync(file(), "utf8")) as MasterRecord;
  } catch {
    return null;
  }
}

export function hasMasterAdmin(): boolean {
  return read() !== null;
}

export function createMasterAdmin(input: { username: string; name: string; password: string }): Master {
  if (hasMasterAdmin()) throw new Error("The administrator account already exists.");
  fs.mkdirSync(dataDir(), { recursive: true });
  const record: MasterRecord = { username: input.username, name: input.name, passwordHash: bcrypt.hashSync(input.password, 10) };
  fs.writeFileSync(file(), JSON.stringify(record, null, 2), "utf8");
  return { username: record.username, name: record.name };
}

export function verifyMaster(username: string, password: string): Master | null {
  const record = read();
  if (!record || record.username.toLowerCase() !== username.toLowerCase()) return null;
  return bcrypt.compareSync(password, record.passwordHash) ? { username: record.username, name: record.name } : null;
}

export async function createMasterSession(master: Master): Promise<void> {
  const token = await new SignJWT({ ...master }).setProtectedHeader({ alg: "HS256" }).setExpirationTime("7d").sign(authSecretKey());
  (await cookies()).set(MASTER_COOKIE, token, { httpOnly: true, sameSite: "lax", path: "/", maxAge: 60 * 60 * 24 * 7 });
}

export async function destroyMasterSession(): Promise<void> {
  (await cookies()).delete(MASTER_COOKIE);
}

export async function getMaster(): Promise<Master | null> {
  const token = (await cookies()).get(MASTER_COOKIE)?.value;
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, authSecretKey());
    const record = read();
    // The token only counts while that administrator still exists.
    if (!record || record.username !== payload.username) return null;
    return { username: record.username, name: record.name };
  } catch {
    return null;
  }
}
