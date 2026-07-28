import { readFileSync } from "node:fs";
import { describe, it, expect } from "vitest";

const html = readFileSync(new URL("../index.html", import.meta.url), "utf8");
const baseCss = readFileSync(new URL("../styles/base.css", import.meta.url), "utf8");

describe("UI shell", () => {
  it("declares language and viewport", () => {
    expect(html).toMatch(/<html[^>]*lang="en"/);
    expect(html).toMatch(/name="viewport"/);
  });

  it("loads tokens before base styles", () => {
    const tokensAt = html.indexOf("styles/tokens.css");
    const baseAt = html.indexOf("styles/base.css");
    expect(tokensAt).toBeGreaterThan(-1);
    expect(baseAt).toBeGreaterThan(tokensAt);
  });

  it("has landmark structure and a skip link", () => {
    expect(html).toMatch(/<header/);
    expect(html).toMatch(/<main[^>]*id="main"/);
    expect(html).toMatch(/<footer/);
    expect(html).toMatch(/href="#main"[^>]*class="skip-link"|class="skip-link"[^>]*href="#main"/);
  });
});

describe("keyboard focus", () => {
  it("styles :focus-visible with a token-driven outline", () => {
    const rule = baseCss.match(/:focus-visible\s*{([^}]+)}/);
    expect(rule, "no :focus-visible rule in base.css").not.toBeNull();
    expect(rule[1]).toMatch(/outline:/);
    expect(rule[1]).not.toMatch(/outline:\s*none/);
    expect(rule[1]).toMatch(/var\(--color-focus\)/);
  });

  it("never removes outlines wholesale", () => {
    // `outline: none` is only acceptable inside :focus:not(:focus-visible).
    const stripped = baseCss.replace(/:focus:not\(:focus-visible\)\s*{[^}]*}/g, "");
    expect(stripped).not.toMatch(/outline:\s*(none|0)/);
  });
});
