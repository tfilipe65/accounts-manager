"use server";

import { postYearEndStock, deleteYearEndStock } from "@/lib/actions/stock-actions";

export async function postYearEndStockFormAction(_prev: { error?: string; success?: boolean } | undefined, fd: FormData) {
  try {
    await postYearEndStock({ year: Number(fd.get("year")), value: Number(String(fd.get("value") || "").replace(",", ".")) });
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Could not post the stock count." };
  }
  return { success: true };
}

export async function deleteYearEndStockAction(year: number) {
  await deleteYearEndStock(year);
}
