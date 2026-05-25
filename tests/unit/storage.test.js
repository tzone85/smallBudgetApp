import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { LocalStorage, NullStorage } from "../../src/storage.js";

describe("NullStorage", () => {
  it("noops save and returns null on load", () => {
    const s = new NullStorage();
    s.save({ budget: 1, expenses: [] });
    expect(s.load()).toBeNull();
  });
});

describe("LocalStorage", () => {
  let store;
  beforeEach(() => {
    store = new Map();
    globalThis.localStorage = {
      getItem: (k) => (store.has(k) ? store.get(k) : null),
      setItem: (k, v) => store.set(k, v),
      removeItem: (k) => store.delete(k),
      clear: () => store.clear(),
    };
  });
  afterEach(() => {
    delete globalThis.localStorage;
  });

  it("save → load roundtrip", () => {
    const s = new LocalStorage("budget");
    s.save({ budget: 500, expenses: [{ id: 1, title: "a", amount: 50 }] });
    expect(s.load()).toEqual({
      budget: 500,
      expenses: [{ id: 1, title: "a", amount: 50 }],
    });
  });

  it("load returns null when nothing stored", () => {
    const s = new LocalStorage("budget");
    expect(s.load()).toBeNull();
  });

  it("load returns null + logs warning on malformed JSON", () => {
    store.set("budget", "{not-json");
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const s = new LocalStorage("budget");
    expect(s.load()).toBeNull();
    expect(warn).toHaveBeenCalled();
    warn.mockRestore();
  });

  it("clear removes the entry", () => {
    const s = new LocalStorage("budget");
    s.save({ budget: 1, expenses: [] });
    s.clear();
    expect(s.load()).toBeNull();
  });
});
