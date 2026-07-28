/**
 * Minimal CSV writer (RFC 4180 line endings, quoting) with spreadsheet
 * formula-injection protection: cells starting with = + or @ get a leading
 * apostrophe so Excel/Sheets treat them as text.
 */
const NEEDS_QUOTING = /[",\n\r]/;
const FORMULA_START = /^[=+@]/;

function cell(value) {
  if (value === null || value === undefined) return "";
  let s = String(value);
  if (typeof value === "string" && FORMULA_START.test(s)) s = "'" + s;
  if (NEEDS_QUOTING.test(s)) s = '"' + s.replaceAll('"', '""') + '"';
  return s;
}

export function toCsv(headers, rows) {
  const lines = [headers, ...rows].map((row) => row.map(cell).join(","));
  return lines.join("\r\n");
}
