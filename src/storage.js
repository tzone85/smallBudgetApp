/**
 * Storage adapters — swap LocalStorage for NullStorage in tests or SSR.
 * Same contract: { save(state), load() -> state|null, clear() }.
 */
export class NullStorage {
  save(_state) {}
  load() {
    return null;
  }
  clear() {}
}

export class LocalStorage {
  #key;
  constructor(key) {
    if (!key) throw new Error("LocalStorage requires a key");
    this.#key = key;
  }
  save(state) {
    try {
      localStorage.setItem(this.#key, JSON.stringify(state));
    } catch (err) {
      console.warn("LocalStorage.save failed:", err);
    }
  }
  load() {
    const raw = localStorage.getItem(this.#key);
    if (raw === null) return null;
    try {
      return JSON.parse(raw);
    } catch (err) {
      console.warn("LocalStorage.load malformed JSON:", err);
      return null;
    }
  }
  clear() {
    localStorage.removeItem(this.#key);
  }
}
