/**
 * UI bindings — thin layer between the BudgetStore and the DOM.
 * No business rules here; renders state, dispatches events.
 * All user-supplied strings are escaped via escapeHtml() before innerHTML.
 */
const FEEDBACK_MS = 3000;

export function mount({ store, root = document, currencySymbol = "R" } = {}) {
  const $ = (sel) => root.querySelector(sel);

  const budgetForm = $("#budget-form");
  const budgetInput = $("#budget-input");
  const budgetFeedback = $(".budget-feedback");

  const expenseForm = $("#expense-form");
  const expenseTitleInput = $("#expense-input");
  const expenseAmountInput = $("#amount-input");
  const expenseFeedback = $(".expense-feedback");

  const budgetAmount = $("#budget-amount");
  const expenseAmount = $("#expense-amount");
  const balance = $("#balance");
  const balanceAmount = $("#balance-amount");

  const expenseList = $("#expense-list");
  const currencySpans = root.querySelectorAll("[data-currency]");
  currencySpans.forEach((el) => (el.textContent = currencySymbol + " "));

  function showFeedback(el, text) {
    el.textContent = text;
    el.classList.add("showItem");
    setTimeout(() => el.classList.remove("showItem"), FEEDBACK_MS);
  }

  function render(state) {
    budgetAmount.textContent = state.budget.toString();
    expenseAmount.textContent = state.totalExpenses.toString();
    balanceAmount.textContent = state.balance.toString();
    balance.classList.remove("showRed", "showGreen", "showBlack");
    if (state.balanceState === "positive") balance.classList.add("showGreen");
    else if (state.balanceState === "negative") balance.classList.add("showRed");
    else balance.classList.add("showBlack");

    expenseList.replaceChildren();

    const header = document.createElement("div");
    header.className = "expense-list__info d-flex justify-content-between text-capitalize";
    header.innerHTML = `
      <h5 class="list-item">expense title</h5>
      <h5 class="list-item">expense value</h5>
      <h5 class="list-item"></h5>`;
    expenseList.appendChild(header);

    for (const e of state.expenses) {
      const row = document.createElement("div");
      row.className = "expense-item d-flex justify-content-between align-items-baseline";
      row.dataset.expenseId = String(e.id);

      const title = document.createElement("h6");
      title.className = "expense-title mb-0 text-uppercase list-item";
      title.textContent = `- ${e.title}`;

      const amt = document.createElement("h5");
      amt.className = "expense-amount mb-0 list-item";
      amt.textContent = String(e.amount);

      const icons = document.createElement("div");
      icons.className = "expense-icons list-item";

      const edit = document.createElement("button");
      edit.type = "button";
      edit.className = "btn btn-link p-0 mx-2 edit-icon";
      edit.dataset.id = String(e.id);
      edit.setAttribute("aria-label", `Edit ${e.title}`);
      edit.textContent = "edit";

      const del = document.createElement("button");
      del.type = "button";
      del.className = "btn btn-link p-0 delete-icon";
      del.dataset.id = String(e.id);
      del.setAttribute("aria-label", `Delete ${e.title}`);
      del.textContent = "delete";

      icons.append(edit, del);
      row.append(title, amt, icons);
      expenseList.appendChild(row);
    }
  }

  budgetForm?.addEventListener("submit", (ev) => {
    ev.preventDefault();
    const result = store.setBudget(budgetInput.value);
    if (!result.ok) {
      showFeedback(budgetFeedback, result.error);
      return;
    }
    budgetInput.value = "";
  });

  expenseForm?.addEventListener("submit", (ev) => {
    ev.preventDefault();
    const result = store.addExpense({
      title: expenseTitleInput.value,
      amount: expenseAmountInput.value,
    });
    if (!result.ok) {
      showFeedback(expenseFeedback, result.error);
      return;
    }
    expenseTitleInput.value = "";
    expenseAmountInput.value = "";
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
      store.removeExpense(id);
    } else if (target.classList.contains("delete-icon")) {
      store.removeExpense(id);
    }
  });

  const unsubscribe = store.subscribe(render);
  render(store.snapshot());

  return { unmount: unsubscribe };
}
