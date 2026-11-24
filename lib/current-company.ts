// Which company this request is for: the `company` cookie set by the company picker.

import { cookies } from "next/headers";
import { COMPANY_COOKIE } from "./company-cookie";
import { getCompany, type Company } from "./companies";

export async function currentCompanySlug(): Promise<string | undefined> {
  return (await cookies()).get(COMPANY_COOKIE)?.value ?? process.env.ACCOUNTS_COMPANY;
}

export async function getCurrentCompany(): Promise<Company | undefined> {
  const slug = await currentCompanySlug();
  return slug ? getCompany(slug) : undefined;
}
