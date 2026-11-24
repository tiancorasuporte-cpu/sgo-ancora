/**
 * SGO Âncora — camada de compatibilidade D1 → PostgreSQL.
 *
 * O servidor do SGO foi escrito para o Cloudflare D1 (SQLite). Esta camada expõe a
 * mesma interface (`prepare().bind().first()/all()/run()` e `batch()`) sobre o
 * PostgreSQL, traduzindo as poucas diferenças de SQL. As tabelas do SGO ficam no
 * schema `sgo` (separado das tabelas do sistema base, que ficam em `public`).
 */
import "@tanstack/react-start/server-only";
import postgres from "postgres";

type Sql = ReturnType<typeof postgres>;
let _sql: Sql | null = null;

export function sgoSql(): Sql {
  if (_sql) return _sql;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  _sql = postgres(<any>{
    host: process.env["PGHOST"],
    port: Number(process.env["PGPORT"] || 5432),
    username: process.env["PGUSER"],
    password: process.env["PGPASSWORD"],
    database: process.env["PGDATABASE"],
    max: 10,
    idle_timeout: 30,
    connection: { search_path: process.env["SGO_SCHEMA"] || "sgo,public" },
    // D1 devolve números; no Postgres bigint/numeric viriam como texto.
    types: {
      bigint: { to: 20, from: [20], serialize: (x: unknown) => String(x), parse: (x: string) => Number(x) },
      numeric: { to: 1700, from: [1700], serialize: (x: unknown) => String(x), parse: (x: string) => Number(x) },
    },
    onnotice: () => undefined,
  });
  return _sql;
}

/* ---------------- tradução SQLite → PostgreSQL ---------------- */

const pkCache = new Map<string, string[]>();
const idCache = new Map<string, boolean>();

async function primaryKey(sql: Sql, table: string): Promise<string[]> {
  if (pkCache.has(table)) return pkCache.get(table)!;
  const rows = await sql.unsafe(
    `SELECT a.attname AS c FROM pg_index i JOIN pg_attribute a ON a.attrelid = i.indrelid AND a.attnum = ANY(i.indkey)
      WHERE i.indrelid = to_regclass($1) AND i.indisprimary`,
    [table],
  );
  const cols = rows.map((r) => String(r["c"]));
  pkCache.set(table, cols);
  return cols;
}

async function hasId(sql: Sql, table: string): Promise<boolean> {
  if (idCache.has(table)) return idCache.get(table)!;
  const rows = await sql.unsafe(
    `SELECT 1 FROM information_schema.columns WHERE table_schema = ANY(current_schemas(false)) AND table_name = $1 AND column_name = 'id' LIMIT 1`,
    [table],
  );
  idCache.set(table, rows.length > 0);
  return rows.length > 0;
}

/** Troca `?` / `?N` por `$N`, ignorando o que está dentro de strings. */
function placeholders(q: string): string {
  let out = "";
  let n = 0;
  let quote: string | null = null;
  for (let i = 0; i < q.length; i++) {
    const ch = q[i]!;
    if (quote) {
      out += ch;
      if (ch === quote) quote = null;
      continue;
    }
    if (ch === "'" || ch === '"') {
      quote = ch;
      out += ch;
      continue;
    }
    if (ch === "?") {
      const m = /^\d+/.exec(q.slice(i + 1));
      if (m) {
        out += "$" + m[0];
        i += m[0].length;
      } else {
        out += "$" + ++n;
      }
      continue;
    }
    out += ch;
  }
  return out;
}

const NOW_TXT = "to_char(now() at time zone 'utc','YYYY-MM-DD HH24:MI:SS')";

async function translate(sql: Sql, q: string): Promise<{ text: string; table?: string | undefined; insert: boolean }> {
  let s = q;
  s = s.replace(/datetime\(\s*'now'\s*\)/gi, NOW_TXT);
  s = s.replace(/\(\s*unixepoch\(\)\s*\*\s*1000\s*\)/gi, "((extract(epoch from now())*1000)::bigint)");
  s = s.replace(/\s+COLLATE\s+NOCASE/gi, "");
  // LIKE do SQLite não diferencia maiúsculas (ASCII)
  s = s.replace(/\bNOT\s+LIKE\b/gi, "NOT ILIKE").replace(/(?<!NOT\s)(?<!I)\bLIKE\b/gi, "ILIKE");
  s = s.replace(/json_extract\(\s*([\w.]+)\s*,\s*'\$\.(\w+)'\s*\)/gi, "($1::jsonb->>'$2')");
  s = s.replace(/json_each\(\s*([\w.]+)\s*\)\s+(\w+)/gi, "jsonb_array_elements_text(COALESCE(NULLIF($1,''),'[]')::jsonb) AS $2(value)");
  s = s.replace(/sqlite_master/gi, "sgo_sqlite_master");
  let insert = false;
  let table: string | undefined;
  const ins = /^\s*INSERT\s+(OR\s+(IGNORE|REPLACE)\s+)?INTO\s+"?(\w+)"?/i.exec(s);
  if (ins) {
    insert = true;
    table = ins[3];
    const mode = ins[2]?.toUpperCase();
    if (mode) s = s.replace(/^\s*INSERT\s+OR\s+(IGNORE|REPLACE)\s+INTO/i, "INSERT INTO");
    if (mode === "IGNORE" && !/ON\s+CONFLICT/i.test(s)) s = s.replace(/;?\s*$/, " ON CONFLICT DO NOTHING");
    if (mode === "REPLACE" && !/ON\s+CONFLICT/i.test(s)) {
      const cols = /INTO\s+"?\w+"?\s*\(([^)]*)\)/i.exec(s)?.[1]?.split(",").map((c) => c.trim().replace(/"/g, "")) ?? [];
      const pk = await primaryKey(sql, table!);
      const upd = cols.filter((c) => !pk.includes(c));
      s = s.replace(
        /;?\s*$/,
        pk.length
          ? ` ON CONFLICT (${pk.join(",")}) DO ${upd.length ? "UPDATE SET " + upd.map((c) => `${c} = EXCLUDED.${c}`).join(", ") : "NOTHING"}`
          : "",
      );
    }
  }
  return { text: placeholders(s), table, insert };
}

/* ---------------- interface D1 ---------------- */

type Meta = { changes: number; last_row_id: number | null; duration: number };

class Stmt {
  constructor(
    private db: D1Pg,
    readonly query: string,
    readonly args: unknown[] = [],
  ) {}
  bind(...args: unknown[]) {
    return new Stmt(this.db, this.query, args);
  }
  async all<T = Record<string, unknown>>() {
    const r = await this.db.exec(this.query, this.args);
    return { results: r.rows as T[], success: true, meta: r.meta };
  }
  async first<T = Record<string, unknown>>(col?: string) {
    const r = await this.db.exec(this.query, this.args);
    const row = (r.rows[0] ?? null) as Record<string, unknown> | null;
    if (!row) return null;
    return (col ? row[col] : row) as T;
  }
  async run() {
    const r = await this.db.exec(this.query, this.args);
    return { success: true, results: r.rows, meta: r.meta };
  }
  async raw() {
    const r = await this.db.exec(this.query, this.args);
    return r.rows.map((x) => Object.values(x));
  }
}

function norm(v: unknown) {
  if (v === undefined) return null;
  if (typeof v === "boolean") return v ? 1 : 0;
  if (v instanceof ArrayBuffer) return Buffer.from(v);
  if (ArrayBuffer.isView(v)) return Buffer.from(v.buffer, v.byteOffset, v.byteLength);
  return v;
}

export class D1Pg {
  constructor(private sqlOverride?: Sql) {}
  private get sql(): Sql {
    return this.sqlOverride ?? sgoSql();
  }
  prepare(query: string) {
    return new Stmt(this, query);
  }
  async exec(query: string, args: unknown[] = []) {
    const t0 = Date.now();
    const sql = this.sql;
    const tr = await translate(sql, query);
    let text = tr.text;
    if (tr.insert && tr.table && !/\bRETURNING\b/i.test(text) && (await hasId(sql, tr.table))) {
      text = text.replace(/;?\s*$/, " RETURNING id");
    }
    let rows: Record<string, unknown>[];
    let count: number;
    try {
      const res = await sql.unsafe(text, args.map(norm) as never[]);
      rows = [...res] as Record<string, unknown>[];
      count = res.count ?? rows.length;
    } catch (e) {
      const err = e as Error;
      console.error("[sgo/d1] SQL falhou:", err.message, "\n", text);
      throw e;
    }
    const lastId = tr.insert && rows[0] && "id" in rows[0] ? Number(rows[0]["id"]) : null;
    const meta: Meta = { changes: count, last_row_id: lastId, duration: Date.now() - t0 };
    return { rows: tr.insert && /RETURNING id$/i.test(text) && !/\bRETURNING\b/i.test(tr.text) ? [] : rows, meta };
  }
  async batch(stmts: Stmt[]) {
    return this.sql.begin(async (tx) => {
      const inner = new D1Pg(tx as unknown as Sql);
      const out = [];
      for (const s of stmts) {
        const r = await inner.exec(s.query, s.args);
        out.push({ results: r.rows, success: true, meta: r.meta });
      }
      return out;
    });
  }
}
