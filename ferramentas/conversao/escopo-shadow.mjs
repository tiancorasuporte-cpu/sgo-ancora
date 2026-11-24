// CSS de uma página inteira → CSS para Shadow DOM: html/:root → :host, body → .sgo-corpo
import { readFileSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
const require = createRequire(process.cwd() + "/package.json");
const postcss = require("postcss");
const [, , ent, sai] = process.argv;
const root = postcss.parse(readFileSync(ent, "utf8"));
const imports = [];
root.walkAtRules((r) => { if (r.name === "import") { imports.push(r.params); r.remove(); } });
root.walkRules((rule) => {
  const p = rule.parent;
  if (p && p.type === "atrule" && /keyframes/i.test(p.name)) return;
  rule.selectors = rule.selectors.map((s) =>
    s.trim()
      .replace(/(^|[\s>+~,(])(html|:root)(?=$|[\s.#:[>+~,)])/g, "$1:host")
      .replace(/(^|[\s>+~,(])body(?=$|[\s.#:[>+~,)])/g, "$1.sgo-corpo")
      .replace(/:host\s+\.sgo-corpo/g, ".sgo-corpo"),
  );
});
writeFileSync(sai, root.toString());
console.log("ok", sai, imports.length ? "imports ignorados: " + imports.join(" | ") : "");
