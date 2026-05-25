import { describe, expect, it, vi } from "vitest";
import { BudgetStore } from "../../src/budget-store.js";

describe("BudgetStore", () => {
  describe("initial state", () => {
    it("starts at zero budget, zero expenses, zero balance", () => {
      const s = new BudgetStore();
      expect(s.snapshot()).toEqual({
        budget: 0,
        expenses: [],
        totalExpenses: 0,
        balance: 0,
        balanceState: "zero",
      });
    });
  });

  describe("setBudget", () => {
    it("accepts a positive integer", () => {
      const s = new BudgetStore();
      const result = s.setBudget(1000);
      expect(result.ok).toBe(true);
      expect(s.snapshot().budget).toBe(1000);
    });

    it("rejects empty / null / undefined", () => {
      const s = new BudgetStore();
      for (const bad of ["", null, undefined]) {
        const r = s.setBudget(bad);
        expect(r.ok).toBe(false);
        expect(r.error).toMatch(/required/i);
      }
      expect(s.snapshot().budget).toBe(0);
    });

    it("rejects negative or non-numeric", () => {
      const s = new BudgetStore();
      for (const bad of [-1, -100, "abc", NaN]) {
        const r = s.setBudget(bad);
        expect(r.ok).toBe(false);
      }
    });

    it("coerces numeric strings", () => {
      const s = new BudgetStore();
      const r = s.setBudget("500");
      expect(r.ok).toBe(true);
      expect(s.snapshot().budget).toBe(500);
    });
  });

  describe("addExpense", () => {
    it("appends an expense with a monotonic id", () => {
      const s = new BudgetStore();
      s.setBudget(1000);
      const a = s.addExpense({ title: "rent", amount: 400 });
      const b = s.addExpense({ title: "food", amount: 100 });
      expect(a.ok).toBe(true);
      expect(b.ok).toBe(true);
      expect(a.expense.id).not.toBe(b.expense.id);
      expect(s.snapshot().expenses.map((e) => e.title)).toEqual(["rent", "food"]);
    });

    it("rejects empty title or non-positive amount", () => {
      const s = new BudgetStore();
      for (const bad of [
        { title: "", amount: 10 },
        { title: "x", amount: 0 },
        { title: "x", amount: -5 },
        { title: "x", amount: "abc" },
      ]) {
        const r = s.addExpense(bad);
        expect(r.ok).toBe(false);
      }
      expect(s.snapshot().expenses).toEqual([]);
    });
  });

  describe("totalExpenses + balance", () => {
    it("sums all expense amounts", () => {
      const s = new BudgetStore();
      s.setBudget(1000);
      s.addExpense({ title: "a", amount: 200 });
      s.addExpense({ title: "b", amount: 350 });
      expect(s.snapshot().totalExpenses).toBe(550);
      expect(s.snapshot().balance).toBe(450);
      expect(s.snapshot().balanceState).toBe("positive");
    });

    it("balanceState=zero when total == budget", () => {
      const s = new BudgetStore();
      s.setBudget(100);
      s.addExpense({ title: "x", amount: 100 });
      expect(s.snapshot().balanceState).toBe("zero");
    });

    it("balanceState=negative when expenses > budget", () => {
      const s = new BudgetStore();
      s.setBudget(50);
      s.addExpense({ title: "x", amount: 100 });
      expect(s.snapshot().balance).toBe(-50);
      expect(s.snapshot().balanceState).toBe("negative");
    });
  });

  describe("removeExpense", () => {
    it("removes by id", () => {
      const s = new BudgetStore();
      s.setBudget(500);
      const a = s.addExpense({ title: "a", amount: 100 });
      const b = s.addExpense({ title: "b", amount: 200 });
      const r = s.removeExpense(a.expense.id);
      expect(r.ok).toBe(true);
      expect(s.snapshot().expenses.map((e) => e.id)).toEqual([b.expense.id]);
      expect(s.snapshot().totalExpenses).toBe(200);
      expect(s.snapshot().balance).toBe(300);
    });

    it("returns ok=false when id missing", () => {
      const s = new BudgetStore();
      const r = s.removeExpense(9999);
      expect(r.ok).toBe(false);
    });
  });

  describe("updateExpense", () => {
    it("changes title and amount", () => {
      const s = new BudgetStore();
      s.setBudget(500);
      const a = s.addExpense({ title: "rent", amount: 200 });
      const r = s.updateExpense(a.expense.id, { title: "RENT", amount: 250 });
      expect(r.ok).toBe(true);
      expect(s.snapshot().expenses[0].title).toBe("RENT");
      expect(s.snapshot().expenses[0].amount).toBe(250);
      expect(s.snapshot().balance).toBe(250);
    });

    it("validates new values", () => {
      const s = new BudgetStore();
      s.setBudget(500);
      const a = s.addExpense({ title: "a", amount: 100 });
      const r = s.updateExpense(a.expense.id, { title: "", amount: -1 });
      expect(r.ok).toBe(false);
      expect(s.snapshot().expenses[0].title).toBe("a");
    });
  });

  describe("subscribe", () => {
    it("fires callback after every mutation", () => {
      const s = new BudgetStore();
      const fn = vi.fn();
      s.subscribe(fn);
      s.setBudget(100);
      s.addExpense({ title: "a", amount: 10 });
      s.removeExpense(s.snapshot().expenses[0].id);
      expect(fn).toHaveBeenCalledTimes(3);
    });

    it("returns an unsubscribe function", () => {
      const s = new BudgetStore();
      const fn = vi.fn();
      const off = s.subscribe(fn);
      s.setBudget(100);
      off();
      s.setBudget(200);
      expect(fn).toHaveBeenCalledTimes(1);
    });
  });

  describe("hydrate", () => {
    it("restores state from a snapshot-shaped object", () => {
      const s = new BudgetStore();
      s.hydrate({
        budget: 800,
        expenses: [{ id: 5, title: "saved", amount: 100 }],
      });
      expect(s.snapshot().budget).toBe(800);
      expect(s.snapshot().expenses).toEqual([{ id: 5, title: "saved", amount: 100 }]);
      expect(s.snapshot().totalExpenses).toBe(100);
      const next = s.addExpense({ title: "x", amount: 1 });
      expect(next.expense.id).toBeGreaterThan(5);
    });
  });
});
