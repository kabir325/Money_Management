"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
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
  formatCurrency,
  formatLongDate,
  formatShortDate,
  getMonthBuckets,
  getSalaryCycleRange,
  isDateInRange,
  parseInputDate,
  todayInputValue,
  toMonthKey,
  type FinanceData,
} from "@/lib/finance";
import { useFinanceStore } from "@/hooks/use-finance-store";

type ExpenseFormState = {
  title: string;
  amount: string;
  categoryId: string;
  date: string;
  note: string;
};

const chartGrid = "#243041";
const chartAxis = "#94a3b8";
const tooltipStyle = {
  backgroundColor: "#020617",
  border: "1px solid #1e293b",
  borderRadius: "16px",
  color: "#e2e8f0",
};

const defaultExpenseForm = (data: FinanceData): ExpenseFormState => ({
  title: "",
  amount: "",
  categoryId: data.categories[0]?.id ?? "",
  date: todayInputValue(),
  note: "",
});

export function Dashboard() {
  const {
    data,
    isReady,
    syncError,
    retrySync,
    addExpense,
    removeExpense,
    removeSavings,
  } = useFinanceStore();
  const [isExpenseModalOpen, setExpenseModalOpen] = useState(false);
  const [expenseForm, setExpenseForm] = useState<ExpenseFormState>(
    defaultExpenseForm(DEFAULT_DATA),
  );

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
      ? `Move ${formatCurrency(savingsGap)} into savings to get closer to the 20% lane.`
      : "Savings are on track or ahead of the 20% lane this cycle.",
    wantsSpent > targetWants
      ? `Wants are ${formatCurrency(wantsSpent - targetWants)} above the 30% guide, so pause shopping or eating out for now.`
      : `You still have ${formatCurrency(wantsAvailable)} of wants room inside the 30% guide.`,
    needsSpent > targetNeeds
      ? `Essentials are ${formatCurrency(needsSpent - targetNeeds)} above the 50% guide. Review bills, groceries, and transport next.`
      : "Essentials are staying inside the 50% lane so far.",
    `Keep daily spending near ${formatCurrency(dailyAllowance)} until salary lands.`,
  ];

  const openExpenseModal = () => {
    setExpenseForm(defaultExpenseForm(data));
    setExpenseModalOpen(true);
  };

  const handleAddExpense = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const amount = Number(expenseForm.amount);

    if (!expenseForm.categoryId || !expenseForm.title.trim() || amount <= 0) {
      return;
    }

    addExpense({
      title: expenseForm.title,
      amount,
      categoryId: expenseForm.categoryId,
      date: expenseForm.date,
      note: expenseForm.note,
    });

    setExpenseForm(defaultExpenseForm(data));
    setExpenseModalOpen(false);
  };

  if (!isReady) {
    return (
      <div className="px-4 py-10">
        <div className="mx-auto max-w-6xl rounded-[32px] border border-slate-800 bg-slate-950/80 p-6">
          <p className="text-sm text-slate-400">Loading dashboard...</p>
        </div>
      </div>
    );
  }

  return (
    <>
      <div className="px-4 py-5 sm:px-6">
        <div className="mx-auto flex max-w-6xl flex-col gap-5 pb-28">
          {syncError ? (
            <div className="rounded-2xl border border-amber-500/20 bg-amber-500/10 px-4 py-3 text-sm text-amber-200">
              <div className="flex items-center justify-between gap-3">
                <span>{syncError}</span>
                <button
                  type="button"
                  onClick={() => void retrySync()}
                  className="rounded-xl border border-amber-500/20 px-3 py-1.5 text-xs font-semibold text-amber-100 transition hover:bg-amber-500/10"
                >
                  Retry
                </button>
              </div>
            </div>
          ) : null}

          <section className="rounded-[32px] border border-slate-800 bg-[radial-gradient(circle_at_top_left,_rgba(99,102,241,0.22),_transparent_38%),linear-gradient(135deg,_rgba(15,23,42,0.98),_rgba(2,6,23,0.98))] p-5 shadow-[0_24px_80px_rgba(2,6,23,0.55)]">
            <div className="flex flex-col gap-5">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.28em] text-violet-300">
                    Personal Finance
                  </p>
                  <h1 className="mt-2 text-3xl font-semibold tracking-tight text-slate-50">
                    Dark money dashboard
                  </h1>
                  <p className="mt-2 max-w-xl text-sm leading-6 text-slate-400">
                    Phone-first insights for expenses, savings, and healthier spending.
                  </p>
                </div>

                <div className="flex items-center gap-2">
                  <Link
                    href="/settings"
                    className="rounded-2xl border border-slate-700 bg-slate-900 px-4 py-2 text-sm font-medium text-slate-200 transition hover:border-slate-600 hover:bg-slate-800"
                  >
                    Settings
                  </Link>
                  <form action={logout}>
                    <button
                      type="submit"
                      className="rounded-2xl border border-slate-700 bg-slate-900 px-4 py-2 text-sm font-medium text-slate-200 transition hover:border-slate-600 hover:bg-slate-800"
                    >
                      Lock
                    </button>
                  </form>
                </div>
              </div>

              <div className="rounded-[28px] border border-slate-800 bg-slate-900/85 p-5 text-white">
                <div className="flex flex-col gap-3">
                  <p className="text-xs font-medium uppercase tracking-[0.24em] text-slate-500">
                    Current net balance
                  </p>
                  <p className="text-4xl font-semibold tracking-tight">
                    {formatCurrency(data.currentBalance)}
                  </p>
                  <p className="text-sm text-slate-400">
                    Salary cycle: {formatLongDate(cycle.start)} to {formatLongDate(cycle.end)}
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
            <Surface title="Spending by category" description="Current salary cycle">
              {expenseByCategory.length ? (
                <div className="h-72">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={expenseByCategory}>
                      <CartesianGrid vertical={false} stroke={chartGrid} />
                      <XAxis
                        dataKey="name"
                        tickLine={false}
                        axisLine={false}
                        tick={{ fill: chartAxis, fontSize: 12 }}
                      />
                      <YAxis
                        tickLine={false}
                        axisLine={false}
                        tick={{ fill: chartAxis, fontSize: 12 }}
                        tickFormatter={(value) => `${Math.round(value / 1000)}k`}
                      />
                      <Tooltip
                        formatter={(value) => formatCurrency(Number(value ?? 0))}
                        cursor={{ fill: "rgba(51,65,85,0.25)" }}
                        contentStyle={tooltipStyle}
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
                <EmptyState text="Tap the + button to add your first expense." />
              )}
            </Surface>

            <Surface title="Savings split" description="All-time by bucket">
              {savingsByBucket.length ? (
                <div className="space-y-4">
                  {savingsByBucket.map((bucket) => (
                    <div key={bucket.name} className="space-y-2">
                      <div className="flex items-center justify-between text-sm">
                        <span className="font-medium text-slate-200">{bucket.name}</span>
                        <span className="text-slate-400">
                          {formatCurrency(bucket.total)}
                        </span>
                      </div>
                      <div className="h-3 overflow-hidden rounded-full bg-slate-800">
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
                <EmptyState text="Savings buckets start filling after you add entries from settings." />
              )}
            </Surface>
          </section>

          <section className="grid gap-5 xl:grid-cols-[1.1fr_0.9fr]">
            <Surface title="Monthly comparison" description="Last 6 calendar months">
              <div className="h-80">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={monthlyComparison}>
                    <CartesianGrid vertical={false} stroke={chartGrid} />
                    <XAxis
                      dataKey="month"
                      tickLine={false}
                      axisLine={false}
                      tick={{ fill: chartAxis, fontSize: 12 }}
                    />
                    <YAxis
                      tickLine={false}
                      axisLine={false}
                      tick={{ fill: chartAxis, fontSize: 12 }}
                      tickFormatter={(value) => `${Math.round(value / 1000)}k`}
                    />
                    <Tooltip
                      formatter={(value) => formatCurrency(Number(value ?? 0))}
                      cursor={{ fill: "rgba(51,65,85,0.25)" }}
                      contentStyle={tooltipStyle}
                    />
                    <Legend wrapperStyle={{ color: "#cbd5e1" }} />
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
                      className="flex items-center justify-between rounded-2xl border border-slate-800 bg-slate-900 px-4 py-3"
                    >
                      <div>
                        <p className="font-medium text-slate-100">{item.title}</p>
                        <p className="text-sm text-slate-500">
                          {item.tag} • {formatShortDate(item.date)}
                        </p>
                      </div>
                      <p
                        className={`text-sm font-semibold ${
                          item.tone === "expense" ? "text-rose-400" : "text-emerald-400"
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
                <MiniInsight label="Expense entries" value={`${data.expenses.length}`} />
                <MiniInsight label="Savings entries" value={`${data.savingsEntries.length}`} />
              </div>
            </Surface>

            <Surface
              title="Habit actions"
              description="The dashboard keeps coaching you toward a better split"
            >
              <div className="grid gap-3 sm:grid-cols-3">
                <BudgetRuleCard title="Needs" tone="indigo" actual={needsSpent} target={targetNeeds} />
                <BudgetRuleCard title="Wants" tone="orange" actual={wantsSpent} target={targetWants} />
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
                    className="rounded-2xl border border-slate-800 bg-slate-900 px-4 py-3 text-sm leading-6 text-slate-300"
                  >
                    {tip}
                  </div>
                ))}
              </div>
            </Surface>
          </section>

          <section className="grid gap-5 xl:grid-cols-2">
            <Surface title="Budget lanes" description="Target vs actual 50 / 30 / 20">
              <div className="rounded-2xl border border-slate-800 bg-slate-900/70 px-4 py-4 text-sm leading-6 text-slate-300">
                Planning base: {formatCurrency(planningBase)}. This uses your live balance plus
                tracked money in the current cycle.
              </div>
              <div className="mt-4 h-72">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={habitRuleChartData}>
                    <CartesianGrid vertical={false} stroke={chartGrid} />
                    <XAxis
                      dataKey="name"
                      tickLine={false}
                      axisLine={false}
                      tick={{ fill: chartAxis, fontSize: 12 }}
                    />
                    <YAxis
                      tickLine={false}
                      axisLine={false}
                      tick={{ fill: chartAxis, fontSize: 12 }}
                      tickFormatter={(value) => `${Math.round(value / 1000)}k`}
                    />
                    <Tooltip
                      formatter={(value) => formatCurrency(Number(value ?? 0))}
                      cursor={{ fill: "rgba(51,65,85,0.25)" }}
                      contentStyle={tooltipStyle}
                    />
                    <Legend wrapperStyle={{ color: "#cbd5e1" }} />
                    <Bar dataKey="Needs" stackId="habit" fill="#6366f1" radius={[10, 10, 0, 0]} />
                    <Bar dataKey="Wants" stackId="habit" fill="#f97316" radius={[10, 10, 0, 0]} />
                    <Bar dataKey="Savings" stackId="habit" fill="#14b8a6" radius={[10, 10, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </Surface>

            <Surface title="Expense log" description="Latest spending records">
              <div className="space-y-3">
                {data.expenses.length ? (
                  data.expenses.map((expense) => (
                    <LedgerRow
                      key={expense.id}
                      title={expense.title}
                      subtitle={`${categoryMap.get(expense.categoryId)?.name ?? "Category"} • ${formatShortDate(expense.date)}`}
                      amount={`-${formatCurrency(expense.amount)}`}
                      amountClassName="text-rose-400"
                      onDelete={() => removeExpense(expense.id)}
                    />
                  ))
                ) : (
                  <EmptyState text="No expenses added yet." />
                )}
              </div>
            </Surface>
          </section>

          <section className="grid gap-5 xl:grid-cols-1">
            <Surface title="Savings log" description="Latest contributions">
              <div className="space-y-3">
                {data.savingsEntries.length ? (
                  data.savingsEntries.map((entry) => (
                    <LedgerRow
                      key={entry.id}
                      title={entry.title}
                      subtitle={`${bucketMap.get(entry.bucketId)?.name ?? "Savings"} • ${formatShortDate(entry.date)}`}
                      amount={`+${formatCurrency(entry.amount)}`}
                      amountClassName="text-emerald-400"
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

      <button
        type="button"
        onClick={openExpenseModal}
        className="fixed bottom-5 right-5 z-40 flex h-16 w-16 items-center justify-center rounded-full bg-violet-600 text-4xl font-light text-white shadow-[0_20px_50px_rgba(124,58,237,0.45)] transition hover:scale-[1.02] hover:bg-violet-500"
        aria-label="Add expense"
      >
        +
      </button>

      {isExpenseModalOpen ? (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm">
          <div className="absolute inset-x-0 bottom-0 mx-auto w-full max-w-lg rounded-t-[32px] border border-slate-800 bg-slate-950 p-5 shadow-2xl sm:bottom-6 sm:rounded-[32px]">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.24em] text-violet-300">
                  Quick Add
                </p>
                <h2 className="mt-2 text-2xl font-semibold text-slate-50">
                  Add expenditure
                </h2>
                <p className="mt-2 text-sm text-slate-400">
                  Use the floating action button any time you spend money.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setExpenseModalOpen(false)}
                className="rounded-2xl border border-slate-700 bg-slate-900 px-4 py-2 text-sm font-medium text-slate-200 transition hover:border-slate-600 hover:bg-slate-800"
              >
                Close
              </button>
            </div>

            <form onSubmit={handleAddExpense} className="mt-6 space-y-4">
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
                className="w-full rounded-2xl bg-violet-600 px-4 py-3 text-sm font-semibold text-white transition hover:bg-violet-500"
              >
                Save expense
              </button>
            </form>
          </div>
        </div>
      ) : null}
    </>
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
    <section className="rounded-[28px] border border-slate-800 bg-slate-950/80 p-5 shadow-[0_24px_70px_rgba(2,6,23,0.35)]">
      <div className="mb-5">
        <h2 className="text-lg font-semibold text-slate-50">{title}</h2>
        <p className="mt-1 text-sm text-slate-500">{description}</p>
      </div>
      {children}
    </section>
  );
}

function StatCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-[24px] border border-slate-800 bg-slate-950/80 p-4">
      <p className="text-xs font-medium uppercase tracking-[0.16em] text-slate-500">
        {label}
      </p>
      <p className="mt-2 text-lg font-semibold tracking-tight text-slate-50">{value}</p>
    </div>
  );
}

function MiniInsight({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-slate-800 bg-slate-900 px-4 py-4">
      <p className="text-sm text-slate-500">{label}</p>
      <p className="mt-1 text-xl font-semibold tracking-tight text-slate-50">{value}</p>
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
      <span className="text-sm font-medium text-slate-300">{label}</span>
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
      ? "bg-indigo-500/10 text-indigo-200 border-indigo-500/20"
      : tone === "orange"
        ? "bg-orange-500/10 text-orange-200 border-orange-500/20"
        : "bg-emerald-500/10 text-emerald-200 border-emerald-500/20";

  return (
    <div className={`rounded-2xl border px-4 py-4 ${toneClassName}`}>
      <div className="flex items-center justify-between gap-3">
        <p className="font-semibold">{title}</p>
        <span className="rounded-full bg-slate-950/60 px-3 py-1 text-xs font-semibold text-slate-100">
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
    <div className="flex items-center justify-between rounded-2xl border border-slate-800 bg-slate-900 px-4 py-3">
      <div>
        <p className="font-medium text-slate-100">{title}</p>
        <p className="text-sm text-slate-500">{subtitle}</p>
      </div>
      <div className="flex items-center gap-3">
        <p className={`text-sm font-semibold ${amountClassName}`}>{amount}</p>
        <button
          type="button"
          onClick={onDelete}
          className="rounded-xl px-3 py-2 text-sm font-medium text-slate-500 transition hover:bg-slate-800 hover:text-rose-300"
        >
          Delete
        </button>
      </div>
    </div>
  );
}

function EmptyState({ text }: { text: string }) {
  return (
    <div className="rounded-2xl border border-dashed border-slate-700 bg-slate-900 px-4 py-8 text-center text-sm leading-6 text-slate-500">
      {text}
    </div>
  );
}

const fieldClassName =
  "w-full rounded-2xl border border-slate-700 bg-slate-900 px-4 py-3 text-base text-slate-100 outline-none transition placeholder:text-slate-500 focus:border-violet-500 focus:bg-slate-950";
