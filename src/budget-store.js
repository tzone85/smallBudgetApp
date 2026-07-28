/**
 * Pure budget logic — no DOM, no I/O, no globals, no Date.
 *
 * Holds several named budgets. Each budget has a monthly amount, categories
 * with optional spending limits, one-off expenses (tagged with a "YYYY-MM"
 * month), and recurring templates that materialise into every month you
 * visit. `snapshot()` is a projection for the active budget + month; the UI
 * re-renders from it via `subscribe()`. `serialize()`/`hydrate()` are the
 * persistence contract for the outer Storage adapter.
 */
import { toCsv } from "./csv.js";

const NUMERIC = /^-?\d+(\.\d+)?$/;
const MONTH_RE = /^\d{4}-(0[1-9]|1[0-2])$/;

function parseAmount(value) {
  if (value === null || value === undefined || value === "") return NaN;
  if (typeof value === "number") return Number.isFinite(value) ? value : NaN;
  if (typeof value === "string" && NUMERIC.test(value.trim())) return Number(value);
  return NaN;
}

function cleanTitle(value) {
  return (value ?? "").toString().trim();
}

export class BudgetStore {
  #budgets = [];
  #activeBudgetId = 1;
  #activeMonth;
  #nextId = 1;
  #listeners = new Set();

  constructor({ month = "1970-01" } = {}) {
    this.#activeMonth = MONTH_RE.test(month) ? month : "1970-01";
    this.#budgets = [this.#blankBudget(this.#nextId++, "Personal")];
  }

  #blankBudget(id, name) {
    return { id, name, amount: 0, categories: [], recurring: [], expenses: [] };
  }

  #active() {
    return this.#budgets.find((b) => b.id === this.#activeBudgetId);
  }

  // ---- snapshot ----------------------------------------------------------

  snapshot() {
    const b = this.#active();
    const monthExpenses = b.expenses.filter((e) => e.month === this.#activeMonth);
    const totalExpenses = monthExpenses.reduce((acc, e) => acc + e.amount, 0);
    const balance = b.amount - totalExpenses;
    let balanceState = "zero";
    if (balance > 0) balanceState = "positive";
    else if (balance < 0) balanceState = "negative";

    const categoryName = (id) => b.categories.find((c) => c.id === id)?.name ?? null;
    const categories = b.categories.map((c) => {
      const spent = monthExpenses
        .filter((e) => e.categoryId === c.id)
        .reduce((acc, e) => acc + e.amount, 0);
      return {
        id: c.id,
        name: c.name,
        limit: c.limit,
        spent,
        over: c.limit !== null && spent > c.limit,
      };
    });

    return {
      budgets: this.#budgets.map((x) => ({ id: x.id, name: x.name })),
      activeBudgetId: this.#activeBudgetId,
      activeMonth: this.#activeMonth,
      budget: b.amount,
      categories,
      recurring: b.recurring.map((r) => ({ ...r })),
      expenses: monthExpenses.map((e) => ({ ...e, categoryName: categoryName(e.categoryId) })),
      totalExpenses,
      balance,
      balanceState,
    };
  }

  // ---- budgets -----------------------------------------------------------

  createBudget(name) {
    const n = cleanTitle(name);
    if (n === "") return { ok: false, error: "budget name is required" };
    if (this.#budgets.some((b) => b.name.toLowerCase() === n.toLowerCase())) {
      return { ok: false, error: "a budget with that name already exists" };
    }
    const budget = this.#blankBudget(this.#nextId++, n);
    this.#budgets.push(budget);
    this.#activeBudgetId = budget.id;
    this.#materialize();
    this.#emit();
    return { ok: true, budget: { id: budget.id, name: budget.name } };
  }

  renameBudget(id, name) {
    const b = this.#budgets.find((x) => x.id === id);
    if (!b) return { ok: false, error: "budget not found" };
    const n = cleanTitle(name);
    if (n === "") return { ok: false, error: "budget name is required" };
    if (this.#budgets.some((x) => x.id !== id && x.name.toLowerCase() === n.toLowerCase())) {
      return { ok: false, error: "a budget with that name already exists" };
    }
    b.name = n;
    this.#emit();
    return { ok: true };
  }

  deleteBudget(id) {
    if (!this.#budgets.some((b) => b.id === id)) {
      return { ok: false, error: "budget not found" };
    }
    if (this.#budgets.length === 1) {
      return { ok: false, error: "cannot delete the last budget" };
    }
    this.#budgets = this.#budgets.filter((b) => b.id !== id);
    if (this.#activeBudgetId === id) this.#activeBudgetId = this.#budgets[0].id;
    this.#emit();
    return { ok: true };
  }

  selectBudget(id) {
    if (!this.#budgets.some((b) => b.id === id)) {
      return { ok: false, error: "budget not found" };
    }
    this.#activeBudgetId = id;
    this.#materialize();
    this.#emit();
    return { ok: true };
  }

  // ---- months ------------------------------------------------------------

  setMonth(month) {
    if (typeof month !== "string" || !MONTH_RE.test(month)) {
      return { ok: false, error: "month must look like 2026-07" };
    }
    this.#activeMonth = month;
    this.#materialize();
    this.#emit();
    return { ok: true };
  }

  // ---- budget amount -----------------------------------------------------

  setBudget(value) {
    if (value === null || value === undefined || value === "") {
      return { ok: false, error: "budget is required" };
    }
    const n = parseAmount(value);
    if (Number.isNaN(n)) return { ok: false, error: "budget must be numeric" };
    if (n < 0) return { ok: false, error: "budget must be non-negative" };
    this.#active().amount = n;
    this.#emit();
    return { ok: true };
  }

  // ---- categories --------------------------------------------------------

  #parseLimit(limit) {
    if (limit === undefined || limit === null || limit === "") return { ok: true, value: null };
    const n = parseAmount(limit);
    if (Number.isNaN(n) || n <= 0) {
      return { ok: false, error: "limit must be a positive number" };
    }
    return { ok: true, value: n };
  }

  addCategory({ name, limit } = {}) {
    const b = this.#active();
    const n = cleanTitle(name);
    if (n === "") return { ok: false, error: "category name is required" };
    if (b.categories.some((c) => c.name.toLowerCase() === n.toLowerCase())) {
      return { ok: false, error: "a category with that name already exists" };
    }
    const lim = this.#parseLimit(limit);
    if (!lim.ok) return lim;
    const category = { id: this.#nextId++, name: n, limit: lim.value };
    b.categories.push(category);
    this.#emit();
    return { ok: true, category: { ...category } };
  }

  updateCategory(id, patch = {}) {
    const b = this.#active();
    const c = b.categories.find((x) => x.id === id);
    if (!c) return { ok: false, error: "category not found" };
    const nextName = patch.name !== undefined ? cleanTitle(patch.name) : c.name;
    if (nextName === "") return { ok: false, error: "category name is required" };
    let nextLimit = c.limit;
    if ("limit" in patch) {
      const lim = this.#parseLimit(patch.limit);
      if (!lim.ok) return lim;
      nextLimit = lim.value;
    }
    c.name = nextName;
    c.limit = nextLimit;
    this.#emit();
    return { ok: true, category: { ...c } };
  }

  removeCategory(id) {
    const b = this.#active();
    if (!b.categories.some((c) => c.id === id)) {
      return { ok: false, error: "category not found" };
    }
    b.categories = b.categories.filter((c) => c.id !== id);
    b.expenses = b.expenses.map((e) => (e.categoryId === id ? { ...e, categoryId: null } : e));
    b.recurring = b.recurring.map((r) => (r.categoryId === id ? { ...r, categoryId: null } : r));
    this.#emit();
    return { ok: true };
  }

  // ---- expenses ----------------------------------------------------------

  #validateExpense({ title, amount, categoryId }) {
    const t = cleanTitle(title);
    if (t === "") return { ok: false, error: "title is required" };
    const n = parseAmount(amount);
    if (Number.isNaN(n) || n <= 0) {
      return { ok: false, error: "amount must be a positive number" };
    }
    let cat = null;
    if (categoryId !== undefined && categoryId !== null && categoryId !== "") {
      const id = Number(categoryId);
      if (!this.#active().categories.some((c) => c.id === id)) {
        return { ok: false, error: "category not found" };
      }
      cat = id;
    }
    return { ok: true, title: t, amount: n, categoryId: cat };
  }

  addExpense(input = {}) {
    const v = this.#validateExpense(input);
    if (!v.ok) return v;
    const expense = {
      id: this.#nextId++,
      title: v.title,
      amount: v.amount,
      categoryId: v.categoryId,
      month: this.#activeMonth,
      recurringId: null,
    };
    this.#active().expenses.push(expense);
    this.#emit();
    return { ok: true, expense: { ...expense } };
  }

  removeExpense(id) {
    const b = this.#active();
    const before = b.expenses.length;
    b.expenses = b.expenses.filter((e) => e.id !== id);
    if (b.expenses.length === before) return { ok: false, error: "expense not found" };
    this.#emit();
    return { ok: true };
  }

  updateExpense(id, patch = {}) {
    const b = this.#active();
    const idx = b.expenses.findIndex((e) => e.id === id);
    if (idx === -1) return { ok: false, error: "expense not found" };
    const current = b.expenses[idx];
    const v = this.#validateExpense({
      title: patch.title !== undefined ? patch.title : current.title,
      amount: patch.amount !== undefined ? patch.amount : current.amount,
      categoryId: patch.categoryId !== undefined ? patch.categoryId : current.categoryId,
    });
    if (!v.ok) return v;
    b.expenses[idx] = {
      ...current,
      title: v.title,
      amount: v.amount,
      categoryId: v.categoryId,
    };
    this.#emit();
    return { ok: true, expense: { ...b.expenses[idx] } };
  }

  // ---- recurring ---------------------------------------------------------

  addRecurring(input = {}) {
    const v = this.#validateExpense(input);
    if (!v.ok) return v;
    const recurring = {
      id: this.#nextId++,
      title: v.title,
      amount: v.amount,
      categoryId: v.categoryId,
    };
    this.#active().recurring.push(recurring);
    this.#materialize();
    this.#emit();
    return { ok: true, recurring: { ...recurring } };
  }

  removeRecurring(id) {
    const b = this.#active();
    const before = b.recurring.length;
    b.recurring = b.recurring.filter((r) => r.id !== id);
    if (b.recurring.length === before) {
      return { ok: false, error: "recurring expense not found" };
    }
    this.#emit();
    return { ok: true };
  }

  /** Copy each recurring template into the active month, once. */
  #materialize() {
    const b = this.#active();
    for (const r of b.recurring) {
      const exists = b.expenses.some(
        (e) => e.recurringId === r.id && e.month === this.#activeMonth,
      );
      if (exists) continue;
      b.expenses.push({
        id: this.#nextId++,
        title: r.title,
        amount: r.amount,
        categoryId: r.categoryId,
        month: this.#activeMonth,
        recurringId: r.id,
      });
    }
  }

  // ---- export ------------------------------------------------------------

  /** CSV of every expense in the active budget, all months. */
  exportCsv() {
    const b = this.#active();
    const name = (id) => b.categories.find((c) => c.id === id)?.name ?? "";
    const rows = [...b.expenses]
      .sort((x, y) => (x.month === y.month ? x.id - y.id : x.month < y.month ? -1 : 1))
      .map((e) => [e.month, e.title, name(e.categoryId), e.amount, e.recurringId ? "yes" : "no"]);
    return toCsv(["month", "title", "category", "amount", "recurring"], rows);
  }

  // ---- persistence -------------------------------------------------------

  serialize() {
    return {
      version: 2,
      activeBudgetId: this.#activeBudgetId,
      activeMonth: this.#activeMonth,
      budgets: this.#budgets.map((b) => ({
        id: b.id,
        name: b.name,
        amount: b.amount,
        categories: b.categories.map((c) => ({ ...c })),
        recurring: b.recurring.map((r) => ({ ...r })),
        expenses: b.expenses.map((e) => ({ ...e })),
      })),
    };
  }

  hydrate(data) {
    if (!data || typeof data !== "object") return;
    if (Array.isArray(data.budgets)) {
      const budgets = data.budgets
        .filter((b) => b && typeof b.id === "number" && typeof b.name === "string")
        .map((b) => ({
          id: b.id,
          name: b.name,
          amount: typeof b.amount === "number" && Number.isFinite(b.amount) ? b.amount : 0,
          categories: (Array.isArray(b.categories) ? b.categories : [])
            .filter((c) => c && typeof c.id === "number" && typeof c.name === "string")
            .map((c) => ({
              id: c.id,
              name: c.name,
              limit: typeof c.limit === "number" ? c.limit : null,
            })),
          recurring: (Array.isArray(b.recurring) ? b.recurring : [])
            .filter(
              (r) =>
                r &&
                typeof r.id === "number" &&
                typeof r.title === "string" &&
                typeof r.amount === "number",
            )
            .map((r) => ({
              id: r.id,
              title: r.title,
              amount: r.amount,
              categoryId: typeof r.categoryId === "number" ? r.categoryId : null,
            })),
          expenses: (Array.isArray(b.expenses) ? b.expenses : [])
            .filter(
              (e) =>
                e &&
                typeof e.id === "number" &&
                typeof e.title === "string" &&
                typeof e.amount === "number" &&
                typeof e.month === "string" &&
                MONTH_RE.test(e.month),
            )
            .map((e) => ({
              id: e.id,
              title: e.title,
              amount: e.amount,
              categoryId: typeof e.categoryId === "number" ? e.categoryId : null,
              month: e.month,
              recurringId: typeof e.recurringId === "number" ? e.recurringId : null,
            })),
        }));
      if (budgets.length === 0) return;
      this.#budgets = budgets;
      this.#activeBudgetId = budgets.some((b) => b.id === data.activeBudgetId)
        ? data.activeBudgetId
        : budgets[0].id;
      if (typeof data.activeMonth === "string" && MONTH_RE.test(data.activeMonth)) {
        this.#activeMonth = data.activeMonth;
      }
    } else if (typeof data.budget === "number" || Array.isArray(data.expenses)) {
      // Legacy v1 shape: a single anonymous budget with flat expenses.
      const b = this.#blankBudget(1, "Personal");
      b.amount = typeof data.budget === "number" && Number.isFinite(data.budget) ? data.budget : 0;
      b.expenses = (Array.isArray(data.expenses) ? data.expenses : [])
        .filter(
          (e) =>
            e &&
            typeof e.id === "number" &&
            typeof e.title === "string" &&
            typeof e.amount === "number",
        )
        .map((e) => ({
          id: e.id,
          title: e.title,
          amount: e.amount,
          categoryId: null,
          month: this.#activeMonth,
          recurringId: null,
        }));
      this.#budgets = [b];
      this.#activeBudgetId = 1;
    } else {
      return;
    }
    this.#nextId =
      this.#budgets.reduce(
        (m, b) =>
          Math.max(
            m,
            b.id,
            ...b.categories.map((c) => c.id),
            ...b.recurring.map((r) => r.id),
            ...b.expenses.map((e) => e.id),
          ),
        0,
      ) + 1;
    this.#materialize();
    this.#emit();
  }

  // ---- subscriptions -----------------------------------------------------

  subscribe(fn) {
    this.#listeners.add(fn);
    return () => this.#listeners.delete(fn);
  }

  #emit() {
    const snap = this.snapshot();
    for (const fn of this.#listeners) fn(snap);
  }
}
