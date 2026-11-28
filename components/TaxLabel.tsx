"use client";

import { createContext, useContext } from "react";
import { taxify, type TaxLabel } from "@/lib/tax-label";

const Ctx = createContext<TaxLabel>("IVA");

/** Makes the company's choice (IVA or VAT) available to every client component. */
export function TaxLabelProvider({ tax, children }: { tax: TaxLabel; children: React.ReactNode }) {
  return <Ctx.Provider value={tax}>{children}</Ctx.Provider>;
}

/** `const tx = useTx();` then `tx("VAT %")` shows "IVA %" or "VAT %" as the company chose. */
export function useTx(): (text: string) => string {
  const tax = useContext(Ctx);
  return (text) => taxify(text, tax);
}
