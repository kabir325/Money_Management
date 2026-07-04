"use client";

import { useEffect, useMemo, useState } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { logout } from "@/app/actions/auth";
import {
  DEFAULT_DATA,
  STORAGE_KEY,
  formatCurrency,
  formatLongDate,
  formatShortDate,
  getMonthBuckets,
  getSalaryCycleRange,
  isDateInRange,
  normalizeFinanceData,
  parseInputDate,
  todayInputValue,
  toMonthKey,
  type FinanceData,
  type SpendingType,
} from "@/lib/finance";

type ExpenseFormState = {
  title: string;
  amount: string;
  categoryId: string;
  date: string;
  note: string;
};

type SavingsFormState = {
  title: string;
  amount: string;
  bucketId: string;
  date: string;
  note: string;
};

type CategoryFormState = {
  name: string;
  color: string;
  kind: SpendingType;
};

type BucketFormState = {
  name: string;
  color: string;
};

const defaultExpenseForm = (data: FinanceData): ExpenseFormState => ({
  title: "",
  amount: "",
  categoryId: data.categories[0]?.id ?? "",
  date: todayInputValue(),
  note: "",
});

const defaultSavingsForm = (data: FinanceData): SavingsFormState => ({
  title: "",
  amount: "",
  bucketId: data.savingsBuckets[0]?.id ?? "",
  date: todayInputValue(),
  note: "",
});

export function Dashboard() {
  const [data, setData] = useState<FinanceData>(DEFAULT_DATA);
  const [isReady, setIsReady] = useState(false);
  const [balanceInput, setBalanceInput] = useState("0");
  const [expenseForm, setExpenseForm] = useState<ExpenseFormState>(
    defaultExpenseForm(DEFAULT_DATA),
  );
  const [savingsForm, setSavingsForm] = useState<SavingsFormState>(
    defaultSavingsForm(DEFAULT_DATA),
  );
  const [categoryForm, setCategoryForm] = useState<CategoryFormState>({
    name: "",
    color: "#8b5cf6",
    kind: "needs",
  });
  const [bucketForm, setBucketForm] = useState<BucketFormState>({
    name: "",
    color: "#14b8a6",
  });

  useEffect(() => {
    let parsedData = DEFAULT_DATA;

    try {
      const storedValue = window.localStorage.getItem(STORAGE_KEY);
      parsedData = storedValue
        ? normalizeFinanceData(JSON.parse(storedValue))
        : DEFAULT_DATA;
    } catch {
      parsedData = DEFAULT_DATA;
    }

    const frame = window.requestAnimationFrame(() => {
      setData(parsedData);
      setBalanceInput(parsedData.currentBalance.toString());
      setExpenseForm(defaultExpenseForm(parsedData));
      setSavingsForm(defaultSavingsForm(parsedData));
      setIsReady(true);
    });

    return () => window.cancelAnimationFrame(frame);
  }, []);

  useEffect(() => {
    if (!isReady) {
      return;
    }

    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  }, [data, isReady]);

  const categoryMap = useMemo(
    () => new Map(data.categories.map((item) => [item.id, item])),
    [data.categories],
  );
  const bucketMap = useMemo(
    () => new Map(data.savingsBuckets.map((item) => [item.id, item])),
    [data.savingsBuckets],
  );
  const cycle = useMemo(
    () => getSalaryCycleRange(new Date(), data.salaryDay),
    [data.salaryDay],
  );

  const currentCycleExpenses = useMemo(
    () =>
      data.expenses.filter((expense) =>
        isDateInRange(expense.date, cycle.start, cycle.end),
      ),
    [cycle.end, cycle.start, data.expenses],
  );

  const currentCycleSavings = useMemo(
    () =>
      data.savingsEntries.filter((entry) =>
        isDateInRange(entry.date, cycle.start, cycle.end),
      ),
    [cycle.end, cycle.start, data.savingsEntries],
  );

  const expenseByCategory = useMemo(() => {
    return data.categories
      .map((category) => {
        const total = currentCycleExpenses
          .filter((expense) => expense.categoryId === category.id)
          .reduce((sum, expense) => sum + expense.amount, 0);

        return {
          name: category.name,
          total,
          color: category.color,
        };
      })
      .filter((item) => item.total > 0)
      .sort((left, right) => right.total - left.total);
  }, [currentCycleExpenses, data.categories]);

  const savingsByBucket = useMemo(() => {
    return data.savingsBuckets
      .map((bucket) => {
        const total = data.savingsEntries
          .filter((entry) => entry.bucketId === bucket.id)
          .reduce((sum, entry) => sum + entry.amount, 0);

        return {
          name: bucket.name,
          total,
          color: bucket.color,
        };
      })
      .filter((item) => item.total > 0)
      .sort((left, right) => right.total - left.total);
  }, [data.savingsBuckets, data.savingsEntries]);

  const monthlyComparison = useMemo(() => {
    return getMonthBuckets(6).map((bucket) => ({
      month: bucket.label,
      spent: data.expenses
        .filter((expense) => toMonthKey(parseInputDate(expense.date)) === bucket.key)
        .reduce((sum, expense) => sum + expense.amount, 0),
      saved: data.savingsEntries
        .filter((entry) => toMonthKey(parseInputDate(entry.date)) === bucket.key)
        .reduce((sum, entry) => sum + entry.amount, 0),
    }));
  }, [data.expenses, data.savingsEntries]);

  const recentActivity = useMemo(() => {
    return [
      ...data.expenses.map((expense) => ({
        id: expense.id,
        title: expense.title,
        amount: expense.amount,
        date: expense.date,
        tag: categoryMap.get(expense.categoryId)?.name ?? "Category",
        tone: "expense" as const,
      })),
      ...data.savingsEntries.map((entry) => ({
        id: entry.id,
        title: entry.title,
        amount: entry.amount,
        date: entry.date,
        tag: bucketMap.get(entry.bucketId)?.name ?? "Savings",
        tone: "savings" as const,
      })),
    ]
      .sort((left, right) => right.date.localeCompare(left.date))
      .slice(0, 8);
  }, [bucketMap, categoryMap, data.expenses, data.savingsEntries]);

  const habitSpend = useMemo(() => {
    return currentCycleExpenses.reduce(
      (totals, expense) => {
        const kind = categoryMap.get(expense.categoryId)?.kind ?? "needs";
        totals[kind] += expense.amount;
        return totals;
      },
      { needs: 0, wants: 0 },
    );
  }, [categoryMap, currentCycleExpenses]);

  const currentCycleSpent = currentCycleExpenses.reduce(
    (sum, expense) => sum + expense.amount,
    0,
  );
  const currentCycleSaved = currentCycleSavings.reduce(
    (sum, entry) => sum + entry.amount,
    0,
  );
  const totalSavings = data.savingsEntries.reduce(
    (sum, entry) => sum + entry.amount,
    0,
  );
  const spentAndSaved = currentCycleSpent + currentCycleSaved;
  const planningBase = Math.max(
    spentAndSaved,
    Math.max(data.currentBalance, 0) + spentAndSaved,
    1,
  );
  const needsSpent = habitSpend.needs;
  const wantsSpent = habitSpend.wants;
  const targetNeeds = Math.round(planningBase * 0.5);
  const targetWants = Math.round(planningBase * 0.3);
  const targetSavings = Math.round(planningBase * 0.2);
  const wantsAvailable = Math.max(targetWants - wantsSpent, 0);
  const savingsGap = Math.max(targetSavings - currentCycleSaved, 0);
  const reserveForSavings = Math.min(Math.max(data.currentBalance, 0), savingsGap);
  const safeToSpend = Math.max(Math.max(data.currentBalance, 0) - reserveForSavings, 0);
  const dailyAllowance =
    cycle.daysLeft > 0 ? Math.round(safeToSpend / cycle.daysLeft) : safeToSpend;
  const savingsRate =
    spentAndSaved > 0 ? Math.round((currentCycleSaved / spentAndSaved) * 100) : 0;
  const cycleLength = Math.max(
    1,
    Math.ceil((cycle.end.getTime() - cycle.start.getTime()) / (1000 * 60 * 60 * 24)),
  );
  const elapsedDays = Math.max(cycleLength - cycle.daysLeft, 1);
  const projectedSpend = Math.round((currentCycleSpent / elapsedDays) * cycleLength);
  const topCategory = expenseByCategory[0]?.name ?? "No spending yet";
  const habitRuleChartData = [
    {
      name: "Target",
      Needs: targetNeeds,
      Wants: targetWants,
      Savings: targetSavings,
    },
    {
      name: "Actual",
      Needs: needsSpent,
      Wants: wantsSpent,
      Savings: currentCycleSaved,
    },
  ];
  const habitTips = [
    savingsGap > 0
      ? `Move ${formatCurrency(savingsGap)} into a savings bucket to get closer to the 20% savings lane.`
      : "Savings are on track or ahead of the 20% lane this cycle.",
    wantsSpent > targetWants
      ? `Your wants are ${formatCurrency(wantsSpent - targetWants)} above the 30% guide, so pause shopping or eating out for now.`
      : `You still have ${formatCurrency(wantsAvailable)} of discretionary room inside the 30% wants guide.`,
    needsSpent > targetNeeds
      ? `Essentials are ${formatCurrency(needsSpent - targetNeeds)} above the 50% guide. Review bills, groceries, and transport costs next.`
      : "Essentials are staying inside the 50% lane so far.",
    `Keep day-to-day spending near ${formatCurrency(dailyAllowance)} per day until salary lands.`,
  ];

  const handleBalanceSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const nextBalance = Number(balanceInput);

    setData((current) => ({
      ...current,
      currentBalance: Number.isFinite(nextBalance) ? nextBalance : 0,
    }));
  };

  const handleAddExpense = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const amount = Number(expenseForm.amount);

    if (!expenseForm.categoryId || !expenseForm.title.trim() || amount <= 0) {
      return;
    }

    setData((current) => ({
      ...current,
      expenses: [
        {
          id: crypto.randomUUID(),
          title: expenseForm.title.trim(),
          amount,
          categoryId: expenseForm.categoryId,
          date: expenseForm.date,
          note: expenseForm.note.trim(),
        },
        ...current.expenses,
      ],
    }));

    setExpenseForm(defaultExpenseForm(data));
  };

  const handleAddSavings = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const amount = Number(savingsForm.amount);

    if (!savingsForm.bucketId || !savingsForm.title.trim() || amount <= 0) {
      return;
    }

    setData((current) => ({
      ...current,
      savingsEntries: [
        {
          id: crypto.randomUUID(),
          title: savingsForm.title.trim(),
          amount,
          bucketId: savingsForm.bucketId,
          date: savingsForm.date,
          note: savingsForm.note.trim(),
        },
        ...current.savingsEntries,
      ],
    }));

    setSavingsForm(defaultSavingsForm(data));
  };

  const handleAddCategory = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const name = categoryForm.name.trim();

    if (!name) {
      return;
    }

    const category = {
      id: `${name.toLowerCase().replace(/\s+/g, "-")}-${crypto.randomUUID().slice(0, 6)}`,
      name,
      color: categoryForm.color,
      kind: categoryForm.kind,
    };

    setData((current) => ({
      ...current,
      categories: [...current.categories, category],
    }));

    setCategoryForm((current) => ({ ...current, name: "" }));
    setExpenseForm((current) => ({ ...current, categoryId: category.id }));
  };

  const handleAddBucket = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const name = bucketForm.name.trim();

    if (!name) {
      return;
    }

    const bucket = {
      id: `${name.toLowerCase().replace(/\s+/g, "-")}-${crypto.randomUUID().slice(0, 6)}`,
      name,
      color: bucketForm.color,
    };

    setData((current) => ({
      ...current,
      savingsBuckets: [...current.savingsBuckets, bucket],
    }));

    setBucketForm({ name: "", color: bucketForm.color });
    setSavingsForm((current) => ({ ...current, bucketId: bucket.id }));
  };

  const removeExpense = (id: string) => {
    setData((current) => ({
      ...current,
      expenses: current.expenses.filter((expense) => expense.id !== id),
    }));
  };

  const removeSavings = (id: string) => {
    setData((current) => ({
      ...current,
      savingsEntries: current.savingsEntries.filter((entry) => entry.id !== id),
    }));
  };

  const removeCategory = (id: string) => {
    if (data.expenses.some((expense) => expense.categoryId === id)) {
      window.alert("Delete the expenses in this category first.");
      return;
    }

    setData((current) => {
      const categories = current.categories.filter((category) => category.id !== id);

      return {
        ...current,
        categories,
      };
    });

    setExpenseForm((current) => ({
      ...current,
      categoryId: current.categoryId === id ? "" : current.categoryId,
    }));
  };

  const removeBucket = (id: string) => {
    if (data.savingsEntries.some((entry) => entry.bucketId === id)) {
      window.alert("Delete the savings entries in this bucket first.");
      return;
    }

    setData((current) => ({
      ...current,
      savingsBuckets: current.savingsBuckets.filter((bucket) => bucket.id !== id),
    }));

    setSavingsForm((current) => ({
      ...current,
      bucketId: current.bucketId === id ? "" : current.bucketId,
    }));
  };

  if (!isReady) {
    return (
      <div className="px-4 py-10">
        <div className="mx-auto max-w-6xl rounded-[32px] border border-white/50 bg-white/80 p-6 shadow-[0_20px_80px_rgba(15,23,42,0.12)]">
          <p className="text-sm text-slate-500">Loading your dashboard...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="px-4 py-5 sm:px-6">
      <div className="mx-auto flex max-w-6xl flex-col gap-5">
        <section className="rounded-[32px] border border-white/60 bg-[radial-gradient(circle_at_top_left,_rgba(167,139,250,0.22),_transparent_36%),linear-gradient(135deg,_rgba(255,255,255,0.96),_rgba(240,249,255,0.92))] p-5 shadow-[0_20px_80px_rgba(15,23,42,0.12)] backdrop-blur">
          <div className="flex flex-col gap-5">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.28em] text-violet-600">
                  Personal Finance
                </p>
                <h1 className="mt-2 text-3xl font-semibold tracking-tight text-slate-950">
                  Expense and savings command center
                </h1>
                <p className="mt-2 max-w-xl text-sm leading-6 text-slate-600">
                  Track spending by category, monitor savings buckets like SPI,
                  and read your money through salary-cycle analytics.
                </p>
              </div>

              <form action={logout}>
                <button
                  type="submit"
                  className="rounded-2xl border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 transition hover:border-slate-300 hover:bg-slate-50"
                >
                  Lock
                </button>
              </form>
            </div>

            <div className="rounded-[28px] bg-slate-950 p-5 text-white shadow-lg">
              <div className="flex flex-col gap-3">
                <p className="text-xs font-medium uppercase tracking-[0.24em] text-slate-400">
                  Current net balance
                </p>
                <p className="text-4xl font-semibold tracking-tight">
                  {formatCurrency(data.currentBalance)}
                </p>
                <p className="text-sm text-slate-300">
                  Salary cycle: {formatLongDate(cycle.start)} to{" "}
                  {formatLongDate(cycle.end)}
                </p>
              </div>
            </div>
          </div>
        </section>

        <section className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
          <StatCard label="Cycle spend" value={formatCurrency(currentCycleSpent)} />
          <StatCard label="Cycle saved" value={formatCurrency(currentCycleSaved)} />
          <StatCard label="Savings rate" value={`${savingsRate}%`} />
          <StatCard label="Days to salary" value={`${cycle.daysLeft}`} />
          <StatCard label="Projected spend" value={formatCurrency(projectedSpend)} />
          <StatCard label="Top category" value={topCategory} />
        </section>

        <section className="grid gap-5 xl:grid-cols-[1.3fr_0.7fr]">
          <Surface
            title="Spending by category"
            description="Current salary cycle"
          >
            {expenseByCategory.length ? (
              <div className="h-72">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={expenseByCategory}>
                    <CartesianGrid vertical={false} stroke="#e2e8f0" />
                    <XAxis dataKey="name" tickLine={false} axisLine={false} />
                    <YAxis
                      tickLine={false}
                      axisLine={false}
                      tickFormatter={(value) => `${Math.round(value / 1000)}k`}
                    />
                    <Tooltip
                      formatter={(value) => formatCurrency(Number(value ?? 0))}
                      cursor={{ fill: "rgba(148, 163, 184, 0.12)" }}
                    />
                    <Bar dataKey="total" radius={[12, 12, 0, 0]}>
                      {expenseByCategory.map((item) => (
                        <Cell key={item.name} fill={item.color} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            ) : (
              <EmptyState text="Add an expense to see which category is consuming the most money this cycle." />
            )}
          </Surface>

          <Surface title="Savings split" description="All-time by bucket">
            {savingsByBucket.length ? (
              <div className="space-y-4">
                {savingsByBucket.map((bucket) => (
                  <div key={bucket.name} className="space-y-2">
                    <div className="flex items-center justify-between text-sm">
                      <span className="font-medium text-slate-700">{bucket.name}</span>
                      <span className="text-slate-500">
                        {formatCurrency(bucket.total)}
                      </span>
                    </div>
                    <div className="h-3 overflow-hidden rounded-full bg-slate-100">
                      <div
                        className="h-full rounded-full"
                        style={{
                          width: `${Math.max(
                            12,
                            Math.round((bucket.total / totalSavings) * 100),
                          )}%`,
                          backgroundColor: bucket.color,
                        }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <EmptyState text="Savings buckets start filling once you add entries such as SPI or emergency fund contributions." />
            )}
          </Surface>
        </section>

        <section className="grid gap-5 xl:grid-cols-[1.1fr_0.9fr]">
          <Surface title="Monthly comparison" description="Last 6 calendar months">
            <div className="h-80">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={monthlyComparison}>
                  <CartesianGrid vertical={false} stroke="#e2e8f0" />
                  <XAxis dataKey="month" tickLine={false} axisLine={false} />
                  <YAxis
                    tickLine={false}
                    axisLine={false}
                    tickFormatter={(value) => `${Math.round(value / 1000)}k`}
                  />
                  <Tooltip
                    formatter={(value) => formatCurrency(Number(value ?? 0))}
                    cursor={{ fill: "rgba(148, 163, 184, 0.12)" }}
                  />
                  <Legend />
                  <Bar dataKey="spent" name="Spent" fill="#8b5cf6" radius={[10, 10, 0, 0]} />
                  <Bar dataKey="saved" name="Saved" fill="#14b8a6" radius={[10, 10, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </Surface>

          <Surface title="Recent activity" description="Latest expenses and savings">
            <div className="space-y-3">
              {recentActivity.length ? (
                recentActivity.map((item) => (
                  <div
                    key={item.id}
                    className="flex items-center justify-between rounded-2xl border border-slate-100 bg-slate-50 px-4 py-3"
                  >
                    <div>
                      <p className="font-medium text-slate-900">{item.title}</p>
                      <p className="text-sm text-slate-500">
                        {item.tag} • {formatShortDate(item.date)}
                      </p>
                    </div>
                    <p
                      className={`text-sm font-semibold ${
                        item.tone === "expense" ? "text-rose-600" : "text-emerald-600"
                      }`}
                    >
                      {item.tone === "expense" ? "-" : "+"}
                      {formatCurrency(item.amount)}
                    </p>
                  </div>
                ))
              ) : (
                <EmptyState text="Your latest movements appear here after the first expense or savings entry." />
              )}
            </div>
          </Surface>
        </section>

        <section className="grid gap-5 xl:grid-cols-2">
          <Surface title="Account settings" description="Update the live balance and salary date">
            <form onSubmit={handleBalanceSubmit} className="space-y-4">
              <label className="block space-y-2">
                <span className="text-sm font-medium text-slate-700">
                  Current account balance
                </span>
                <input
                  type="number"
                  step="0.01"
                  value={balanceInput}
                  onChange={(event) => setBalanceInput(event.target.value)}
                  className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 outline-none transition focus:border-violet-400 focus:bg-white"
                />
              </label>

              <label className="block space-y-2">
                <span className="text-sm font-medium text-slate-700">
                  Salary usually arrives on
                </span>
                <select
                  value={data.salaryDay}
                  onChange={(event) =>
                    setData((current) => ({
                      ...current,
                      salaryDay: Number(event.target.value) === 26 ? 26 : 25,
                    }))
                  }
                  className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 outline-none transition focus:border-violet-400 focus:bg-white"
                >
                  <option value={25}>25th</option>
                  <option value={26}>26th</option>
                </select>
              </label>

              <button
                type="submit"
                className="rounded-2xl bg-slate-950 px-4 py-3 text-sm font-semibold text-white transition hover:bg-slate-800"
              >
                Save balance
              </button>
            </form>
          </Surface>

          <Surface title="Quick signals" description="A glanceable reading of this cycle">
            <div className="grid gap-3 sm:grid-cols-2">
              <MiniInsight
                label="Available after cycle spend"
                value={formatCurrency(data.currentBalance - currentCycleSpent)}
              />
              <MiniInsight
                label="Total tracked savings"
                value={formatCurrency(totalSavings)}
              />
              <MiniInsight
                label="Expense entries"
                value={`${data.expenses.length}`}
              />
              <MiniInsight
                label="Savings entries"
                value={`${data.savingsEntries.length}`}
              />
            </div>
          </Surface>
        </section>

        <section className="grid gap-5 xl:grid-cols-[1.05fr_0.95fr]">
          <Surface
            title="Habit coach"
            description="A practical 50/30/20 check based on this cycle tracked money"
          >
            <div className="space-y-4">
              <div className="rounded-2xl border border-amber-100 bg-amber-50 px-4 py-4 text-sm leading-6 text-amber-900">
                The app uses your current balance plus this cycle tracked spending and
                savings as a planning base of {formatCurrency(planningBase)}.
              </div>

              <div className="h-72">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={habitRuleChartData}>
                    <CartesianGrid vertical={false} stroke="#e2e8f0" />
                    <XAxis dataKey="name" tickLine={false} axisLine={false} />
                    <YAxis
                      tickLine={false}
                      axisLine={false}
                      tickFormatter={(value) => `${Math.round(value / 1000)}k`}
                    />
                    <Tooltip
                      formatter={(value) => formatCurrency(Number(value ?? 0))}
                      cursor={{ fill: "rgba(148, 163, 184, 0.12)" }}
                    />
                    <Legend />
                    <Bar dataKey="Needs" stackId="habit" fill="#6366f1" radius={[10, 10, 0, 0]} />
                    <Bar dataKey="Wants" stackId="habit" fill="#f97316" radius={[10, 10, 0, 0]} />
                    <Bar dataKey="Savings" stackId="habit" fill="#14b8a6" radius={[10, 10, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          </Surface>

          <Surface title="Habit actions" description="Simple rules to keep spending healthier">
            <div className="grid gap-3 sm:grid-cols-3">
              <BudgetRuleCard
                title="Needs"
                tone="indigo"
                actual={needsSpent}
                target={targetNeeds}
              />
              <BudgetRuleCard
                title="Wants"
                tone="orange"
                actual={wantsSpent}
                target={targetWants}
              />
              <BudgetRuleCard
                title="Savings"
                tone="emerald"
                actual={currentCycleSaved}
                target={targetSavings}
              />
            </div>

            <div className="mt-5 space-y-3">
              {habitTips.map((tip) => (
                <div
                  key={tip}
                  className="rounded-2xl border border-slate-100 bg-slate-50 px-4 py-3 text-sm leading-6 text-slate-700"
                >
                  {tip}
                </div>
              ))}
            </div>
          </Surface>
        </section>

        <section className="grid gap-5 xl:grid-cols-2">
          <Surface title="Add expense" description="Map every spend into a category">
            <form onSubmit={handleAddExpense} className="space-y-4">
              <Input
                label="Expense title"
                value={expenseForm.title}
                onChange={(value) =>
                  setExpenseForm((current) => ({ ...current, title: value }))
                }
                placeholder="Groceries, rent, fuel..."
              />

              <div className="grid gap-4 sm:grid-cols-2">
                <Input
                  label="Amount"
                  type="number"
                  value={expenseForm.amount}
                  onChange={(value) =>
                    setExpenseForm((current) => ({ ...current, amount: value }))
                  }
                  placeholder="0"
                />
                <Field label="Category">
                  <select
                    value={expenseForm.categoryId}
                    onChange={(event) =>
                      setExpenseForm((current) => ({
                        ...current,
                        categoryId: event.target.value,
                      }))
                    }
                    className={fieldClassName}
                  >
                    {data.categories.map((category) => (
                      <option key={category.id} value={category.id}>
                        {category.name}
                      </option>
                    ))}
                  </select>
                </Field>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <Input
                  label="Date"
                  type="date"
                  value={expenseForm.date}
                  onChange={(value) =>
                    setExpenseForm((current) => ({ ...current, date: value }))
                  }
                />
                <Input
                  label="Note"
                  value={expenseForm.note}
                  onChange={(value) =>
                    setExpenseForm((current) => ({ ...current, note: value }))
                  }
                  placeholder="Optional detail"
                />
              </div>

              <button
                type="submit"
                className="rounded-2xl bg-violet-600 px-4 py-3 text-sm font-semibold text-white transition hover:bg-violet-700"
              >
                Add expense
              </button>
            </form>
          </Surface>

          <Surface title="Add savings" description="Track contributions like SPI and goals">
            <form onSubmit={handleAddSavings} className="space-y-4">
              <Input
                label="Savings title"
                value={savingsForm.title}
                onChange={(value) =>
                  setSavingsForm((current) => ({ ...current, title: value }))
                }
                placeholder="SPI, emergency fund..."
              />

              <div className="grid gap-4 sm:grid-cols-2">
                <Input
                  label="Amount"
                  type="number"
                  value={savingsForm.amount}
                  onChange={(value) =>
                    setSavingsForm((current) => ({ ...current, amount: value }))
                  }
                  placeholder="0"
                />
                <Field label="Savings bucket">
                  <select
                    value={savingsForm.bucketId}
                    onChange={(event) =>
                      setSavingsForm((current) => ({
                        ...current,
                        bucketId: event.target.value,
                      }))
                    }
                    className={fieldClassName}
                  >
                    {data.savingsBuckets.map((bucket) => (
                      <option key={bucket.id} value={bucket.id}>
                        {bucket.name}
                      </option>
                    ))}
                  </select>
                </Field>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <Input
                  label="Date"
                  type="date"
                  value={savingsForm.date}
                  onChange={(value) =>
                    setSavingsForm((current) => ({ ...current, date: value }))
                  }
                />
                <Input
                  label="Note"
                  value={savingsForm.note}
                  onChange={(value) =>
                    setSavingsForm((current) => ({ ...current, note: value }))
                  }
                  placeholder="Optional detail"
                />
              </div>

              <button
                type="submit"
                className="rounded-2xl bg-emerald-600 px-4 py-3 text-sm font-semibold text-white transition hover:bg-emerald-700"
              >
                Add savings
              </button>
            </form>
          </Surface>
        </section>

        <section className="grid gap-5 xl:grid-cols-2">
          <Surface title="Expense categories" description="Create custom spending groups">
            <form onSubmit={handleAddCategory} className="grid gap-4 sm:grid-cols-2">
              <Input
                label="Category name"
                value={categoryForm.name}
                onChange={(value) =>
                  setCategoryForm((current) => ({ ...current, name: value }))
                }
                placeholder="Medical, education..."
              />
              <Field label="Color">
                <input
                  type="color"
                  value={categoryForm.color}
                  onChange={(event) =>
                    setCategoryForm((current) => ({
                      ...current,
                      color: event.target.value,
                    }))
                  }
                  className="h-12 w-full rounded-2xl border border-slate-200 bg-slate-50 p-2"
                />
              </Field>
              <Field label="Budget type">
                <select
                  value={categoryForm.kind}
                  onChange={(event) =>
                    setCategoryForm((current) => ({
                      ...current,
                      kind: event.target.value === "wants" ? "wants" : "needs",
                    }))
                  }
                  className={fieldClassName}
                >
                  <option value="needs">Need / essential</option>
                  <option value="wants">Want / lifestyle</option>
                </select>
              </Field>
              <div className="flex items-end sm:col-span-2">
                <button
                  type="submit"
                  className="w-full rounded-2xl bg-slate-950 px-4 py-3 text-sm font-semibold text-white transition hover:bg-slate-800 sm:w-auto"
                >
                  Add
                </button>
              </div>
            </form>

            <div className="mt-5 space-y-3">
              {data.categories.map((category) => (
                <TagRow
                  key={category.id}
                  name={category.name}
                  color={category.color}
                  subtitle={category.kind === "needs" ? "Need / essential" : "Want / lifestyle"}
                  onDelete={() => removeCategory(category.id)}
                />
              ))}
            </div>
          </Surface>

          <Surface title="Savings buckets" description="Create groups like SPI, travel, or investments">
            <form onSubmit={handleAddBucket} className="grid gap-4 sm:grid-cols-[1fr_auto_auto]">
              <Input
                label="Bucket name"
                value={bucketForm.name}
                onChange={(value) =>
                  setBucketForm((current) => ({ ...current, name: value }))
                }
                placeholder="Home fund, MF, SPI..."
              />
              <Field label="Color">
                <input
                  type="color"
                  value={bucketForm.color}
                  onChange={(event) =>
                    setBucketForm((current) => ({
                      ...current,
                      color: event.target.value,
                    }))
                  }
                  className="h-12 w-full rounded-2xl border border-slate-200 bg-slate-50 p-2"
                />
              </Field>
              <div className="flex items-end">
                <button
                  type="submit"
                  className="w-full rounded-2xl bg-slate-950 px-4 py-3 text-sm font-semibold text-white transition hover:bg-slate-800"
                >
                  Add
                </button>
              </div>
            </form>

            <div className="mt-5 space-y-3">
              {data.savingsBuckets.map((bucket) => (
                <TagRow
                  key={bucket.id}
                  name={bucket.name}
                  color={bucket.color}
                  onDelete={() => removeBucket(bucket.id)}
                />
              ))}
            </div>
          </Surface>
        </section>

        <section className="grid gap-5 xl:grid-cols-2">
          <Surface title="Expense log" description="Latest spending records">
            <div className="space-y-3">
              {data.expenses.length ? (
                data.expenses.map((expense) => (
                  <LedgerRow
                    key={expense.id}
                    title={expense.title}
                    subtitle={`${categoryMap.get(expense.categoryId)?.name ?? "Category"} • ${formatShortDate(expense.date)}`}
                    amount={`-${formatCurrency(expense.amount)}`}
                    amountClassName="text-rose-600"
                    onDelete={() => removeExpense(expense.id)}
                  />
                ))
              ) : (
                <EmptyState text="No expenses added yet." />
              )}
            </div>
          </Surface>

          <Surface title="Savings log" description="Latest contributions">
            <div className="space-y-3">
              {data.savingsEntries.length ? (
                data.savingsEntries.map((entry) => (
                  <LedgerRow
                    key={entry.id}
                    title={entry.title}
                    subtitle={`${bucketMap.get(entry.bucketId)?.name ?? "Savings"} • ${formatShortDate(entry.date)}`}
                    amount={`+${formatCurrency(entry.amount)}`}
                    amountClassName="text-emerald-600"
                    onDelete={() => removeSavings(entry.id)}
                  />
                ))
              ) : (
                <EmptyState text="No savings entries added yet." />
              )}
            </div>
          </Surface>
        </section>
      </div>
    </div>
  );
}

function Surface({
  title,
  description,
  children,
}: {
  title: string;
  description: string;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-[28px] border border-white/60 bg-white/85 p-5 shadow-[0_20px_80px_rgba(15,23,42,0.08)] backdrop-blur">
      <div className="mb-5">
        <h2 className="text-lg font-semibold text-slate-950">{title}</h2>
        <p className="mt-1 text-sm text-slate-500">{description}</p>
      </div>
      {children}
    </section>
  );
}

function StatCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-[24px] border border-white/60 bg-white/80 p-4 shadow-[0_10px_40px_rgba(15,23,42,0.06)]">
      <p className="text-xs font-medium uppercase tracking-[0.16em] text-slate-500">
        {label}
      </p>
      <p className="mt-2 text-lg font-semibold tracking-tight text-slate-950">
        {value}
      </p>
    </div>
  );
}

function MiniInsight({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-slate-100 bg-slate-50 px-4 py-4">
      <p className="text-sm text-slate-500">{label}</p>
      <p className="mt-1 text-xl font-semibold tracking-tight text-slate-950">
        {value}
      </p>
    </div>
  );
}

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <label className="block space-y-2">
      <span className="text-sm font-medium text-slate-700">{label}</span>
      {children}
    </label>
  );
}

function Input({
  label,
  value,
  onChange,
  placeholder,
  type = "text",
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  type?: string;
}) {
  return (
    <Field label={label}>
      <input
        type={type}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        className={fieldClassName}
      />
    </Field>
  );
}

function TagRow({
  name,
  color,
  subtitle,
  onDelete,
}: {
  name: string;
  color: string;
  subtitle?: string;
  onDelete: () => void;
}) {
  return (
    <div className="flex items-center justify-between rounded-2xl border border-slate-100 bg-slate-50 px-4 py-3">
      <div className="flex items-center gap-3">
        <span
          className="inline-flex h-3 w-3 rounded-full"
          style={{ backgroundColor: color }}
        />
        <div>
          <p className="font-medium text-slate-800">{name}</p>
          {subtitle ? <p className="text-sm text-slate-500">{subtitle}</p> : null}
        </div>
      </div>
      <button
        type="button"
        onClick={onDelete}
        className="rounded-xl px-3 py-2 text-sm font-medium text-slate-500 transition hover:bg-white hover:text-rose-600"
      >
        Delete
      </button>
    </div>
  );
}

function BudgetRuleCard({
  title,
  actual,
  target,
  tone,
}: {
  title: string;
  actual: number;
  target: number;
  tone: "indigo" | "orange" | "emerald";
}) {
  const difference = actual - target;
  const status =
    tone === "emerald"
      ? difference >= 0
        ? "On track"
        : "Below target"
      : difference <= 0
        ? "Healthy"
        : "Over";
  const toneClassName =
    tone === "indigo"
      ? "bg-indigo-50 text-indigo-700 border-indigo-100"
      : tone === "orange"
        ? "bg-orange-50 text-orange-700 border-orange-100"
        : "bg-emerald-50 text-emerald-700 border-emerald-100";

  return (
    <div className={`rounded-2xl border px-4 py-4 ${toneClassName}`}>
      <div className="flex items-center justify-between gap-3">
        <p className="font-semibold">{title}</p>
        <span className="rounded-full bg-white/80 px-3 py-1 text-xs font-semibold">
          {status}
        </span>
      </div>
      <p className="mt-3 text-sm">Actual: {formatCurrency(actual)}</p>
      <p className="mt-1 text-sm">Target: {formatCurrency(target)}</p>
    </div>
  );
}

function LedgerRow({
  title,
  subtitle,
  amount,
  amountClassName,
  onDelete,
}: {
  title: string;
  subtitle: string;
  amount: string;
  amountClassName: string;
  onDelete: () => void;
}) {
  return (
    <div className="flex items-center justify-between rounded-2xl border border-slate-100 bg-slate-50 px-4 py-3">
      <div>
        <p className="font-medium text-slate-900">{title}</p>
        <p className="text-sm text-slate-500">{subtitle}</p>
      </div>
      <div className="flex items-center gap-3">
        <p className={`text-sm font-semibold ${amountClassName}`}>{amount}</p>
        <button
          type="button"
          onClick={onDelete}
          className="rounded-xl px-3 py-2 text-sm font-medium text-slate-500 transition hover:bg-white hover:text-rose-600"
        >
          Delete
        </button>
      </div>
    </div>
  );
}

function EmptyState({ text }: { text: string }) {
  return (
    <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 px-4 py-8 text-center text-sm leading-6 text-slate-500">
      {text}
    </div>
  );
}

const fieldClassName =
  "w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-base outline-none transition focus:border-violet-400 focus:bg-white";
