// Prefixa todos os seletores de um CSS com um escopo (ex.: .tela-tickets) — uso: node escopo-css.mjs entrada.css saida.css .tela-x
import { readFileSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
const require = createRequire(process.cwd() + "/package.json");
const postcss = require("postcss");
const [, , ent, sai, escopo] = process.argv;
const css = readFileSync(ent, "utf8");
const root = postcss.parse(css);
root.walkAtRules((r) => { if (r.name === "import") r.remove(); });
root.walkRules((rule) => {
  const p = rule.parent;
  if (p && p.type === "atrule" && /keyframes/i.test(p.name)) return;
  rule.selectors = rule.selectors.map((s) => {
    s = s.trim();
    if (/^(html|body|:root)\b/.test(s)) {
      const resto = s.replace(/^(html|body|:root)(\s*,?\s*(html|body))?/, "").trim();
      return resto ? `${escopo} ${resto}` : escopo;
    }
    if (s === "*" || s.startsWith("*")) return `${escopo} ${s}`;
    return `${escopo} ${s}`;
  });
});
writeFileSync(sai, root.toString());
console.log("ok", sai);
