import { beforeEach, describe, expect, it } from "vitest";
import { initTheme } from "../../src/theme.js";

class MemoryStorage {
  #data = new Map();
  getItem(k) {
    return this.#data.has(k) ? this.#data.get(k) : null;
  }
  setItem(k, v) {
    this.#data.set(k, String(v));
  }
}

describe("initTheme", () => {
  let storage;
  beforeEach(() => {
    storage = new MemoryStorage();
    delete document.documentElement.dataset.theme;
  });

  it("defaults to light", () => {
    const theme = initTheme({ storage });
    expect(theme.current()).toBe("light");
    expect(document.documentElement.dataset.theme).toBe("light");
  });

  it("toggles to dark and persists", () => {
    const theme = initTheme({ storage });
    theme.toggle();
    expect(theme.current()).toBe("dark");
    expect(document.documentElement.dataset.theme).toBe("dark");
    expect(storage.getItem("nozzles-theme")).toBe("dark");
  });

  it("restores the persisted choice", () => {
    storage.setItem("nozzles-theme", "dark");
    const theme = initTheme({ storage });
    expect(theme.current()).toBe("dark");
  });

  it("ignores garbage in storage", () => {
    storage.setItem("nozzles-theme", "purple");
    const theme = initTheme({ storage });
    expect(theme.current()).toBe("light");
  });
});
