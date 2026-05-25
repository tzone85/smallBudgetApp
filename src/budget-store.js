/**
 * Pure budget logic — no DOM, no I/O, no globals.
 *
 * The UI layer reads `snapshot()` after every change (via the `subscribe`
 * callback) and renders accordingly. Persistence is handled by an outer
 * Storage adapter that listens to `subscribe()` and writes to localStorage.
 */
const POSITIVE_INT = /^-?\d+(\.\d+)?$/;

function parseAmount(value) {
  if (value === null || value === undefined || value === "") return NaN;
  if (typeof value === "number") return Number.isFinite(value) ? value : NaN;
  if (typeof value === "string" && POSITIVE_INT.test(value.trim())) {
    return Number(value);
  }
  return NaN;
}

export class BudgetStore {
  #budget = 0;
  #expenses = [];
  #nextId = 1;
  #listeners = new Set();

  snapshot() {
    const totalExpenses = this.#expenses.reduce((acc, e) => acc + e.amount, 0);
    const balance = this.#budget - totalExpenses;
    let balanceState = "zero";
    if (balance > 0) balanceState = "positive";
    else if (balance < 0) balanceState = "negative";
    return {
      budget: this.#budget,
      expenses: this.#expenses.map((e) => ({ ...e })),
      totalExpenses,
      balance,
      balanceState,
    };
  }

  setBudget(value) {
    if (value === null || value === undefined || value === "") {
      return { ok: false, error: "budget is required" };
    }
    const n = parseAmount(value);
    if (Number.isNaN(n)) return { ok: false, error: "budget must be numeric" };
    if (n < 0) return { ok: false, error: "budget must be non-negative" };
    this.#budget = n;
    this.#emit();
    return { ok: true };
  }

  addExpense({ title, amount } = {}) {
    const t = (title ?? "").toString().trim();
    if (t === "") return { ok: false, error: "title is required" };
    const n = parseAmount(amount);
    if (Number.isNaN(n) || n <= 0) {
      return { ok: false, error: "amount must be a positive number" };
    }
    const expense = { id: this.#nextId++, title: t, amount: n };
    this.#expenses.push(expense);
    this.#emit();
    return { ok: true, expense: { ...expense } };
  }

  removeExpense(id) {
    const before = this.#expenses.length;
    this.#expenses = this.#expenses.filter((e) => e.id !== id);
    if (this.#expenses.length === before) {
      return { ok: false, error: "expense not found" };
    }
    this.#emit();
    return { ok: true };
  }

  updateExpense(id, patch) {
    const idx = this.#expenses.findIndex((e) => e.id === id);
    if (idx === -1) return { ok: false, error: "expense not found" };
    const current = this.#expenses[idx];
    const nextTitle = patch.title !== undefined ? patch.title.toString().trim() : current.title;
    const nextAmount = patch.amount !== undefined ? parseAmount(patch.amount) : current.amount;
    if (nextTitle === "") return { ok: false, error: "title is required" };
    if (Number.isNaN(nextAmount) || nextAmount <= 0) {
      return { ok: false, error: "amount must be a positive number" };
    }
    this.#expenses = this.#expenses.map((e, i) =>
      i === idx ? { ...e, title: nextTitle, amount: nextAmount } : e,
    );
    this.#emit();
    return { ok: true, expense: { ...this.#expenses[idx] } };
  }

  subscribe(fn) {
    this.#listeners.add(fn);
    return () => this.#listeners.delete(fn);
  }

  hydrate({ budget = 0, expenses = [] } = {}) {
    this.#budget = Number.isFinite(budget) ? budget : 0;
    this.#expenses = Array.isArray(expenses)
      ? expenses
          .filter(
            (e) =>
              e &&
              typeof e.id === "number" &&
              typeof e.title === "string" &&
              typeof e.amount === "number",
          )
          .map((e) => ({ id: e.id, title: e.title, amount: e.amount }))
      : [];
    this.#nextId = this.#expenses.reduce((m, e) => Math.max(m, e.id), 0) + 1;
    this.#emit();
  }

  #emit() {
    const snap = this.snapshot();
    for (const fn of this.#listeners) fn(snap);
  }
}
