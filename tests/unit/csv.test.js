import { describe, expect, it } from "vitest";
import { toCsv } from "../../src/csv.js";

describe("toCsv", () => {
  it("joins headers and rows with CRLF", () => {
    const csv = toCsv(["a", "b"], [["1", "2"], ["3", "4"]]);
    expect(csv).toBe("a,b\r\n1,2\r\n3,4");
  });

  it("quotes cells containing commas, quotes or newlines", () => {
    const csv = toCsv(["t"], [['he said "hi", then left']]);
    expect(csv.split("\r\n")[1]).toBe('"he said ""hi"", then left"');
    expect(toCsv(["t"], [["a\nb"]])).toContain('"a\nb"');
  });

  it("stringifies numbers and empty values", () => {
    expect(toCsv(["n", "x"], [[10.5, null]])).toBe("n,x\r\n10.5,");
  });

  it("neutralises spreadsheet formula injection", () => {
    const csv = toCsv(["t"], [["=SUM(A1)"], ["@cmd"], ["+1"]]);
    const lines = csv.split("\r\n").slice(1);
    expect(lines[0]).toBe("'=SUM(A1)");
    expect(lines[1]).toBe("'@cmd");
    expect(lines[2]).toBe("'+1");
  });
});
