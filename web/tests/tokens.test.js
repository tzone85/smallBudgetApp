import { describe, it, expect } from "vitest";
import { readTokens } from "./helpers/tokens.js";
import { contrastRatio } from "./helpers/wcag.js";

const tokens = readTokens(new URL("../styles/tokens.css", import.meta.url));

describe("design tokens", () => {
  it("exposes the palette as CSS vars", () => {
    for (const name of [
      "color-bg",
      "color-surface",
      "color-border",
      "color-text",
      "color-text-muted",
      "color-brand",
      "color-brand-strong",
      "color-on-brand",
      "color-positive",
      "color-negative",
      "color-danger-bg",
      "color-danger-text",
      "color-focus",
    ]) {
      expect(tokens[name], `--${name} missing`).toBeDefined();
    }
  });

  it("exposes the type pairing and scale as CSS vars", () => {
    expect(tokens["font-display"]).toMatch(/serif/);
    expect(tokens["font-body"]).toMatch(/system-ui|sans-serif/);
    for (const name of [
      "text-sm",
      "text-base",
      "text-lg",
      "text-xl",
      "text-2xl",
      "leading-tight",
      "leading-normal",
    ]) {
      expect(tokens[name], `--${name} missing`).toBeDefined();
    }
  });

  it("exposes an ascending rem spacing scale", () => {
    const steps = ["space-1", "space-2", "space-3", "space-4", "space-5", "space-6"];
    const values = steps.map((name) => {
      expect(tokens[name], `--${name} missing`).toMatch(/rem$/);
      return parseFloat(tokens[name]);
    });
    for (let i = 1; i < values.length; i++) {
      expect(values[i], `${steps[i]} must exceed ${steps[i - 1]}`).toBeGreaterThan(
        values[i - 1],
      );
    }
  });
});

describe("AA contrast", () => {
  // [foreground, background, minimum ratio]. 4.5 is AA for normal text,
  // 3 is AA for non-text UI (the focus ring against page/surface).
  const pairs = [
    ["color-text", "color-bg", 4.5],
    ["color-text", "color-surface", 4.5],
    ["color-text-muted", "color-bg", 4.5],
    ["color-text-muted", "color-surface", 4.5],
    ["color-brand", "color-surface", 4.5],
    ["color-on-brand", "color-brand", 4.5],
    ["color-on-brand", "color-brand-strong", 4.5],
    ["color-positive", "color-surface", 4.5],
    ["color-negative", "color-surface", 4.5],
    ["color-danger-text", "color-danger-bg", 4.5],
    ["color-focus", "color-bg", 3],
    ["color-focus", "color-surface", 3],
  ];

  it.each(pairs)("--%s on --%s ≥ %s:1", (fg, bg, min) => {
    const ratio = contrastRatio(tokens[fg], tokens[bg]);
    expect(ratio).toBeGreaterThanOrEqual(min);
  });
});
