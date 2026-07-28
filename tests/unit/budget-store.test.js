import { describe, expect, it, vi } from "vitest";
import { BudgetStore } from "../../src/budget-store.js";

const MONTH = "2026-07";

function makeStore() {
  return new BudgetStore({ month: MONTH });
}

describe("BudgetStore", () => {
  describe("initial state", () => {
    it("starts with one default budget, zero amounts, the given month", () => {
      const s = makeStore();
      const snap = s.snapshot();
      expect(snap.budgets).toEqual([{ id: 1, name: "Personal" }]);
      expect(snap.activeBudgetId).toBe(1);
      expect(snap.activeMonth).toBe(MONTH);
      expect(snap.budget).toBe(0);
      expect(snap.expenses).toEqual([]);
      expect(snap.categories).toEqual([]);
      expect(snap.recurring).toEqual([]);
      expect(snap.totalExpenses).toBe(0);
      expect(snap.balance).toBe(0);
      expect(snap.balanceState).toBe("zero");
    });
  });

  describe("setBudget", () => {
    it("accepts a positive number", () => {
      const s = makeStore();
      expect(s.setBudget(1000).ok).toBe(true);
      expect(s.snapshot().budget).toBe(1000);
    });

    it("rejects empty / null / undefined", () => {
      const s = makeStore();
      for (const bad of ["", null, undefined]) {
        const r = s.setBudget(bad);
        expect(r.ok).toBe(false);
        expect(r.error).toMatch(/required/i);
      }
      expect(s.snapshot().budget).toBe(0);
    });

    it("rejects negative or non-numeric", () => {
      const s = makeStore();
      for (const bad of [-1, -100, "abc", NaN]) {
        expect(s.setBudget(bad).ok).toBe(false);
      }
    });

    it("coerces numeric strings", () => {
      const s = makeStore();
      expect(s.setBudget("500").ok).toBe(true);
      expect(s.snapshot().budget).toBe(500);
    });

    it("is per budget", () => {
      const s = makeStore();
      s.setBudget(1000);
      s.createBudget("Side hustle");
      expect(s.snapshot().budget).toBe(0);
      s.setBudget(300);
      s.selectBudget(1);
      expect(s.snapshot().budget).toBe(1000);
    });
  });

  describe("named budgets", () => {
    it("creates and auto-selects a new budget", () => {
      const s = makeStore();
      const r = s.createBudget("Groceries");
      expect(r.ok).toBe(true);
      expect(s.snapshot().activeBudgetId).toBe(r.budget.id);
      expect(s.snapshot().budgets.map((b) => b.name)).toEqual(["Personal", "Groceries"]);
    });

    it("rejects empty or duplicate names", () => {
      const s = makeStore();
      expect(s.createBudget("").ok).toBe(false);
      expect(s.createBudget("  personal  ").ok).toBe(false);
    });

    it("renames a budget", () => {
      const s = makeStore();
      expect(s.renameBudget(1, "Household").ok).toBe(true);
      expect(s.snapshot().budgets[0].name).toBe("Household");
      expect(s.renameBudget(99, "x").ok).toBe(false);
    });

    it("keeps expenses isolated per budget", () => {
      const s = makeStore();
      s.setBudget(100);
      s.addExpense({ title: "a", amount: 10 });
      s.createBudget("Other");
      expect(s.snapshot().expenses).toEqual([]);
      s.addExpense({ title: "b", amount: 20 });
      expect(s.snapshot().totalExpenses).toBe(20);
      s.selectBudget(1);
      expect(s.snapshot().totalExpenses).toBe(10);
    });

    it("deletes a budget but never the last one", () => {
      const s = makeStore();
      const r = s.createBudget("Temp");
      expect(s.deleteBudget(r.budget.id).ok).toBe(true);
      expect(s.snapshot().activeBudgetId).toBe(1);
      expect(s.deleteBudget(1).ok).toBe(false);
    });

    it("rejects selecting an unknown budget", () => {
      const s = makeStore();
      expect(s.selectBudget(42).ok).toBe(false);
    });
  });

  describe("monthly periods", () => {
    it("validates the month format", () => {
      const s = makeStore();
      for (const bad of ["", "2026", "2026-13", "07-2026", "2026-7", null]) {
        expect(s.setMonth(bad).ok).toBe(false);
      }
      expect(s.setMonth("2026-08").ok).toBe(true);
      expect(s.snapshot().activeMonth).toBe("2026-08");
    });

    it("scopes expenses and totals to the active month", () => {
      const s = makeStore();
      s.setBudget(500);
      s.addExpense({ title: "july", amount: 100 });
      s.setMonth("2026-08");
      expect(s.snapshot().expenses).toEqual([]);
      expect(s.snapshot().balance).toBe(500);
      s.addExpense({ title: "august", amount: 50 });
      expect(s.snapshot().totalExpenses).toBe(50);
      s.setMonth(MONTH);
      expect(s.snapshot().expenses.map((e) => e.title)).toEqual(["july"]);
    });
  });

  describe("categories", () => {
    it("adds a category with an optional limit", () => {
      const s = makeStore();
      const a = s.addCategory({ name: "Food", limit: 300 });
      const b = s.addCategory({ name: "Fun" });
      expect(a.ok).toBe(true);
      expect(b.ok).toBe(true);
      expect(s.snapshot().categories).toEqual([
        { id: a.category.id, name: "Food", limit: 300, spent: 0, over: false },
        { id: b.category.id, name: "Fun", limit: null, spent: 0, over: false },
      ]);
    });

    it("rejects empty names, duplicates, and bad limits", () => {
      const s = makeStore();
      s.addCategory({ name: "Food" });
      expect(s.addCategory({ name: "" }).ok).toBe(false);
      expect(s.addCategory({ name: " food " }).ok).toBe(false);
      expect(s.addCategory({ name: "x", limit: -5 }).ok).toBe(false);
      expect(s.addCategory({ name: "x", limit: "abc" }).ok).toBe(false);
    });

    it("tracks per-category spend for the active month and flags overruns", () => {
      const s = makeStore();
      const food = s.addCategory({ name: "Food", limit: 100 }).category;
      s.addExpense({ title: "veg", amount: 60, categoryId: food.id });
      expect(s.snapshot().categories[0]).toMatchObject({ spent: 60, over: false });
      s.addExpense({ title: "steak", amount: 70, categoryId: food.id });
      expect(s.snapshot().categories[0]).toMatchObject({ spent: 130, over: true });
      s.setMonth("2026-08");
      expect(s.snapshot().categories[0]).toMatchObject({ spent: 0, over: false });
    });

    it("updates name and limit; clearing the limit", () => {
      const s = makeStore();
      const c = s.addCategory({ name: "Food", limit: 100 }).category;
      expect(s.updateCategory(c.id, { name: "Eating", limit: null }).ok).toBe(true);
      expect(s.snapshot().categories[0]).toMatchObject({ name: "Eating", limit: null });
      expect(s.updateCategory(999, { name: "x" }).ok).toBe(false);
    });

    it("removing a category unassigns its expenses", () => {
      const s = makeStore();
      const c = s.addCategory({ name: "Food" }).category;
      s.addExpense({ title: "veg", amount: 10, categoryId: c.id });
      expect(s.removeCategory(c.id).ok).toBe(true);
      expect(s.snapshot().categories).toEqual([]);
      expect(s.snapshot().expenses[0].categoryId).toBe(null);
    });
  });

  describe("addExpense", () => {
    it("appends an expense with a monotonic id into the active month", () => {
      const s = makeStore();
      const a = s.addExpense({ title: "rent", amount: 400 });
      const b = s.addExpense({ title: "food", amount: 100 });
      expect(a.ok && b.ok).toBe(true);
      expect(a.expense.id).not.toBe(b.expense.id);
      expect(a.expense.month).toBe(MONTH);
      expect(s.snapshot().expenses.map((e) => e.title)).toEqual(["rent", "food"]);
    });

    it("rejects empty title, non-positive amount, unknown category", () => {
      const s = makeStore();
      for (const bad of [
        { title: "", amount: 10 },
        { title: "x", amount: 0 },
        { title: "x", amount: -5 },
        { title: "x", amount: "abc" },
        { title: "x", amount: 5, categoryId: 999 },
      ]) {
        expect(s.addExpense(bad).ok).toBe(false);
      }
      expect(s.snapshot().expenses).toEqual([]);
    });

    it("exposes categoryName on snapshot expenses", () => {
      const s = makeStore();
      const c = s.addCategory({ name: "Food" }).category;
      s.addExpense({ title: "veg", amount: 10, categoryId: c.id });
      s.addExpense({ title: "misc", amount: 5 });
      const [veg, misc] = s.snapshot().expenses;
      expect(veg.categoryName).toBe("Food");
      expect(misc.categoryName).toBe(null);
    });
  });

  describe("balance", () => {
    it("computes positive / zero / negative states", () => {
      const s = makeStore();
      s.setBudget(100);
      s.addExpense({ title: "x", amount: 40 });
      expect(s.snapshot()).toMatchObject({ balance: 60, balanceState: "positive" });
      s.addExpense({ title: "y", amount: 60 });
      expect(s.snapshot().balanceState).toBe("zero");
      s.addExpense({ title: "z", amount: 1 });
      expect(s.snapshot()).toMatchObject({ balance: -1, balanceState: "negative" });
    });
  });

  describe("removeExpense / updateExpense", () => {
    it("removes by id", () => {
      const s = makeStore();
      s.setBudget(500);
      const a = s.addExpense({ title: "a", amount: 100 });
      s.addExpense({ title: "b", amount: 200 });
      expect(s.removeExpense(a.expense.id).ok).toBe(true);
      expect(s.snapshot().totalExpenses).toBe(200);
      expect(s.removeExpense(9999).ok).toBe(false);
    });

    it("updates title, amount and category with validation", () => {
      const s = makeStore();
      const c = s.addCategory({ name: "Food" }).category;
      const a = s.addExpense({ title: "rent", amount: 200 });
      const r = s.updateExpense(a.expense.id, { title: "RENT", amount: 250, categoryId: c.id });
      expect(r.ok).toBe(true);
      expect(s.snapshot().expenses[0]).toMatchObject({
        title: "RENT",
        amount: 250,
        categoryId: c.id,
      });
      expect(s.updateExpense(a.expense.id, { title: "" }).ok).toBe(false);
      expect(s.updateExpense(a.expense.id, { amount: -1 }).ok).toBe(false);
      expect(s.updateExpense(a.expense.id, { categoryId: 999 }).ok).toBe(false);
    });
  });

  describe("recurring expenses", () => {
    it("materializes into the active month immediately", () => {
      const s = makeStore();
      const r = s.addRecurring({ title: "Rent", amount: 400 });
      expect(r.ok).toBe(true);
      expect(s.snapshot().recurring).toEqual([
        { id: r.recurring.id, title: "Rent", amount: 400, categoryId: null },
      ]);
      expect(s.snapshot().expenses).toHaveLength(1);
      expect(s.snapshot().expenses[0]).toMatchObject({
        title: "Rent",
        amount: 400,
        recurringId: r.recurring.id,
      });
    });

    it("materializes once per month, on entering the month", () => {
      const s = makeStore();
      s.addRecurring({ title: "Rent", amount: 400 });
      s.setMonth("2026-08");
      expect(s.snapshot().expenses).toHaveLength(1);
      s.setMonth(MONTH);
      s.setMonth("2026-08");
      expect(s.snapshot().expenses).toHaveLength(1);
    });

    it("validates like an expense", () => {
      const s = makeStore();
      expect(s.addRecurring({ title: "", amount: 5 }).ok).toBe(false);
      expect(s.addRecurring({ title: "x", amount: 0 }).ok).toBe(false);
      expect(s.addRecurring({ title: "x", amount: 5, categoryId: 7 }).ok).toBe(false);
    });

    it("removing the template stops future months but keeps past instances", () => {
      const s = makeStore();
      const r = s.addRecurring({ title: "Gym", amount: 30 });
      expect(s.removeRecurring(r.recurring.id).ok).toBe(true);
      expect(s.snapshot().recurring).toEqual([]);
      expect(s.snapshot().expenses).toHaveLength(1);
      s.setMonth("2026-08");
      expect(s.snapshot().expenses).toHaveLength(0);
      expect(s.removeRecurring(999).ok).toBe(false);
    });

    it("deleting one instance does not touch other months", () => {
      const s = makeStore();
      s.addRecurring({ title: "Rent", amount: 400 });
      s.setMonth("2026-08");
      const inst = s.snapshot().expenses[0];
      s.removeExpense(inst.id);
      expect(s.snapshot().expenses).toHaveLength(0);
      s.setMonth(MONTH);
      expect(s.snapshot().expenses).toHaveLength(1);
    });
  });

  describe("exportCsv", () => {
    it("exports all months of the active budget with headers", () => {
      const s = makeStore();
      const c = s.addCategory({ name: "Food" }).category;
      s.addExpense({ title: "veg", amount: 10.5, categoryId: c.id });
      s.setMonth("2026-08");
      s.addExpense({ title: "rent", amount: 400 });
      const csv = s.exportCsv();
      const lines = csv.split("\r\n");
      expect(lines[0]).toBe("month,title,category,amount,recurring");
      expect(lines[1]).toBe("2026-07,veg,Food,10.5,no");
      expect(lines[2]).toBe("2026-08,rent,,400,no");
    });

    it("marks recurring instances", () => {
      const s = makeStore();
      s.addRecurring({ title: "Rent", amount: 400 });
      expect(s.exportCsv()).toContain("Rent,,400,yes");
    });
  });

  describe("subscribe", () => {
    it("fires after every mutation and supports unsubscribe", () => {
      const s = makeStore();
      const fn = vi.fn();
      const off = s.subscribe(fn);
      s.setBudget(100);
      s.addExpense({ title: "a", amount: 10 });
      s.setMonth("2026-08");
      expect(fn).toHaveBeenCalledTimes(3);
      off();
      s.setBudget(200);
      expect(fn).toHaveBeenCalledTimes(3);
    });

    it("does not fire on rejected mutations", () => {
      const s = makeStore();
      const fn = vi.fn();
      s.subscribe(fn);
      s.setBudget("abc");
      s.addExpense({ title: "", amount: 1 });
      expect(fn).not.toHaveBeenCalled();
    });
  });

  describe("serialize / hydrate", () => {
    it("round-trips full state", () => {
      const s = makeStore();
      s.setBudget(1000);
      const c = s.addCategory({ name: "Food", limit: 200 }).category;
      s.addExpense({ title: "veg", amount: 50, categoryId: c.id });
      s.addRecurring({ title: "Rent", amount: 400 });
      s.createBudget("Side");
      s.setBudget(99);

      const restored = new BudgetStore({ month: "2000-01" });
      restored.hydrate(s.serialize());
      expect(restored.serialize()).toEqual(s.serialize());
      expect(restored.snapshot().activeMonth).toBe(MONTH);
    });

    it("new ids stay monotonic after hydrate", () => {
      const s = makeStore();
      s.addExpense({ title: "a", amount: 10 });
      const restored = makeStore();
      restored.hydrate(s.serialize());
      const next = restored.addExpense({ title: "b", amount: 5 });
      const ids = restored.snapshot().expenses.map((e) => e.id);
      expect(new Set(ids).size).toBe(ids.length);
      expect(next.expense.id).toBeGreaterThan(ids[0] - 1);
    });

    it("migrates the legacy v1 shape {budget, expenses}", () => {
      const s = makeStore();
      s.hydrate({ budget: 800, expenses: [{ id: 5, title: "saved", amount: 100 }] });
      const snap = s.snapshot();
      expect(snap.budget).toBe(800);
      expect(snap.expenses).toHaveLength(1);
      expect(snap.expenses[0]).toMatchObject({ title: "saved", amount: 100, month: MONTH });
    });

    it("ignores garbage", () => {
      const s = makeStore();
      s.setBudget(10);
      s.hydrate(null);
      s.hydrate({ budgets: "nope" });
      expect(s.snapshot().budget).toBe(10);
    });
  });
});
