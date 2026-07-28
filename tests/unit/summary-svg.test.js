import { describe, expect, it } from "vitest";
import { summarySvg } from "../../src/summary-svg.js";

function snap(overrides = {}) {
  return {
    activeMonth: "2026-07",
    budget: 1000,
    totalExpenses: 300,
    balance: 700,
    categories: [
      { id: 1, name: "Food", limit: 200, spent: 150, over: false },
      { id: 2, name: "Fun", limit: 50, spent: 80, over: true },
    ],
    expenses: [
      { id: 10, title: "veg", amount: 150, categoryId: 1 },
      { id: 11, title: "games", amount: 80, categoryId: 2 },
      { id: 12, title: "misc", amount: 70, categoryId: null },
    ],
    ...overrides,
  };
}

describe("summarySvg", () => {
  it("returns a self-contained accessible svg", () => {
    const svg = summarySvg(snap());
    expect(svg).toMatch(/^<svg /);
    expect(svg).toContain('role="img"');
    expect(svg).toContain("<title>");
    expect(svg).toContain("2026-07");
  });

  it("draws one bar per category plus uncategorised", () => {
    const svg = summarySvg(snap());
    expect(svg.match(/class="summary-bar/g)).toHaveLength(3);
    expect(svg).toContain("Food");
    expect(svg).toContain("Uncategorised");
  });

  it("flags over-limit categories and draws limit markers", () => {
    const svg = summarySvg(snap());
    expect(svg).toContain("summary-bar--over");
    expect(svg.match(/class="summary-limit"/g)).toHaveLength(2);
  });

  it("escapes category names", () => {
    const svg = summarySvg(
      snap({
        categories: [{ id: 1, name: "<img onerror=x>", limit: null, spent: 5, over: false }],
        expenses: [{ id: 1, title: "x", amount: 5, categoryId: 1 }],
      }),
    );
    expect(svg).not.toContain("<img");
    expect(svg).toContain("&lt;img");
  });

  it("handles the empty month without dividing by zero", () => {
    const svg = summarySvg(snap({ categories: [], expenses: [], totalExpenses: 0, budget: 0 }));
    expect(svg).toMatch(/^<svg /);
    expect(svg).toContain("Nothing spent");
    expect(svg).not.toContain("NaN");
  });
});
