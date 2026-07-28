import { describe, it, expect } from "vitest";
import { contrastRatio, hexToRgb } from "./helpers/wcag.js";

describe("wcag contrast helper", () => {
  it("parses 6-digit and 3-digit hex", () => {
    expect(hexToRgb("#ffffff")).toEqual({ r: 255, g: 255, b: 255 });
    expect(hexToRgb("#fff")).toEqual({ r: 255, g: 255, b: 255 });
    expect(hexToRgb("#1B2733")).toEqual({ r: 27, g: 39, b: 51 });
  });

  it("rejects non-hex values", () => {
    expect(() => hexToRgb("rebeccapurple")).toThrow(/not a hex color/);
  });

  it("matches known reference ratios", () => {
    expect(contrastRatio("#000000", "#ffffff")).toBeCloseTo(21, 5);
    expect(contrastRatio("#ffffff", "#ffffff")).toBeCloseTo(1, 5);
    // Order must not matter.
    expect(contrastRatio("#777777", "#ffffff")).toBeCloseTo(
      contrastRatio("#ffffff", "#777777"),
      10,
    );
  });
});
