/**
 * UI bindings — thin layer between the BudgetStore and the DOM.
 * No business rules here; renders state, dispatches events. User-supplied
 * strings only ever reach the DOM through textContent or the escaping in
 * summarySvg(), never raw innerHTML.
 */
import { summarySvg } from "./summary-svg.js";

const FEEDBACK_MS = 3000;

export function mount({ store, theme, root = document, currencySymbol = "R" } = {}) {
  const $ = (sel) => root.querySelector(sel);

  const budgetSelect = $("#budget-select");
  const monthInput = $("#month-input");
  const themeToggle = $("#theme-toggle");

  const budgetForm = $("#budget-form");
  const budgetInput = $("#budget-input");
  const budgetFeedback = $(".budget-feedback");

  const budgetCreateForm = $("#budget-create-form");
  const newBudgetInput = $("#new-budget-input");
  const deleteBudgetBtn = $("#delete-budget-btn");
  const manageFeedback = $(".manage-feedback");

  const categoryForm = $("#category-form");
  const categoryNameInput = $("#category-name-input");
  const categoryLimitInput = $("#category-limit-input");
  const categoryFeedback = $(".category-feedback");
  const categoryList = $("#category-list");

  const expenseForm = $("#expense-form");
  const expenseTitleInput = $("#expense-input");
  const expenseAmountInput = $("#amount-input");
  const expenseCategorySelect = $("#expense-category");
  const expenseRecurringCheck = $("#expense-recurring");
  const expenseFeedback = $(".expense-feedback");
  const expenseList = $("#expense-list");
  const recurringList = $("#recurring-list");

  const budgetAmount = $("#budget-amount");
  const expenseAmount = $("#expense-amount");
  const balance = $("#balance");
  const balanceAmount = $("#balance-amount");

  const summary = $("#summary");
  const exportBtn = $("#export-csv");

  root.querySelectorAll("[data-currency]").forEach((el) => (el.textContent = currencySymbol + " "));

  function showFeedback(el, text) {
    el.textContent = text;
    el.classList.add("showItem");
    setTimeout(() => el.classList.remove("showItem"), FEEDBACK_MS);
  }

  function linkButton(label, ariaLabel, className, id) {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = `btn--link ${className}`;
    btn.dataset.id = String(id);
    btn.setAttribute("aria-label", ariaLabel);
    btn.textContent = label;
    return btn;
  }

  function renderBudgetSelect(state) {
    budgetSelect.replaceChildren(
      ...state.budgets.map((b) => {
        const opt = document.createElement("option");
        opt.value = String(b.id);
        opt.textContent = b.name;
        return opt;
      }),
    );
    budgetSelect.value = String(state.activeBudgetId);
  }

  function renderCategoryOptions(state) {
    const previous = expenseCategorySelect.value;
    const none = document.createElement("option");
    none.value = "";
    none.textContent = "No category";
    expenseCategorySelect.replaceChildren(
      none,
      ...state.categories.map((c) => {
        const opt = document.createElement("option");
        opt.value = String(c.id);
        opt.textContent = c.name;
        return opt;
      }),
    );
    if ([...expenseCategorySelect.options].some((o) => o.value === previous)) {
      expenseCategorySelect.value = previous;
    }
  }

  function renderCategoryList(state) {
    categoryList.replaceChildren(
      ...state.categories.map((c) => {
        const li = document.createElement("li");
        li.dataset.categoryId = String(c.id);

        const name = document.createElement("span");
        name.className = "expense-title category-name";
        name.textContent = c.name;

        const spend = document.createElement("span");
        spend.className = c.over ? "tag tag--over category-spend" : "tag category-spend";
        spend.textContent =
          c.limit === null
            ? `${currencySymbol}${c.spent}`
            : `${currencySymbol}${c.spent} / ${currencySymbol}${c.limit}${c.over ? " — over" : ""}`;

        li.append(name, spend, linkButton("delete", `Delete category ${c.name}`, "category-delete", c.id));
        return li;
      }),
    );
  }

  function renderRecurringList(state) {
    recurringList.replaceChildren(
      ...state.recurring.map((r) => {
        const li = document.createElement("li");
        const title = document.createElement("span");
        title.className = "expense-title recurring-title";
        title.textContent = r.title;
        const amt = document.createElement("span");
        amt.className = "expense-amount";
        amt.textContent = `${currencySymbol}${r.amount}`;
        li.append(title, amt, linkButton("stop", `Stop recurring ${r.title}`, "recurring-delete", r.id));
        return li;
      }),
    );
  }

  function renderExpenseList(state) {
    expenseList.replaceChildren(
      ...state.expenses.map((e) => {
        const row = document.createElement("div");
        row.className = "expense-item";
        row.dataset.expenseId = String(e.id);

        const title = document.createElement("span");
        title.className = "expense-title";
        title.textContent = e.recurringId ? `${e.title} ↻` : e.title;

        const amt = document.createElement("span");
        amt.className = "expense-amount";
        amt.textContent = `${currencySymbol}${e.amount}`;

        const row2 = [title];
        if (e.categoryName) {
          const tag = document.createElement("span");
          tag.className = "tag";
          tag.textContent = e.categoryName;
          row2.push(tag);
        }
        row.append(
          ...row2,
          amt,
          linkButton("edit", `Edit ${e.title}`, "edit-icon", e.id),
          linkButton("delete", `Delete ${e.title}`, "delete-icon", e.id),
        );
        return row;
      }),
    );
  }

  function render(state) {
    budgetAmount.textContent = state.budget.toString();
    expenseAmount.textContent = state.totalExpenses.toString();
    balanceAmount.textContent = state.balance.toString();
    balance.classList.remove("is-positive", "is-negative", "is-zero");
    balance.classList.add(`is-${state.balanceState}`);

    monthInput.value = state.activeMonth;
    renderBudgetSelect(state);
    renderCategoryOptions(state);
    renderCategoryList(state);
    renderRecurringList(state);
    renderExpenseList(state);

    // Safe: summarySvg escapes all interpolated text.
    summary.innerHTML = summarySvg(state, { currency: currencySymbol });
  }

  function renderTheme() {
    themeToggle.textContent = theme.current() === "dark" ? "Light mode" : "Dark mode";
    themeToggle.setAttribute("aria-pressed", String(theme.current() === "dark"));
  }

  budgetForm?.addEventListener("submit", (ev) => {
    ev.preventDefault();
    const result = store.setBudget(budgetInput.value);
    if (!result.ok) return showFeedback(budgetFeedback, result.error);
    budgetInput.value = "";
  });

  budgetCreateForm?.addEventListener("submit", (ev) => {
    ev.preventDefault();
    const result = store.createBudget(newBudgetInput.value);
    if (!result.ok) return showFeedback(manageFeedback, result.error);
    newBudgetInput.value = "";
  });

  deleteBudgetBtn?.addEventListener("click", () => {
    const result = store.deleteBudget(store.snapshot().activeBudgetId);
    if (!result.ok) showFeedback(manageFeedback, result.error);
  });

  budgetSelect?.addEventListener("change", () => {
    store.selectBudget(Number(budgetSelect.value));
  });

  monthInput?.addEventListener("change", () => {
    const result = store.setMonth(monthInput.value);
    if (!result.ok) monthInput.value = store.snapshot().activeMonth;
  });

  categoryForm?.addEventListener("submit", (ev) => {
    ev.preventDefault();
    const result = store.addCategory({
      name: categoryNameInput.value,
      limit: categoryLimitInput.value === "" ? null : categoryLimitInput.value,
    });
    if (!result.ok) return showFeedback(categoryFeedback, result.error);
    categoryNameInput.value = "";
    categoryLimitInput.value = "";
  });

  categoryList?.addEventListener("click", (ev) => {
    const target = ev.target.closest(".category-delete");
    if (target) store.removeCategory(Number(target.dataset.id));
  });

  expenseForm?.addEventListener("submit", (ev) => {
    ev.preventDefault();
    const input = {
      title: expenseTitleInput.value,
      amount: expenseAmountInput.value,
      categoryId: expenseCategorySelect.value === "" ? null : Number(expenseCategorySelect.value),
    };
    const result = expenseRecurringCheck.checked
      ? store.addRecurring(input)
      : store.addExpense(input);
    if (!result.ok) return showFeedback(expenseFeedback, result.error);
    expenseTitleInput.value = "";
    expenseAmountInput.value = "";
    expenseRecurringCheck.checked = false;
  });

  recurringList?.addEventListener("click", (ev) => {
    const target = ev.target.closest(".recurring-delete");
    if (target) store.removeRecurring(Number(target.dataset.id));
  });

  expenseList?.addEventListener("click", (ev) => {
    const target = ev.target.closest(".edit-icon, .delete-icon");
    if (!target) return;
    const id = Number(target.dataset.id);
    if (target.classList.contains("edit-icon")) {
      const expense = store.snapshot().expenses.find((e) => e.id === id);
      if (!expense) return;
      expenseTitleInput.value = expense.title;
      expenseAmountInput.value = expense.amount;
      expenseCategorySelect.value = expense.categoryId === null ? "" : String(expense.categoryId);
      store.removeExpense(id);
    } else {
      store.removeExpense(id);
    }
  });

  exportBtn?.addEventListener("click", () => {
    const snap = store.snapshot();
    const name = snap.budgets.find((b) => b.id === snap.activeBudgetId)?.name ?? "budget";
    const blob = new Blob([store.exportCsv()], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${name.toLowerCase().replaceAll(/\s+/g, "-")}-expenses.csv`;
    a.click();
    URL.revokeObjectURL(url);
  });

  themeToggle?.addEventListener("click", () => {
    theme.toggle();
    renderTheme();
  });

  const unsubscribe = store.subscribe(render);
  render(store.snapshot());
  renderTheme();

  return { unmount: unsubscribe };
}
