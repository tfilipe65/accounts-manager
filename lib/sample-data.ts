// Sample data, so the app can be seen working like a real business: clients, suppliers, projects,
// staff, invoices raised and paid (some late, some not yet), purchases, wages, VAT, bank transfers,
// petty cash, depreciation, from January of last year to today. Everything is made up.
//
// The numbers are generated from a seeded random series per company, so loading twice gives the same
// picture. Every entry goes through the same tables the screens use, so every report shows it.
//
// "Start fresh" (clearCompanyData) is the other half: it empties a company's entries and master data,
// keeping its chart of accounts, settings, bank accounts and logins, after taking a backup.

import type { Company } from "./companies";
import { openCompanyDatabase } from "./db";
import { createBackup } from "./backup";
import { SPLIT_SEPARATOR as SPLIT_NOTE } from "./banking-group";

type Tx = { query: (text: string, params?: unknown[]) => Promise<{ rows: any[] }> }; // eslint-disable-line @typescript-eslint/no-explicit-any

type Product = { name: string; unit: string; price: number; vat: number; weight?: number };
type Supplier = { name: string; city: string; account: number; net: [number, number]; vat: number; project?: boolean; what: string[] };
type Recurring = { name: string; city: string; account: number; net: number; vat: number; every: number; what: string };
type Staff = { name: string; position: string; salary: number; field: boolean };

type Profile = {
  prefix: string;
  scale: number; // opening balances and tax payments scale with the size of the business
  seasonal: number[];
  salesPerMonth: [number, number];
  documentType: "Invoice" | "Commission";
  useProjects: boolean;
  qty: [number, number];
  clients: string[];
  projects: { code: string; name: string; status: string }[];
  products: Product[];
  suppliers: Supplier[];
  purchasesPerMonth: [number, number];
  /** What the trading suppliers cost each month, as a share of that month's sales: costs follow work. */
  supplierRatio: number;
  recurring: Recurring[];
  staff: Staff[];
  /** A bank loan being repaid monthly: the instalment is split into principal, interest and fees. */
  loan?: { opening: number; instalment: number; yearlyRate: number; fee: number };
};

const FLAT = Array(12).fill(1);
const TOURISM = [0.7, 0.7, 0.85, 1, 1.1, 1.25, 1.35, 1.35, 1.15, 1, 0.8, 0.75];

const PROFILES: Record<string, Profile> = {
  "teia-firme": {
    prefix: "FT",
    supplierRatio: 0.62,
    scale: 1,
    seasonal: [0.8, 0.85, 1, 1.05, 1.1, 1.1, 1, 0.9, 1.1, 1.1, 1.05, 0.9],
    salesPerMonth: [4, 7],
    documentType: "Invoice",
    useProjects: true,
    qty: [1, 2],
    clients: ["António & Maria Santos", "Peter & Helen Brown", "João Carlos Mendes", "Sophie Laurent", "Hans Müller", "Ricardo Faria", "Algarve Villas Lda", "Mark & Linda Taylor"],
    projects: [
      { code: "VIL", name: "Vilamoura villa extension", status: "In Progress" },
      { code: "LAG", name: "Lagos apartment renovation", status: "In Progress" },
      { code: "CAR", name: "Carvoeiro new build", status: "In Progress" },
      { code: "TAV", name: "Tavira restaurant refit", status: "Completed" },
      { code: "ALB", name: "Albufeira pool and terrace", status: "Guarantee Period" },
    ],
    products: [
      { name: "Building works - stage payment", unit: "stage", price: 9500, vat: 0.23 },
      { name: "Renovation labour", unit: "day", price: 190, vat: 0.06 },
      { name: "Project management", unit: "month", price: 1200, vat: 0.23 },
      { name: "Materials supply", unit: "lot", price: 3400, vat: 0.23 },
    ],
    suppliers: [
      { name: "Materiais de Construção Silves Lda", city: "Silves", account: 2101, net: [800, 9000], vat: 0.23, project: true, what: ["Cement, blocks and sand", "Bricks and steel mesh", "Tiles and adhesive"] },
      { name: "Cimentos do Sul SA", city: "Faro", account: 2101, net: [1200, 6500], vat: 0.23, project: true, what: ["Ready-mix concrete delivery", "Concrete screed"] },
      { name: "Electro Algarve Lda", city: "Loulé", account: 2201, net: [1500, 7000], vat: 0.23, project: true, what: ["Electrical installation", "Electrical first and second fix"] },
      { name: "Canalizações Faro Lda", city: "Faro", account: 2201, net: [900, 5200], vat: 0.23, project: true, what: ["Plumbing installation", "Bathroom plumbing"] },
      { name: "Pinturas Lagos Unipessoal", city: "Lagos", account: 2201, net: [1100, 4800], vat: 0.23, project: true, what: ["Interior painting", "Exterior rendering and painting"] },
      { name: "Aluguer de Máquinas Loulé", city: "Loulé", account: 2203, net: [300, 2500], vat: 0.23, project: true, what: ["Excavator hire", "Scaffolding hire"] },
      { name: "Ferragens Central Lda", city: "Portimão", account: 2204, net: [100, 900], vat: 0.23, project: true, what: ["Fixings and tools", "Consumables"] },
      { name: "Ecoresíduos Algarve", city: "Olhão", account: 2205, net: [150, 650], vat: 0.23, project: true, what: ["Skip hire and waste removal"] },
    ],
    purchasesPerMonth: [16, 22],
    recurring: [
      { name: "Imobiliária Almancil", city: "Almancil", account: 3201, net: 850, vat: 0.23, every: 1, what: "Office and yard rent" },
      { name: "Leasing Automóvel Millennium", city: "Lisboa", account: 3201, net: 640, vat: 0.23, every: 1, what: "Van lease instalment" },
      { name: "Contabilidade Silva & Associados", city: "Faro", account: 3401, net: 320, vat: 0.23, every: 1, what: "Monthly accounting fee" },
      { name: "Fidelidade Seguros", city: "Lisboa", account: 3404, net: 410, vat: 0, every: 3, what: "Builders insurance quarter" },
      { name: "MEO Empresas", city: "Lisboa", account: 3203, net: 89, vat: 0.23, every: 1, what: "Telephone and internet" },
      { name: "EDP Comercial", city: "Lisboa", account: 3202, net: 214, vat: 0.23, every: 1, what: "Office electricity" },
      { name: "Primavera Software", city: "Braga", account: 3403, net: 65, vat: 0.23, every: 1, what: "Software subscription" },
    ],
    loan: { opening: 24000, instalment: 520, yearlyRate: 0.058, fee: 4.5 },
    staff: [
      { name: "Carlos Pereira", position: "Site foreman", salary: 1450, field: true },
      { name: "Nuno Ferreira", position: "Carpenter", salary: 1150, field: true },
      { name: "Paulo Gomes", position: "Carpenter", salary: 1150, field: true },
      { name: "Rui Santos", position: "Labourer", salary: 920, field: true },
      { name: "Hélder Dias", position: "Labourer", salary: 920, field: true },
      { name: "Fernando Lopes", position: "Bricklayer", salary: 1050, field: true },
      { name: "Ana Costa", position: "Office administrator", salary: 1100, field: false },
    ],
  },
  woodgrain: {
    prefix: "WG",
    supplierRatio: 0.55,
    scale: 0.35,
    seasonal: FLAT,
    salesPerMonth: [3, 5],
    documentType: "Invoice",
    useProjects: true,
    qty: [1, 2],
    clients: ["Hotel Mar Azul Lda", "Isabel Cardoso", "Michael & Jane Wright", "Quinta do Lago Residences", "Bruno Almeida", "Claire Dubois"],
    projects: [
      { code: "KIT", name: "Kitchen - Quinta do Lago", status: "In Progress" },
      { code: "WAR", name: "Fitted wardrobes - Vale do Lobo", status: "In Progress" },
      { code: "DOR", name: "Hotel doors and frames", status: "Completed" },
      { code: "PER", name: "Pergola - Tavira", status: "In Progress" },
    ],
    products: [
      { name: "Custom kitchen", unit: "job", price: 4500, vat: 0.23 },
      { name: "Fitted wardrobe", unit: "unit", price: 1400, vat: 0.23 },
      { name: "Doors and frames", unit: "set", price: 420, vat: 0.23 },
      { name: "Repairs and restoration", unit: "hour", price: 38, vat: 0.23 },
    ],
    suppliers: [
      { name: "Madeiras do Barrocal Lda", city: "Loulé", account: 2102, net: [500, 4200], vat: 0.23, project: true, what: ["Oak boards", "MDF and plywood sheets", "Solid pine"] },
      { name: "Ferragens e Acessórios do Sul", city: "Faro", account: 2103, net: [90, 800], vat: 0.23, project: true, what: ["Hinges, slides and handles", "Screws and fixings"] },
      { name: "Tintas e Vernizes Algarve", city: "Portimão", account: 2104, net: [80, 600], vat: 0.23, project: true, what: ["Varnish and stain", "Sealer and paint"] },
      { name: "Vidraria Sul Lda", city: "Albufeira", account: 2201, net: [150, 1100], vat: 0.23, project: true, what: ["Glass panels", "Mirror doors"] },
    ],
    purchasesPerMonth: [6, 10],
    recurring: [
      { name: "Imobiliária Almancil", city: "Almancil", account: 3201, net: 600, vat: 0.23, every: 1, what: "Workshop rent" },
      { name: "Contabilidade Silva & Associados", city: "Faro", account: 3401, net: 180, vat: 0.23, every: 1, what: "Monthly accounting fee" },
      { name: "Allianz Seguros", city: "Lisboa", account: 3404, net: 160, vat: 0, every: 3, what: "Workshop insurance quarter" },
      { name: "EDP Comercial", city: "Lisboa", account: 3202, net: 260, vat: 0.23, every: 1, what: "Workshop electricity" },
      { name: "NOS Empresas", city: "Lisboa", account: 3203, net: 55, vat: 0.23, every: 1, what: "Telephone and internet" },
    ],
    loan: { opening: 6000, instalment: 190, yearlyRate: 0.065, fee: 3.5 },
    staff: [
      { name: "Joaquim Mendes", position: "Master carpenter", salary: 1300, field: true },
      { name: "Tiago Ramos", position: "Carpenter's assistant", salary: 950, field: true },
    ],
  },
  "algarve-interior": {
    prefix: "AI",
    supplierRatio: 0.55,
    scale: 0.3,
    seasonal: [0.7, 0.8, 1, 1.1, 1.2, 1.1, 0.9, 0.8, 1.1, 1.2, 1, 0.8],
    salesPerMonth: [3, 5],
    documentType: "Invoice",
    useProjects: true,
    qty: [1, 4],
    clients: ["Villa Horizonte Lda", "Catherine Murray", "Pedro & Inês Rocha", "Sunset Rentals Algarve", "Olaf Jensen", "Beatriz Nogueira"],
    projects: [
      { code: "HOR", name: "Villa Horizonte styling", status: "In Progress" },
      { code: "MUR", name: "Murray apartment refresh", status: "Completed" },
      { code: "ROC", name: "Rocha family home", status: "In Progress" },
      { code: "SUN", name: "Sunset Rentals staging", status: "In Progress" },
    ],
    products: [
      { name: "Interior design consultancy", unit: "hour", price: 75, vat: 0.23 },
      { name: "Soft furnishings supply", unit: "lot", price: 1400, vat: 0.23 },
      { name: "Curtains and blinds", unit: "set", price: 520, vat: 0.23 },
      { name: "Staging for rental", unit: "property", price: 2200, vat: 0.23 },
    ],
    suppliers: [
      { name: "Têxteis do Sul Lda", city: "Faro", account: 2105, net: [300, 2400], vat: 0.23, project: true, what: ["Curtain fabric", "Upholstery fabric", "Cushions and throws"] },
      { name: "Iluminação Moderna Lda", city: "Loulé", account: 2105, net: [200, 1800], vat: 0.23, project: true, what: ["Pendant lights", "Lamps and shades"] },
      { name: "Mobiliário Casa Bela", city: "Almancil", account: 2105, net: [400, 3500], vat: 0.23, project: true, what: ["Sofa and armchairs", "Dining table and chairs"] },
      { name: "Atelier de Costura Maria", city: "Tavira", account: 2201, net: [120, 900], vat: 0.23, project: true, what: ["Curtain making", "Upholstery work"] },
    ],
    purchasesPerMonth: [5, 8],
    recurring: [
      { name: "Contabilidade Silva & Associados", city: "Faro", account: 3401, net: 150, vat: 0.23, every: 1, what: "Monthly accounting fee" },
      { name: "MEO Empresas", city: "Lisboa", account: 3203, net: 45, vat: 0.23, every: 1, what: "Telephone and internet" },
      { name: "Adobe", city: "Dublin", account: 3403, net: 58, vat: 0.23, every: 1, what: "Design software" },
      { name: "Imobiliária Almancil", city: "Almancil", account: 3201, net: 450, vat: 0.23, every: 1, what: "Studio rent" },
    ],
    staff: [
      { name: "Marta Lopes", position: "Interior designer", salary: 1250, field: false },
      { name: "Inês Duarte", position: "Showroom assistant", salary: 950, field: false },
    ],
  },
  "casas-algarve": {
    prefix: "CA",
    supplierRatio: 0.12,
    scale: 0.5,
    seasonal: TOURISM,
    salesPerMonth: [16, 24],
    documentType: "Commission",
    useProjects: true,
    qty: [1, 1],
    clients: ["Joanne Whitfield", "David Brennan", "Thomas Keller", "Stay Well Lifestyle LLC", "Julie Garner", "Mexia Investimentos Lda", "Rowena Hartley", "Pedro Matos"],
    projects: [
      { code: "AZU", name: "Casa Azul - Albufeira", status: "In Progress" },
      { code: "MAR", name: "Villa Mar - Carvoeiro", status: "In Progress" },
      { code: "PIN", name: "Quinta do Pinhal - Loulé", status: "In Progress" },
      { code: "MRN", name: "Apartamento Marina - Vilamoura", status: "In Progress" },
      { code: "SOL", name: "Casa do Sol - Tavira", status: "In Progress" },
      { code: "PAL", name: "Vila das Palmeiras - Lagos", status: "In Progress" },
    ],
    products: [
      { name: "Rental management commission", unit: "month", price: 700, vat: 0.23, weight: 4 },
      { name: "Guest check-in service", unit: "stay", price: 55, vat: 0.23 },
      { name: "Maintenance coordination fee", unit: "job", price: 90, vat: 0.23 },
      { name: "Annual property inspection", unit: "visit", price: 140, vat: 0.23 },
    ],
    suppliers: [
      { name: "Limpezas Brilho Lda", city: "Albufeira", account: 2206, net: [60, 420], vat: 0.23, project: true, what: ["Turnaround cleaning", "Deep clean before arrival"] },
      { name: "Lavandaria Algarvia", city: "Loulé", account: 2206, net: [40, 260], vat: 0.23, project: true, what: ["Linen and towel laundry"] },
      { name: "Piscinas Cristal Unipessoal", city: "Albufeira", account: 2207, net: [70, 180], vat: 0.23, project: true, what: ["Pool maintenance"] },
      { name: "Jardins & Cia", city: "Loulé", account: 2207, net: [50, 220], vat: 0.23, project: true, what: ["Garden maintenance"] },
      { name: "Eletricista João Dias", city: "Faro", account: 2208, net: [60, 480], vat: 0.23, project: true, what: ["Electrical repair", "Light fittings replaced"] },
      { name: "Canalizador Paulo Nunes", city: "Lagos", account: 2208, net: [55, 380], vat: 0.23, project: true, what: ["Plumbing repair", "Water heater service"] },
    ],
    purchasesPerMonth: [10, 15],
    recurring: [
      { name: "Contabilidade Silva & Associados", city: "Faro", account: 3401, net: 280, vat: 0.23, every: 1, what: "Monthly accounting fee" },
      { name: "Fidelidade Seguros", city: "Lisboa", account: 3404, net: 190, vat: 0, every: 3, what: "Business insurance quarter" },
      { name: "MEO Empresas", city: "Lisboa", account: 3203, net: 79, vat: 0.23, every: 1, what: "Telephone and internet" },
      { name: "Bookingsoft", city: "Porto", account: 3403, net: 120, vat: 0.23, every: 1, what: "Reservation system" },
      { name: "Imobiliária Almancil", city: "Almancil", account: 3201, net: 650, vat: 0.23, every: 1, what: "Office rent" },
    ],
    staff: [
      { name: "Sofia Martins", position: "Property manager", salary: 1300, field: false },
      { name: "Paula Reis", position: "Housekeeper", salary: 900, field: false },
    ],
  },
  "casas-algarve-clients": {
    prefix: "CC",
    supplierRatio: 0.04,
    scale: 0.15,
    seasonal: TOURISM,
    salesPerMonth: [2, 4],
    documentType: "Invoice",
    useProjects: false,
    qty: [1, 1],
    clients: ["Joanne Whitfield", "David Brennan", "Thomas Keller", "Julie Garner"],
    projects: [],
    products: [{ name: "Owner account administration", unit: "month", price: 45, vat: 0.23 }],
    suppliers: [{ name: "Banco Comercial Algarve", city: "Faro", account: 3408, net: [10, 40], vat: 0, what: ["Account and transfer charges"] }],
    purchasesPerMonth: [1, 2],
    recurring: [],
    staff: [],
  },
};

const DEFAULT_PROFILE = PROFILES["teia-firme"];

// ---------------------------------------------------------------------------------------------

function seeded(seedText: string) {
  let h = 1779033703;
  for (let i = 0; i < seedText.length; i++) h = Math.imul(h ^ seedText.charCodeAt(i), 3432918353);
  let a = (h ^ (h >>> 16)) >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const r2 = (n: number) => Math.round(n * 100) / 100;
const iso = (y: number, m: number, d: number) => `${y}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
const addDays = (date: string, days: number) => new Date(Date.parse(date + "T00:00:00Z") + days * 86400000).toISOString().slice(0, 10);
const MONTH_NAMES = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

type BankIds = { check: { id: number; account_no: number }; iva: { id: number; account_no: number }; petty: { id: number; account_no: number } };

async function generate(tx: Tx, company: Company, profile: Profile, today: string): Promise<string> {
  const rnd = seeded(company.slug);
  const int = (a: number, b: number) => Math.floor(a + rnd() * (b - a + 1));
  const between = (a: number, b: number) => a + rnd() * (b - a);
  const pick = <T,>(items: T[]): T => items[Math.floor(rnd() * items.length)];
  const chance = (p: number) => rnd() < p;
  const ok = (date: string) => date <= today;

  // ---- what this company's chart and banks look like ----
  const accountSet = new Set<number>((await tx.query("SELECT account_no FROM accounts")).rows.map((r) => Number(r.account_no)));
  const has = (n: number) => accountSet.has(n);
  const roleNo = async (role: string): Promise<number> => Number((await tx.query("SELECT account_no FROM accounts WHERE role = $1 ORDER BY account_no LIMIT 1", [role])).rows[0]?.account_no ?? 0);
  const banks = (await tx.query("SELECT id, account_no, is_cash FROM bank_accounts WHERE active ORDER BY is_cash, id")).rows as { id: number; account_no: number; is_cash: boolean }[];
  const real = banks.filter((b) => !b.is_cash);
  const cash = banks.filter((b) => b.is_cash);
  if (real.length === 0) throw new Error("This company has no bank account to book the sample payments to.");
  const bank: BankIds = {
    check: real[0],
    iva: real[1] ?? real[0],
    petty: cash[0] ?? real[0],
  };
  const revenue = Number((await tx.query("SELECT account_no_sales FROM app_settings WHERE id = 1")).rows[0]?.account_no_sales ?? 0);
  if (!revenue) throw new Error("The chart of accounts has no default sales account, so the sample sales cannot be booked.");
  const safe = (n: number, fallback: number) => (has(n) ? n : fallback);
  const A = {
    capital: await roleNo("share_capital"),
    equipment: safe(5102, safe(5104, 0)),
    accumulated: safe(5201, 0),
    depreciation: safe(3601, 0),
    loan: await roleNo("loan_principal"),
    interest: await roleNo("interest_expense"),
    wagesDirect: await roleNo("wages_direct"),
    wagesOffice: await roleNo("wages_office"),
    employerDirect: await roleNo("employer_social_security_direct"),
    employerOffice: await roleNo("employer_social_security_office"),
    netPay: await roleNo("net_pay_payable"),
    withholding: await roleNo("withholding_payable"),
    social: await roleNo("social_security_payable"),
    bankFees: await roleNo("bank_charges"),
    fuel: safe(3301, 0),
    tolls: safe(3303, 0),
    office: safe(3402, 0),
    meals: safe(3407, 0),
    incomeTax: safe(4301, 0),
    vatSettled: await roleNo("vat_settlement"),
    transfers: await roleNo("transfers_clearing"),
  };

  // ---- master data ----
  const idOf = async (sql: string, params: unknown[]): Promise<number> => Number((await tx.query(sql, params)).rows[0].id);
  const nif = () => String(int(200000000, 299999999));
  const email = (name: string) => `${name.toLowerCase().normalize("NFD").replace(/[^a-z]+/g, ".").replace(/^\.|\.$/g, "")}@example.com`;
  const phone = () => `9${int(10000000, 39999999)}`;

  const clients: { id: number; name: string; weight: number }[] = [];
  for (const [i, name] of profile.clients.entries()) {
    const id = await idOf(
      `INSERT INTO customers (name, city, country, payment_term_days, telephone, email, vat_number) VALUES ($1,$2,'Portugal',$3,$4,$5,$6) RETURNING id`,
      [name, pick(["Albufeira", "Lagos", "Loulé", "Faro", "Tavira", "Vilamoura", "Carvoeiro"]), pick([15, 30, 30, 30, 45]), phone(), email(name), nif()]
    );
    clients.push({ id, name, weight: i < 3 ? 3 : 1 });
  }
  const suppliers: { id: number; s: Supplier; used: Set<string> }[] = [];
  for (const s of profile.suppliers) {
    const id = await idOf(
      `INSERT INTO suppliers (name, city, country, payment_term_days, telephone, email, vat_number) VALUES ($1,$2,'Portugal',$3,$4,$5,$6) RETURNING id`,
      [s.name, s.city, pick([15, 30, 30, 45]), phone(), email(s.name), String(int(500000000, 509999999))]
    );
    suppliers.push({ id, s, used: new Set() });
  }
  const recurring: { id: number; r: Recurring }[] = [];
  for (const r of profile.recurring) {
    const existing = suppliers.find((x) => x.s.name === r.name);
    const id =
      existing?.id ??
      (await idOf(`INSERT INTO suppliers (name, city, country, payment_term_days, vat_number) VALUES ($1,$2,'Portugal',30,$3) RETURNING id`, [r.name, r.city, String(int(500000000, 509999999))]));
    recurring.push({ id, r });
  }
  const projects: { id: number; code: string }[] = [];
  for (const [i, p] of profile.projects.entries()) {
    const id = await idOf(`INSERT INTO projects (code, name, start_date, status) VALUES ($1,$2,$3,$4) RETURNING id`, [p.code, p.name, iso(2024, 6 + (i % 6), 1), p.status]);
    projects.push({ id, code: p.code });
  }
  const products: { id: number; p: Product }[] = [];
  for (const p of profile.products) {
    products.push({ id: await idOf(`INSERT INTO products_services (name, unit, price_ex_vat, vat_perc) VALUES ($1,$2,$3,$4) RETURNING id`, [p.name, p.unit, p.price, p.vat]), p });
  }
  const staff: { id: number; s: Staff }[] = [];
  for (const s of profile.staff) {
    staff.push({
      id: await idOf(
        `INSERT INTO employees (name, position, vat_number, country, telephone, email, start_date, monthly_salary, status, cost_type) VALUES ($1,$2,$3,'Portugal',$4,$5,$6,$7,'Active',$8) RETURNING id`,
        [s.name, s.position, nif(), phone(), email(s.name), iso(2024, int(1, 9), int(1, 28)), s.salary, s.field && A.wagesDirect ? "direct" : "office"]
      ),
      s,
    });
  }

  // ---- opening balances at the start of last year (balanced: banks and equipment against capital) ----
  const lastYear = Number(today.slice(0, 4)) - 1;
  const start = iso(lastYear, 1, 1);
  const openingRows: [number, number][] = [
    [bank.check.account_no, Math.round(18000 * profile.scale)],
    [bank.petty.account_no, 250],
  ];
  if (bank.iva.account_no !== bank.check.account_no) openingRows.push([bank.iva.account_no, Math.round(3500 * profile.scale)]);
  if (A.equipment) openingRows.push([A.equipment, Math.round(14000 * profile.scale)]);
  let openingTotal = 0;
  for (const [acct, amount] of openingRows) {
    await tx.query(`INSERT INTO opening_balances (date, account_no, description, debit, credit) VALUES ($1,$2,'Opening balance',$3,0)`, [start, acct, amount]);
    openingTotal += amount;
  }
  // a bank loan still being repaid at the start is a liability: the owners' capital is what is left
  const loan = profile.loan && A.loan && A.interest && A.bankFees ? profile.loan : null;
  let loanBalance = loan?.opening ?? 0;
  if (loan) await tx.query(`INSERT INTO opening_balances (date, account_no, description, debit, credit) VALUES ($1,$2,'Opening balance: bank loan',0,$3)`, [start, A.loan, loan.opening]);
  if (A.capital) await tx.query(`INSERT INTO opening_balances (date, account_no, description, debit, credit) VALUES ($1,$2,'Opening balance',0,$3)`, [start, A.capital, openingTotal - loanBalance]);

  // ---- the months ----
  const bankIn = async (b: { id: number }, date: string, description: string, link: { sales?: number; purchase?: number; account?: number }, inn: number, inVat: number, out: number, outVat: number, extra: { employee?: number; vat?: number } = {}) =>
    tx.query(
      `INSERT INTO bank_transactions (bank_account_id, payment_date, description, sales_invoice_id, purchase_invoice_id, account_no, employee_id, vat_perc, in_amount, in_vat, out_amount, out_vat)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)`,
      [b.id, date, description, link.sales ?? null, link.purchase ?? null, link.account ?? null, extra.employee ?? null, extra.vat ?? null, r2(inn), r2(inVat), r2(out), r2(outVat)]
    );

  const transfer = async (from: { id: number }, to: { id: number }, date: string, amount: number, tag: string, note: string) => {
    const tid = `sample-${company.slug}-${tag}`;
    await tx.query(
      `INSERT INTO bank_transactions (bank_account_id, payment_date, description, account_no, out_amount, transfer_id) VALUES ($1,$2,$3,$4,$5,$6)`,
      [from.id, date, `Transfer to ${note}`, A.transfers, r2(amount), tid]
    );
    await tx.query(
      `INSERT INTO bank_transactions (bank_account_id, payment_date, description, account_no, in_amount, transfer_id) VALUES ($1,$2,$3,$4,$5,$6)`,
      [to.id, date, `Transfer from ${note === "petty cash" ? "bank" : "current account"}`, A.transfers, r2(amount), tid]
    );
  };

  const [ty, tm] = [Number(today.slice(0, 4)), Number(today.slice(5, 7))];
  const months: [number, number][] = [];
  for (let y = lastYear; y <= ty; y++) for (let m = 1; m <= 12; m++) if (y < ty || m <= tm) months.push([y, m]);

  const usedNumbers = new Set<string>();
  const salesSeq: Record<number, number> = {};
  const vatOut = new Map<string, number>();
  const vatIn = new Map<string, number>();
  const addVat = (map: Map<string, number>, key: string, v: number) => map.set(key, (map.get(key) ?? 0) + v);
  const payrollDue = new Map<string, { irs: number; ss: number }>();
  let salesCount = 0;
  let purchaseCount = 0;
  let paymentCount = 0;

  const weightedProduct = () => {
    const total = products.reduce((t, p) => t + (p.p.weight ?? 1), 0);
    let x = rnd() * total;
    for (const p of products) if ((x -= p.p.weight ?? 1) <= 0) return p;
    return products[0];
  };

  const weightedClient = () => {
    const total = clients.reduce((s, c) => s + c.weight, 0);
    let x = rnd() * total;
    for (const c of clients) if ((x -= c.weight) <= 0) return c;
    return clients[0];
  };

  const raiseSales = async (date: string, docType: string, client: { id: number }, lines: { product: { id: number; p: Product }; qty: number; price: number; project: number | null; subject: string }[], numberPrefix: string) => {
    const y = Number(date.slice(0, 4));
    salesSeq[y] = (salesSeq[y] ?? 0) + 1;
    const number = `${numberPrefix} ${y}/${String(salesSeq[y]).padStart(4, "0")}`;
    const id = await idOf(`INSERT INTO sales_invoices (invoice_number, date, doc_type, customer_id) VALUES ($1,$2,$3,$4) RETURNING id`, [number, date, docType, client.id]);
    let net = 0;
    let vat = 0;
    for (const [i, l] of lines.entries()) {
      await tx.query(
        `INSERT INTO sales_invoice_lines (sales_invoice_id, line_no, product_service_id, subject, quantity, price_ex_vat, vat_perc, discount_perc, account_no, project_id)
         VALUES ($1,$2,$3,$4,$5,$6,$7,0,$8,$9)`,
        [id, i + 1, l.product.id, l.subject, l.qty, l.price, l.product.p.vat, revenue, l.project]
      );
      net += l.qty * l.price;
      vat += l.qty * l.price * l.product.p.vat;
    }
    return { id, number, net: r2(net), vat: r2(vat), gross: r2(net + vat) };
  };

  for (const [y, m] of months) {
    const key = `${y}-${m}`;
    const monthEnd = iso(y, m, 28);
    const season = profile.seasonal[m - 1];

    // -- sales invoices, and the money that comes in against them --
    let monthNetSales = 0;
    const nSales = Math.max(1, Math.round(int(profile.salesPerMonth[0], profile.salesPerMonth[1]) * season));
    for (let i = 0; i < nSales; i++) {
      const date = iso(y, m, int(1, 27));
      if (!ok(date)) continue;
      const client = weightedClient();
      const lineCount = profile.documentType === "Commission" ? 1 : int(1, 2);
      const lines = Array.from({ length: lineCount }, () => {
        const product = weightedProduct();
        const project = profile.useProjects && projects.length ? pick(projects).id : null;
        const projectName = projects.find((p) => p.id === project)?.code;
        return {
          product,
          qty: int(profile.qty[0], profile.qty[1]),
          price: r2(product.p.price * between(0.85, 1.2)),
          project,
          subject: `${product.p.name}${projectName ? ` (${projectName})` : ""}${profile.documentType === "Commission" ? ` ${MONTH_NAMES[m - 1]}` : ""}`,
        };
      });
      const inv = await raiseSales(date, profile.documentType, client, lines, profile.prefix);
      salesCount++;
      monthNetSales += inv.net;
      addVat(vatOut, key, inv.vat);

      const vatShare = inv.gross > 0 ? inv.vat / inv.gross : 0;
      const pay = async (when: string, amount: number, to: { id: number }) => {
        if (!ok(when) || amount <= 0) return;
        await bankIn(to, when, `Payment ${inv.number}`, { sales: inv.id }, amount - amount * vatShare, amount * vatShare, 0, 0);
        paymentCount++;
      };
      const roll = rnd();
      const target = inv.gross < 250 && chance(0.4) ? bank.petty : bank.check;
      const age = (Date.parse(today + "T00:00:00Z") - Date.parse(date + "T00:00:00Z")) / 86400000;
      if (roll < 0.74) await pay(addDays(date, int(7, 45)), inv.gross, target);
      else if (roll < 0.88) {
        const first = r2(inv.gross * between(0.3, 0.6));
        await pay(addDays(date, int(5, 20)), first, target);
        await pay(addDays(date, int(40, 75)), r2(inv.gross - first), target);
      } else if (age > 100 && !chance(0.08)) {
        await pay(addDays(date, int(60, 100)), inv.gross, target); // paid late
      } // otherwise still open: recent ones are normal, and an old one is a client to chase
    }

    // a credit note each quarter, and a proforma now and then (which never counts)
    if (m % 3 === 0 && ok(iso(y, m, 20))) {
      const product = pick(products);
      const cn = await raiseSales(iso(y, m, 20), "Credit Note", weightedClient(), [{ product, qty: -1, price: r2(product.p.price * 0.15), project: null, subject: `Credit - ${product.p.name}` }], "NC");
      addVat(vatOut, key, cn.vat);
    }
    if (m === 4 && ok(iso(y, m, 10))) {
      const product = pick(products);
      await raiseSales(iso(y, m, 10), "Proforma", weightedClient(), [{ product, qty: 1, price: r2(product.p.price * 2), project: null, subject: `Quotation - ${product.p.name}` }], "PF");
    }

    // -- purchase invoices (suppliers, recurring bills) and their payments --
    const buy = async (supplier: { id: number }, date: string, account: number, net: number, vat: number, what: string, project: number | null, numberSeed: string) => {
      let number = "";
      do number = `${numberSeed}/${y}-${String(m).padStart(2, "0")}-${int(100, 9999)}`;
      while (usedNumbers.has(`${supplier.id}|${number}`));
      usedNumbers.add(`${supplier.id}|${number}`);
      const gross = r2(net * (1 + vat));
      const id = await idOf(`INSERT INTO purchase_invoices (invoice_number, date, supplier_id) VALUES ($1,$2,$3) RETURNING id`, [number, date, supplier.id]);
      await tx.query(`INSERT INTO purchase_invoice_lines (purchase_invoice_id, line_no, description, account_no, project_id, vat_perc, amount_inc_vat) VALUES ($1,1,$2,$3,$4,$5,$6)`, [id, what, account, project, vat, gross]);
      purchaseCount++;
      addVat(vatIn, key, gross - gross / (1 + vat));
      if (chance(0.985)) {
        const when = addDays(date, int(8, 38));
        if (ok(when)) {
          const vatPart = gross - gross / (1 + vat);
          const via = gross < 90 && chance(0.5) ? bank.petty : bank.check;
          await bankIn(via, when, `Payment ${number}`, { purchase: id }, 0, 0, gross - vatPart, vatPart);
          paymentCount++;
        }
      }
    };

    let remaining = profile.supplierRatio * monthNetSales;
    for (let guard = 0; guard < 80 && remaining > 40; guard++) {
      const sup = pick(suppliers);
      const date = iso(y, m, int(1, 27));
      if (!ok(date)) break;
      const net = r2(Math.min(between(sup.s.net[0], sup.s.net[1]), remaining));
      if (net < Math.min(sup.s.net[0] * 0.3, 40)) continue;
      await buy(sup, date, sup.s.account, net, sup.s.vat, pick(sup.s.what), sup.s.project && projects.length ? pick(projects).id : null, `FT`);
      remaining -= net;
    }
    for (const { id, r } of recurring) {
      if ((m - 1) % r.every !== 0) continue;
      const date = iso(y, m, 3);
      if (ok(date)) await buy({ id }, date, r.account, r.net, r.vat, `${r.what} ${MONTH_NAMES[m - 1]}`, null, `R`);
    }

    // -- payroll: posted each month, net pay paid at month end, the State paid with one split on the 20th of the next month --
    const payDate = monthEnd;
    if (ok(payDate) && staff.length && A.netPay && A.withholding && A.social) {
      let irsTotal = 0;
      let ssTotal = 0;
      for (const { id, s } of staff) {
        const direct = s.field && !!A.wagesDirect;
        const wages = direct ? A.wagesDirect : A.wagesOffice;
        const employer = direct ? A.employerDirect : A.employerOffice;
        if (!wages || !employer) continue;
        const irs = r2(s.salary * 0.08);
        const employeeSs = r2(s.salary * 0.11);
        const employerSs = r2(s.salary * 0.2375);
        const net = r2(s.salary - irs - employeeSs);
        const entry = `sample-${company.slug}-payroll-${id}-${key}`;
        const lines: [number, number, number][] = [
          [wages, s.salary, 0],
          [employer, employerSs, 0],
          [A.netPay, 0, net],
          [A.withholding, 0, irs],
          [A.social, 0, r2(employeeSs + employerSs)],
        ];
        for (const [account, debit, credit] of lines) {
          await tx.query(
            `INSERT INTO journal_entries (date, account_no, description, debit, credit, employee_id, entry_id) VALUES ($1,$2,$3,$4,$5,$6,$7)`,
            [payDate, account, `Payroll ${MONTH_NAMES[m - 1]} ${y}: ${s.name}`, debit, credit, id, entry]
          );
        }
        irsTotal += irs;
        ssTotal += employeeSs + employerSs;
        await bankIn(bank.check, payDate, `Net pay ${MONTH_NAMES[m - 1]} ${y}: ${s.name}`, { account: A.netPay }, 0, 0, net, 0, { employee: id });
        paymentCount++;
      }
      payrollDue.set(key, { irs: irsTotal, ss: ssTotal });
    }
    const prevKey = m === 1 ? `${y - 1}-12` : `${y}-${m - 1}`;
    const owed = payrollDue.get(prevKey);
    if (owed && ok(iso(y, m, 20)) && A.withholding && A.social) {
      const splitId = `sample-${company.slug}-state-${key}`;
      for (const [account, amount, note] of [[A.withholding, owed.irs, "IRS withheld from pay"], [A.social, owed.ss, "Social security"]] as [number, number, string][]) {
        await tx.query(
          `INSERT INTO bank_transactions (bank_account_id, payment_date, description, account_no, out_amount, split_id) VALUES ($1,$2,$3,$4,$5,$6)`,
          [bank.check.id, iso(y, m, 20), `Payment to the State${SPLIT_NOTE}${note}`, account, r2(amount), splitId]
        );
      }
      paymentCount++;
      payrollDue.delete(prevKey);
    }

    // -- the bank loan: one instalment a month, split into principal, interest and fees --
    if (loan && loanBalance > 0 && ok(iso(y, m, 2))) {
      const interest = r2((loanBalance * loan.yearlyRate) / 12);
      const principal = r2(Math.min(loan.instalment - interest - loan.fee, loanBalance));
      const splitId = `sample-${company.slug}-loan-${key}`;
      for (const [account, amount, note] of [[A.loan, principal, "Principal repaid"], [A.interest, interest, "Interest"], [A.bankFees, loan.fee, "Fees and charges"]] as [number, number, string][]) {
        await tx.query(
          `INSERT INTO bank_transactions (bank_account_id, payment_date, description, account_no, out_amount, split_id) VALUES ($1,$2,$3,$4,$5,$6)`,
          [bank.check.id, iso(y, m, 2), `Loan instalment${SPLIT_NOTE}${note}`, account, amount, splitId]
        );
      }
      loanBalance = r2(loanBalance - principal);
      paymentCount++;
    }

    // -- card payments: fuel, tolls, bank charges --
    if (A.fuel) {
      for (let i = 0; i < (profile.staff.length ? int(3, 6) : 1); i++) {
        const date = iso(y, m, int(1, 27));
        if (!ok(date)) continue;
        const net = r2(between(35, 85) / 1.23);
        await bankIn(bank.check, date, "Fuel - card payment", { account: A.fuel }, 0, 0, net, r2(net * 0.23), { vat: 0.23 });
        addVat(vatIn, key, net * 0.23);
      }
    }
    if (A.tolls && chance(0.5) && ok(iso(y, m, 14))) await bankIn(bank.check, iso(y, m, 14), "Via Verde tolls", { account: A.tolls }, 0, 0, r2(between(15, 45) / 1.23), r2((between(15, 45) / 1.23) * 0.23), { vat: 0.23 });
    if (A.bankFees && ok(iso(y, m, 25))) await bankIn(bank.check, iso(y, m, 25), "Bank account charges", { account: A.bankFees }, 0, 0, r2(between(11, 26)), 0);

    // -- petty cash: topped up from the bank, spent on small things --
    if (ok(iso(y, m, 5)) && bank.petty.id !== bank.check.id && A.transfers) {
      await transfer(bank.check, bank.petty, iso(y, m, 5), 200, `${key}-petty`, "petty cash");
      for (let i = 0; i < int(2, 4); i++) {
        const date = iso(y, m, int(6, 27));
        if (!ok(date)) continue;
        const account = pick([A.office, A.meals, A.tolls].filter(Boolean));
        if (!account) continue;
        const net = r2(between(6, 38) / 1.23);
        await bankIn(bank.petty, date, pick(["Stationery", "Coffee and lunch", "Parking", "Cleaning supplies", "Postage"]), { account }, 0, 0, net, r2(net * 0.23), { vat: 0.23 });
        addVat(vatIn, key, net * 0.23);
      }
    }

    // -- the month's IVA is set aside in the IVA account, and settled each quarter --
    if (ok(monthEnd) && bank.iva.id !== bank.check.id && A.transfers) {
      const due = (vatOut.get(key) ?? 0) - (vatIn.get(key) ?? 0);
      if (due > 50) {
        await transfer(bank.check, bank.iva, monthEnd, due, `${key}-iva`, "IVA account");
      }
    }
    if ([2, 5, 8, 11].includes(m) && A.vatSettled && ok(iso(y, m, 15))) {
      const monthsOfQuarter = [m - 4, m - 3, m - 2].map((x) => (x < 1 ? `${y - 1}-${x + 12}` : `${y}-${x}`));
      const settle = monthsOfQuarter.reduce((t, k) => t + (vatOut.get(k) ?? 0) - (vatIn.get(k) ?? 0), 0);
      const lastMonth = m - 2 < 1 ? m + 10 : m - 2;
      if (settle > 50) await bankIn(bank.iva, iso(y, m, 15), `IVA payment - quarter to ${MONTH_NAMES[lastMonth - 1]}`, { account: A.vatSettled }, 0, 0, r2(settle), 0);
    }

    // -- income tax on account, and depreciation --
    if ([7, 9, 12].includes(m) && A.incomeTax && ok(iso(y, m, 20))) await bankIn(bank.check, iso(y, m, 20), "IRC payment on account", { account: A.incomeTax }, 0, 0, Math.round(1400 * profile.scale + 200), 0);
    if (m % 3 === 0 && A.depreciation && A.equipment && A.accumulated && ok(iso(y, m, 28))) {
      const amount = Math.round((14000 * profile.scale) / 20);
      await tx.query(`INSERT INTO journal_entries (date, account_no, description, debit, credit) VALUES ($1,$2,$3,$4,0)`, [iso(y, m, 28), A.depreciation, `Depreciation Q${m / 3} ${y}`, amount]);
      await tx.query(`INSERT INTO journal_entries (date, account_no, description, debit, credit) VALUES ($1,$2,$3,0,$4)`, [iso(y, m, 28), A.accumulated, `Depreciation Q${m / 3} ${y}`, amount]);
    }
  }

  // The current account has been reconciled with the bank statements up to two months ago.
  await tx.query(`UPDATE bank_transactions SET reconciled = true WHERE bank_account_id = $1 AND payment_date < ($2::date - 60)`, [bank.check.id, today]);

  return `${clients.length} clients, ${suppliers.length + recurring.length} suppliers, ${staff.length} staff, ${salesCount} sales invoices, ${purchaseCount} purchase invoices and ${paymentCount} payments, ${months.length} months`;
}

/** Fill an empty company with made-up but realistic data. Refuses a company that already has entries. */
export async function loadSampleData(company: Company): Promise<string> {
  const db = await openCompanyDatabase(company);
  const n = Number(
    (await db.query<{ n: string }>(
      `SELECT (SELECT COUNT(*) FROM sales_invoices) + (SELECT COUNT(*) FROM purchase_invoices) + (SELECT COUNT(*) FROM bank_transactions)
            + (SELECT COUNT(*) FROM customers) + (SELECT COUNT(*) FROM suppliers) AS n`
    )).rows[0].n
  );
  if (n > 0) throw new Error(`${company.name} already has entries. Use "Start fresh" first if you want the sample data instead.`);
  await createBackup(db, company, "-before-sample");
  const profile = PROFILES[company.slug] ?? DEFAULT_PROFILE;
  const today = new Date().toISOString().slice(0, 10);
  return db.transaction(async (tx) => generate(tx as unknown as Tx, company, profile, today));
}

/** Empty a company's entries and master data (after a backup). Keeps the chart of accounts, settings, bank accounts and logins. */
export async function clearCompanyData(company: Company): Promise<void> {
  const db = await openCompanyDatabase(company);
  await createBackup(db, company, "-before-clear");
  await db.transaction(async (tx) => {
    for (const table of [
      "bank_transactions",
      "sales_invoice_lines",
      "sales_invoices",
      "purchase_invoice_lines",
      "purchase_invoices",
      "journal_entries",
      "opening_balances",
      "employees",
      "customers",
      "suppliers",
      "products_services",
      "projects",
    ]) {
      await tx.query(`DELETE FROM ${table}`);
    }
    await tx.query("UPDATE app_settings SET closed_through_year = NULL WHERE id = 1");
  });
}
