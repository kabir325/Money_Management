"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { logout } from "@/app/actions/auth";
import {
  formatCurrency,
  getEmergencyProfileDescription,
  getEmergencyProfileLabel,
  type EmergencyFundProfile,
  type SpendingType,
} from "@/lib/finance";
import { useFinanceStore } from "@/hooks/use-finance-store";

type CategoryFormState = {
  name: string;
  color: string;
  kind: SpendingType;
};

type BucketFormState = {
  name: string;
  color: string;
};

export function SettingsPanel() {
  const {
    data,
    isReady,
    syncError,
    retrySync,
    updateBalances,
    updateSalaryDay,
    updateSalaryAmount,
    updateEmergencyFundProfile,
    replaceData,
    addCategory,
    addBucket,
    removeCategory,
    removeBucket,
  } = useFinanceStore();
  const [bankBalanceInput, setBankBalanceInput] = useState("0");
  const [cashBalanceInput, setCashBalanceInput] = useState("0");
  const [salaryAmountInput, setSalaryAmountInput] = useState("0");
  const [salaryDayInput, setSalaryDayInput] = useState("25");
  const [profileInput, setProfileInput] = useState<EmergencyFundProfile>("secure");
  const [categoryForm, setCategoryForm] = useState<CategoryFormState>({
    name: "",
    color: "#8b5cf6",
    kind: "needs",
  });
  const [bucketForm, setBucketForm] = useState<BucketFormState>({
    name: "",
    color: "#14b8a6",
  });
  const backupInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (!isReady) {
      return;
    }

    const frame = window.requestAnimationFrame(() => {
      setBankBalanceInput(data.bankBalance.toString());
      setCashBalanceInput(data.cashBalance.toString());
      setSalaryAmountInput(data.salaryAmount.toString());
      setSalaryDayInput(data.salaryDay.toString());
      setProfileInput(data.emergencyFundProfile);
    });

    return () => window.cancelAnimationFrame(frame);
  }, [
    data.bankBalance,
    data.cashBalance,
    data.emergencyFundProfile,
    data.salaryAmount,
    data.salaryDay,
    isReady,
  ]);

  const handleAccountSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    updateBalances(Number(bankBalanceInput), Number(cashBalanceInput));
    updateSalaryAmount(Number(salaryAmountInput));
    updateSalaryDay(Number(salaryDayInput));
    updateEmergencyFundProfile(profileInput);
  };

  const handleCategorySubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const name = categoryForm.name.trim();
    if (!name) {
      return;
    }

    addCategory({
      name,
      color: categoryForm.color,
      kind: categoryForm.kind,
    });

    setCategoryForm((current) => ({ ...current, name: "" }));
  };

  const handleBucketSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const name = bucketForm.name.trim();
    if (!name) {
      return;
    }

    addBucket({
      name,
      color: bucketForm.color,
    });

    setBucketForm((current) => ({ ...current, name: "" }));
  };

  const handleCategoryDelete = (id: string) => {
    if (!removeCategory(id)) {
      window.alert("Delete the expenses in this category first.");
    }
  };

  const handleBucketDelete = (id: string) => {
    if (!removeBucket(id)) {
      window.alert("Delete the savings entries in this bucket first.");
    }
  };

  const handleExportBackup = () => {
    const blob = new Blob([JSON.stringify(data, null, 2)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `personal-finance-backup-${new Date().toISOString().slice(0, 10)}.json`;
    anchor.click();
    URL.revokeObjectURL(url);
  };

  const handleImportBackup = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) {
      return;
    }

    try {
      const raw = await file.text();
      const parsed = JSON.parse(raw);
      replaceData(parsed);
      window.alert("Backup imported successfully.");
    } catch {
      window.alert("Could not import that backup file.");
    } finally {
      event.target.value = "";
    }
  };

  if (!isReady) {
    return (
      <div className="px-4 py-10">
        <div className="mx-auto max-w-6xl rounded-[32px] border border-slate-800 bg-slate-950/80 p-6">
          <p className="text-sm text-slate-400">Loading settings...</p>
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
                  Settings
                </h1>
                <p className="mt-2 max-w-xl text-sm leading-6 text-slate-400">
                  Set your bank and cash balances, salary details, emergency profile, and
                  finance categories.
                </p>
              </div>

              <div className="flex items-center gap-2">
                <Link
                  href="/"
                  className="rounded-2xl border border-slate-700 bg-slate-900 px-4 py-2 text-sm font-medium text-slate-200 transition hover:border-slate-600 hover:bg-slate-800"
                >
                  Back
                </Link>
                <Link
                  href="/savings"
                  className="rounded-2xl border border-slate-700 bg-slate-900 px-4 py-2 text-sm font-medium text-slate-200 transition hover:border-slate-600 hover:bg-slate-800"
                >
                  Savings
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
              <SummaryCard label="Total balance" value={formatCurrency(data.currentBalance)} />
              <SummaryCard label="Bank" value={formatCurrency(data.bankBalance)} />
              <SummaryCard label="Cash" value={formatCurrency(data.cashBalance)} />
              <SummaryCard label="Salary" value={formatCurrency(data.salaryAmount)} />
            </div>
          </div>
        </section>

        <section className="grid gap-5 xl:grid-cols-2">
          <Surface title="Account details" description="Set the actual money you have right now">
            <form onSubmit={handleAccountSubmit} className="space-y-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <Input
                  label="Bank balance"
                  type="number"
                  value={bankBalanceInput}
                  onChange={setBankBalanceInput}
                  placeholder="0"
                />
                <Input
                  label="Cash balance"
                  type="number"
                  value={cashBalanceInput}
                  onChange={setCashBalanceInput}
                  placeholder="0"
                />
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <Input
                  label="Monthly salary amount"
                  type="number"
                  value={salaryAmountInput}
                  onChange={setSalaryAmountInput}
                  placeholder="0"
                />
                <Input
                  label="Salary date"
                  type="number"
                  value={salaryDayInput}
                  onChange={setSalaryDayInput}
                  placeholder="25"
                />
              </div>

              <Field label="Which type of individual are you?">
                <select
                  value={profileInput}
                  onChange={(event) =>
                    setProfileInput(
                      event.target.value === "family"
                        ? "family"
                        : event.target.value === "freelancer"
                          ? "freelancer"
                          : "secure",
                    )
                  }
                  className={fieldClassName}
                >
                  <option value="secure">3 months: secure / stable income</option>
                  <option value="family">6 months: family / dependents / loans</option>
                  <option value="freelancer">9 months: freelancer / volatile income</option>
                </select>
              </Field>

              <div className="rounded-2xl border border-slate-800 bg-slate-900 px-4 py-4 text-sm leading-6 text-slate-300">
                <p className="font-medium text-slate-100">{getEmergencyProfileLabel(profileInput)}</p>
                <p className="mt-1 text-slate-400">
                  {getEmergencyProfileDescription(profileInput)}
                </p>
              </div>

              <button
                type="submit"
                className="rounded-2xl bg-emerald-600 px-4 py-3 text-sm font-semibold text-white transition hover:bg-emerald-500"
              >
                Save settings
              </button>
            </form>
          </Surface>

          <Surface title="Savings and loans" description="These now live on their own page">
            <div className="space-y-4">
              <div className="rounded-2xl border border-slate-800 bg-slate-900 px-4 py-4 text-sm leading-6 text-slate-300">
                Use the dedicated savings page to add savings entries, track emergency-fund
                progress, create loans, and log monthly loan payments.
              </div>
              <Link
                href="/savings"
                className="inline-flex items-center rounded-2xl bg-violet-600 px-4 py-3 text-sm font-semibold text-white transition hover:bg-violet-500"
              >
                Open savings page
              </Link>
            </div>
          </Surface>
        </section>

        <section className="grid gap-5 xl:grid-cols-2">
          <Surface title="Backup" description="Export or restore your full synced finance data">
            <div className="space-y-4">
              <div className="rounded-2xl border border-slate-800 bg-slate-900 px-4 py-4 text-sm leading-6 text-slate-300">
                Export creates a JSON backup of balances, settings, expenses, savings, salary
                entries, and loans. Import replaces the current synced data with the backup file.
              </div>
              <div className="flex flex-wrap gap-3">
                <button
                  type="button"
                  onClick={handleExportBackup}
                  className="rounded-2xl bg-violet-600 px-4 py-3 text-sm font-semibold text-white transition hover:bg-violet-500"
                >
                  Export backup
                </button>
                <button
                  type="button"
                  onClick={() => backupInputRef.current?.click()}
                  className="rounded-2xl border border-slate-700 bg-slate-900 px-4 py-3 text-sm font-semibold text-slate-200 transition hover:border-slate-600 hover:bg-slate-800"
                >
                  Import backup
                </button>
                <input
                  ref={backupInputRef}
                  type="file"
                  accept="application/json"
                  onChange={handleImportBackup}
                  className="hidden"
                />
              </div>
            </div>
          </Surface>
        </section>

        <section className="grid gap-5 xl:grid-cols-2">
          <Surface title="Expense categories" description="Classify what is a need vs a want">
            <form onSubmit={handleCategorySubmit} className="grid gap-4 sm:grid-cols-2">
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
                  className="h-12 w-full rounded-2xl border border-slate-700 bg-slate-900 p-2"
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
                  className="w-full rounded-2xl bg-slate-100 px-4 py-3 text-sm font-semibold text-slate-950 transition hover:bg-white sm:w-auto"
                >
                  Add category
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
                  onDelete={() => handleCategoryDelete(category.id)}
                />
              ))}
            </div>
          </Surface>

          <Surface title="Savings buckets" description="Group savings like SPI, travel, or MF">
            <form onSubmit={handleBucketSubmit} className="grid gap-4 sm:grid-cols-[1fr_auto_auto]">
              <Input
                label="Bucket name"
                value={bucketForm.name}
                onChange={(value) =>
                  setBucketForm((current) => ({ ...current, name: value }))
                }
                placeholder="SPI, travel, MF..."
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
                  className="h-12 w-full rounded-2xl border border-slate-700 bg-slate-900 p-2"
                />
              </Field>
              <div className="flex items-end">
                <button
                  type="submit"
                  className="w-full rounded-2xl bg-slate-100 px-4 py-3 text-sm font-semibold text-slate-950 transition hover:bg-white"
                >
                  Add bucket
                </button>
              </div>
            </form>

            <div className="mt-5 space-y-3">
              {data.savingsBuckets.map((bucket) => (
                <TagRow
                  key={bucket.id}
                  name={bucket.name}
                  color={bucket.color}
                  onDelete={() => handleBucketDelete(bucket.id)}
                />
              ))}
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
    <div className="flex items-center justify-between rounded-2xl border border-slate-800 bg-slate-900 px-4 py-3">
      <div className="flex items-center gap-3">
        <span
          className="inline-flex h-3 w-3 rounded-full"
          style={{ backgroundColor: color }}
        />
        <div>
          <p className="font-medium text-slate-100">{name}</p>
          {subtitle ? <p className="text-sm text-slate-500">{subtitle}</p> : null}
        </div>
      </div>
      <button
        type="button"
        onClick={onDelete}
        className="rounded-xl px-3 py-2 text-sm font-medium text-slate-500 transition hover:bg-slate-800 hover:text-rose-300"
      >
        Delete
      </button>
    </div>
  );
}

const fieldClassName =
  "w-full rounded-2xl border border-slate-700 bg-slate-900 px-4 py-3 text-base text-slate-100 outline-none transition placeholder:text-slate-500 focus:border-emerald-500 focus:bg-slate-950";
