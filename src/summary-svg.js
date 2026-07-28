/**
 * Spending summary drawn as a plain SVG string — no chart library. One bar
 * per category (plus "Uncategorised"), a tick where the limit sits, red bar
 * when a limit is blown. Colors come from CSS classes so the chart follows
 * the light/dark theme. All text is escaped before interpolation.
 */
const WIDTH = 640;
const LABEL_W = 150;
const BAR_X = LABEL_W + 10;
const BAR_MAX_W = WIDTH - BAR_X - 90;
const ROW_H = 34;
const BAR_H = 18;
const HEADER_H = 44;

function esc(s) {
  return String(s)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

export function summarySvg(snapshot, { currency = "R" } = {}) {
  const { activeMonth, budget, totalExpenses, categories, expenses } = snapshot;

  const uncategorised = expenses
    .filter((e) => e.categoryId === null)
    .reduce((acc, e) => acc + e.amount, 0);

  const rows = categories.map((c) => ({
    name: c.name,
    spent: c.spent,
    limit: c.limit,
    over: c.over,
  }));
  if (uncategorised > 0) {
    rows.push({ name: "Uncategorised", spent: uncategorised, limit: null, over: false });
  }

  const height = HEADER_H + Math.max(rows.length, 1) * ROW_H + 10;
  const scale = Math.max(1, ...rows.map((r) => Math.max(r.spent, r.limit ?? 0)));
  const px = (value) => Math.round((value / scale) * BAR_MAX_W * 100) / 100;

  const title = `Spending summary for ${activeMonth}`;
  const parts = [];
  parts.push(
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${WIDTH} ${height}" ` +
      `role="img" aria-label="${esc(title)}" class="summary-chart">`,
  );
  parts.push(`<title>${esc(title)}</title>`);
  parts.push(
    `<text x="0" y="18" class="summary-heading">${esc(
      `${activeMonth} — spent ${currency}${totalExpenses} of ${currency}${budget}`,
    )}</text>`,
  );

  if (rows.length === 0) {
    parts.push(
      `<text x="0" y="${HEADER_H + 20}" class="summary-label">Nothing spent this month yet.</text>`,
    );
  }

  rows.forEach((r, i) => {
    const y = HEADER_H + i * ROW_H;
    const barY = y + (ROW_H - BAR_H) / 2 - 4;
    const textY = barY + BAR_H - 4;
    const barClass = r.over ? "summary-bar summary-bar--over" : "summary-bar";
    const label = r.limit === null ? `${currency}${r.spent}` : `${currency}${r.spent} / ${currency}${r.limit}`;
    parts.push(`<text x="0" y="${textY}" class="summary-label">${esc(r.name)}</text>`);
    parts.push(`<rect x="${BAR_X}" y="${barY}" width="${BAR_MAX_W}" height="${BAR_H}" class="summary-track"/>`);
    parts.push(
      `<rect x="${BAR_X}" y="${barY}" width="${px(r.spent)}" height="${BAR_H}" class="${barClass}"/>`,
    );
    if (r.limit !== null) {
      const lx = BAR_X + px(r.limit);
      parts.push(
        `<line x1="${lx}" y1="${barY - 3}" x2="${lx}" y2="${barY + BAR_H + 3}" class="summary-limit"/>`,
      );
    }
    parts.push(
      `<text x="${BAR_X + BAR_MAX_W + 8}" y="${textY}" class="summary-value">${esc(label)}</text>`,
    );
  });

  parts.push("</svg>");
  return parts.join("");
}
