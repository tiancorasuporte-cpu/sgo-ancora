/**
 * O build de produção não pode subir sem o JavaScript que o navegador executa.
 * Um import solto era descartado e a via do cliente, a Omie e outras telas
 * sumiam do site, mesmo com o código no git. Este passo roda no fim de `bun run build`.
 */
import { readdirSync, readFileSync, statSync } from "node:fs";
import { dirname, join, resolve } from "node:path";

const root = resolve(import.meta.dirname, "..");
const clientDir = join(root, ".output", "public", "assets");
const serverDir = join(root, ".output", "server");

const pkg = JSON.parse(readFileSync(join(root, "package.json"), "utf8"));
if (pkg.sideEffects === false) {
  fail("package.json está com sideEffects:false. Isso tira código do bundle do navegador.");
}

const fontes = [];
const vistos = new Set();
for (const rota of listar(join(root, "src", "routes"))) seguir(rota);
const obrigatorios = [...new Set(fontes)];

const clientBlob = normalizar(lerArvore(clientDir, /\.(js|css)$/));
const serverBlob = normalizar(lerArvore(serverDir, /\.(js|mjs)$/));
if (!clientBlob) fail("Build do navegador ausente em .output/public/assets. Rode o vite build antes.");

const faltando = [];
for (const arquivo of obrigatorios) {
  let texto;
  try {
    texto = readFileSync(arquivo, "utf8");
  } catch {
    faltando.push(`${arquivo} (arquivo não encontrado)`);
    continue;
  }
  const marca = marcar(texto);
  if (!marca) {
    faltando.push(`${rel(arquivo)} (sem trecho estável para conferir)`);
    continue;
  }
  if (!contem(clientBlob, marca)) faltando.push(`${rel(arquivo)} → “${marca}”`);
}

const servidor = [
  ["/api/os/faturar-omie", "rota de enviar a OS para a Omie"],
  ["/api/cadastros/busca", "rota de busca de cadastros"],
  ["exigeTag", "busca de fornecedor sem exigir só a tag Fornecedor"],
];
for (const [marca, nome] of servidor) {
  if (!contem(serverBlob, marca)) faltando.push(`servidor: ${nome} → “${marca}”`);
}
// index.ts: cotação precisa achar parceiro mesmo quando a Omie deixou só a tag Cliente
const indexTs = readFileSync(join(root, "src", "sgo", "server", "index.ts"), "utf8");
if (!indexTs.includes('tag === "Fornecedor"') || !indexTs.includes("sql`true`")) {
  faltando.push("src/sgo/server/index.ts: busca de fornecedor ainda exige só a tag Fornecedor");
}

// Regressões que já quebraram orçamentos/compras em produção: a busca precisa
// rodar no Shadow DOM da tela isolada, não reaproveitar o SGOBusca da janela.
const clienteCritico = [
  ["__sgoDoc", "busca isolada por tela (Shadow DOM)"],
  ["SGOBusca&&window.SGOBusca.__sgoDoc===document", "não reusar SGOBusca da janela principal"],
  ['tipo:"cliente"', "orçamentos liga busca de cliente"],
  ['tipo:"produto"', "orçamentos liga busca de produto"],
  ["cadastros/busca", "autocomplete chama a API de cadastros"],
  ["composed:true", "evento sgo-busca atravessa o Shadow DOM"],
];
for (const [marca, nome] of clienteCritico) {
  if (!contem(clientBlob, marca)) faltando.push(`navegador: ${nome} → “${marca}”`);
}

const fonteBusca = join(root, "src", "sgo", "telas", "_comum", "busca-cadastros.js");
const textoBusca = readFileSync(fonteBusca, "utf8");
if (!textoBusca.includes("__sgoDoc")) {
  faltando.push("src/sgo/telas/_comum/busca-cadastros.js perdeu o isolamento __sgoDoc");
}
if (!textoBusca.includes("composed:true")) {
  faltando.push("src/sgo/telas/_comum/busca-cadastros.js perdeu composed:true no evento sgo-busca");
}

if (faltando.length) {
  console.error("\nO build de produção não está completo. O deploy deve parar.\n");
  for (const item of faltando) console.error("  - " + item);
  console.error("");
  process.exit(1);
}

console.log(
  `Build do navegador conferido: ${obrigatorios.length} telas + busca de orçamentos/cadastros.`,
);

function listar(dir) {
  const saida = [];
  for (const nome of readdirSync(dir)) {
    const caminho = join(dir, nome);
    if (statSync(caminho).isDirectory()) saida.push(...listar(caminho));
    else if (/\.(ts|tsx|js|mjs)$/.test(nome)) saida.push(caminho);
  }
  return saida;
}

function seguir(arquivo) {
  const chave = resolve(arquivo);
  if (vistos.has(chave)) return;
  vistos.add(chave);
  let texto;
  try {
    texto = readFileSync(chave, "utf8");
  } catch {
    return;
  }
  for (const m of texto.matchAll(/["']([^"']+)["']/g)) {
    const spec = m[1];
    if (!spec.startsWith(".") && !spec.startsWith("@/")) continue;
    const bruto = spec.replace(/\?.*$/, "");
    const destino = achar(resolver(dirname(chave), bruto));
    if (!destino) continue;
    if (spec.includes("?raw")) fontes.push(destino);
    if (/\.(ts|tsx|js|mjs)$/.test(destino)) seguir(destino);
  }
}

function achar(base) {
  if (existe(base)) return base;
  for (const ext of [".ts", ".tsx", ".js", ".mjs"]) {
    if (existe(base + ext)) return base + ext;
  }
  for (const ext of [".ts", ".tsx", ".js", ".mjs"]) {
    const idx = join(base, "index" + ext);
    if (existe(idx)) return idx;
  }
  return null;
}

function existe(caminho) {
  try {
    return statSync(caminho).isFile();
  } catch {
    return false;
  }
}

function lerArvore(dir, filtro) {
  let blob = "";
  const visitar = (caminho) => {
    if (statSync(caminho).isDirectory()) {
      for (const nome of readdirSync(caminho)) visitar(join(caminho, nome));
      return;
    }
    if (filtro.test(caminho)) blob += readFileSync(caminho, "utf8") + "\n";
  };
  try {
    visitar(dir);
  } catch {
    return "";
  }
  return blob;
}

function resolver(base, spec) {
  if (spec.startsWith("@/")) return join(root, "src", spec.slice(2));
  return resolve(base, spec);
}

function marcar(texto) {
  const re = /[A-Za-zÀ-ÿ][A-Za-zÀ-ÿ0-9 .,;:()%/+\-]{15,80}/g;
  let m;
  while ((m = re.exec(texto))) {
    const s = m[0].slice(0, 48).trim();
    if (s.length >= 16 && !/\\/.test(s)) return s;
  }
  const compacto = texto.replace(/\s+/g, " ").trim();
  for (let n = Math.min(64, compacto.length); n >= 20; n -= 4) {
    for (let i = 0; i + n <= compacto.length; i += 8) {
      const s = compacto.slice(i, i + n);
      if (!/[`'\\\n]/.test(s)) return s;
    }
  }
  return null;
}

function normalizar(texto) {
  return texto.replace(/\s+/g, " ");
}

function contem(blob, marca) {
  const alvo = normalizar(marca);
  if (blob.includes(alvo)) return true;
  const esc = alvo.replace(/[^\u0000-\u007F]/g, (ch) => "\\u" + ch.charCodeAt(0).toString(16).padStart(4, "0"));
  return esc !== alvo && blob.includes(esc);
}

function rel(arquivo) {
  return arquivo.slice(root.length + 1).replaceAll("\\", "/");
}

function fail(msg) {
  console.error("\n" + msg + "\n");
  process.exit(1);
}
