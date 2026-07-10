"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  DEFAULT_DATA,
  STORAGE_KEY,
  normalizeFinanceData,
  withUpdatedTimestamp,
  type BalanceSource,
  type EmergencyFundProfile,
  type FinanceData,
  type SalaryDay,
  type SpendingType,
} from "@/lib/finance";

type AddExpenseInput = {
  title: string;
  amount: number;
  categoryId: string;
  account: BalanceSource;
  date: string;
  note?: string;
};

type AddSavingsInput = {
  title: string;
  amount: number;
  bucketId: string;
  account: BalanceSource;
  date: string;
  note?: string;
};

type AddCashEntryInput = {
  title: string;
  amount: number;
  account: BalanceSource;
  date: string;
  note?: string;
};

type AddSalaryEntryInput = {
  amount: number;
  account: BalanceSource;
  date: string;
  salaryMonthKey: string;
  note?: string;
};

type AddCategoryInput = {
  name: string;
  color: string;
  kind: SpendingType;
};

type AddBucketInput = {
  name: string;
  color: string;
};

type AddLoanInput = {
  title: string;
  lender: string;
  principalAmount: number;
  monthlyPayment: number;
  totalMonths: number;
  dueDay: number;
  startDate: string;
  note?: string;
};

type AddLoanPaymentInput = {
  loanId: string;
  amount: number;
  account: BalanceSource;
  date: string;
  note?: string;
};

type UpdateExpenseInput = AddExpenseInput;
type UpdateSavingsInput = AddSavingsInput;
type UpdateLoanPaymentInput = Omit<AddLoanPaymentInput, "loanId">;

const SYNC_POLL_MS = 5000;

export function useFinanceStore() {
  const [data, setData] = useState<FinanceData>(DEFAULT_DATA);
  const [isReady, setIsReady] = useState(false);
  const [syncError, setSyncError] = useState<string | null>(null);
  const latestDataRef = useRef<FinanceData>(DEFAULT_DATA);

  useEffect(() => {
    latestDataRef.current = data;
  }, [data]);

  const applyRemoteData = useCallback((incomingData: FinanceData) => {
    setData((current) => {
      return incomingData.updatedAt > current.updatedAt ? incomingData : current;
    });
  }, []);

  const persistRemoteData = useCallback((nextData: FinanceData) => {
    return (async () => {
      try {
        const response = await fetch("/api/finance", {
          method: "PUT",
          headers: {
            "Content-Type": "application/json",
          },
          credentials: "same-origin",
          body: JSON.stringify({ data: nextData }),
        });

        if (!response.ok) {
          const payload = (await response.json().catch(() => null)) as
            | { error?: string }
            | null;
          throw new Error(payload?.error ?? "Unable to save synced data.");
        }

        const payload = (await response.json()) as { data: FinanceData };
        const savedData = normalizeFinanceData(payload.data);
        latestDataRef.current = savedData;
        setData(savedData);
        setSyncError(null);
      } catch (error) {
        setSyncError(
          error instanceof Error ? error.message : "Unable to save your finance data.",
        );
      }
    })();
  }, []);

  const loadRemoteData = useCallback(
    async (mode: "initial" | "poll" = "poll") => {
      try {
        const response = await fetch("/api/finance", {
          method: "GET",
          cache: "no-store",
          credentials: "same-origin",
        });

        if (!response.ok) {
          const payload = (await response.json().catch(() => null)) as
            | { error?: string }
            | null;
          throw new Error(payload?.error ?? "Unable to load synced data.");
        }

        const payload = (await response.json()) as { data: FinanceData };
        const remoteData = normalizeFinanceData(payload.data);
        const legacyLocalData =
          mode === "initial" ? getLegacyLocalData() : null;

        if (mode === "initial" && legacyLocalData && shouldMigrateLegacyData(remoteData)) {
          const migratedData = withUpdatedTimestamp(legacyLocalData);
          latestDataRef.current = migratedData;
          setData(migratedData);
          void persistRemoteData(migratedData);
        } else {
          applyRemoteData(remoteData);
        }

        setSyncError(null);

        if (mode === "initial") {
          setIsReady(true);
        }
      } catch (error) {
        if (mode === "initial") {
          setData(DEFAULT_DATA);
          setIsReady(true);
        }

        setSyncError(
          error instanceof Error ? error.message : "Unable to sync your finance data.",
        );
      }
    },
    [applyRemoteData, persistRemoteData],
  );

  const updateData = useCallback(
    (updater: (current: FinanceData) => FinanceData) => {
      setData((current) => {
        const nextData = withUpdatedTimestamp(
          normalizeFinanceData(updater(current)),
        );
        latestDataRef.current = nextData;
        void persistRemoteData(nextData);
        return nextData;
      });
    },
    [persistRemoteData],
  );

  useEffect(() => {
    const frame = window.requestAnimationFrame(() => {
      void loadRemoteData("initial");
    });

    const interval = window.setInterval(() => {
      void loadRemoteData("poll");
    }, SYNC_POLL_MS);

    const onFocus = () => {
      void loadRemoteData("poll");
    };

    window.addEventListener("focus", onFocus);

    return () => {
      window.cancelAnimationFrame(frame);
      window.clearInterval(interval);
      window.removeEventListener("focus", onFocus);
    };
  }, [loadRemoteData]);

  const updateBalance = (currentBalance: number) => {
    updateData((current) => ({
      ...current,
      bankBalance: Number.isFinite(currentBalance) ? currentBalance : 0,
      cashBalance: 0,
    }));
  };

  const updateBalances = (bankBalance: number, cashBalance: number) => {
    updateData((current) => ({
      ...current,
      bankBalance: Number.isFinite(bankBalance) ? bankBalance : 0,
      cashBalance: Number.isFinite(cashBalance) ? cashBalance : 0,
    }));
  };

  const updateSalaryDay = (salaryDay: SalaryDay) => {
    updateData((current) => ({
      ...current,
      salaryDay,
    }));
  };

  const updateSalaryAmount = (salaryAmount: number) => {
    updateData((current) => ({
      ...current,
      salaryAmount: Number.isFinite(salaryAmount) ? salaryAmount : 0,
    }));
  };

  const updateEmergencyFundProfile = (emergencyFundProfile: EmergencyFundProfile) => {
    updateData((current) => ({
      ...current,
      emergencyFundProfile,
    }));
  };

  const addExpense = (input: AddExpenseInput) => {
    updateData((current) => ({
      ...current,
      ...applyAccountDelta(current, input.account, -input.amount),
      expenses: [
        {
          id: crypto.randomUUID(),
          title: input.title.trim(),
          amount: input.amount,
          categoryId: input.categoryId,
          account: input.account,
          date: input.date,
          note: input.note?.trim() ?? "",
        },
        ...current.expenses,
      ],
    }));
  };

  const addSavings = (input: AddSavingsInput) => {
    updateData((current) => ({
      ...current,
      ...applyAccountDelta(current, input.account, -input.amount),
      savingsEntries: [
        {
          id: crypto.randomUUID(),
          title: input.title.trim(),
          amount: input.amount,
          bucketId: input.bucketId,
          account: input.account,
          date: input.date,
          note: input.note?.trim() ?? "",
        },
        ...current.savingsEntries,
      ],
    }));
  };

  const addCashEntry = (input: AddCashEntryInput) => {
    updateData((current) => ({
      ...current,
      ...applyAccountDelta(current, input.account, input.amount),
      cashEntries: [
        {
          id: crypto.randomUUID(),
          title: input.title.trim(),
          amount: input.amount,
          account: input.account,
          date: input.date,
          note: input.note?.trim() ?? "",
        },
        ...current.cashEntries,
      ],
    }));
  };

  const addSalaryEntry = (input: AddSalaryEntryInput) => {
    updateData((current) => ({
      ...current,
      ...applyAccountDelta(current, input.account, input.amount),
      salaryEntries: [
        {
          id: crypto.randomUUID(),
          amount: input.amount,
          account: input.account,
          date: input.date,
          salaryMonthKey: input.salaryMonthKey,
          note: input.note?.trim() ?? "",
        },
        ...current.salaryEntries.filter((entry) => entry.salaryMonthKey !== input.salaryMonthKey),
      ],
    }));
  };

  const addCategory = (input: AddCategoryInput) => {
    const category = {
      id: `${input.name.toLowerCase().replace(/\s+/g, "-")}-${crypto.randomUUID().slice(0, 6)}`,
      name: input.name.trim(),
      color: input.color,
      kind: input.kind,
    };

    updateData((current) => ({
      ...current,
      categories: [...current.categories, category],
    }));

    return category;
  };

  const addBucket = (input: AddBucketInput) => {
    const bucket = {
      id: `${input.name.toLowerCase().replace(/\s+/g, "-")}-${crypto.randomUUID().slice(0, 6)}`,
      name: input.name.trim(),
      color: input.color,
    };

    updateData((current) => ({
      ...current,
      savingsBuckets: [...current.savingsBuckets, bucket],
    }));

    return bucket;
  };

  const addLoan = (input: AddLoanInput) => {
    const loan = {
      id: crypto.randomUUID(),
      title: input.title.trim(),
      lender: input.lender.trim(),
      principalAmount: input.principalAmount,
      monthlyPayment: input.monthlyPayment,
      totalMonths: Math.max(1, Math.round(input.totalMonths)),
      dueDay: Math.min(31, Math.max(1, Math.round(input.dueDay))),
      startDate: input.startDate,
      note: input.note?.trim() ?? "",
      payments: [],
    };

    updateData((current) => ({
      ...current,
      loans: [loan, ...current.loans],
    }));
  };

  const addLoanPayment = (input: AddLoanPaymentInput) => {
    updateData((current) => ({
      ...current,
      ...applyAccountDelta(current, input.account, -input.amount),
      loans: current.loans.map((loan) =>
        loan.id === input.loanId
          ? {
              ...loan,
              payments: [
                {
                  id: crypto.randomUUID(),
                  amount: input.amount,
                  account: input.account,
                  date: input.date,
                  note: input.note?.trim() ?? "",
                },
                ...loan.payments,
              ],
            }
          : loan,
      ),
    }));
  };

  const updateExpense = (id: string, input: UpdateExpenseInput) => {
    updateData((current) => {
      const existing = current.expenses.find((expense) => expense.id === id);
      if (!existing) {
        return current;
      }

      const reverted = applyAccountDelta(current, existing.account, existing.amount);
      const nextBase = { ...current, ...reverted };
      const applied = applyAccountDelta(nextBase, input.account, -input.amount);

      return {
        ...nextBase,
        ...applied,
        expenses: current.expenses.map((expense) =>
          expense.id === id
            ? {
                ...expense,
                title: input.title.trim(),
                amount: input.amount,
                categoryId: input.categoryId,
                account: input.account,
                date: input.date,
                note: input.note?.trim() ?? "",
              }
            : expense,
        ),
      };
    });
  };

  const updateSavings = (id: string, input: UpdateSavingsInput) => {
    updateData((current) => {
      const existing = current.savingsEntries.find((entry) => entry.id === id);
      if (!existing) {
        return current;
      }

      const reverted = applyAccountDelta(current, existing.account, existing.amount);
      const nextBase = { ...current, ...reverted };
      const applied = applyAccountDelta(nextBase, input.account, -input.amount);

      return {
        ...nextBase,
        ...applied,
        savingsEntries: current.savingsEntries.map((entry) =>
          entry.id === id
            ? {
                ...entry,
                title: input.title.trim(),
                amount: input.amount,
                bucketId: input.bucketId,
                account: input.account,
                date: input.date,
                note: input.note?.trim() ?? "",
              }
            : entry,
        ),
      };
    });
  };

  const updateLoanPayment = (loanId: string, paymentId: string, input: UpdateLoanPaymentInput) => {
    updateData((current) => {
      const loan = current.loans.find((item) => item.id === loanId);
      const existing = loan?.payments.find((payment) => payment.id === paymentId);
      if (!loan || !existing) {
        return current;
      }

      const reverted = applyAccountDelta(current, existing.account, existing.amount);
      const nextBase = { ...current, ...reverted };
      const applied = applyAccountDelta(nextBase, input.account, -input.amount);

      return {
        ...nextBase,
        ...applied,
        loans: current.loans.map((item) =>
          item.id === loanId
            ? {
                ...item,
                payments: item.payments.map((payment) =>
                  payment.id === paymentId
                    ? {
                        ...payment,
                        amount: input.amount,
                        account: input.account,
                        date: input.date,
                        note: input.note?.trim() ?? "",
                      }
                    : payment,
                ),
              }
            : item,
        ),
      };
    });
  };

  const removeExpense = (id: string) => {
    updateData((current) => {
      const removedExpense = current.expenses.find((expense) => expense.id === id);

      return {
        ...current,
        ...applyAccountDelta(
          current,
          removedExpense?.account ?? "bank",
          removedExpense?.amount ?? 0,
        ),
        expenses: current.expenses.filter((expense) => expense.id !== id),
      };
    });
  };

  const removeSavings = (id: string) => {
    updateData((current) => {
      const removedSavings = current.savingsEntries.find((entry) => entry.id === id);

      return {
        ...current,
        ...applyAccountDelta(
          current,
          removedSavings?.account ?? "bank",
          removedSavings?.amount ?? 0,
        ),
        savingsEntries: current.savingsEntries.filter((entry) => entry.id !== id),
      };
    });
  };

  const removeCashEntry = (id: string) => {
    updateData((current) => {
      const removedCashEntry = current.cashEntries.find((entry) => entry.id === id);

      return {
        ...current,
        ...applyAccountDelta(
          current,
          removedCashEntry?.account ?? "bank",
          -(removedCashEntry?.amount ?? 0),
        ),
        cashEntries: current.cashEntries.filter((entry) => entry.id !== id),
      };
    });
  };

  const removeLoanPayment = (loanId: string, paymentId: string) => {
    updateData((current) => {
      const loan = current.loans.find((item) => item.id === loanId);
      const payment = loan?.payments.find((item) => item.id === paymentId);
      if (!loan || !payment) {
        return current;
      }

      return {
        ...current,
        ...applyAccountDelta(current, payment.account, payment.amount),
        loans: current.loans.map((item) =>
          item.id === loanId
            ? {
                ...item,
                payments: item.payments.filter((entry) => entry.id !== paymentId),
              }
            : item,
        ),
      };
    });
  };

  const removeLoan = (id: string) => {
    updateData((current) => {
      const loan = current.loans.find((item) => item.id === id);
      if (!loan) {
        return current;
      }

      const restored = loan.payments.reduce(
        (state, payment) => ({
          ...state,
          ...applyAccountDelta(state, payment.account, payment.amount),
        }),
        current,
      );

      return {
        ...restored,
        loans: restored.loans.filter((item) => item.id !== id),
      };
    });
  };

  const replaceData = (nextData: FinanceData) => {
    const normalized = withUpdatedTimestamp(normalizeFinanceData(nextData));
    latestDataRef.current = normalized;
    setData(normalized);
    void persistRemoteData(normalized);
  };

  const removeCategory = (id: string) => {
    if (latestDataRef.current.expenses.some((expense) => expense.categoryId === id)) {
      return false;
    }

    updateData((current) => ({
      ...current,
      categories: current.categories.filter((category) => category.id !== id),
    }));

    return true;
  };

  const removeBucket = (id: string) => {
    if (latestDataRef.current.savingsEntries.some((entry) => entry.bucketId === id)) {
      return false;
    }

    updateData((current) => ({
      ...current,
      savingsBuckets: current.savingsBuckets.filter((bucket) => bucket.id !== id),
    }));

    return true;
  };

  return {
    data,
    isReady,
    syncError,
    refreshData: loadRemoteData,
    retrySync: () => persistRemoteData(latestDataRef.current),
    updateBalance,
    updateBalances,
    updateSalaryDay,
    updateSalaryAmount,
    updateEmergencyFundProfile,
    addExpense,
    addSavings,
    addCashEntry,
    addSalaryEntry,
    addCategory,
    addBucket,
    addLoan,
    addLoanPayment,
    updateExpense,
    updateSavings,
    updateLoanPayment,
    removeExpense,
    removeSavings,
    removeCashEntry,
    removeLoanPayment,
    removeLoan,
    removeCategory,
    removeBucket,
    replaceData,
  };
}

function getLegacyLocalData() {
  try {
    const storedValue = window.localStorage.getItem(STORAGE_KEY);
    if (!storedValue) {
      return null;
    }

    return normalizeFinanceData(JSON.parse(storedValue));
  } catch {
    return null;
  }
}

function shouldMigrateLegacyData(remoteData: FinanceData) {
  const isRemoteEmpty =
    remoteData.currentBalance === 0 &&
    remoteData.bankBalance === 0 &&
    remoteData.cashBalance === 0 &&
    remoteData.expenses.length === 0 &&
    remoteData.savingsEntries.length === 0 &&
    remoteData.cashEntries.length === 0 &&
    remoteData.salaryEntries.length === 0 &&
    remoteData.loans.length === 0 &&
    remoteData.updatedAt === DEFAULT_DATA.updatedAt;

  return isRemoteEmpty;
}

function applyAccountDelta(
  current: FinanceData,
  account: BalanceSource,
  delta: number,
) {
  const bankBalance =
    account === "bank" ? current.bankBalance + delta : current.bankBalance;
  const cashBalance =
    account === "cash" ? current.cashBalance + delta : current.cashBalance;

  return {
    bankBalance,
    cashBalance,
    currentBalance: bankBalance + cashBalance,
  };
}
