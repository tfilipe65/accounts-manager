// One-off generator: reads the cleaned TSV extracts pulled from
// Teia_Accounts.xlsb (analysis/seed/*_clean.tsv) and emits INSERT statements
// for the real master data (customers, suppliers, products, projects,
// opening balances). Not part of the app's runtime -- a migration aid, run
// once, output pasted into a Supabase execute_sql call.

import { readFileSync } from "fs";

const DIR = "C:\\Users\\tony\\OneDrive - Teia Firme Lda\\_ALGARVE BUILDERS\\CLAUDE AI\\AB ACCT\\analysis\\seed\\";

function sql(v) {
  if (v === undefined || v === null || v === "") return "NULL";
  return `'${String(v).replace(/'/g, "''")}'`;
}
function num(v) {
  if (v === undefined || v === null || v === "") return "NULL";
  const n = Number(v);
  return Number.isFinite(n) ? String(n) : "NULL";
}
function rows(file) {
  return readFileSync(DIR + file, "utf8")
    .replace(/^﻿/, "")
    .split(/\r?\n/)
    .filter((l) => l.trim() !== "")
    .map((l) => l.split("\t"));
}

const out = [];

// customers_clean.tsv: name,supplier#(ignore N/A here it's actually blank for customers),address,zip,city,country,contact,payment_term,telephone,email,vat,coc,intra,free1,free2
// Actual columns extracted (C..P): name,address,zip,city,country,contact,payment_term,telephone,email,vat,coc,intra,free1,free2 (14 cols, no # column for customers)
{
  const r = rows("customers_clean.tsv");
  const vals = r.map((c) => {
    const [name, address, zip, city, country, contact, payment_term, telephone, email, vat, coc, intra, free1, free2] = c;
    return `(${sql(name)}, ${sql(address)}, ${sql(zip)}, ${sql(city)}, ${sql(country)}, ${sql(contact)}, ${num(payment_term)}, ${sql(telephone)}, ${sql(email)}, ${sql(vat)}, ${sql(coc)}, ${sql(intra)}, ${sql(free1)}, ${sql(free2)})`;
  });
  out.push(
    `INSERT INTO customers (name, address, zip, city, country, contact, payment_term_days, telephone, email, vat_number, coc_number, intra_community, free_code_1, free_code_2) VALUES\n${vals.join(",\n")};`
  );
}

// suppliers_clean.tsv: name, supplier#(ignore), address, zip, city, country, contact, payment_term, telephone, email, vat, coc, intra, free1, free2 (15 cols)
{
  const r = rows("suppliers_clean.tsv");
  const vals = r.map((c) => {
    const [name, , address, zip, city, country, contact, payment_term, telephone, email, vat, coc, intra, free1, free2] = c;
    return `(${sql(name)}, ${sql(address)}, ${sql(zip)}, ${sql(city)}, ${sql(country)}, ${sql(contact)}, ${num(payment_term)}, ${sql(telephone)}, ${sql(email)}, ${sql(vat)}, ${sql(coc)}, ${sql(intra)}, ${sql(free1)}, ${sql(free2)})`;
  });
  out.push(
    `INSERT INTO suppliers (name, address, zip, city, country, contact, payment_term_days, telephone, email, vat_number, coc_number, intra_community, free_code_1, free_code_2) VALUES\n${vals.join(",\n")};`
  );
}

// products_clean.tsv: name, unit, price_ex_vat, vat_perc, free1, free2, free3 (7 cols)
{
  const r = rows("products_clean.tsv");
  const vals = r.map((c) => {
    const [name, unit, price, vatp, free1, free2, free3] = c;
    return `(${sql(name)}, ${sql(unit)}, ${num(price)}, ${num(vatp)}, ${sql(free1)}, ${sql(free2)}, ${sql(free3)})`;
  });
  out.push(`INSERT INTO products_services (name, unit, price_ex_vat, vat_perc, free_code_1, free_code_2, free_code_3) VALUES\n${vals.join(",\n")};`);
}

// projects_clean.tsv: code, name, start_date, end_date, free1, status (6 cols)
{
  const r = rows("projects_clean.tsv");
  const vals = r.map((c) => {
    const [code, name, start, end, free1, status] = c;
    return `(${sql(code)}, ${sql(name)}, ${start ? sql(start) : "NULL"}, ${end ? sql(end) : "NULL"}, ${sql(status)}, ${sql(free1)})`;
  });
  out.push(`INSERT INTO projects (code, name, start_date, end_date, status, free_code_1) VALUES\n${vals.join(",\n")};`);
}

// opening_balance_clean.tsv: date, account_no, account_name(ignore), description, debit, credit (6 cols)
{
  const r = rows("opening_balance_clean.tsv");
  const vals = r.map((c) => {
    const [date, accNo, , desc, debit, credit] = c;
    return `(${sql(date)}, ${num(accNo)}, ${sql(desc)}, ${debit ? num(debit) : 0}, ${credit ? num(credit) : 0})`;
  });
  out.push(`INSERT INTO opening_balances (date, account_no, description, debit, credit) VALUES\n${vals.join(",\n")};`);
}

console.log(out.join("\n\n"));
