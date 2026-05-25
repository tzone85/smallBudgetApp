import "bootstrap/dist/css/bootstrap.min.css";
import "./styles/main.css";

import { BudgetStore } from "./budget-store.js";
import { LocalStorage } from "./storage.js";
import { mount } from "./ui.js";

const STORAGE_KEY = "nozzles-budget-app:v1";

const storage = new LocalStorage(STORAGE_KEY);
const store = new BudgetStore();

const persisted = storage.load();
if (persisted) store.hydrate(persisted);

store.subscribe((snap) => storage.save(snap));

mount({ store });
