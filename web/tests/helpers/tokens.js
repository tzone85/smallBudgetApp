import { readFileSync } from "node:fs";

// Parses `--name: value;` declarations out of a CSS file and resolves
// one level of var() aliasing (e.g. --color-positive: var(--color-brand)).
export function readTokens(cssUrl) {
  const css = readFileSync(cssUrl, "utf8");
  const tokens = {};
  for (const match of css.matchAll(/--([a-z0-9-]+)\s*:\s*([^;]+);/g)) {
    tokens[match[1]] = match[2].trim();
  }
  for (const [name, value] of Object.entries(tokens)) {
    const alias = value.match(/^var\(--([a-z0-9-]+)\)$/);
    if (alias) tokens[name] = tokens[alias[1]] ?? value;
  }
  return tokens;
}
