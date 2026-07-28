import "./styles/tokens.css";
import "./styles/base.css";
import "./styles/main.css";

import { BudgetStore } from "./budget-store.js";
import { LocalStorage } from "./storage.js";
import { initTheme } from "./theme.js";
import { mount } from "./ui.js";

const STORAGE_KEY = "nozzles-budget-app:v2";
const LEGACY_KEY = "nozzles-budget-app:v1";

const currentMonth = new Date().toISOString().slice(0, 7);
const store = new BudgetStore({ month: currentMonth });

const storage = new LocalStorage(STORAGE_KEY);
const persisted = storage.load() ?? new LocalStorage(LEGACY_KEY).load();
if (persisted) {
  store.hydrate(persisted);
  // Always open on the real current month so recurring expenses materialise.
  store.setMonth(currentMonth);
}

store.subscribe(() => storage.save(store.serialize()));

const theme = initTheme({ storage: localStorage });

mount({ store, theme });
