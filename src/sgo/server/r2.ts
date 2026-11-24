/**
 * SGO Âncora — armazenamento de arquivos (fotos de OS, documentos do CRM, telas, ajuda).
 *
 * Emula a interface do Cloudflare R2 (`get/put/delete/list/head`) sobre uma pasta
 * local (`SGO_ARQUIVOS_DIR`, padrão `./data/arquivos`). Para produção, basta trocar
 * esta classe por uma que fale com S3/MinIO/R2 mantendo os mesmos métodos.
 */
import "@tanstack/react-start/server-only";
import { mkdir, readFile, rm, stat, writeFile, readdir } from "node:fs/promises";
import { dirname, join, relative, resolve, sep } from "node:path";

type Meta = { httpMetadata?: { contentType?: string }; customMetadata?: Record<string, string> };

function rootDir() {
  return resolve(process.cwd(), process.env["SGO_ARQUIVOS_DIR"] || "data/arquivos");
}

function caminho(key: string) {
  const root = rootDir();
  const p = resolve(root, key);
  if (p !== root && !p.startsWith(root + sep)) throw new Error("Caminho inválido");
  return p;
}

async function lerMeta(p: string): Promise<Meta> {
  try {
    return JSON.parse(await readFile(p + ".meta.json", "utf8")) as Meta;
  } catch {
    return {};
  }
}

class Obj {
  constructor(
    readonly key: string,
    private data: Buffer,
    readonly size: number,
    readonly uploaded: Date,
    meta: Meta,
  ) {
    this.httpMetadata = meta.httpMetadata ?? {};
    this.customMetadata = meta.customMetadata ?? {};
  }
  httpMetadata: { contentType?: string };
  customMetadata: Record<string, string>;
  get body() {
    return new Blob([new Uint8Array(this.data)]).stream();
  }
  async arrayBuffer() {
    return this.data.buffer.slice(this.data.byteOffset, this.data.byteOffset + this.data.byteLength);
  }
  async text() {
    return this.data.toString("utf8");
  }
  async json() {
    return JSON.parse(this.data.toString("utf8"));
  }
  writeHttpMetadata(h: Headers) {
    if (this.httpMetadata.contentType) h.set("content-type", this.httpMetadata.contentType);
  }
}

async function toBuffer(v: unknown): Promise<Buffer> {
  if (v == null) return Buffer.alloc(0);
  if (typeof v === "string") return Buffer.from(v, "utf8");
  if (Buffer.isBuffer(v)) return v;
  if (v instanceof ArrayBuffer) return Buffer.from(v);
  if (ArrayBuffer.isView(v)) return Buffer.from(v.buffer, v.byteOffset, v.byteLength);
  if (v instanceof Blob) return Buffer.from(await v.arrayBuffer());
  if (v instanceof ReadableStream) return Buffer.from(await new Response(v).arrayBuffer());
  return Buffer.from(String(v));
}

export class R2Local {
  async get(key: string) {
    const p = caminho(key);
    try {
      const [data, st, meta] = await Promise.all([readFile(p), stat(p), lerMeta(p)]);
      return new Obj(key, data, st.size, st.mtime, meta);
    } catch {
      return null;
    }
  }
  async head(key: string) {
    return this.get(key);
  }
  async put(key: string, value: unknown, opts: Meta = {}) {
    const p = caminho(key);
    await mkdir(dirname(p), { recursive: true });
    const buf = await toBuffer(value);
    await writeFile(p, buf);
    if (opts.httpMetadata || opts.customMetadata) {
      await writeFile(p + ".meta.json", JSON.stringify({ httpMetadata: opts.httpMetadata, customMetadata: opts.customMetadata }));
    }
    return { key, size: buf.length };
  }
  async delete(keys: string | string[]) {
    for (const k of Array.isArray(keys) ? keys : [keys]) {
      const p = caminho(k);
      await rm(p, { force: true });
      await rm(p + ".meta.json", { force: true });
    }
  }
  async list(opts: { prefix?: string; limit?: number; cursor?: string } = {}) {
    const root = rootDir();
    const out: { key: string; size: number; uploaded: Date }[] = [];
    async function walk(d: string) {
      let ents;
      try {
        ents = await readdir(d, { withFileTypes: true });
      } catch {
        return;
      }
      for (const e of ents) {
        const full = join(d, e.name);
        if (e.isDirectory()) await walk(full);
        else if (!e.name.endsWith(".meta.json")) {
          const key = relative(root, full).split(sep).join("/");
          if (!opts.prefix || key.startsWith(opts.prefix)) {
            const st = await stat(full);
            out.push({ key, size: st.size, uploaded: st.mtime });
          }
        }
      }
    }
    await walk(root);
    out.sort((a, b) => a.key.localeCompare(b.key));
    const start = opts.cursor ? Number(opts.cursor) : 0;
    const lim = opts.limit ?? 1000;
    const objects = out.slice(start, start + lim);
    const truncated = start + lim < out.length;
    return { objects, truncated, cursor: truncated ? String(start + lim) : undefined, delimitedPrefixes: [] };
  }
}
