"use client";

import { useEffect, useState } from "react";
import {
  DEFAULT_DATA,
  STORAGE_KEY,
  normalizeFinanceData,
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

type AddCategoryInput = {
  name: string;
  color: string;
  kind: SpendingType;
};

type AddBucketInput = {
  name: string;
  color: string;
};

export function useFinanceStore() {
  const [data, setData] = useState<FinanceData>(DEFAULT_DATA);
  const [isReady, setIsReady] = useState(false);

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

  const updateBalance = (currentBalance: number) => {
    setData((current) => ({
      ...current,
      currentBalance: Number.isFinite(currentBalance) ? currentBalance : 0,
    }));
  };

  const updateSalaryDay = (salaryDay: SalaryDay) => {
    setData((current) => ({
      ...current,
      salaryDay,
    }));
  };

  const addExpense = (input: AddExpenseInput) => {
    setData((current) => ({
      ...current,
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
    setData((current) => ({
      ...current,
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

  const addCategory = (input: AddCategoryInput) => {
    const category = {
      id: `${input.name.toLowerCase().replace(/\s+/g, "-")}-${crypto.randomUUID().slice(0, 6)}`,
      name: input.name.trim(),
      color: input.color,
      kind: input.kind,
    };

    setData((current) => ({
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

    setData((current) => ({
      ...current,
      savingsBuckets: [...current.savingsBuckets, bucket],
    }));

    return bucket;
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
      return false;
    }

    setData((current) => ({
      ...current,
      categories: current.categories.filter((category) => category.id !== id),
    }));

    return true;
  };

  const removeBucket = (id: string) => {
    if (data.savingsEntries.some((entry) => entry.bucketId === id)) {
      return false;
    }

    setData((current) => ({
      ...current,
      savingsBuckets: current.savingsBuckets.filter((bucket) => bucket.id !== id),
    }));

    return true;
  };

  return {
    data,
    isReady,
    setData,
    updateBalance,
    updateSalaryDay,
    addExpense,
    addSavings,
    addCategory,
    addBucket,
    removeExpense,
    removeSavings,
    removeCategory,
    removeBucket,
  };
}
