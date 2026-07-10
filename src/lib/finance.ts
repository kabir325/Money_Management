export type SalaryDay = number;
export type SpendingType = "needs" | "wants";
export type BalanceSource = "bank" | "cash";
export type EmergencyFundProfile = "secure" | "family" | "freelancer";

export type Category = {
  id: string;
  name: string;
  color: string;
  kind: SpendingType;
};

export type SavingsBucket = {
  id: string;
  name: string;
  color: string;
};

export type Expense = {
  id: string;
  title: string;
  amount: number;
  categoryId: string;
  account: BalanceSource;
  date: string;
  note?: string;
};

export type SavingsEntry = {
  id: string;
  title: string;
  amount: number;
  bucketId: string;
  account: BalanceSource;
  date: string;
  note?: string;
};

export type CashEntry = {
  id: string;
  title: string;
  amount: number;
  account: BalanceSource;
  date: string;
  note?: string;
};

export type SalaryEntry = {
  id: string;
  amount: number;
  account: BalanceSource;
  date: string;
  salaryMonthKey: string;
  note?: string;
};

export type LoanPayment = {
  id: string;
  amount: number;
  account: BalanceSource;
  date: string;
  note?: string;
};

export type Loan = {
  id: string;
  title: string;
  lender: string;
  principalAmount: number;
  monthlyPayment: number;
  totalMonths: number;
  dueDay: number;
  startDate: string;
  note?: string;
  payments: LoanPayment[];
};

export type FinanceData = {
  currentBalance: number;
  bankBalance: number;
  cashBalance: number;
  salaryDay: SalaryDay;
  salaryAmount: number;
  emergencyFundProfile: EmergencyFundProfile;
  categories: Category[];
  savingsBuckets: SavingsBucket[];
  expenses: Expense[];
  savingsEntries: SavingsEntry[];
  cashEntries: CashEntry[];
  salaryEntries: SalaryEntry[];
  loans: Loan[];
  updatedAt: string;
};

export const STORAGE_KEY = "money-management-dashboard";
export const FINANCE_DATA_KEY = "finance:data";

export const DEFAULT_CATEGORIES: Category[] = [
  { id: "groceries", name: "Groceries", color: "#22c55e", kind: "needs" },
  { id: "bills", name: "Bills", color: "#a855f7", kind: "needs" },
  { id: "transport", name: "Transport", color: "#06b6d4", kind: "needs" },
  { id: "eating-out", name: "Eating Out", color: "#f97316", kind: "wants" },
  { id: "shopping", name: "Shopping", color: "#ec4899", kind: "wants" },
];

export const DEFAULT_SAVINGS_BUCKETS: SavingsBucket[] = [
  { id: "spi", name: "SPI", color: "#6366f1" },
  { id: "emergency-fund", name: "Emergency Fund", color: "#14b8a6" },
  { id: "goal-savings", name: "Goal Savings", color: "#eab308" },
];

export const DEFAULT_DATA: FinanceData = {
  currentBalance: 0,
  bankBalance: 0,
  cashBalance: 0,
  salaryDay: 25,
  salaryAmount: 0,
  emergencyFundProfile: "secure",
  categories: DEFAULT_CATEGORIES,
  savingsBuckets: DEFAULT_SAVINGS_BUCKETS,
  expenses: [],
  savingsEntries: [],
  cashEntries: [],
  salaryEntries: [],
  loans: [],
  updatedAt: new Date(0).toISOString(),
};

export function normalizeFinanceData(input: unknown): FinanceData {
  if (!input || typeof input !== "object") {
    return DEFAULT_DATA;
  }

  const candidate = input as Partial<FinanceData> & {
    currentBalance?: number;
  };
  const bankBalance = normalizeNumber(candidate.bankBalance, candidate.currentBalance ?? 0);
  const cashBalance = normalizeNumber(candidate.cashBalance, 0);

  return {
    currentBalance: bankBalance + cashBalance,
    bankBalance,
    cashBalance,
    salaryDay: clampDay(candidate.salaryDay),
    salaryAmount: normalizeNumber(candidate.salaryAmount, 0),
    emergencyFundProfile: normalizeEmergencyFundProfile(candidate.emergencyFundProfile),
    categories: Array.isArray(candidate.categories)
      ? candidate.categories
          .map((category) => normalizeCategory(category))
          .filter((category): category is Category => category !== null)
      : DEFAULT_CATEGORIES,
    savingsBuckets: Array.isArray(candidate.savingsBuckets)
      ? candidate.savingsBuckets
          .map((bucket) => normalizeSavingsBucket(bucket))
          .filter((bucket): bucket is SavingsBucket => bucket !== null)
      : DEFAULT_SAVINGS_BUCKETS,
    expenses: Array.isArray(candidate.expenses)
      ? candidate.expenses
          .map((expense) => normalizeExpense(expense))
          .filter((expense): expense is Expense => expense !== null)
      : [],
    savingsEntries: Array.isArray(candidate.savingsEntries)
      ? candidate.savingsEntries
          .map((entry) => normalizeSavingsEntry(entry))
          .filter((entry): entry is SavingsEntry => entry !== null)
      : [],
    cashEntries: Array.isArray(candidate.cashEntries)
      ? candidate.cashEntries
          .map((entry) => normalizeCashEntry(entry))
          .filter((entry): entry is CashEntry => entry !== null)
      : [],
    salaryEntries: Array.isArray(candidate.salaryEntries)
      ? candidate.salaryEntries
          .map((entry) => normalizeSalaryEntry(entry))
          .filter((entry): entry is SalaryEntry => entry !== null)
      : [],
    loans: Array.isArray(candidate.loans)
      ? candidate.loans
          .map((loan) => normalizeLoan(loan))
          .filter((loan): loan is Loan => loan !== null)
      : [],
    updatedAt:
      typeof candidate.updatedAt === "string" && candidate.updatedAt
        ? candidate.updatedAt
        : new Date(0).toISOString(),
  };
}

export function withUpdatedTimestamp(data: FinanceData): FinanceData {
  return {
    ...normalizeFinanceData(data),
    updatedAt: new Date().toISOString(),
  };
}

export function formatCurrency(value: number) {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(Number.isFinite(value) ? value : 0);
}

export function formatShortDate(value: string) {
  return parseInputDate(value).toLocaleDateString("en-IN", {
    day: "numeric",
    month: "short",
  });
}

export function formatLongDate(value: Date) {
  return value.toLocaleDateString("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

export function getAccountLabel(account: BalanceSource) {
  return account === "cash" ? "Cash" : "Bank";
}

export function getEmergencyFundMonths(profile: EmergencyFundProfile) {
  if (profile === "family") {
    return 6;
  }

  if (profile === "freelancer") {
    return 9;
  }

  return 3;
}

export function getEmergencyProfileLabel(profile: EmergencyFundProfile) {
  if (profile === "family") {
    return "6-month cover";
  }

  if (profile === "freelancer") {
    return "9-month cover";
  }

  return "3-month cover";
}

export function getEmergencyProfileDescription(profile: EmergencyFundProfile) {
  if (profile === "family") {
    return "Families, couples with shared responsibilities, dependents, or loans.";
  }

  if (profile === "freelancer") {
    return "Freelancers, self-employed people, or volatile-income work.";
  }

  return "Single or dual-income households with secure and stable jobs.";
}

export function getSalaryCycleRange(referenceDate: Date, salaryDay: SalaryDay) {
  const today = atMidday(referenceDate);
  const safeDay = clampDay(salaryDay);
  const currentMonthSalaryDate = createMonthDay(today.getFullYear(), today.getMonth(), safeDay);
  const start =
    today.getTime() >= currentMonthSalaryDate.getTime()
      ? currentMonthSalaryDate
      : createMonthDay(today.getFullYear(), today.getMonth() - 1, safeDay);
  const end = createMonthDay(start.getFullYear(), start.getMonth() + 1, safeDay);
  const daysLeft = Math.max(
    0,
    Math.ceil((end.getTime() - today.getTime()) / (1000 * 60 * 60 * 24)),
  );

  return { start, end, daysLeft };
}

export function getSalaryDueDate(referenceDate: Date, salaryDay: SalaryDay) {
  const today = atMidday(referenceDate);
  const safeDay = clampDay(salaryDay);
  const currentMonthSalaryDate = createMonthDay(today.getFullYear(), today.getMonth(), safeDay);

  return today.getTime() >= currentMonthSalaryDate.getTime()
    ? currentMonthSalaryDate
    : createMonthDay(today.getFullYear(), today.getMonth() - 1, safeDay);
}

export function getSalaryDueMonthKey(referenceDate: Date, salaryDay: SalaryDay) {
  return toMonthKey(getSalaryDueDate(referenceDate, salaryDay));
}

export function isDateInRange(date: string, start: Date, end: Date) {
  const parsed = parseInputDate(date);
  return parsed >= start && parsed < end;
}

export function getMonthBuckets(monthCount = 6) {
  const today = new Date();
  const months: { key: string; label: string }[] = [];

  for (let index = monthCount - 1; index >= 0; index -= 1) {
    const date = new Date(today.getFullYear(), today.getMonth() - index, 1, 12);
    months.push({
      key: toMonthKey(date),
      label: date.toLocaleDateString("en-IN", {
        month: "short",
      }),
    });
  }

  return months;
}

export function parseInputDate(value: string) {
  const [year, month, day] = value.split("-").map(Number);
  return new Date(year, (month || 1) - 1, day || 1, 12);
}

export function todayInputValue() {
  return toInputDate(new Date());
}

export function toInputDate(date: Date) {
  const year = date.getFullYear();
  const month = `${date.getMonth() + 1}`.padStart(2, "0");
  const day = `${date.getDate()}`.padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function toMonthKey(date: Date) {
  const year = date.getFullYear();
  const month = `${date.getMonth() + 1}`.padStart(2, "0");
  return `${year}-${month}`;
}

export function toYearKey(date: Date) {
  return `${date.getFullYear()}`;
}

function atMidday(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate(), 12);
}

function createMonthDay(year: number, monthIndex: number, day: number) {
  const safeYear = monthIndex < 0 ? year + Math.floor(monthIndex / 12) : year;
  const normalizedMonth = ((monthIndex % 12) + 12) % 12;
  const adjustedYear = monthIndex >= 0 ? year + Math.floor(monthIndex / 12) : safeYear;
  const lastDay = new Date(adjustedYear, normalizedMonth + 1, 0).getDate();
  return new Date(adjustedYear, normalizedMonth, Math.min(day, lastDay), 12);
}

function normalizeCategory(value: unknown): Category | null {
  if (
    !value ||
    typeof value !== "object" ||
    !("id" in value) ||
    !("name" in value) ||
    !("color" in value)
  ) {
    return null;
  }

  const candidate = value as Partial<Category>;

  return {
    id: String(candidate.id),
    name: String(candidate.name),
    color: String(candidate.color),
    kind: candidate.kind === "wants" ? "wants" : inferCategoryKind(String(candidate.id)),
  };
}

function normalizeSavingsBucket(value: unknown): SavingsBucket | null {
  if (
    !value ||
    typeof value !== "object" ||
    !("id" in value) ||
    !("name" in value) ||
    !("color" in value)
  ) {
    return null;
  }

  const candidate = value as Partial<SavingsBucket>;

  return {
    id: String(candidate.id),
    name: String(candidate.name),
    color: String(candidate.color),
  };
}

function normalizeExpense(value: unknown): Expense | null {
  if (
    !value ||
    typeof value !== "object" ||
    !("id" in value) ||
    !("title" in value) ||
    !("amount" in value) ||
    !("categoryId" in value) ||
    !("date" in value)
  ) {
    return null;
  }

  const candidate = value as Partial<Expense>;

  return {
    id: String(candidate.id),
    title: String(candidate.title),
    amount: normalizeNumber(candidate.amount, 0),
    categoryId: String(candidate.categoryId),
    account: normalizeBalanceSource(candidate.account),
    date: String(candidate.date),
    note: typeof candidate.note === "string" ? candidate.note : "",
  };
}

function normalizeSavingsEntry(value: unknown): SavingsEntry | null {
  if (
    !value ||
    typeof value !== "object" ||
    !("id" in value) ||
    !("title" in value) ||
    !("amount" in value) ||
    !("bucketId" in value) ||
    !("date" in value)
  ) {
    return null;
  }

  const candidate = value as Partial<SavingsEntry>;

  return {
    id: String(candidate.id),
    title: String(candidate.title),
    amount: normalizeNumber(candidate.amount, 0),
    bucketId: String(candidate.bucketId),
    account: normalizeBalanceSource(candidate.account),
    date: String(candidate.date),
    note: typeof candidate.note === "string" ? candidate.note : "",
  };
}

function normalizeCashEntry(value: unknown): CashEntry | null {
  if (
    !value ||
    typeof value !== "object" ||
    !("id" in value) ||
    !("title" in value) ||
    !("amount" in value) ||
    !("date" in value)
  ) {
    return null;
  }

  const candidate = value as Partial<CashEntry>;

  return {
    id: String(candidate.id),
    title: String(candidate.title),
    amount: normalizeNumber(candidate.amount, 0),
    account: normalizeBalanceSource(candidate.account),
    date: String(candidate.date),
    note: typeof candidate.note === "string" ? candidate.note : "",
  };
}

function normalizeSalaryEntry(value: unknown): SalaryEntry | null {
  if (
    !value ||
    typeof value !== "object" ||
    !("id" in value) ||
    !("amount" in value) ||
    !("date" in value)
  ) {
    return null;
  }

  const candidate = value as Partial<SalaryEntry>;
  const date = String(candidate.date);

  return {
    id: String(candidate.id),
    amount: normalizeNumber(candidate.amount, 0),
    account: normalizeBalanceSource(candidate.account),
    date,
    salaryMonthKey:
      typeof candidate.salaryMonthKey === "string" && candidate.salaryMonthKey
        ? candidate.salaryMonthKey
        : toMonthKey(parseInputDate(date)),
    note: typeof candidate.note === "string" ? candidate.note : "",
  };
}

function normalizeLoan(value: unknown): Loan | null {
  if (
    !value ||
    typeof value !== "object" ||
    !("id" in value) ||
    !("title" in value) ||
    !("principalAmount" in value) ||
    !("monthlyPayment" in value) ||
    !("totalMonths" in value) ||
    !("dueDay" in value) ||
    !("startDate" in value)
  ) {
    return null;
  }

  const candidate = value as Partial<Loan>;

  return {
    id: String(candidate.id),
    title: String(candidate.title),
    lender: typeof candidate.lender === "string" ? candidate.lender : "",
    principalAmount: normalizeNumber(candidate.principalAmount, 0),
    monthlyPayment: normalizeNumber(candidate.monthlyPayment, 0),
    totalMonths: Math.max(1, Math.round(normalizeNumber(candidate.totalMonths, 1))),
    dueDay: clampDay(candidate.dueDay),
    startDate: String(candidate.startDate),
    note: typeof candidate.note === "string" ? candidate.note : "",
    payments: Array.isArray(candidate.payments)
      ? candidate.payments
          .map((payment) => normalizeLoanPayment(payment))
          .filter((payment): payment is LoanPayment => payment !== null)
      : [],
  };
}

function normalizeLoanPayment(value: unknown): LoanPayment | null {
  if (
    !value ||
    typeof value !== "object" ||
    !("id" in value) ||
    !("amount" in value) ||
    !("date" in value)
  ) {
    return null;
  }

  const candidate = value as Partial<LoanPayment>;

  return {
    id: String(candidate.id),
    amount: normalizeNumber(candidate.amount, 0),
    account: normalizeBalanceSource(candidate.account),
    date: String(candidate.date),
    note: typeof candidate.note === "string" ? candidate.note : "",
  };
}

function normalizeEmergencyFundProfile(value: unknown): EmergencyFundProfile {
  if (value === "family" || value === "freelancer") {
    return value;
  }

  return "secure";
}

function normalizeBalanceSource(value: unknown): BalanceSource {
  return value === "cash" ? "cash" : "bank";
}

function normalizeNumber(value: unknown, fallback: number) {
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

function clampDay(value: unknown) {
  const day =
    typeof value === "number" && Number.isFinite(value) ? Math.round(value) : DEFAULT_DATA.salaryDay;
  return Math.min(31, Math.max(1, day));
}

function inferCategoryKind(value: string): SpendingType {
  return /(shop|eat|food-out|restaurant|fun|travel|entertain|luxury|wants?)/i.test(
    value,
  )
    ? "wants"
    : "needs";
}
