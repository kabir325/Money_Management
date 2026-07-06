export type SalaryDay = 25 | 26;
export type SpendingType = "needs" | "wants";

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
  date: string;
  note?: string;
};

export type SavingsEntry = {
  id: string;
  title: string;
  amount: number;
  bucketId: string;
  date: string;
  note?: string;
};

export type CashEntry = {
  id: string;
  title: string;
  amount: number;
  date: string;
  note?: string;
};

export type FinanceData = {
  currentBalance: number;
  salaryDay: SalaryDay;
  categories: Category[];
  savingsBuckets: SavingsBucket[];
  expenses: Expense[];
  savingsEntries: SavingsEntry[];
  cashEntries: CashEntry[];
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
  salaryDay: 25,
  categories: DEFAULT_CATEGORIES,
  savingsBuckets: DEFAULT_SAVINGS_BUCKETS,
  expenses: [],
  savingsEntries: [],
  cashEntries: [],
  updatedAt: new Date(0).toISOString(),
};

export function normalizeFinanceData(input: unknown): FinanceData {
  if (!input || typeof input !== "object") {
    return DEFAULT_DATA;
  }

  const candidate = input as Partial<FinanceData>;

  return {
    currentBalance:
      typeof candidate.currentBalance === "number" &&
      Number.isFinite(candidate.currentBalance)
        ? candidate.currentBalance
        : 0,
    salaryDay: candidate.salaryDay === 26 ? 26 : 25,
    categories: Array.isArray(candidate.categories)
      ? candidate.categories
          .map((category) => normalizeCategory(category))
          .filter((category): category is Category => category !== null)
      : DEFAULT_CATEGORIES,
    savingsBuckets: Array.isArray(candidate.savingsBuckets)
      ? candidate.savingsBuckets.filter(isSavingsBucket)
      : DEFAULT_SAVINGS_BUCKETS,
    expenses: Array.isArray(candidate.expenses)
      ? candidate.expenses.filter(isExpense)
      : [],
    savingsEntries: Array.isArray(candidate.savingsEntries)
      ? candidate.savingsEntries.filter(isSavingsEntry)
      : [],
    cashEntries: Array.isArray(candidate.cashEntries)
      ? candidate.cashEntries.filter(isCashEntry)
      : [],
    updatedAt:
      typeof candidate.updatedAt === "string" && candidate.updatedAt
        ? candidate.updatedAt
        : new Date(0).toISOString(),
  };
}

export function withUpdatedTimestamp(data: FinanceData): FinanceData {
  return {
    ...data,
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

export function getSalaryCycleRange(referenceDate: Date, salaryDay: SalaryDay) {
  const today = atMidday(referenceDate);
  const start =
    today.getDate() >= salaryDay
      ? new Date(today.getFullYear(), today.getMonth(), salaryDay, 12)
      : new Date(today.getFullYear(), today.getMonth() - 1, salaryDay, 12);
  const end = new Date(start.getFullYear(), start.getMonth() + 1, salaryDay, 12);
  const daysLeft = Math.max(
    0,
    Math.ceil((end.getTime() - today.getTime()) / (1000 * 60 * 60 * 24)),
  );

  return { start, end, daysLeft };
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

function atMidday(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate(), 12);
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

function isSavingsBucket(value: unknown): value is SavingsBucket {
  return Boolean(
    value &&
      typeof value === "object" &&
      "id" in value &&
      "name" in value &&
      "color" in value,
  );
}

function inferCategoryKind(value: string): SpendingType {
  return /(shop|eat|food-out|restaurant|fun|travel|entertain|luxury|wants?)/i.test(
    value,
  )
    ? "wants"
    : "needs";
}

function isExpense(value: unknown): value is Expense {
  return Boolean(
    value &&
      typeof value === "object" &&
      "id" in value &&
      "title" in value &&
      "amount" in value &&
      "categoryId" in value &&
      "date" in value,
  );
}

function isSavingsEntry(value: unknown): value is SavingsEntry {
  return Boolean(
    value &&
      typeof value === "object" &&
      "id" in value &&
      "title" in value &&
      "amount" in value &&
      "bucketId" in value &&
      "date" in value,
  );
}

function isCashEntry(value: unknown): value is CashEntry {
  return Boolean(
    value &&
      typeof value === "object" &&
      "id" in value &&
      "title" in value &&
      "amount" in value &&
      "date" in value,
  );
}
