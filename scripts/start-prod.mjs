import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

const root = process.cwd();

/** Carrega .env sem sobrescrever variáveis já definidas no processo/PM2. */
function loadDotEnv(file) {
  if (!existsSync(file)) return;
  for (const line of readFileSync(file, "utf8").split(/\r?\n/)) {
    const t = line.trim();
    if (!t || t.startsWith("#")) continue;
    const eq = t.indexOf("=");
    if (eq < 1) continue;
    const key = t.slice(0, eq).trim();
    let val = t.slice(eq + 1).trim();
    if (
      (val.startsWith('"') && val.endsWith('"')) ||
      (val.startsWith("'") && val.endsWith("'"))
    ) {
      val = val.slice(1, -1);
    }
    if (process.env[key] == null || process.env[key] === "") process.env[key] = val;
  }
}

/**
 * Nitro 3 (srvx) não encaminha NITRO_BUN_IDLE_TIMEOUT. Sem idleTimeout no
 * Bun.serve, requests longos (sync Omie) caem em ~10s → nginx 502.
 */
function ensureBunIdleTimeout(serverEntry, idleTimeout) {
  let source = readFileSync(serverEntry, "utf8");
  const next = `bun: { websocket: void 0, idleTimeout: ${idleTimeout} }`;
  let patched = source.replace(
    /bun:\s*\{\s*websocket:\s*void 0(?:\s*,\s*idleTimeout:\s*\d+)?\s*\}/g,
    next,
  );
  if (patched === source) {
    patched = source.replace(
      /bun:\s*\{\s*websocket:\s*import\.meta\._websocket\s*\?\s*ws\?\.websocket\s*:\s*undefined(?:\s*,\s*idleTimeout:\s*[^}]*)?\s*\}/g,
      `bun: { websocket: import.meta._websocket ? ws?.websocket : undefined, idleTimeout: ${idleTimeout} }`,
    );
  }
  if (patched !== source) {
    writeFileSync(serverEntry, patched, "utf8");
    console.info(`[start-prod] Bun idleTimeout=${idleTimeout}s aplicado em ${serverEntry}`);
  } else if (!/idleTimeout\s*:\s*\d+/.test(source)) {
    console.warn(
      "[start-prod] Não achei o bloco bun:{websocket} para injetar idleTimeout — sync Omie pode falhar após 10s.",
    );
  }
}

loadDotEnv(resolve(root, ".env"));

const serverEntry = resolve(root, ".output/server/index.mjs");
if (!existsSync(serverEntry)) {
  console.error("[start-prod] Build ausente. Rode `bun run build` antes.");
  process.exit(1);
}

// Por trás de Cloudflare/nginx o TLS já termina na borda — não ligar HTTPS
// só porque existem certs de desenvolvimento no disco (isso gerava 502 no tunnel).
const wantHttps = process.env.ENABLE_HTTPS === "1" || process.env.NITRO_SSL === "1";
const keyPath = resolve(root, "certs/dev-key.pem");
const certPath = resolve(root, "certs/dev-cert.pem");
if (wantHttps && existsSync(keyPath) && existsSync(certPath)) {
  process.env.NITRO_SSL_KEY ??= readFileSync(keyPath, "utf8");
  process.env.NITRO_SSL_CERT ??= readFileSync(certPath, "utf8");
} else {
  delete process.env.NITRO_SSL_KEY;
  delete process.env.NITRO_SSL_CERT;
}

process.env.PORT ??= "8080";
process.env.NITRO_PORT = process.env.PORT;
process.env.HOST ??= "0.0.0.0";
process.env.NITRO_HOST ??= process.env.HOST;
process.env.NODE_ENV ??= "production";

// Bun.serve fecha conexões idle em 10s por padrão (máx. 255). Sync Omie
// passa disso (sleep 8s entre apps + APIs). Nitro 3 beta não lê a env —
// injetamos idleTimeout no bundle antes de subir o servidor.
{
  const raw = Number.parseInt(process.env.NITRO_BUN_IDLE_TIMEOUT ?? "255", 10);
  const idleTimeout = Number.isFinite(raw) && raw >= 0 && raw <= 255 ? raw : 255;
  process.env.NITRO_BUN_IDLE_TIMEOUT = String(idleTimeout);
  ensureBunIdleTimeout(serverEntry, idleTimeout);
}

console.info(
  `[start-prod] ${process.env.HOST}:${process.env.PORT}` +
    (wantHttps ? " (https)" : " (http)") +
    ` idleTimeout=${process.env.NITRO_BUN_IDLE_TIMEOUT}s`,
);

await import(serverEntry);
