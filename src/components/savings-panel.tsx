"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { logout } from "@/app/actions/auth";
import {
  formatCurrency,
  formatLongDate,
  formatShortDate,
  getAccountLabel,
  getEmergencyFundMonths,
  getEmergencyProfileDescription,
  getEmergencyProfileLabel,
  parseInputDate,
  todayInputValue,
  type BalanceSource,
} from "@/lib/finance";
import { useFinanceStore } from "@/hooks/use-finance-store";

type SavingsFormState = {
  title: string;
  amount: string;
  bucketId: string;
  account: BalanceSource;
  date: string;
  note: string;
};

type LoanFormState = {
  title: string;
  lender: string;
  principalAmount: string;
  monthlyPayment: string;
  totalMonths: string;
  dueDay: string;
  startDate: string;
  note: string;
};

type LoanPaymentFormState = {
  amount: string;
  account: BalanceSource;
  date: string;
  note: string;
};

export function SavingsPanel() {
  const {
    data,
    isReady,
    syncError,
    retrySync,
    addSavings,
    removeSavings,
    addLoan,
    addLoanPayment,
    removeLoan,
  } = useFinanceStore();
  const [savingsForm, setSavingsForm] = useState<SavingsFormState>({
    title: "",
    amount: "",
    bucketId: "",
    account: "bank",
    date: todayInputValue(),
    note: "",
  });
  const [loanForm, setLoanForm] = useState<LoanFormState>({
    title: "",
    lender: "",
    principalAmount: "",
    monthlyPayment: "",
    totalMonths: "12",
    dueDay: "5",
    startDate: todayInputValue(),
    note: "",
  });
  const [paymentForms, setPaymentForms] = useState<Record<string, LoanPaymentFormState>>({});

  const emergencyFundTotal = useMemo(
    () =>
      data.savingsEntries
        .filter((entry) => entry.bucketId === "emergency-fund")
        .reduce((sum, entry) => sum + entry.amount, 0),
    [data.savingsEntries],
  );
  const emergencyMonths = getEmergencyFundMonths(data.emergencyFundProfile);
  const emergencyTarget = data.salaryAmount * emergencyMonths;
  const emergencyProgress =
    emergencyTarget > 0 ? Math.min(100, Math.round((emergencyFundTotal / emergencyTarget) * 100)) : 0;
  const totalSavings = data.savingsEntries.reduce((sum, entry) => sum + entry.amount, 0);
  const totalOutstandingLoans = data.loans.reduce((sum, loan) => {
    const paid = loan.payments.reduce((paymentSum, payment) => paymentSum + payment.amount, 0);
    return sum + Math.max(loan.principalAmount - paid, 0);
  }, 0);

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

  const loanCards = useMemo(() => {
    return data.loans.map((loan) => {
      const paidAmount = loan.payments.reduce((sum, payment) => sum + payment.amount, 0);
      const outstanding = Math.max(loan.principalAmount - paidAmount, 0);
      const progress =
        loan.principalAmount > 0
          ? Math.min(100, Math.round((paidAmount / loan.principalAmount) * 100))
          : 0;

      return {
        ...loan,
        paidAmount,
        outstanding,
        progress,
      };
    });
  }, [data.loans]);

  const handleSavingsSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const amount = Number(savingsForm.amount);

    if (!savingsForm.title.trim() || !savingsForm.bucketId || amount <= 0) {
      return;
    }

    addSavings({
      title: savingsForm.title,
      amount,
      bucketId: savingsForm.bucketId,
      account: savingsForm.account,
      date: savingsForm.date,
      note: savingsForm.note,
    });

    setSavingsForm((current) => ({
      ...current,
      title: "",
      amount: "",
      date: todayInputValue(),
      note: "",
    }));
  };

  const handleLoanSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const principalAmount = Number(loanForm.principalAmount);
    const monthlyPayment = Number(loanForm.monthlyPayment);
    const totalMonths = Number(loanForm.totalMonths);
    const dueDay = Number(loanForm.dueDay);

    if (!loanForm.title.trim() || principalAmount <= 0 || monthlyPayment <= 0 || totalMonths <= 0) {
      return;
    }

    addLoan({
      title: loanForm.title,
      lender: loanForm.lender,
      principalAmount,
      monthlyPayment,
      totalMonths,
      dueDay,
      startDate: loanForm.startDate,
      note: loanForm.note,
    });

    setLoanForm({
      title: "",
      lender: "",
      principalAmount: "",
      monthlyPayment: "",
      totalMonths: "12",
      dueDay: "5",
      startDate: todayInputValue(),
      note: "",
    });
  };

  const handleLoanPaymentSubmit = (loanId: string) => (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = paymentForms[loanId] ?? defaultPaymentForm();
    const amount = Number(form.amount);

    if (amount <= 0) {
      return;
    }

    addLoanPayment({
      loanId,
      amount,
      account: form.account,
      date: form.date,
      note: form.note,
    });

    setPaymentForms((current) => ({
      ...current,
      [loanId]: defaultPaymentForm(),
    }));
  };

  if (!isReady) {
    return (
      <div className="px-4 py-10">
        <div className="mx-auto max-w-6xl rounded-[32px] border border-slate-800 bg-slate-950/80 p-6">
          <p className="text-sm text-slate-400">Loading savings...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="px-4 py-5 sm:px-6">
      <div className="mx-auto flex max-w-6xl flex-col gap-5 pb-10">
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

        <section className="rounded-[32px] border border-slate-800 bg-[radial-gradient(circle_at_top_left,_rgba(20,184,166,0.18),_transparent_40%),linear-gradient(135deg,_rgba(15,23,42,0.98),_rgba(2,6,23,0.98))] p-5 shadow-[0_24px_80px_rgba(2,6,23,0.55)]">
          <div className="flex flex-col gap-5">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h1 className="text-3xl font-semibold tracking-tight text-slate-50">
                  Savings
                </h1>
                <p className="mt-2 max-w-xl text-sm leading-6 text-slate-400">
                  Track savings goals, emergency cover, loans, and monthly payments in one
                  place.
                </p>
              </div>

              <div className="flex items-center gap-2">
                <Link
                  href="/"
                  className="rounded-2xl border border-slate-700 bg-slate-900 px-4 py-2 text-sm font-medium text-slate-200 transition hover:border-slate-600 hover:bg-slate-800"
                >
                  Dashboard
                </Link>
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

            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              <SummaryCard label="Total savings" value={formatCurrency(totalSavings)} />
              <SummaryCard label="Emergency fund" value={formatCurrency(emergencyFundTotal)} />
              <SummaryCard label="Emergency target" value={formatCurrency(emergencyTarget)} />
              <SummaryCard label="Loans outstanding" value={formatCurrency(totalOutstandingLoans)} />
            </div>
          </div>
        </section>

        <section className="grid gap-5 xl:grid-cols-[1.05fr_0.95fr]">
          <Surface title="Emergency fund goal" description="Built from your salary and 3 / 6 / 9 rule">
            <div className="rounded-2xl border border-slate-800 bg-slate-900 px-4 py-4">
              <div className="flex items-center justify-between gap-4">
                <div>
                  <p className="font-medium text-slate-100">
                    {getEmergencyProfileLabel(data.emergencyFundProfile)}
                  </p>
                  <p className="mt-1 text-sm leading-6 text-slate-400">
                    {getEmergencyProfileDescription(data.emergencyFundProfile)}
                  </p>
                </div>
                <p className="text-sm font-semibold text-emerald-300">
                  {emergencyMonths} months
                </p>
              </div>
              <div className="mt-4 h-3 overflow-hidden rounded-full bg-slate-800">
                <div
                  className="h-full rounded-full bg-emerald-500"
                  style={{
                    width: `${Math.max(emergencyProgress, emergencyFundTotal > 0 ? 8 : 0)}%`,
                  }}
                />
              </div>
              <div className="mt-3 flex items-center justify-between text-sm">
                <span className="text-slate-400">
                  {formatCurrency(emergencyFundTotal)} saved
                </span>
                <span className="font-medium text-slate-200">
                  {emergencyProgress}% reached
                </span>
              </div>
            </div>
          </Surface>

          <Surface title="Savings split" description="All-time progress by bucket">
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
                          width: `${Math.max(12, Math.round((bucket.total / totalSavings) * 100))}%`,
                          backgroundColor: bucket.color,
                        }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <EmptyState text="Savings buckets will start filling once you add entries." />
            )}
          </Surface>
        </section>

        <section className="grid gap-5 xl:grid-cols-2">
          <Surface title="Add savings entry" description="Choose the savings bucket and account source">
            <form onSubmit={handleSavingsSubmit} className="space-y-4">
              <Input
                label="Savings title"
                value={savingsForm.title}
                onChange={(value) =>
                  setSavingsForm((current) => ({ ...current, title: value }))
                }
                placeholder="SPI, emergency fund, bike goal..."
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
                <Field label="Bucket">
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
                    <option value="">Select bucket</option>
                    {data.savingsBuckets.map((bucket) => (
                      <option key={bucket.id} value={bucket.id}>
                        {bucket.name}
                      </option>
                    ))}
                  </select>
                </Field>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="Paid from">
                  <select
                    value={savingsForm.account}
                    onChange={(event) =>
                      setSavingsForm((current) => ({
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
                  value={savingsForm.date}
                  onChange={(value) =>
                    setSavingsForm((current) => ({ ...current, date: value }))
                  }
                />
              </div>

              <Input
                label="Note"
                value={savingsForm.note}
                onChange={(value) =>
                  setSavingsForm((current) => ({ ...current, note: value }))
                }
                placeholder="Optional detail"
              />

              <button
                type="submit"
                className="rounded-2xl bg-emerald-600 px-4 py-3 text-sm font-semibold text-white transition hover:bg-emerald-500"
              >
                Add savings
              </button>
            </form>
          </Surface>

          <Surface title="Savings log" description="Your latest savings entries">
            <div className="space-y-3">
              {data.savingsEntries.length ? (
                data.savingsEntries.map((entry) => (
                  <LedgerRow
                    key={entry.id}
                    title={entry.title}
                    subtitle={`${data.savingsBuckets.find((bucket) => bucket.id === entry.bucketId)?.name ?? "Savings"} • ${getAccountLabel(entry.account)} • ${formatShortDate(entry.date)}`}
                    amount={`-${formatCurrency(entry.amount)}`}
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

        <section className="grid gap-5 xl:grid-cols-[0.9fr_1.1fr]">
          <Surface title="Add loan" description="Track a bike loan, finance, or any EMI plan">
            <form onSubmit={handleLoanSubmit} className="space-y-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <Input
                  label="Loan title"
                  value={loanForm.title}
                  onChange={(value) =>
                    setLoanForm((current) => ({ ...current, title: value }))
                  }
                  placeholder="Bike loan"
                />
                <Input
                  label="Lender"
                  value={loanForm.lender}
                  onChange={(value) =>
                    setLoanForm((current) => ({ ...current, lender: value }))
                  }
                  placeholder="Bank or finance company"
                />
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <Input
                  label="Total loan amount"
                  type="number"
                  value={loanForm.principalAmount}
                  onChange={(value) =>
                    setLoanForm((current) => ({ ...current, principalAmount: value }))
                  }
                  placeholder="0"
                />
                <Input
                  label="Monthly payment"
                  type="number"
                  value={loanForm.monthlyPayment}
                  onChange={(value) =>
                    setLoanForm((current) => ({ ...current, monthlyPayment: value }))
                  }
                  placeholder="0"
                />
              </div>

              <div className="grid gap-4 sm:grid-cols-3">
                <Input
                  label="Total months"
                  type="number"
                  value={loanForm.totalMonths}
                  onChange={(value) =>
                    setLoanForm((current) => ({ ...current, totalMonths: value }))
                  }
                  placeholder="12"
                />
                <Input
                  label="EMI due day"
                  type="number"
                  value={loanForm.dueDay}
                  onChange={(value) =>
                    setLoanForm((current) => ({ ...current, dueDay: value }))
                  }
                  placeholder="5"
                />
                <Input
                  label="Start date"
                  type="date"
                  value={loanForm.startDate}
                  onChange={(value) =>
                    setLoanForm((current) => ({ ...current, startDate: value }))
                  }
                />
              </div>

              <Input
                label="Note"
                value={loanForm.note}
                onChange={(value) =>
                  setLoanForm((current) => ({ ...current, note: value }))
                }
                placeholder="Optional detail"
              />

              <button
                type="submit"
                className="rounded-2xl bg-violet-600 px-4 py-3 text-sm font-semibold text-white transition hover:bg-violet-500"
              >
                Add loan
              </button>
            </form>
          </Surface>

          <Surface title="Loan tracker" description="Outstanding balances and monthly payment progress">
            <div className="space-y-4">
              {loanCards.length ? (
                loanCards.map((loan) => {
                  const paymentForm = paymentForms[loan.id] ?? defaultPaymentForm();

                  return (
                    <div
                      key={loan.id}
                      className="rounded-[24px] border border-slate-800 bg-slate-900 p-4"
                    >
                      <div className="flex flex-wrap items-start justify-between gap-4">
                        <div>
                          <p className="text-lg font-semibold text-slate-50">{loan.title}</p>
                          <p className="mt-1 text-sm text-slate-500">
                            {loan.lender || "Lender not set"} • Started{" "}
                            {formatLongDate(parseInputDate(loan.startDate))}
                          </p>
                        </div>
                        <button
                          type="button"
                          onClick={() => removeLoan(loan.id)}
                          className="rounded-xl px-3 py-2 text-sm font-medium text-slate-500 transition hover:bg-slate-800 hover:text-rose-300"
                        >
                          Delete
                        </button>
                      </div>

                      <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                        <SummaryCard label="Outstanding" value={formatCurrency(loan.outstanding)} />
                        <SummaryCard label="Paid so far" value={formatCurrency(loan.paidAmount)} />
                        <SummaryCard
                          label="Monthly payment"
                          value={formatCurrency(loan.monthlyPayment)}
                        />
                        <SummaryCard
                          label="Installments"
                          value={`${loan.payments.length} / ${loan.totalMonths}`}
                        />
                      </div>

                      <div className="mt-4 h-3 overflow-hidden rounded-full bg-slate-800">
                        <div
                          className="h-full rounded-full bg-violet-500"
                          style={{ width: `${Math.max(loan.progress, loan.paidAmount > 0 ? 8 : 0)}%` }}
                        />
                      </div>

                      <p className="mt-3 text-sm text-slate-400">
                        EMI due around day {loan.dueDay} every month.
                      </p>

                      <form onSubmit={handleLoanPaymentSubmit(loan.id)} className="mt-4 space-y-4">
                        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
                          <Input
                            label="Payment amount"
                            type="number"
                            value={paymentForm.amount}
                            onChange={(value) =>
                              setPaymentForms((current) => ({
                                ...current,
                                [loan.id]: {
                                  ...paymentForm,
                                  amount: value,
                                },
                              }))
                            }
                            placeholder="0"
                          />
                          <Field label="Paid from">
                            <select
                              value={paymentForm.account}
                              onChange={(event) =>
                                setPaymentForms((current) => ({
                                  ...current,
                                  [loan.id]: {
                                    ...paymentForm,
                                    account: event.target.value === "cash" ? "cash" : "bank",
                                  },
                                }))
                              }
                              className={fieldClassName}
                            >
                              <option value="bank">Bank</option>
                              <option value="cash">Cash</option>
                            </select>
                          </Field>
                          <Input
                            label="Payment date"
                            type="date"
                            value={paymentForm.date}
                            onChange={(value) =>
                              setPaymentForms((current) => ({
                                ...current,
                                [loan.id]: {
                                  ...paymentForm,
                                  date: value,
                                },
                              }))
                            }
                          />
                          <Input
                            label="Note"
                            value={paymentForm.note}
                            onChange={(value) =>
                              setPaymentForms((current) => ({
                                ...current,
                                [loan.id]: {
                                  ...paymentForm,
                                  note: value,
                                },
                              }))
                            }
                            placeholder="Optional"
                          />
                        </div>

                        <button
                          type="submit"
                          className="rounded-2xl bg-slate-100 px-4 py-3 text-sm font-semibold text-slate-950 transition hover:bg-white"
                        >
                          Add loan payment
                        </button>
                      </form>
                    </div>
                  );
                })
              ) : (
                <EmptyState text="No loans added yet. Add one here when you finance your bike or take any loan." />
              )}
            </div>
          </Surface>
        </section>
      </div>
    </div>
  );
}

function defaultPaymentForm(): LoanPaymentFormState {
  return {
    amount: "",
    account: "bank",
    date: todayInputValue(),
    note: "",
  };
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

function SummaryCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-slate-800 bg-slate-900 px-4 py-4">
      <p className="text-sm text-slate-500">{label}</p>
      <p className="mt-1 text-xl font-semibold text-slate-50">{value}</p>
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
  "w-full rounded-2xl border border-slate-700 bg-slate-900 px-4 py-3 text-base text-slate-100 outline-none transition placeholder:text-slate-500 focus:border-emerald-500 focus:bg-slate-950";
