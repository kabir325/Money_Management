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
  getAccountLabel,
  getEmergencyFundMonths,
  getEmergencyProfileLabel,
  getMonthBuckets,
  getSalaryCycleRange,
  isDateInRange,
  parseInputDate,
  todayInputValue,
  toInputDate,
  toMonthKey,
  toYearKey,
  type BalanceSource,
  type FinanceData,
} from "@/lib/finance";
import { useFinanceStore } from "@/hooks/use-finance-store";

type ExpenseFormState = {
  title: string;
  amount: string;
  categoryId: string;
  account: BalanceSource;
  date: string;
  note: string;
};

type CashFormState = {
  title: string;
  amount: string;
  account: BalanceSource;
  date: string;
  note: string;
};

type QuickAddMode = "expense" | "cash";
type ComparisonView = "daily" | "monthly" | "yearly";

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
  account: "bank",
  date: todayInputValue(),
  note: "",
});

const defaultCashForm = (): CashFormState => ({
  title: "",
  amount: "",
  account: "bank",
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
    addCashEntry,
    removeExpense,
    removeCashEntry,
  } = useFinanceStore();
  const [isQuickAddOpen, setQuickAddOpen] = useState(false);
  const [quickAddMode, setQuickAddMode] = useState<QuickAddMode>("expense");
  const [comparisonView, setComparisonView] = useState<ComparisonView>("monthly");
  const [activityLimit, setActivityLimit] = useState(5);
  const [expenseForm, setExpenseForm] = useState<ExpenseFormState>(
    defaultExpenseForm(DEFAULT_DATA),
  );
  const [cashForm, setCashForm] = useState<CashFormState>(defaultCashForm);

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
  const currentCycleCash = useMemo(
    () =>
      data.cashEntries.filter((entry) =>
        isDateInRange(entry.date, cycle.start, cycle.end),
      ),
    [cycle.end, cycle.start, data.cashEntries],
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
          ...bucket,
          total,
        };
      })
      .filter((bucket) => bucket.total > 0)
      .sort((left, right) => right.total - left.total);
  }, [data.savingsBuckets, data.savingsEntries]);

  const comparisonData = useMemo(
    () => buildComparisonData(data, comparisonView),
    [comparisonView, data],
  );

  const recentActivity = useMemo(() => {
    return [
      ...data.expenses.map((expense) => ({
        id: expense.id,
        title: expense.title,
        amount: expense.amount,
        date: expense.date,
        tag: `${categoryMap.get(expense.categoryId)?.name ?? "Category"} • ${getAccountLabel(
          expense.account,
        )}`,
        tone: "expense" as const,
      })),
      ...data.savingsEntries.map((entry) => ({
        id: entry.id,
        title: entry.title,
        amount: entry.amount,
        date: entry.date,
        tag: `${bucketMap.get(entry.bucketId)?.name ?? "Savings"} • ${getAccountLabel(
          entry.account,
        )}`,
        tone: "savings" as const,
      })),
      ...data.cashEntries.map((entry) => ({
        id: entry.id,
        title: entry.title,
        amount: entry.amount,
        date: entry.date,
        tag: `Money received • ${getAccountLabel(entry.account)}`,
        tone: "cash" as const,
      })),
      ...data.loans.flatMap((loan) =>
        loan.payments.map((payment) => ({
          id: payment.id,
          title: `${loan.title} payment`,
          amount: payment.amount,
          date: payment.date,
          tag: `Loan • ${getAccountLabel(payment.account)}`,
          tone: "expense" as const,
        })),
      ),
    ]
      .sort((left, right) => right.date.localeCompare(left.date))
      .slice(0, activityLimit);
  }, [
    activityLimit,
    bucketMap,
    categoryMap,
    data.cashEntries,
    data.expenses,
    data.loans,
    data.savingsEntries,
  ]);

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
  const currentCycleCashTotal = currentCycleCash.reduce(
    (sum, entry) => sum + entry.amount,
    0,
  );
  const totalSavings = data.savingsEntries.reduce((sum, entry) => sum + entry.amount, 0);
  const totalCashReceived = data.cashEntries.reduce((sum, entry) => sum + entry.amount, 0);
  const emergencyFundTotal = data.savingsEntries
    .filter((entry) => entry.bucketId === "emergency-fund")
    .reduce((sum, entry) => sum + entry.amount, 0);
  const emergencyFundTarget = data.salaryAmount * getEmergencyFundMonths(data.emergencyFundProfile);
  const emergencyFundProgress =
    emergencyFundTarget > 0
      ? Math.min(100, Math.round((emergencyFundTotal / emergencyFundTarget) * 100))
      : 0;
  const monthlyLoanLoad = data.loans.reduce((sum, loan) => sum + loan.monthlyPayment, 0);
  const totalOutstandingLoans = data.loans.reduce((sum, loan) => {
    const paid = loan.payments.reduce((paymentSum, payment) => paymentSum + payment.amount, 0);
    return sum + Math.max(loan.principalAmount - paid, 0);
  }, 0);
  const trackedCycleMoney = currentCycleSpent + currentCycleSaved + currentCycleCashTotal;
  const planningBase = Math.max(
    trackedCycleMoney,
    Math.max(data.currentBalance, 0) + trackedCycleMoney,
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
    trackedCycleMoney > 0 ? Math.round((currentCycleSaved / trackedCycleMoney) * 100) : 0;
  const cycleLength = Math.max(
    1,
    Math.ceil((cycle.end.getTime() - cycle.start.getTime()) / (1000 * 60 * 60 * 24)),
  );
  const elapsedDays = Math.max(cycleLength - cycle.daysLeft, 1);
  const projectedSpend = Math.round((currentCycleSpent / elapsedDays) * cycleLength);
  const topCategory = expenseByCategory[0]?.name ?? "No spending yet";
  const latestTransactions = [
    ...data.expenses.map((entry) => ({ kind: "expense" as const, entry })),
    ...data.cashEntries.map((entry) => ({ kind: "cash" as const, entry })),
  ]
    .sort((left, right) => right.entry.date.localeCompare(left.entry.date))
    .slice(0, 8);
  const habitTips = [
    savingsGap > 0
      ? `Move ${formatCurrency(savingsGap)} into savings to get closer to the 20% lane.`
      : "Savings are on track or ahead of the 20% lane this cycle.",
    wantsSpent > targetWants
      ? `Wants are ${formatCurrency(wantsSpent - targetWants)} above the 30% guide, so pause non-essential spending for now.`
      : `You still have ${formatCurrency(wantsAvailable)} of wants room inside the 30% guide.`,
    needsSpent > targetNeeds
      ? `Essentials are ${formatCurrency(needsSpent - targetNeeds)} above the 50% guide. Review bills, groceries, and transport next.`
      : "Essentials are staying inside the 50% lane so far.",
    `Keep daily spending near ${formatCurrency(dailyAllowance)} until salary lands.`,
  ];

  const openQuickAdd = () => {
    setExpenseForm(defaultExpenseForm(data));
    setCashForm(defaultCashForm());
    setQuickAddMode("expense");
    setQuickAddOpen(true);
  };

  const handleAddExpense = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const amount = Number(expenseForm.amount);

    if (!expenseForm.title.trim() || !expenseForm.categoryId || amount <= 0) {
      return;
    }

    addExpense({
      title: expenseForm.title,
      amount,
      categoryId: expenseForm.categoryId,
      account: expenseForm.account,
      date: expenseForm.date,
      note: expenseForm.note,
    });

    setExpenseForm(defaultExpenseForm(data));
    setQuickAddOpen(false);
  };

  const handleAddCashEntry = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const amount = Number(cashForm.amount);

    if (!cashForm.title.trim() || amount <= 0) {
      return;
    }

    addCashEntry({
      title: cashForm.title,
      amount,
      account: cashForm.account,
      date: cashForm.date,
      note: cashForm.note,
    });

    setCashForm(defaultCashForm());
    setQuickAddOpen(false);
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

          <section className="rounded-[32px] border border-slate-800 bg-[radial-gradient(circle_at_top_left,_rgba(99,102,241,0.16),_transparent_34%),linear-gradient(135deg,_rgba(15,23,42,0.98),_rgba(2,6,23,0.98))] p-5 shadow-[0_24px_80px_rgba(2,6,23,0.55)]">
            <div className="flex items-center justify-between gap-4">
              <h1 className="text-2xl font-semibold tracking-tight text-slate-50">
                Personal Finance
              </h1>

              <div className="flex items-center gap-2">
                <Link
                  href="/savings"
                  aria-label="Savings"
                  className="flex h-11 w-11 items-center justify-center rounded-2xl border border-slate-700 bg-slate-900 text-slate-200 transition hover:border-slate-600 hover:bg-slate-800"
                >
                  <SavingsIcon />
                </Link>
                <Link
                  href="/settings"
                  aria-label="Settings"
                  className="flex h-11 w-11 items-center justify-center rounded-2xl border border-slate-700 bg-slate-900 text-slate-200 transition hover:border-slate-600 hover:bg-slate-800"
                >
                  <SettingsIcon />
                </Link>
                <form action={logout}>
                  <button
                    type="submit"
                    aria-label="Lock"
                    className="flex h-11 w-11 items-center justify-center rounded-2xl border border-slate-700 bg-slate-900 text-slate-200 transition hover:border-slate-600 hover:bg-slate-800"
                  >
                    <LockIcon />
                  </button>
                </form>
              </div>
            </div>

            <div className="mt-5 grid grid-cols-2 gap-3 md:grid-cols-4 xl:grid-cols-8">
              <StatCard label="Total" value={formatCurrency(data.currentBalance)} />
              <StatCard label="Bank" value={formatCurrency(data.bankBalance)} />
              <StatCard label="Cash" value={formatCurrency(data.cashBalance)} />
              <StatCard label="Cycle spend" value={formatCurrency(currentCycleSpent)} />
              <StatCard label="Cash in" value={formatCurrency(currentCycleCashTotal)} />
              <StatCard label="Salary" value={formatCurrency(data.salaryAmount)} />
              <StatCard label="Cycle saved" value={formatCurrency(currentCycleSaved)} />
              <StatCard label="Savings rate" value={`${savingsRate}%`} />
            </div>

            <p className="mt-4 text-sm text-slate-500">
              Salary cycle: {formatLongDate(cycle.start)} to {formatLongDate(cycle.end)}
            </p>
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
                        tickFormatter={(value) => formatAxisValue(Number(value ?? 0))}
                      />
                      <Tooltip
                        formatter={(value) => [formatCurrency(Number(value ?? 0)), "Spent"]}
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

            <Surface title="Savings focus" description="Emergency fund and goals">
              <div className="space-y-4">
                <MiniInsight
                  label="Emergency target"
                  value={formatCurrency(emergencyFundTarget)}
                />
                <div className="rounded-2xl border border-slate-800 bg-slate-900 px-4 py-4">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <p className="font-medium text-slate-100">
                        {getEmergencyProfileLabel(data.emergencyFundProfile)}
                      </p>
                      <p className="mt-1 text-sm text-slate-500">
                        Emergency fund progress
                      </p>
                    </div>
                    <p className="text-sm font-semibold text-emerald-300">
                      {emergencyFundProgress}%
                    </p>
                  </div>
                  <div className="mt-3 h-3 overflow-hidden rounded-full bg-slate-800">
                    <div
                      className="h-full rounded-full bg-emerald-500"
                      style={{
                        width: `${Math.max(
                          emergencyFundProgress,
                          emergencyFundTotal > 0 ? 8 : 0,
                        )}%`,
                      }}
                    />
                  </div>
                  <p className="mt-3 text-sm text-slate-400">
                    {formatCurrency(emergencyFundTotal)} saved of{" "}
                    {formatCurrency(emergencyFundTarget || 0)}
                  </p>
                </div>
                <Link
                  href="/savings"
                  className="inline-flex items-center rounded-2xl border border-slate-700 bg-slate-900 px-4 py-3 text-sm font-medium text-slate-200 transition hover:border-slate-600 hover:bg-slate-800"
                >
                  Open savings page
                </Link>
              </div>
            </Surface>
          </section>

          <section className="grid gap-5 xl:grid-cols-[1.1fr_0.9fr]">
            <Surface
              title="Comparison"
              description={getComparisonDescription(comparisonView)}
              actions={
                <SegmentedControl<ComparisonView>
                  value={comparisonView}
                  options={[
                    { value: "daily", label: "Daily" },
                    { value: "monthly", label: "Monthly" },
                    { value: "yearly", label: "Yearly" },
                  ]}
                  onChange={setComparisonView}
                />
              }
            >
              <div className="h-80">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={comparisonData}>
                    <CartesianGrid vertical={false} stroke={chartGrid} />
                    <XAxis
                      dataKey="label"
                      tickLine={false}
                      axisLine={false}
                      tick={{ fill: chartAxis, fontSize: 12 }}
                    />
                    <YAxis
                      tickLine={false}
                      axisLine={false}
                      tick={{ fill: chartAxis, fontSize: 12 }}
                      tickFormatter={(value) => formatAxisValue(Number(value ?? 0))}
                    />
                    <Tooltip
                      formatter={(value) => formatCurrency(Number(value ?? 0))}
                      cursor={{ fill: "rgba(51,65,85,0.25)" }}
                      contentStyle={tooltipStyle}
                    />
                    <Legend wrapperStyle={{ color: "#cbd5e1" }} />
                    <Bar dataKey="spent" name="Spent" fill="#8b5cf6" radius={[10, 10, 0, 0]} />
                    <Bar dataKey="saved" name="Saved" fill="#14b8a6" radius={[10, 10, 0, 0]} />
                    <Bar
                      dataKey="received"
                      name="Cash In"
                      fill="#38bdf8"
                      radius={[10, 10, 0, 0]}
                    />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </Surface>

            <Surface
              title="Recent activity"
              description="Latest records across spending, savings, cash, and loan payments"
              actions={
                <select
                  value={activityLimit}
                  onChange={(event) => setActivityLimit(Number(event.target.value))}
                  className="rounded-xl border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-200 outline-none"
                >
                  {[5, 10, 20, 50].map((count) => (
                    <option key={count} value={count}>
                      {count} entries
                    </option>
                  ))}
                </select>
              }
            >
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
                          item.tone === "expense"
                            ? "text-rose-400"
                            : item.tone === "cash"
                              ? "text-sky-400"
                              : "text-emerald-400"
                        }`}
                      >
                        {item.tone === "expense" ? "-" : "+"}
                        {formatCurrency(item.amount)}
                      </p>
                    </div>
                  ))
                ) : (
                  <EmptyState text="Your latest movements appear here after the first entry." />
                )}
              </div>
            </Surface>
          </section>

          <section className="grid gap-5 xl:grid-cols-2">
            <Surface title="Quick signals" description="A glanceable reading of this cycle">
              <div className="grid gap-3 sm:grid-cols-2">
                <MiniInsight label="Projected spend" value={formatCurrency(projectedSpend)} />
                <MiniInsight label="Total tracked savings" value={formatCurrency(totalSavings)} />
                <MiniInsight label="Cash gifts tracked" value={formatCurrency(totalCashReceived)} />
                <MiniInsight label="Monthly loan load" value={formatCurrency(monthlyLoanLoad)} />
                <MiniInsight label="Outstanding loans" value={formatCurrency(totalOutstandingLoans)} />
                <MiniInsight label="Top category" value={topCategory} />
                <MiniInsight label="Days to salary" value={`${cycle.daysLeft}`} />
                <MiniInsight label="Safe daily pace" value={formatCurrency(dailyAllowance)} />
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
            <Surface title="Money split" description="Live cash vs bank position">
              <div className="space-y-4">
                <BalanceBar
                  label="Bank balance"
                  amount={data.bankBalance}
                  total={data.currentBalance}
                  tone="violet"
                />
                <BalanceBar
                  label="Cash balance"
                  amount={data.cashBalance}
                  total={data.currentBalance}
                  tone="sky"
                />
                <div className="rounded-2xl border border-slate-800 bg-slate-900/70 px-4 py-4 text-sm leading-6 text-slate-300">
                  Planning base: {formatCurrency(planningBase)}. This uses your live balances
                  and tracked money in the current salary cycle.
                </div>
              </div>
            </Surface>

            <Surface title="Latest transactions" description="Recent expense and money received entries">
              <div className="space-y-3">
                {latestTransactions.length ? (
                  latestTransactions.map((item) =>
                    item.kind === "expense" ? (
                      <LedgerRow
                        key={item.entry.id}
                        title={item.entry.title}
                        subtitle={`${categoryMap.get(item.entry.categoryId)?.name ?? "Category"} • ${getAccountLabel(item.entry.account)} • ${formatShortDate(item.entry.date)}`}
                        amount={`-${formatCurrency(item.entry.amount)}`}
                        amountClassName="text-rose-400"
                        onDelete={() => removeExpense(item.entry.id)}
                      />
                    ) : (
                      <LedgerRow
                        key={item.entry.id}
                        title={item.entry.title}
                        subtitle={`Money received • ${getAccountLabel(item.entry.account)} • ${formatShortDate(item.entry.date)}`}
                        amount={`+${formatCurrency(item.entry.amount)}`}
                        amountClassName="text-sky-400"
                        onDelete={() => removeCashEntry(item.entry.id)}
                      />
                    ),
                  )
                ) : (
                  <EmptyState text="Your latest expense and money received entries show here." />
                )}
              </div>
            </Surface>
          </section>

          <section className="grid gap-5 xl:grid-cols-2">
            <Surface title="Savings buckets" description="All-time progress by bucket">
              {savingsByBucket.length ? (
                <div className="space-y-4">
                  {savingsByBucket.map((bucket) => (
                    <div key={bucket.id} className="space-y-2">
                      <div className="flex items-center justify-between text-sm">
                        <span className="font-medium text-slate-200">{bucket.name}</span>
                        <span className="text-slate-400">{formatCurrency(bucket.total)}</span>
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
                <EmptyState text="Savings buckets start filling after you add savings entries." />
              )}
            </Surface>

            <Surface title="Emergency rule" description="3 / 6 / 9 month safety goal">
              <div className="rounded-2xl border border-slate-800 bg-slate-900 px-4 py-4">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="font-medium text-slate-100">
                      {getEmergencyProfileLabel(data.emergencyFundProfile)}
                    </p>
                    <p className="mt-1 text-sm text-slate-500">
                      Target built from your salary settings
                    </p>
                  </div>
                  <p className="text-sm font-semibold text-emerald-300">
                    {formatCurrency(emergencyFundTarget)}
                  </p>
                </div>
                <div className="mt-4 h-3 overflow-hidden rounded-full bg-slate-800">
                  <div
                    className="h-full rounded-full bg-emerald-500"
                    style={{
                      width: `${Math.max(
                        emergencyFundProgress,
                        emergencyFundTotal > 0 ? 8 : 0,
                      )}%`,
                    }}
                  />
                </div>
                <p className="mt-3 text-sm text-slate-400">
                  {formatCurrency(emergencyFundTotal)} saved so far.
                </p>
              </div>
            </Surface>
          </section>
        </div>
      </div>

      <button
        type="button"
        onClick={openQuickAdd}
        className="fixed bottom-5 right-5 z-40 flex h-16 w-16 items-center justify-center rounded-full bg-violet-600 text-4xl font-light text-white shadow-[0_20px_50px_rgba(124,58,237,0.45)] transition hover:scale-[1.02] hover:bg-violet-500"
        aria-label="Add transaction"
      >
        +
      </button>

      {isQuickAddOpen ? (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm">
          <div className="absolute inset-x-0 bottom-0 mx-auto w-full max-w-lg rounded-t-[32px] border border-slate-800 bg-slate-950 p-5 shadow-2xl sm:bottom-6 sm:rounded-[32px]">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.24em] text-violet-300">
                  Quick Add
                </p>
                <h2 className="mt-2 text-2xl font-semibold text-slate-50">
                  {quickAddMode === "expense" ? "Add expenditure" : "Add money received"}
                </h2>
                <p className="mt-2 text-sm text-slate-400">
                  {quickAddMode === "expense"
                    ? "Track what you spent and whether it came from bank or cash."
                    : "Track money you received and where you kept it."}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setQuickAddOpen(false)}
                className="rounded-2xl border border-slate-700 bg-slate-900 px-4 py-2 text-sm font-medium text-slate-200 transition hover:border-slate-600 hover:bg-slate-800"
              >
                Close
              </button>
            </div>

            <div className="mt-6 grid grid-cols-2 gap-2 rounded-2xl border border-slate-800 bg-slate-900 p-1">
              <button
                type="button"
                onClick={() => setQuickAddMode("expense")}
                className={`rounded-2xl px-4 py-3 text-sm font-semibold transition ${
                  quickAddMode === "expense"
                    ? "bg-violet-600 text-white"
                    : "text-slate-300 hover:bg-slate-800"
                }`}
              >
                Expense
              </button>
              <button
                type="button"
                onClick={() => setQuickAddMode("cash")}
                className={`rounded-2xl px-4 py-3 text-sm font-semibold transition ${
                  quickAddMode === "cash"
                    ? "bg-sky-600 text-white"
                    : "text-slate-300 hover:bg-slate-800"
                }`}
              >
                Money received
              </button>
            </div>

            {quickAddMode === "expense" ? (
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
                  <Field label="Paid from">
                    <select
                      value={expenseForm.account}
                      onChange={(event) =>
                        setExpenseForm((current) => ({
                          ...current,
                          account: event.target.value === "cash" ? "cash" : "bank",
                        }))
                      }
                      className={fieldClassName}
                    >
                      <option value="bank">Bank</option>
                      <option value="cash">Cash</option>
                    </select>
                  </Field>
                  <Input
                    label="Date"
                    type="date"
                    value={expenseForm.date}
                    onChange={(value) =>
                      setExpenseForm((current) => ({ ...current, date: value }))
                    }
                  />
                </div>

                <Input
                  label="Note"
                  value={expenseForm.note}
                  onChange={(value) =>
                    setExpenseForm((current) => ({ ...current, note: value }))
                  }
                  placeholder="Optional detail"
                />

                <button
                  type="submit"
                  className="w-full rounded-2xl bg-violet-600 px-4 py-3 text-sm font-semibold text-white transition hover:bg-violet-500"
                >
                  Save expense
                </button>
              </form>
            ) : (
              <form onSubmit={handleAddCashEntry} className="mt-6 space-y-4">
                <Input
                  label="Money source"
                  value={cashForm.title}
                  onChange={(value) =>
                    setCashForm((current) => ({ ...current, title: value }))
                  }
                  placeholder="Gift, family help, side cash..."
                />

                <div className="grid gap-4 sm:grid-cols-2">
                  <Input
                    label="Amount"
                    type="number"
                    value={cashForm.amount}
                    onChange={(value) =>
                      setCashForm((current) => ({ ...current, amount: value }))
                    }
                    placeholder="0"
                  />
                  <Field label="Added to">
                    <select
                      value={cashForm.account}
                      onChange={(event) =>
                        setCashForm((current) => ({
                          ...current,
                          account: event.target.value === "cash" ? "cash" : "bank",
                        }))
                      }
                      className={fieldClassName}
                    >
                      <option value="bank">Bank</option>
                      <option value="cash">Cash</option>
                    </select>
                  </Field>
                </div>

                <div className="grid gap-4 sm:grid-cols-2">
                  <Input
                    label="Date"
                    type="date"
                    value={cashForm.date}
                    onChange={(value) =>
                      setCashForm((current) => ({ ...current, date: value }))
                    }
                  />
                  <Input
                    label="Note"
                    value={cashForm.note}
                    onChange={(value) =>
                      setCashForm((current) => ({ ...current, note: value }))
                    }
                    placeholder="Optional detail"
                  />
                </div>

                <button
                  type="submit"
                  className="w-full rounded-2xl bg-sky-600 px-4 py-3 text-sm font-semibold text-white transition hover:bg-sky-500"
                >
                  Save money received
                </button>
              </form>
            )}
          </div>
        </div>
      ) : null}
    </>
  );
}

function Surface({
  title,
  description,
  actions,
  children,
}: {
  title: string;
  description: string;
  actions?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-[28px] border border-slate-800 bg-slate-950/80 p-5 shadow-[0_24px_70px_rgba(2,6,23,0.35)]">
      <div className="mb-5 flex items-start justify-between gap-4">
        <div>
          <h2 className="text-lg font-semibold text-slate-50">{title}</h2>
          <p className="mt-1 text-sm text-slate-500">{description}</p>
        </div>
        {actions ? <div className="shrink-0">{actions}</div> : null}
      </div>
      {children}
    </section>
  );
}

function SegmentedControl<T extends string>({
  value,
  options,
  onChange,
}: {
  value: T;
  options: { value: T; label: string }[];
  onChange: (value: T) => void;
}) {
  return (
    <div className="grid grid-cols-3 gap-1 rounded-2xl border border-slate-800 bg-slate-900 p-1">
      {options.map((option) => (
        <button
          key={option.value}
          type="button"
          onClick={() => onChange(option.value)}
          className={`rounded-xl px-3 py-2 text-sm font-medium transition ${
            value === option.value
              ? "bg-violet-600 text-white"
              : "text-slate-300 hover:bg-slate-800"
          }`}
        >
          {option.label}
        </button>
      ))}
    </div>
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

function BalanceBar({
  label,
  amount,
  total,
  tone,
}: {
  label: string;
  amount: number;
  total: number;
  tone: "violet" | "sky";
}) {
  const width = total > 0 ? Math.max(8, Math.round((amount / total) * 100)) : 0;
  const color = tone === "sky" ? "bg-sky-500" : "bg-violet-500";

  return (
    <div className="rounded-2xl border border-slate-800 bg-slate-900 px-4 py-4">
      <div className="flex items-center justify-between gap-3">
        <p className="font-medium text-slate-100">{label}</p>
        <p className="text-sm font-semibold text-slate-300">{formatCurrency(amount)}</p>
      </div>
      <div className="mt-3 h-3 overflow-hidden rounded-full bg-slate-800">
        <div className={`h-full rounded-full ${color}`} style={{ width: `${width}%` }} />
      </div>
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

function SavingsIcon() {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      className="h-5 w-5"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M5 12a7 7 0 1 0 14 0c0-2.7-1.7-5-4.1-6" />
      <path d="M12 12c2.2 0 4-1.3 4-3s-1.8-3-4-3-4 1.3-4 3" />
      <path d="M12 12v7" />
      <path d="M8 19h8" />
    </svg>
  );
}

function SettingsIcon() {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      className="h-5 w-5"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <circle cx="12" cy="12" r="3.25" />
      <path d="M19.4 15a1 1 0 0 0 .2 1.1l.1.1a2 2 0 0 1 0 2.8 2 2 0 0 1-2.8 0l-.1-.1a1 1 0 0 0-1.1-.2 1 1 0 0 0-.6.9V20a2 2 0 0 1-4 0v-.2a1 1 0 0 0-.6-.9 1 1 0 0 0-1.1.2l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1 1 0 0 0 .2-1.1 1 1 0 0 0-.9-.6H4a2 2 0 0 1 0-4h.2a1 1 0 0 0 .9-.6 1 1 0 0 0-.2-1.1l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1 1 0 0 0 1.1.2 1 1 0 0 0 .6-.9V4a2 2 0 0 1 4 0v.2a1 1 0 0 0 .6.9 1 1 0 0 0 1.1-.2l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1 1 0 0 0-.2 1.1 1 1 0 0 0 .9.6H20a2 2 0 0 1 0 4h-.2a1 1 0 0 0-.9.6Z" />
    </svg>
  );
}

function LockIcon() {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      className="h-5 w-5"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <rect x="5" y="11" width="14" height="10" rx="2.5" />
      <path d="M8 11V8a4 4 0 1 1 8 0v3" />
      <circle cx="12" cy="16" r="1" fill="currentColor" stroke="none" />
    </svg>
  );
}

function buildComparisonData(data: FinanceData, view: ComparisonView) {
  const buckets =
    view === "daily"
      ? getDailyBuckets(7)
      : view === "yearly"
        ? getYearBuckets(5)
        : getMonthBuckets(6).map((bucket) => ({ key: bucket.key, label: bucket.label }));

  return buckets.map((bucket) => ({
    label: bucket.label,
    spent: data.expenses
      .filter((expense) => getBucketKey(expense.date, view) === bucket.key)
      .reduce((sum, expense) => sum + expense.amount, 0),
    saved: data.savingsEntries
      .filter((entry) => getBucketKey(entry.date, view) === bucket.key)
      .reduce((sum, entry) => sum + entry.amount, 0),
    received: data.cashEntries
      .filter((entry) => getBucketKey(entry.date, view) === bucket.key)
      .reduce((sum, entry) => sum + entry.amount, 0),
  }));
}

function getBucketKey(date: string, view: ComparisonView) {
  const parsed = parseInputDate(date);

  if (view === "daily") {
    return toInputDate(parsed);
  }

  if (view === "yearly") {
    return toYearKey(parsed);
  }

  return toMonthKey(parsed);
}

function getDailyBuckets(dayCount: number) {
  return Array.from({ length: dayCount }, (_, index) => {
    const date = new Date();
    date.setDate(date.getDate() - (dayCount - 1 - index));
    return {
      key: toInputDate(date),
      label: date.toLocaleDateString("en-IN", { day: "numeric", month: "short" }),
    };
  });
}

function getYearBuckets(yearCount: number) {
  const currentYear = new Date().getFullYear();
  return Array.from({ length: yearCount }, (_, index) => {
    const year = currentYear - (yearCount - 1 - index);
    return {
      key: `${year}`,
      label: `${year}`,
    };
  });
}

function getComparisonDescription(view: ComparisonView) {
  if (view === "daily") {
    return "Last 7 days";
  }

  if (view === "yearly") {
    return "Last 5 years";
  }

  return "Last 6 calendar months";
}

function formatAxisValue(value: number) {
  if (value >= 100000) {
    return `${Math.round(value / 100000)}L`;
  }

  if (value >= 1000) {
    return `${Math.round(value / 1000)}k`;
  }

  return `${Math.round(value)}`;
}

const fieldClassName =
  "w-full rounded-2xl border border-slate-700 bg-slate-900 px-4 py-3 text-base text-slate-100 outline-none transition placeholder:text-slate-500 focus:border-violet-500 focus:bg-slate-950";
