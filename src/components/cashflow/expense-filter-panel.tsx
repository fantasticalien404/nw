"use client";

import { useId, useState } from "react";
import type { ExpenseClassification } from "@/lib/analytics/cashflow-insights";
import { formatMonthName } from "@/lib/format";
import { CategoryMenu } from "./category-menu";
import type { ExpenseInsights } from "./use-expense-insights";

const monthOptions = Array.from({ length: 12 }, (_, index) => {
  const value = String(index + 1).padStart(2, "0");
  return { value, label: formatMonthName(value) };
});

const selectClass = "mt-1 w-full border border-zinc-300 bg-white px-2 py-1.5";

export function ExpenseFilterPanel({
  filters,
  categoryOptions,
  parentOptions,
}: {
  filters: ExpenseInsights["filters"];
  categoryOptions: string[];
  parentOptions: string[];
}) {
  const menuId = useId();
  const [openMenu, setOpenMenu] = useState<"parent" | "category" | null>(null);
  const toggleMenu = (menu: "parent" | "category") => setOpenMenu((open) => (open === menu ? null : menu));

  return (
    <div className="grid items-end gap-3 border border-zinc-300 bg-zinc-50 p-4 sm:grid-cols-2 lg:grid-cols-4">
      <label className="text-xs font-medium text-zinc-700">
        Expense classification
        <select
          className={selectClass}
          value={filters.classification}
          onChange={(event) => filters.setClassification(event.target.value as ExpenseClassification)}
        >
          <option value="all">All expenses</option>
          <option value="essential">Essential</option>
          <option value="discretionary">Discretionary</option>
          <option value="recurring">Recurring</option>
          <option value="non-recurring">Non-recurring</option>
        </select>
      </label>
      <label className="text-xs font-medium text-zinc-700">
        Month
        <select className={selectClass} value={filters.month} onChange={(event) => filters.setMonth(event.target.value)}>
          <option value="all">Use date range</option>
          {monthOptions.map(({ value, label }) => (
            <option key={value} value={value}>{label}</option>
          ))}
        </select>
      </label>
      <CategoryMenu
        id={`${menuId}-parent`}
        label="Parent categories"
        options={parentOptions}
        selected={filters.parents}
        onChange={filters.setParents}
        isOpen={openMenu === "parent"}
        onToggle={() => toggleMenu("parent")}
        listClassName="grid gap-2 sm:grid-cols-2"
      />
      <CategoryMenu
        id={`${menuId}-category`}
        label="Categories"
        options={categoryOptions}
        selected={filters.categories}
        onChange={filters.setCategories}
        isOpen={openMenu === "category"}
        onToggle={() => toggleMenu("category")}
        listClassName="grid max-h-72 gap-2 overflow-y-auto sm:grid-cols-2"
      />
    </div>
  );
}
