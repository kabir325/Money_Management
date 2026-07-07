"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  DEFAULT_DATA,
  STORAGE_KEY,
  normalizeFinanceData,
  withUpdatedTimestamp,
  type FinanceData,
  type SalaryDay,
  type SpendingType,
} from "@/lib/finance";

type AddExpenseInput = {
  title: string;
  amount: number;
  categoryId: string;
  date: string;
  note?: string;
};

type AddSavingsInput = {
  title: string;
  amount: number;
  bucketId: string;
  date: string;
  note?: string;
};

type AddCashEntryInput = {
  title: string;
  amount: number;
  date: string;
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
      currentBalance: Number.isFinite(currentBalance) ? currentBalance : 0,
    }));
  };

  const updateSalaryDay = (salaryDay: SalaryDay) => {
    updateData((current) => ({
      ...current,
      salaryDay,
    }));
  };

  const addExpense = (input: AddExpenseInput) => {
    updateData((current) => ({
      ...current,
      currentBalance: current.currentBalance - input.amount,
      expenses: [
        {
          id: crypto.randomUUID(),
          title: input.title.trim(),
          amount: input.amount,
          categoryId: input.categoryId,
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
      currentBalance: current.currentBalance - input.amount,
      savingsEntries: [
        {
          id: crypto.randomUUID(),
          title: input.title.trim(),
          amount: input.amount,
          bucketId: input.bucketId,
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
      currentBalance: current.currentBalance + input.amount,
      cashEntries: [
        {
          id: crypto.randomUUID(),
          title: input.title.trim(),
          amount: input.amount,
          date: input.date,
          note: input.note?.trim() ?? "",
        },
        ...current.cashEntries,
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

  const removeExpense = (id: string) => {
    updateData((current) => {
      const removedExpense = current.expenses.find((expense) => expense.id === id);

      return {
        ...current,
        currentBalance: current.currentBalance + (removedExpense?.amount ?? 0),
        expenses: current.expenses.filter((expense) => expense.id !== id),
      };
    });
  };

  const removeSavings = (id: string) => {
    updateData((current) => {
      const removedSavings = current.savingsEntries.find((entry) => entry.id === id);

      return {
        ...current,
        currentBalance: current.currentBalance + (removedSavings?.amount ?? 0),
        savingsEntries: current.savingsEntries.filter((entry) => entry.id !== id),
      };
    });
  };

  const removeCashEntry = (id: string) => {
    updateData((current) => {
      const removedCashEntry = current.cashEntries.find((entry) => entry.id === id);

      return {
        ...current,
        currentBalance: current.currentBalance - (removedCashEntry?.amount ?? 0),
        cashEntries: current.cashEntries.filter((entry) => entry.id !== id),
      };
    });
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
    updateSalaryDay,
    addExpense,
    addSavings,
    addCashEntry,
    addCategory,
    addBucket,
    removeExpense,
    removeSavings,
    removeCashEntry,
    removeCategory,
    removeBucket,
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
    remoteData.expenses.length === 0 &&
    remoteData.savingsEntries.length === 0 &&
    remoteData.cashEntries.length === 0 &&
    remoteData.updatedAt === DEFAULT_DATA.updatedAt;

  return isRemoteEmpty;
}
