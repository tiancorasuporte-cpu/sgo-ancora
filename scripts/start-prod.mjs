import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

const root = process.cwd();
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
process.env.NITRO_PORT ??= process.env.PORT;
process.env.HOST ??= "0.0.0.0";
process.env.NITRO_HOST ??= process.env.HOST;
process.env.NODE_ENV ??= "production";

await import(serverEntry);
