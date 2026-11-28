// The sales tax is called IVA in Portugal and VAT in English. The company picks one in Settings; every screen is
// written with either word and passed through here so it shows the chosen one.

export type TaxLabel = "IVA" | "VAT";

export const taxify = (text: string, tax: TaxLabel): string => text.replace(/\b(VAT|IVA)\b/g, tax);
