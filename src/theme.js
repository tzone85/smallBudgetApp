/**
 * Light/dark theme switch. Sets `data-theme` on <html>; the design tokens in
 * styles/tokens.css swap on that attribute. Persists the choice.
 */
const KEY = "nozzles-theme";
const THEMES = ["light", "dark"];

export function initTheme({ storage, root = document.documentElement } = {}) {
  const stored = storage?.getItem(KEY);
  let theme = THEMES.includes(stored) ? stored : "light";

  function apply() {
    root.dataset.theme = theme;
  }
  apply();

  return {
    current: () => theme,
    toggle() {
      theme = theme === "dark" ? "light" : "dark";
      storage?.setItem(KEY, theme);
      apply();
      return theme;
    },
  };
}
