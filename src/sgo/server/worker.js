// SGO Âncora — servidor (API) portado do Cloudflare Worker v31.
// Roda dentro do TanStack Start; o banco D1 é emulado sobre PostgreSQL (schema sgo) e o R2 sobre pasta local.
/* eslint-disable */
// @ts-nocheck
import { ARQUIVOS } from "./arquivos.js";
const SEG = {
  'x-content-type-options': 'nosniff',
  'referrer-policy': 'strict-origin-when-cross-origin',
  'x-frame-options': 'SAMEORIGIN',
  'content-security-policy': "frame-ancestors 'self'",
  'permissions-policy': 'camera=(self), microphone=(self), geolocation=(self)'
};
function b64(s) { const bin = atob(s); const u = new Uint8Array(bin.length); for (let i = 0; i < bin.length; i++) u[i] = bin.charCodeAt(i); return u; }
function servirArquivo(caminho) {
  if (caminho.endsWith('.html') && caminho !== '/index.html') caminho = caminho.slice(0, -5);
  let a = ARQUIVOS[caminho];
  if (!a && !/\.[a-z0-9]+$/i.test(caminho)) a = ARQUIVOS['/index.html']; // rotas do app
  if (!a) return new Response('Não encontrado', { status: 404, headers: SEG });
  const cache = a.t.startsWith('text/html') || a.t.startsWith('application/javascript') ? 'no-cache' : 'public, max-age=300';
  return new Response(a.b64 ? b64(a.d) : a.d, { headers: { 'content-type': a.t, 'cache-control': cache, ...SEG } });
}

// src/util.js
var corsDev = {};
function corsDe(request) {
  const origin = request.headers.get("origin") || "";
  if (!/^https?:\/\/(localhost|127\.0\.0\.1|192\.168\.\d+\.\d+)(:\d+)?$/.test(origin)) return null;
  return {
    "access-control-allow-origin": origin,
    "access-control-allow-headers": "content-type, x-sgo, x-sgo-app, x-sgo-sessao",
    "access-control-allow-methods": "GET, POST, PUT, OPTIONS"
  };
}
var json = (data, status = 200, extraHeaders = {}) => new Response(JSON.stringify(data), {
  status,
  headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store", ...corsDev, ...extraHeaders }
});
var hex = (buf) => [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, "0")).join("");
var deHex = (s) => new Uint8Array(s.match(/../g).map((h2) => parseInt(h2, 16)));
function aleatorio(bytes = 32) {
  const u = new Uint8Array(bytes);
  crypto.getRandomValues(u);
  return hex(u);
}
async function sha256(texto) {
  return hex(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(texto)));
}
async function hashSenha(senha, saltHex, iter = 1e5) {
  const chave = await crypto.subtle.importKey("raw", new TextEncoder().encode(senha), "PBKDF2", false, ["deriveBits"]);
  const bits = await crypto.subtle.deriveBits({ name: "PBKDF2", hash: "SHA-256", salt: deHex(saltHex), iterations: iter }, chave, 256);
  return hex(bits);
}
function iguais(a, b) {
  if (typeof a !== "string" || typeof b !== "string" || a.length !== b.length) return false;
  let d = 0;
  for (let i = 0; i < a.length; i++) d |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return d === 0;
}
async function lerJson(request, limite = 5e4) {
  const t = await request.text();
  if (t.length > limite) throw new Error("grande");
  return JSON.parse(t || "{}");
}
function cookie(request, nome) {
  const c = request.headers.get("cookie") || "";
  const m = c.match(new RegExp("(?:^|;\\s*)" + nome + "=([^;]+)"));
  return m ? m[1] : null;
}

// src/auth.js
var COOKIE = "sgo_sessao";
var DURACAO = 12 * 3600 * 1e3;
var DURACAO_TECNICO = 400 * 24 * 3600 * 1e3;
var duracao = (perfil) => perfil === "tecnico" ? DURACAO_TECNICO : DURACAO;
var MAX_ERROS = 5;
var BLOQUEIO = 15 * 60 * 1e3;
var PERFIS_TOTAIS = ["superadmin", "administrador"];
var ehAdmin = (u) => !!u && PERFIS_TOTAIS.includes(u.perfil);
function cookieSessao(valor, maxAge) {
  return `${COOKIE}=${valor}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=${maxAge}`;
}
function tokenDaReq(request) {
  const header = request.headers.get("x-sgo-sessao") || "";
  if (/^[0-9a-f]{64}$/.test(header)) return header;
  return cookie(request, COOKIE);
}
async function usuarioDaSessao(request, env) {
  const token = tokenDaReq(request);
  if (!token || !/^[0-9a-f]{64}$/.test(token)) return null;
  const id = await sha256(token);
  const agora = Date.now();
  const u = await env.DB.prepare(
    `SELECT u.id, u.login, u.nome, u.email, u.setor_id, u.perfil, u.equipe, u.vendedor, u.comprador, s.nome AS setor_nome, ss.ultimo_uso
       FROM sessoes ss JOIN usuarios u ON u.id = ss.usuario_id LEFT JOIN setores s ON s.id = u.setor_id
      WHERE ss.id = ? AND ss.expira_em > ? AND u.ativo = 1`
  ).bind(id, agora).first();
  if (!u) return null;
  if (agora - u.ultimo_uso > 5 * 60 * 1e3) {
    await env.DB.prepare("UPDATE sessoes SET ultimo_uso = ?, expira_em = ? WHERE id = ?").bind(agora, agora + duracao(u.perfil), id).run();
  }
  u.vendedor = !!u.vendedor;
  u.comprador = !!u.comprador;
  u.permissoes = await permissoes(env, u);
  try {
    const { results: veics } = await env.DB.prepare("SELECT vehicle_id FROM usuario_veiculos WHERE usuario_id = ? ORDER BY vehicle_id").bind(u.id).all();
    u.veiculos_ids = (veics || []).map((r) => Number(r.vehicle_id)).filter((n) => n > 0);
  } catch {
    u.veiculos_ids = [];
  }
  return u;
}
async function permissoes(env, u) {
  if (u.perfil === "tecnico") return [];
  if (ehAdmin(u)) {
    const { results: results2 } = await env.DB.prepare("SELECT id FROM menu_itens WHERE ativo = 1").all();
    return results2.map((r) => r.id);
  }
  const { results } = await env.DB.prepare("SELECT item_id FROM usuario_permissoes WHERE usuario_id = ?").bind(u.id).all();
  const lista = results.map((r) => r.item_id).filter((id) => id !== "usuarios");
  const set = new Set(lista);
  if (u.vendedor) ["com-crm", "com-leads", "com-orc"].forEach((x) => set.add(x));
  if (u.comprador) set.add("op-compras");
  return [...set];
}
async function login(request, env) {
  let dados;
  try {
    dados = await lerJson(request, 2e3);
  } catch {
    return json({ erro: "Dados inv\xE1lidos" }, 400);
  }
  const usuario = String(dados.login || "").trim();
  const senha = String(dados.senha || "");
  const falha = json({ erro: "Usu\xE1rio ou senha incorretos." }, 401);
  if (!usuario || !senha || usuario.length > 80 || senha.length > 200) return falha;
  const u = await env.DB.prepare("SELECT * FROM usuarios WHERE login = ? COLLATE NOCASE").bind(usuario).first();
  const agora = Date.now();
  if (!u) {
    await hashSenha(senha, "00".repeat(16));
    return falha;
  }
  if (!u.ativo) return json({ erro: "Usu\xE1rio desativado. Fale com o administrador." }, 403);
  if (u.bloqueado_ate > agora) {
    const min = Math.ceil((u.bloqueado_ate - agora) / 6e4);
    return json({ erro: `Muitas tentativas erradas. Tente de novo em ${min} min.` }, 429);
  }
  const hash = await hashSenha(senha, u.senha_salt, u.senha_iter);
  if (!iguais(hash, u.senha_hash)) {
    const t = u.tentativas + 1;
    const bloq = t >= MAX_ERROS ? agora + BLOQUEIO : 0;
    await env.DB.prepare("UPDATE usuarios SET tentativas = ?, bloqueado_ate = ? WHERE id = ?").bind(bloq ? 0 : t, bloq, u.id).run();
    if (bloq) return json({ erro: "Muitas tentativas erradas. Acesso bloqueado por 15 min." }, 429);
    return falha;
  }
  const token = aleatorio(32);
  await env.DB.batch([
    env.DB.prepare("INSERT INTO sessoes (id, usuario_id, criado_em, expira_em, ultimo_uso) VALUES (?,?,?,?,?)").bind(await sha256(token), u.id, agora, agora + duracao(u.perfil), agora),
    env.DB.prepare("UPDATE usuarios SET tentativas = 0, bloqueado_ate = 0, ultimo_acesso = ? WHERE id = ?").bind(agora, u.id),
    env.DB.prepare("DELETE FROM sessoes WHERE expira_em < ?").bind(agora)
  ]);
  if (request.headers.get("x-sgo-app") === "1" && u.perfil !== "tecnico") {
    return json({ erro: "O app é só para o perfil Técnico." }, 403);
  }
  const corpo = {
    ok: true,
    nome: u.nome,
    perfil: u.perfil,
    destino: u.perfil === "tecnico" ? "/app" : null
  };
  if (request.headers.get("x-sgo-app") === "1") corpo.token = token;
  return json(corpo, 200, { "set-cookie": cookieSessao(token, duracao(u.perfil) / 1e3) });
}
async function logout(request, env) {
  const token = tokenDaReq(request);
  if (token && /^[0-9a-f]{64}$/.test(token)) await env.DB.prepare("DELETE FROM sessoes WHERE id = ?").bind(await sha256(token)).run();
  return json({ ok: true }, 200, { "set-cookie": cookieSessao("", 0) });
}
async function trocarSenha(request, env, u) {
  let d;
  try {
    d = await lerJson(request, 2e3);
  } catch {
    return json({ erro: "Dados inv\xE1lidos" }, 400);
  }
  const atual = String(d.atual || ""), nova = String(d.nova || "");
  const erro = validarSenha(nova);
  if (erro) return json({ erro }, 400);
  const reg = await env.DB.prepare("SELECT senha_hash, senha_salt, senha_iter FROM usuarios WHERE id = ?").bind(u.id).first();
  if (!iguais(await hashSenha(atual, reg.senha_salt, reg.senha_iter), reg.senha_hash)) return json({ erro: "Senha atual incorreta." }, 400);
  const salt = aleatorio(16);
  const token = cookie(request, COOKIE);
  await env.DB.batch([
    env.DB.prepare("UPDATE usuarios SET senha_hash = ?, senha_salt = ?, senha_iter = 100000, atualizado_em = datetime('now') WHERE id = ?").bind(await hashSenha(nova, salt), salt, u.id),
    // encerra as outras sessões deste usuário
    env.DB.prepare("DELETE FROM sessoes WHERE usuario_id = ? AND id <> ?").bind(u.id, await sha256(token || ""))
  ]);
  return json({ ok: true });
}
function validarSenha(s) {
  if (s.length < 8) return "A senha precisa ter pelo menos 8 caracteres.";
  if (s.length > 128) return "Senha longa demais.";
  if (!/[A-Za-z]/.test(s) || !/\d/.test(s)) return "Use letras e n\xFAmeros na senha.";
  return null;
}

// src/usuarios.js
var PERFIS = { superadmin: "Super Admin", administrador: "Administrador", usuario: "Usu\xE1rio", tecnico: "T\xE9cnico" };
async function carregar(env) {
  const [us, ps, setores, itens] = await env.DB.batch([
    env.DB.prepare(`SELECT id, login, nome, email, setor_id, perfil, equipe, ativo, ultimo_acesso, bloqueado_ate, vendedor, comprador
                      FROM usuarios ORDER BY perfil = 'superadmin' DESC, nome COLLATE NOCASE`),
    env.DB.prepare("SELECT usuario_id, item_id FROM usuario_permissoes"),
    env.DB.prepare("SELECT id, nome FROM setores WHERE ativo = 1 ORDER BY nome"),
    env.DB.prepare("SELECT id, grupo, titulo, ordem, pai, destino FROM menu_itens WHERE ativo = 1 ORDER BY ordem")
  ]);
  const perm = /* @__PURE__ */ new Map();
  for (const p of ps.results) {
    if (!perm.has(p.usuario_id)) perm.set(p.usuario_id, []);
    perm.get(p.usuario_id).push(p.item_id);
  }
  let veiculos = [];
  let links = [];
  try {
    veiculos = (await env.DB.prepare(
      "SELECT id, name, plate, active FROM public.fleet_vehicles ORDER BY name",
    ).all()).results || [];
    veiculos = veiculos.filter((v) => v.active === true || v.active === 1 || v.active === "t" || v.active == null);
  } catch (e) {
    console.error("[sgo] fleet_vehicles p/ usuarios:", e && e.message ? e.message : e);
    try {
      veiculos = (await env.DB.prepare("SELECT id, name, plate FROM fleet_vehicles ORDER BY name").all()).results || [];
    } catch (e2) {
      console.error("[sgo] fleet_vehicles fallback:", e2 && e2.message ? e2.message : e2);
      veiculos = [];
    }
  }
  try {
    links = (await env.DB.prepare("SELECT usuario_id, vehicle_id FROM usuario_veiculos").all()).results || [];
  } catch (_) {
    links = [];
  }
  const porUser = /* @__PURE__ */ new Map();
  for (const l of links) {
    if (!porUser.has(l.usuario_id)) porUser.set(l.usuario_id, []);
    porUser.get(l.usuario_id).push(Number(l.vehicle_id));
  }
  return {
    usuarios: us.results.map((u) => ({
      ...u,
      ativo: !!u.ativo,
      vendedor: !!u.vendedor,
      comprador: !!u.comprador,
      veiculos_ids: porUser.get(u.id) || [],
      permissoes: perm.get(u.id) || [],
    })),
    setores: setores.results,
    itens: itens.results,
    perfis: PERFIS,
    veiculos: veiculos.map((v) => ({ id: Number(v.id), nome: v.name, placa: v.plate || "" })),
    auxiliares: (await env.DB.prepare("SELECT id, nome, ativo FROM auxiliares ORDER BY nome COLLATE NOCASE").all()).results.map((a) => ({
      ...a,
      ativo: !!a.ativo,
    })),
  };
}
function limpar(d) {
  const veiculos_ids = Array.isArray(d.veiculos_ids)
    ? [...new Set(d.veiculos_ids.map((x) => parseInt(x, 10)).filter((n) => n > 0))]
    : [];
  return {
    login: String(d.login || "").trim().toLowerCase(),
    nome: String(d.nome || "").trim(),
    email: String(d.email || "").trim() || null,
    setor_id: String(d.setor_id || "").trim() || null,
    perfil: String(d.perfil || "usuario"),
    equipe: String(d.equipe || "").trim() || null,
    ativo: d.ativo === false ? 0 : 1,
    vendedor: d.vendedor ? 1 : 0,
    comprador: d.comprador ? 1 : 0,
    veiculos_ids,
    senha: d.senha ? String(d.senha) : "",
    permissoes: Array.isArray(d.permissoes) ? d.permissoes.map(String) : [],
  };
}
function enriquecerPermissoesFlags(v) {
  const p = new Set(v.permissoes || []);
  if (v.vendedor) ["com-crm", "com-leads", "com-orc"].forEach((x) => p.add(x));
  if (v.comprador) p.add("op-compras");
  v.permissoes = [...p];
  return v;
}
async function gravarVeiculosUsuario(env, usuarioId, perfil, veiculosIds, flags) {
  const ids = perfil === "tecnico" ? veiculosIds || [] : [];
  try {
    await env.DB.prepare("DELETE FROM usuario_veiculos WHERE usuario_id = ?").bind(usuarioId).run();
    for (const vid of ids) {
      await env.DB.prepare("INSERT INTO usuario_veiculos (usuario_id, vehicle_id) VALUES (?, ?)").bind(usuarioId, vid).run();
    }
  } catch (e) {
    console.error("[sgo] usuario_veiculos", e);
  }
  const first = ids[0] || null;
  const isTec = perfil === "tecnico";
  const isVend = !!(flags && flags.vendedor);
  const isComp = !!(flags && flags.comprador);
  try {
    await env.DB.prepare("DELETE FROM user_vehicles WHERE user_id = ?").bind(usuarioId).run();
    for (const vid of ids) {
      await env.DB.prepare(
        "INSERT INTO user_vehicles (user_id, vehicle_id) VALUES (?, ?) ON CONFLICT (user_id, vehicle_id) DO NOTHING",
      )
        .bind(usuarioId, vid)
        .run();
    }
    await env.DB.prepare(
      "UPDATE users SET default_vehicle_id = ?, is_tecnico = ?, is_vendedor = ?, is_comprador = ? WHERE id = ?",
    )
      .bind(first, isTec, isVend, isComp, usuarioId)
      .run();
  } catch (_) {
    /* espelho public pode ainda nao existir */
  }
}
async function validar(env, v, eu, alvo) {
  if (!v.nome || v.nome.length > 80) return "Informe o nome (at\xE9 80 caracteres).";
  if (!/^[a-z0-9._-]{3,40}$/.test(v.login)) return "Usu\xE1rio de acesso: 3 a 40 caracteres, s\xF3 letras sem acento, n\xFAmeros, ponto, h\xEDfen ou sublinhado.";
  if (v.email && (v.email.length > 120 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v.email))) return "E-mail inv\xE1lido.";
  if (!["administrador", "usuario", "tecnico"].includes(v.perfil) && !(alvo && alvo.perfil === "superadmin")) return "Perfil inv\xE1lido.";
  if (v.perfil === "tecnico") v.equipe = v.equipe ? v.equipe.slice(0, 80) : null;
  else v.equipe = null;
  if (v.setor_id) {
    const s = await env.DB.prepare("SELECT id FROM setores WHERE id = ?").bind(v.setor_id).first();
    if (!s) return "Setor inv\xE1lido.";
  }
  const dup = await env.DB.prepare("SELECT id FROM usuarios WHERE login = ? COLLATE NOCASE AND id <> ?").bind(v.login, alvo ? alvo.id : 0).first();
  if (dup) return "J\xE1 existe um usu\xE1rio com esse nome de acesso.";
  if (alvo && alvo.perfil === "superadmin" && eu.perfil !== "superadmin") return "S\xF3 o Super Admin pode alterar o pr\xF3prio cadastro.";
  if (alvo && alvo.id === eu.id && !v.ativo) return "Voc\xEA n\xE3o pode desativar o seu pr\xF3prio usu\xE1rio.";
  if (alvo && alvo.id === eu.id && alvo.perfil === "administrador" && v.perfil !== "administrador") return "Voc\xEA n\xE3o pode tirar o seu pr\xF3prio perfil de Administrador.";
  if (v.senha) {
    const e = validarSenha(v.senha);
    if (e) return e;
  }
  return null;
}
async function gravarPermissoes(env, id, lista) {
  const { results } = await env.DB.prepare("SELECT id FROM menu_itens WHERE ativo = 1").all();
  const validos = new Set(results.map((r) => r.id));
  const ops = [env.DB.prepare("DELETE FROM usuario_permissoes WHERE usuario_id = ?").bind(id)];
  for (const item of new Set(lista)) {
    if (validos.has(item) && item !== "usuarios") ops.push(env.DB.prepare("INSERT INTO usuario_permissoes (usuario_id, item_id) VALUES (?, ?)").bind(id, item));
  }
  await env.DB.batch(ops);
}
async function rotaUsuarios(request, env, url, eu) {
  const m = url.pathname.match(/^\/api\/usuarios(?:\/(\d+))?$/);
  if (!m) return null;
  const id = m[1] ? parseInt(m[1], 10) : null;
  if (!id && request.method === "GET") return json(await carregar(env));
  let d;
  try {
    d = await lerJson(request, 2e4);
  } catch {
    return json({ erro: "Dados inv\xE1lidos" }, 400);
  }
  const v = limpar(d);
  if (!id && request.method === "POST") {
    const erro = await validar(env, v, eu, null) || (v.senha ? null : "Defina a senha inicial do usu\xE1rio.");
    if (erro) return json({ erro }, 400);
    const salt = aleatorio(16);
    enriquecerPermissoesFlags(v);
    const r = await env.DB.prepare(
      "INSERT INTO usuarios (login, nome, email, setor_id, perfil, equipe, ativo, vendedor, comprador, senha_hash, senha_salt, senha_iter) VALUES (?,?,?,?,?,?,?,?,?,?,?,100000)"
    ).bind(v.login, v.nome, v.email, v.setor_id, v.perfil, v.equipe, v.ativo, v.vendedor, v.comprador, await hashSenha(v.senha, salt), salt).run();
    const novo = r.meta.last_row_id;
    await gravarPermissoes(env, novo, v.perfil === "tecnico" ? [] : v.permissoes);
    await gravarVeiculosUsuario(env, novo, v.perfil, v.veiculos_ids, v);
    return json({ ok: true, id: novo });
  }
  if (id && request.method === "PUT") {
    const alvo = await env.DB.prepare("SELECT id, perfil, ativo FROM usuarios WHERE id = ?").bind(id).first();
    if (!alvo) return json({ erro: "Usu\xE1rio n\xE3o encontrado." }, 404);
    if (alvo.perfil === "superadmin") {
      v.perfil = "superadmin";
      v.ativo = 1;
    }
    const erro = await validar(env, v, eu, alvo);
    if (erro) return json({ erro }, 400);
    enriquecerPermissoesFlags(v);
    const ops = [env.DB.prepare(
      "UPDATE usuarios SET login = ?, nome = ?, email = ?, setor_id = ?, perfil = ?, equipe = ?, ativo = ?, vendedor = ?, comprador = ?, atualizado_em = datetime('now') WHERE id = ?"
    ).bind(v.login, v.nome, v.email, v.setor_id, v.perfil, v.equipe, v.ativo, v.vendedor, v.comprador, id)];
    if (v.senha) {
      const salt = aleatorio(16);
      ops.push(env.DB.prepare("UPDATE usuarios SET senha_hash = ?, senha_salt = ?, senha_iter = 100000, tentativas = 0, bloqueado_ate = 0 WHERE id = ?").bind(await hashSenha(v.senha, salt), salt, id));
    }
    if (v.senha || !v.ativo || v.perfil !== alvo.perfil) ops.push(env.DB.prepare("DELETE FROM sessoes WHERE usuario_id = ?").bind(id));
    if (d.desbloquear) ops.push(env.DB.prepare("UPDATE usuarios SET tentativas = 0, bloqueado_ate = 0 WHERE id = ?").bind(id));
    await env.DB.batch(ops);
    if (alvo.perfil !== "superadmin") await gravarPermissoes(env, id, v.perfil === "tecnico" ? [] : v.permissoes);
    await gravarVeiculosUsuario(env, id, v.perfil, v.veiculos_ids, v);
    return json({ ok: true });
  }
  return json({ erro: "M\xE9todo n\xE3o permitido" }, 405);
}
async function rotaEquipes(env) {
  const [t, a] = await env.DB.batch([
    env.DB.prepare("SELECT id, nome, equipe FROM usuarios WHERE perfil = 'tecnico' AND ativo = 1 ORDER BY nome COLLATE NOCASE"),
    env.DB.prepare("SELECT id, nome FROM auxiliares WHERE ativo = 1 ORDER BY nome COLLATE NOCASE")
  ]);
  return json({ tecnicos: t.results, auxiliares: a.results });
}
async function rotaAuxiliares(request, env, url) {
  const m = url.pathname.match(/^\/api\/auxiliares(?:\/(\d+))?$/);
  if (!m) return null;
  const id = m[1] ? parseInt(m[1], 10) : null;
  if (!id && request.method === "GET") {
    const { results } = await env.DB.prepare("SELECT id, nome, ativo FROM auxiliares ORDER BY nome COLLATE NOCASE").all();
    return json({ auxiliares: results.map((a) => ({ ...a, ativo: !!a.ativo })) });
  }
  let d;
  try {
    d = await lerJson(request, 2e3);
  } catch {
    return json({ erro: "Dados inv\xE1lidos" }, 400);
  }
  const nome = String(d.nome || "").trim().replace(/\s+/g, " ");
  if (!nome || nome.length > 80) return json({ erro: "Informe o nome do auxiliar (at\xE9 80 caracteres)." }, 400);
  const dup = await env.DB.prepare("SELECT id FROM auxiliares WHERE nome = ? COLLATE NOCASE AND id <> ?").bind(nome, id || 0).first();
  if (dup) return json({ erro: "J\xE1 existe um auxiliar com esse nome." }, 400);
  if (!id && request.method === "POST") {
    const r = await env.DB.prepare("INSERT INTO auxiliares (nome) VALUES (?)").bind(nome).run();
    return json({ ok: true, id: r.meta.last_row_id });
  }
  if (id && request.method === "PUT") {
    const r = await env.DB.prepare("UPDATE auxiliares SET nome = ?, ativo = ? WHERE id = ?").bind(nome, d.ativo === false ? 0 : 1, id).run();
    if (!r.meta.changes) return json({ erro: "Auxiliar n\xE3o encontrado." }, 404);
    return json({ ok: true });
  }
  return json({ erro: "M\xE9todo n\xE3o permitido" }, 405);
}

// src/docs.js
var COLECOES = {
  os: {
    tabela: "ordens_servico",
    extra: (d) => ({ stage: Number.isInteger(d.stage) ? d.stage : 0 }),
    numero: (n) => String(n).padStart(5, "0"),
    parse: (num) => parseInt(num, 10) || 0
  },
  tickets: {
    tabela: "tickets",
    extra: (d) => ({ status: d.status, setores: JSON.stringify(Array.isArray(d.setores) ? d.setores : []) }),
    numero: (n) => "TK-" + String(n).padStart(4, "0"),
    parse: (num) => parseInt(String(num).replace(/\D/g, ""), 10) || 0
  }
};
var STATUS_TK = ["aberto", "andamento", "encaminhado", "resolvido", "os"];
async function listarDocs(env, col, desde) {
  const c = COLECOES[col];
  const stmt = desde ? env.DB.prepare(`SELECT id, versao, dados FROM ${c.tabela} WHERE atualizado_em > ? ORDER BY atualizado_em`).bind(desde) : env.DB.prepare(`SELECT id, versao, dados FROM ${c.tabela} ORDER BY num`);
  const { results } = await stmt.all();
  return results.map((r) => ({ id: r.id, versao: r.versao, dados: JSON.parse(r.dados) }));
}
async function proximoNumero(env, col) {
  const c = COLECOES[col];
  const { results } = await env.DB.prepare(`SELECT num FROM ${c.tabela}`).all();
  const max = results.reduce((m, r) => Math.max(m, c.parse(r.num)), 0);
  return c.numero(max + 1);
}
async function salvarDoc(env, request, col, id, email) {
  const c = COLECOES[col];
  if (!/^[A-Za-z0-9_-]{1,40}$/.test(id)) return json({ erro: "Identificador inv\xE1lido" }, 400);
  const corpo = await request.text();
  if (corpo.length > 4e5) return json({ erro: "Registro grande demais" }, 413);
  let entrada;
  try {
    entrada = JSON.parse(corpo);
  } catch {
    return json({ erro: "JSON inv\xE1lido" }, 400);
  }
  const dados = entrada && entrada.dados;
  if (!dados || typeof dados !== "object" || Array.isArray(dados)) return json({ erro: "Dados ausentes" }, 400);
  if (col === "tickets" && !STATUS_TK.includes(dados.status)) return json({ erro: "Status inv\xE1lido" }, 400);
  dados.id = id;
  const agora = Date.now();
  const extra = c.extra(dados);
  const atual = await env.DB.prepare(`SELECT versao, num FROM ${c.tabela} WHERE id = ?`).bind(id).first();
  const ultimo = (lista) => Array.isArray(lista) && lista.length ? lista[lista.length - 1] : null;
  const h2 = col === "os" ? ultimo(dados.hist) : ultimo(dados.tl);
  const acao = h2 ? String(h2.acao || h2.titulo || "").slice(0, 300) : null;
  if (!atual) {
    for (let tentativa = 0; tentativa < 3; tentativa++) {
      dados.num = await proximoNumero(env, col);
      const campos = ["id", "num", ...Object.keys(extra), "dados", "versao", "atualizado_em", "atualizado_por"];
      const valores = [id, dados.num, ...Object.values(extra), JSON.stringify(dados), 1, agora, email];
      try {
        await env.DB.batch([
          env.DB.prepare(`INSERT INTO ${c.tabela} (${campos.join(",")}) VALUES (${campos.map(() => "?").join(",")})`).bind(...valores),
          env.DB.prepare("INSERT INTO auditoria (quando, email, colecao, doc_id, num, acao) VALUES (?,?,?,?,?,?)").bind(agora, email, col, id, dados.num, acao)
        ]);
        return json({ id, versao: 1, dados });
      } catch (e) {
        if (!/UNIQUE/i.test(String(e && e.message))) throw e;
      }
    }
    return json({ erro: "N\xE3o foi poss\xEDvel gerar o n\xFAmero. Tente de novo." }, 409);
  }
  if (entrada.versao !== atual.versao) {
    const doc = await env.DB.prepare(`SELECT id, versao, dados FROM ${c.tabela} WHERE id = ?`).bind(id).first();
    return json({ erro: "conflito", atual: { id: doc.id, versao: doc.versao, dados: JSON.parse(doc.dados) } }, 409);
  }
  dados.num = atual.num;
  const sets = Object.keys(extra).map((k) => `${k} = ?`).concat(["dados = ?", "versao = versao + 1", "atualizado_em = ?", "atualizado_por = ?"]);
  const r = await env.DB.batch([
    env.DB.prepare(`UPDATE ${c.tabela} SET ${sets.join(", ")} WHERE id = ? AND versao = ?`).bind(...Object.values(extra), JSON.stringify(dados), agora, email, id, atual.versao),
    env.DB.prepare("INSERT INTO auditoria (quando, email, colecao, doc_id, num, acao) VALUES (?,?,?,?,?,?)").bind(agora, email, col, id, dados.num, acao)
  ]);
  if (!r[0].meta.changes) return json({ erro: "conflito" }, 409);
  if (col === "os") { try { await crmDaOS(env, dados, email); } catch (e) {} try { await cmpSyncDaOS(env, dados, email); } catch (e) {} try { await estReconciliarOS(env, dados, email); } catch (e) {} }
  return json({ id, versao: atual.versao + 1, dados });
}
async function rotaDocs(request, env, url, email) {
  const m = url.pathname.match(/^\/api\/(os|tickets)(?:\/([^/]+))?$/);
  if (!m) return null;
  const [, col, id] = m;
  try {
    if (!id && request.method === "GET") {
      const desde = parseInt(url.searchParams.get("desde") || "0", 10) || 0;
      const agora = Date.now();
      return json({ docs: await listarDocs(env, col, desde ? desde - 2e3 : 0), agora });
    }
    if (id && request.method === "PUT") return await salvarDoc(env, request, col, id, email);
    return json({ erro: "M\xE9todo n\xE3o permitido" }, 405);
  } catch (e) {
    return json({ erro: "Falha no banco de dados" }, 500);
  }
}

// public/tecnico/regras.js
var LAST = 7;
var pad = (n) => (n < 10 ? "0" : "") + n;
function rotulo(ms) {
  const d = new Date(ms - 3 * 3600 * 1e3);
  return pad(d.getUTCDate()) + "/" + pad(d.getUTCMonth() + 1) + " " + pad(d.getUTCHours()) + ":" + pad(d.getUTCMinutes());
}
function isoDia(ms) {
  return new Date(ms - 3 * 3600 * 1e3).toISOString().slice(0, 10);
}
var it = (qtd, nome, st, prev) => ({ qtd, nome, st, prev: prev || "" });
var h = (quando, quem, acao) => ({ quando, quem, acao });
function dur(a, b) {
  const m = Math.max(0, Math.round((b - a) / 6e4));
  return m < 60 ? m + " min" : Math.floor(m / 60) + " h " + pad(m % 60) + " min";
}
function limpaGps(g) {
  if (!g || typeof g !== "object") return null;
  const lat = Number(g.lat), lng = Number(g.lng), prec = Number(g.prec);
  if (!isFinite(lat) || !isFinite(lng) || Math.abs(lat) > 90 || Math.abs(lng) > 180) return null;
  return { lat: Math.round(lat * 1e6) / 1e6, lng: Math.round(lng * 1e6) / 1e6, prec: isFinite(prec) ? Math.round(prec) : null };
}
var txt = (v, max) => String(v == null ? "" : v).replace(/\s+/g, " ").trim().slice(0, max);
function mover(card, to, quando, quem, acao, extra, opts) {
  const from = card.stage;
  const upd = Object.assign({}, card, { stage: to, pending: null }, extra || {});
  if (to < 4 && from >= 4) {
    upd.agenda = "A reagendar";
    upd.agDate = null;
    upd.hora = null;
  }
  if (to < 4 && from >= 4 && !(opts && opts.keepEquipe)) {
    upd.tecnico = null;
    upd.tecnicoId = null;
    upd.auxiliar = null;
  }
  let hist = card.hist || [];
  if (to < 5 && from >= 5) {
    upd.itens = (upd.itens || []).map((i) => i.st === "campo" ? it(i.qtd, i.nome, "separado") : i);
    hist = hist.concat([h(quando, quem, "Material devolvido do estoque da " + (card.tecnico || "equipe") + " para o estoque")]);
  }
  if (from === 1 && to !== 1) {
    upd.fromCompras = false;
    upd.fromTecnico = false;
  }
  if (to !== 4 && !(extra && "envio" in extra)) upd.envio = null;
  if (to < 5) {
    if (card.ci) upd.visitas = (card.visitas || []).concat([{ ci: card.ci, co: card.co || null, fim: Date.now() }]);
    upd.ci = null;
    upd.co = null;
  }
  if (to === LAST) upd.finDate = isoDia(Date.now());
  upd.hist = hist.concat([h(quando, quem, acao)]);
  return upd;
}
var ACOES = {
  ok(c, a, u, q) {
    if (c.stage !== 4 || !c.envio || c.envio.tecnicoId !== u.id) return { erro: "A OS n\xE3o est\xE1 mais aguardando o seu OK." };
    if (c.envio.div) return { erro: "Voc\xEA reportou diverg\xEAncia nesta OS; aguarde a Assist\xEAncia tratar." };
    const e = c.envio, n = (c.itens || []).length;
    const hs = [h(q, e.equipe, "T\xE9cnico conferiu " + (n ? n + (n === 1 ? " item" : " itens") : "a OS") + " e deu OK no app")];
    if (n) hs.push(h(q, e.equipe, "Sa\xEDda de material: " + n + (n === 1 ? " item" : " itens") + " do estoque \u2192 estoque da " + e.equipe));
    const base = Object.assign({}, c, { hist: (c.hist || []).concat(hs) });
    return { card: mover(base, 5, q, e.equipe, "Agendado \u2192 Em execu\xE7\xE3o \xB7 " + e.equipe + (e.troca || ""), {
      tecnico: e.equipe,
      tecnicoId: u.id,
      envio: null,
      ci: null,
      co: null,
      itens: (c.itens || []).map((i) => it(i.qtd, i.nome, "campo"))
    }) };
  },
  div(c, a, u, q) {
    if (c.stage !== 4 || !c.envio || c.envio.tecnicoId !== u.id) return { erro: "A OS n\xE3o est\xE1 mais aguardando o seu OK." };
    const falta = txt(a.dados && a.dados.texto, 500);
    if (!falta) return { erro: "Descreva a diverg\xEAncia." };
    return { card: Object.assign({}, c, { envio: Object.assign({}, c.envio, { div: falta }), hist: (c.hist || []).concat([h(q, c.envio.equipe, "T\xE9cnico reportou diverg\xEAncia no app: " + falta)]) }) };
  },
  checkin(c, a, u, q, t) {
    if (c.stage !== 5 || c.tecnicoId !== u.id) return { erro: "A OS n\xE3o est\xE1 em execu\xE7\xE3o com voc\xEA." };
    if (c.ci) return { erro: "O check-in desta OS j\xE1 foi feito." };
    const gps = limpaGps(a.dados && a.dados.gps);
    return { card: Object.assign({}, c, { ci: t, ciGps: gps || null, hist: (c.hist || []).concat([h(q, c.tecnico || "T\xE9cnico", "Check-in no local da OS" + (gps ? " (com localiza\xE7\xE3o)" : ""))]) }) };
  },
  checkout(c, a, u, q, t) {
    if (c.stage !== 5 || c.tecnicoId !== u.id) return { erro: "A OS n\xE3o est\xE1 em execu\xE7\xE3o com voc\xEA." };
    if (!c.ci) return { erro: "Fa\xE7a o check-in antes do check-out." };
    if (c.co) return { erro: "O check-out desta OS j\xE1 foi feito." };
    const texto = String(a.dados && a.dados.texto || "").trim().slice(0, 4e3);
    if (!texto) return { erro: "Descreva a resolu\xE7\xE3o antes do check-out." };
    const fotos = (Array.isArray(a.dados.fotos) ? a.dados.fotos : []).filter((f) => /^[a-z0-9-]{8,40}$/i.test(f)).slice(0, 20).map((f) => "/api/fotos/" + c.id + "/" + f + ".jpg");
    const quem = c.tecnico || "T\xE9cnico", gps = limpaGps(a.dados.gps);
    const assId = String(a.dados.assinatura || ""), assinatura = /^[a-z0-9-]{8,40}$/i.test(assId) ? "/api/fotos/" + c.id + "/" + assId + ".jpg" : null, assinNome = String(a.dados.assinNome || "").replace(/\s+/g, " ").trim().slice(0, 80) || null;
    return { card: Object.assign({}, c, { co: t, coGps: gps, rel: { texto, fotos, por: quem, quando: q, assinatura, assinNome }, hist: (c.hist || []).concat(assinatura ? [h(q, quem, "Assinatura do cliente coletada no app" + (assinNome ? " \xB7 " + assinNome : ""))] : [], [
      h(q, quem, "Resolu\xE7\xE3o enviada pelo app" + (fotos.length ? " \xB7 " + fotos.length + (fotos.length === 1 ? " foto" : " fotos") : "")),
      h(q, quem, "Check-out da OS \xB7 " + dur(c.ci, t) + " no local")
    ]) }) };
  },
  req(c, a, u, q, t) {
    if (c.stage !== 5 || c.tecnicoId !== u.id) return { erro: "A OS n\xE3o est\xE1 em execu\xE7\xE3o com voc\xEA." };
    const rows = (Array.isArray(a.dados && a.dados.itens) ? a.dados.itens : []).map((r) => ({ qtd: parseInt(r.qtd, 10), nome: txt(r.nome, 120) })).filter((r) => r.nome && r.qtd > 0).slice(0, 30);
    if (!rows.length) return { erro: "Informe pelo menos um produto." };
    const novos = rows.map((r) => it(r.qtd + "x", r.nome, "pendente"));
    const obs = txt(a.dados.obs, 300), quem = c.tecnico || "T\xE9cnico";
    const base = Object.assign({}, c, { co: c.co || (c.ci && t ? t : null), itens: (c.itens || []).concat(novos), hist: (c.hist || []).concat([h(
      q,
      quem,
      "T\xE9cnico solicitou material: " + novos.map((i) => i.qtd + " " + i.nome).join(", ") + (obs ? " \xB7 " + obs : "") + " \xB7 OS volta para Separa\xE7\xE3o"
    )]) });
    return { card: mover(base, 1, q, quem, "Em execu\xE7\xE3o \u2192 Em separa\xE7\xE3o (solicita\xE7\xE3o do t\xE9cnico)", { fromTecnico: true }, { keepEquipe: true }) };
  },
  extra(c, a, u, q) {
    if (c.stage !== 5 || c.tecnicoId !== u.id) return { erro: "A OS n\xE3o est\xE1 em execu\xE7\xE3o com voc\xEA." };
    const n = parseInt(a.dados && a.dados.qtd, 10), nome = txt(a.dados && a.dados.nome, 120);
    const origem = a.dados && a.dados.origem === "empresa" ? "empresa" : "tecnico";
    if (!nome || !(n > 0)) return { erro: "Informe o produto e a quantidade." };
    const item = { qtd: n + "x", nome, st: "extra", prev: "", origem, equipe: c.tecnico, pid: parseInt(a.dados && a.dados.pid, 10) || void 0 };
    const de = origem === "tecnico" ? "estoque do t\xE9cnico (" + (c.tecnico || "equipe") + ")" : "estoque da empresa";
    return { card: Object.assign({}, c, { itens: (c.itens || []).concat([item]), hist: (c.hist || []).concat([h(q, c.tecnico || "T\xE9cnico", "Item adicional: " + item.qtd + " " + nome + " \xB7 baixa no " + de + " \xB7 incluir no or\xE7amento")]) }) };
  },
  lev(c, a, u, q) {
    if (c.stage !== 5 || c.tecnicoId !== u.id || c.tipo !== "visita") return { erro: "Esta OS n\xE3o \xE9 uma visita de or\xE7amento em execu\xE7\xE3o com voc\xEA." };
    const itens = (Array.isArray(a.dados && a.dados.itens) ? a.dados.itens : []).map((r) => ({ qtd: (parseInt(r.qtd, 10) || 0) + "x", nome: txt(r.nome, 120), obs: txt(r.obs, 200) })).filter((r) => r.nome && parseInt(r.qtd, 10) > 0).slice(0, 60);
    if (!itens.length) return { erro: "Inclua pelo menos um equipamento ou servi\xE7o." };
    const lev = { itens, obs: txt(a.dados.obs, 1e3) };
    return { card: Object.assign({}, c, { lev, hist: (c.hist || []).concat([h(q, c.tecnico || "T\xE9cnico", (c.lev ? "T\xE9cnico atualizou o or\xE7amento: " : "T\xE9cnico registrou or\xE7amento: ") + itens.length + (itens.length === 1 ? " item" : " itens"))]) }) };
  },
  aceitar(c, a, u, q) {
    if (c.stage !== 5 || c.tecnicoId !== u.id || !c.confPend) return { erro: "N\xE3o h\xE1 confer\xEAncia aguardando o seu aceite." };
    const p = c.confPend, eq = c.tecnico || "T\xE9cnico";
    const base = Object.assign({}, c, {
      itens: p.itens,
      confBy: { estoque: p.estoque, tecnico: eq + " (app) \xB7 " + q },
      confPend: null,
      hist: (c.hist || []).concat([h(q, eq, "T\xE9cnico aceitou a confer\xEAncia no app" + (p.devs ? " \xB7 devolu\xE7\xE3o ao estoque confirmada" : ""))])
    });
    return { card: mover(base, 6, q, eq, "Em execu\xE7\xE3o \u2192 Executado") };
  },
  contestar(c, a, u, q) {
    if (c.stage !== 5 || c.tecnicoId !== u.id || !c.confPend) return { erro: "N\xE3o h\xE1 confer\xEAncia aguardando o seu aceite." };
    const motivo = txt(a.dados && a.dados.motivo, 500);
    if (!motivo) return { erro: "Explique o que est\xE1 diferente." };
    const eq = c.tecnico || "T\xE9cnico";
    return { card: Object.assign({}, c, { confPend: null, confContest: motivo, hist: (c.hist || []).concat([h(q, eq, "T\xE9cnico n\xE3o concordou com a confer\xEAncia no app: " + motivo)]) }) };
  }
};
function minha(c, u) {
  if (c.stage === 4 && c.envio && c.envio.tecnicoId === u.id) return true;
  if (c.tecnicoId === u.id && (c.stage === 5 || c.stage === 6 && c.confPend)) return true;
  if (c.tecnicoId === u.id && c.stage === 4) return true;
  return false;
}

// src/tecnico.js
async function listar(env, u) {
  const { results } = await env.DB.prepare(
    `SELECT id, versao, dados FROM ordens_servico WHERE stage BETWEEN 4 AND 6 AND dados LIKE ?`
  ).bind(`%"tecnicoId":${u.id}%`).all();
  const docs = [];
  for (const r of results) {
    const c = JSON.parse(r.dados);
    if (minha(c, u)) docs.push({ versao: r.versao, dados: c });
  }
  return docs;
}
async function aplicar(env, u, a) {
  if (!a || typeof a !== "object" || !/^[A-Za-z0-9_-]{8,64}$/.test(String(a.id || ""))) return { id: a && a.id, status: "erro", motivo: "A\xE7\xE3o inv\xE1lida." };
  const ja = await env.DB.prepare("SELECT status, motivo FROM tecnico_acoes WHERE id = ?").bind(a.id).first();
  if (ja) return { id: a.id, status: ja.status, motivo: ja.motivo, repetida: true };
  if (!a.dados || typeof a.dados !== "object") a.dados = {};
  const fn = ACOES[a.tipo];
  const agora = Date.now();
  let t = parseInt(a.quando, 10);
  if (!(t > agora - 30 * 864e5 && t < agora + 10 * 6e4)) t = agora;
  const q = rotulo(t);
  let status = "erro", motivo = null, versao = null, dados = null;
  if (!fn) motivo = "A\xE7\xE3o desconhecida.";
  for (let tentativa = 0; fn && tentativa < 3; tentativa++) {
    const doc = await env.DB.prepare("SELECT versao, num, dados FROM ordens_servico WHERE id = ?").bind(String(a.os || "")).first();
    if (!doc) {
      motivo = "OS n\xE3o encontrada.";
      break;
    }
    const r = fn(JSON.parse(doc.dados), a, u, q, t);
    if (r.erro) {
      status = "recusada";
      motivo = r.erro;
      break;
    }
    const card = r.card;
    const ultimo = card.hist && card.hist.length ? card.hist[card.hist.length - 1].acao : null;
    const res = await env.DB.batch([
      env.DB.prepare("UPDATE ordens_servico SET stage = ?, dados = ?, versao = versao + 1, atualizado_em = ?, atualizado_por = ? WHERE id = ? AND versao = ?").bind(card.stage, JSON.stringify(card), agora, u.login, a.os, doc.versao),
      env.DB.prepare("INSERT INTO auditoria (quando, email, colecao, doc_id, num, acao) VALUES (?,?,?,?,?,?)").bind(agora, u.login, "os", a.os, doc.num, ("App: " + (ultimo || a.tipo)).slice(0, 300))
    ]);
    if (res[0].meta.changes) {
      status = "ok";
      versao = doc.versao + 1;
      dados = card;
      try { await estReconciliarOS(env, card, card.tecnico || u.login); } catch (e) {}
      break;
    }
  }
  if (fn && status === "erro" && !motivo) motivo = "A OS estava sendo alterada por outra pessoa. Tente de novo.";
  if (status !== "erro") {
    await env.DB.prepare("INSERT OR IGNORE INTO tecnico_acoes (id, usuario_id, os_id, tipo, quando, recebido_em, status, motivo) VALUES (?,?,?,?,?,?,?,?)").bind(a.id, u.id, String(a.os || ""), String(a.tipo), t, agora, status, motivo).run();
  }
  return { id: a.id, status, motivo, os: a.os, versao, dados };
}
var FOTO = /^\/api\/(?:tecnico\/)?fotos\/([A-Za-z0-9_-]{1,40})\/([a-z0-9-]{8,40})\.jpg$/i;
async function enviarFoto(request, env, u, osId, fotoId) {
  if (!env.FOTOS) return json({ erro: "Armazenamento de fotos indispon\xEDvel." }, 503);
  const doc = await env.DB.prepare("SELECT dados FROM ordens_servico WHERE id = ?").bind(osId).first();
  if (!doc) return json({ erro: "OS n\xE3o encontrada." }, 404);
  const c = JSON.parse(doc.dados);
  if (c.tecnicoId !== u.id && !(c.envio && c.envio.tecnicoId === u.id)) return json({ erro: "Esta OS n\xE3o \xE9 sua." }, 403);
  const tam = parseInt(request.headers.get("content-length") || "0", 10);
  if (tam > 3 * 1024 * 1024) return json({ erro: "Foto grande demais (m\xE1x. 3 MB)." }, 413);
  const corpo = await request.arrayBuffer();
  if (!corpo.byteLength || corpo.byteLength > 3 * 1024 * 1024) return json({ erro: "Foto inv\xE1lida." }, 400);
  const b = new Uint8Array(corpo, 0, 3);
  if (!(b[0] === 255 && b[1] === 216 && b[2] === 255)) return json({ erro: "Envie a foto em JPEG." }, 400);
  await env.FOTOS.put("os/" + osId + "/" + fotoId + ".jpg", corpo, {
    httpMetadata: { contentType: "image/jpeg" },
    customMetadata: { usuario: u.login, enviado: String(Date.now()) }
  });
  return json({ ok: true });
}

// src/via-link.js · v25 — link público da via do cliente (OS finalizada)
var VIA_RE = /^\/v\/([A-Za-z0-9_-]{24,48})(?:\/(dados|a|f\/(\d{1,2})))?$/;
var VIA_HDR = { "cache-control": "no-store", "x-robots-tag": "noindex, nofollow", "referrer-policy": "no-referrer", "x-content-type-options": "nosniff" };
function viaToken() {
  const b = new Uint8Array(24);
  crypto.getRandomValues(b);
  return btoa(String.fromCharCode(...b)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}
async function viaCriarLink(request, env, url, u) {
  if (request.method !== "POST") return json({ erro: "M\xE9todo n\xE3o permitido" }, 405);
  let b = {};
  try { b = await request.json(); } catch {}
  const osId = String(b.os || "").slice(0, 40);
  const doc = await env.DB.prepare("SELECT stage FROM ordens_servico WHERE id = ?").bind(osId).first();
  if (!doc) return json({ erro: "OS n\xE3o encontrada." }, 404);
  if (doc.stage !== 7) return json({ erro: "A via do cliente s\xF3 pode ser compartilhada com a OS finalizada." }, 409);
  let r = await env.DB.prepare("SELECT token FROM os_via_links WHERE os_id = ?").bind(osId).first();
  if (!r) {
    r = { token: viaToken() };
    await env.DB.prepare("INSERT OR IGNORE INTO os_via_links (token, os_id, criado_em, criado_por) VALUES (?,?,?,?)").bind(r.token, osId, Date.now(), String(u.nome || u.login || "")).run();
    r = await env.DB.prepare("SELECT token FROM os_via_links WHERE os_id = ?").bind(osId).first();
  }
  return json({ url: url.origin + "/v/" + r.token });
}
function viaDados(c, base) {
  const f = c.fech || {}, rel = c.rel || {};
  const num = (x) => (typeof x === "number" && isFinite(x) ? x : null);
  return {
    num: c.num, cliente: c.cliente || "", cidade: c.cidade || "", tipo: c.tipo || "", sub: c.sub || "", servico: c.servico || "",
    orc: c.orc || "", orcamento: c.orcamento && c.orcamento.num ? { num: c.orcamento.num } : null,
    tecnico: c.tecnico || "", auxiliar: c.auxiliar || "", finDate: c.finDate || "", ci: num(c.ci), co: num(c.co),
    visitas: (Array.isArray(c.visitas) ? c.visitas : []).map((v) => ({ ci: num(v && v.ci), co: num(v && v.co) })),
    itens: (Array.isArray(c.itens) ? c.itens : []).map((t) => ({ nome: t.nome, qtd: t.qtd, st: t.st, usado: t.usado })),
    fech: c.fech ? {
      minutos: num(f.minutos), quando: num(f.quando), pessoas: Array.isArray(f.pessoas) ? f.pessoas : [], auxiliar: f.auxiliar || "",
      visitas: (Array.isArray(f.visitas) ? f.visitas : []).map((v) => ({ ci: num(v.ci), co: num(v.co), min: num(v.min) })),
      mo: (Array.isArray(f.mo) ? f.mo : []).map((x) => ({ descricao: x.descricao, unidade: x.unidade, qtd: x.qtd, preco: x.preco })),
      valorMO: num(f.valorMO),
      mat: (Array.isArray(f.mat) ? f.mat : []).map((x) => ({ descricao: x.descricao, qtd: x.qtd, preco: x.preco })),
      valorMat: num(f.valorMat), valorTotal: num(f.valorTotal)
    } : null,
    rel: {
      texto: rel.texto || "", quando: rel.quando || "", assinNome: rel.assinNome || null,
      fotos: (Array.isArray(rel.fotos) ? rel.fotos : []).map((x, i) => base + "/f/" + i),
      assinatura: rel.assinatura ? base + "/a" : null
    }
  };
}
async function viaPublica(env, m) {
  const l = await env.DB.prepare("SELECT l.os_id, o.stage, o.dados FROM os_via_links l JOIN ordens_servico o ON o.id = l.os_id WHERE l.token = ?").bind(m[1]).first();
  if (!l || l.stage !== 7) {
    if (m[2]) return json({ erro: "Via n\xE3o dispon\xEDvel." }, 404, VIA_HDR);
    return new Response(VIA_INDISP, { status: 404, headers: Object.assign({ "content-type": "text/html; charset=utf-8" }, VIA_HDR) });
  }
  if (!m[2]) return new Response(VIA_PAGINA, { headers: Object.assign({ "content-type": "text/html; charset=utf-8" }, VIA_HDR) });
  const c = JSON.parse(l.dados || "{}"), base = "/v/" + m[1];
  if (m[2] === "dados") return json(viaDados(c, base), 200, VIA_HDR);
  const rel = c.rel || {};
  const src = m[2] === "a" ? rel.assinatura : (Array.isArray(rel.fotos) ? rel.fotos[Number(m[3])] : null);
  const fm = String(src || "").match(FOTO);
  if (!fm || fm[1] !== l.os_id || !env.FOTOS) return json({ erro: "N\xE3o encontrado" }, 404, VIA_HDR);
  const obj = await env.FOTOS.get("os/" + fm[1] + "/" + fm[2] + ".jpg");
  if (!obj) return json({ erro: "Foto n\xE3o encontrada" }, 404, VIA_HDR);
  return new Response(obj.body, { headers: { "content-type": "image/jpeg", "cache-control": "private, max-age=86400", "x-content-type-options": "nosniff", "x-robots-tag": "noindex" } });
}

// src/estoque.js · v26 — estoque da empresa e das equipes técnicas
// Locais: "empresa", "eq:<id da equipe>", e as pontas "cliente", "ajuste" (contagem) e "compra".
// Toda quantidade nasce de uma movimentação (estoque_mov). O saldo de um local é a soma do que entrou menos o que saiu.
var EST_PERM = { emp: ["op-est-emp"], tec: ["op-est-tec"], mov: ["op-est-mov", "op-est-emp", "op-est-tec"] };
var EST_TIPOS = {
  contagem: "Contagem / ajuste", compra: "Entrada de compra", retirada: "Retirada do técnico", devolucao: "Devolução do técnico",
  os_saida: "Saída para a OS", os_cliente: "Aplicado no cliente", os_retorno: "Sobra da OS devolvida", os_estorno: "Estorno de OS", os_transfer: "Troca de equipe na OS"
};
var estPode = (u, k) => ehAdmin(u) || EST_PERM[k].some((p) => u.permissoes.includes(p));
var estQ = (v) => Math.round((Number(v) || 0) * 1e3) / 1e3;
function estTxt(v, max) { return String(v == null ? "" : v).replace(/\s+/g, " ").trim().slice(0, max); }
async function estEquipes(env) {
  const { results } = await env.DB.prepare("SELECT e.id, e.nome, e.principal_id, e.ativo, u.nome AS principal FROM equipes_tecnicas e LEFT JOIN usuarios u ON u.id = e.principal_id ORDER BY e.ativo DESC, e.nome").all();
  return results;
}
async function estNomesLocais(env) {
  const m = { empresa: "Estoque da empresa", cliente: "Cliente", ajuste: "Contagem / ajuste", compra: "Compra (fornecedor)" };
  for (const e of await estEquipes(env)) m["eq:" + e.id] = e.nome;
  return m;
}
// saldo de um local: { produto_id: qtd }
async function estSaldoLocal(env, local) {
  const { results } = await env.DB.prepare(
    "SELECT produto_id, SUM(CASE WHEN para = ?1 THEN qtd ELSE -qtd END) AS s FROM estoque_mov WHERE para = ?1 OR de = ?1 GROUP BY produto_id"
  ).bind(local).all();
  const m = {};
  for (const r of results) m[r.produto_id] = estQ(r.s);
  return m;
}
// material de OS em execução, escolhido do estoque do técnico, que ainda não saiu (sai quando a OS é executada)
async function estReservado(env, eqId) {
  const { results } = await env.DB.prepare("SELECT dados FROM ordens_servico WHERE stage = 5").all();
  const res = {}, eqs = await estEquipes(env), eq = eqs.find((e) => e.id === eqId);
  if (!eq) return res;
  const itens = [];
  for (const r of results) {
    let c; try { c = JSON.parse(r.dados); } catch { continue; }
    if (!(c.tecnicoId === eq.principal_id || c.tecnico === eq.nome)) continue;
    for (const i of c.itens || []) if (i.st === "extra" && i.origem !== "empresa") itens.push({ i, os: c.num });
  }
  if (!itens.length) return res;
  const mapa = await estMapaProdutos(env, itens.map((x) => x.i));
  for (const { i, os } of itens) {
    const pid = estPid(mapa, i);
    if (!pid) continue;
    const q = parseInt(i.qtd, 10) || 1;
    res[pid] = res[pid] || { qtd: 0, os: [] };
    res[pid].qtd += q;
    if (res[pid].os.indexOf(os) < 0) res[pid].os.push(os);
  }
  return res;
}
// descrição do item da OS → produto do cadastro (pelo código, pelo id ou pela descrição; aceita "(observação)" no fim)
function estBaseNome(n) { return String(n || "").replace(/\s*\([^()]*\)\s*$/, "").trim(); }
async function estMapaProdutos(env, itens) {
  const ids = new Set(), nomes = new Set();
  for (const i of itens) {
    if (parseInt(i.pid, 10) > 0) ids.add(parseInt(i.pid, 10));
    const n = String(i.nome || "").trim();
    if (n) { nomes.add(n.toLowerCase()); const b = estBaseNome(n); if (b) nomes.add(b.toLowerCase()); }
  }
  const mapa = { ids: {}, nomes: {} };
  const lista = [...nomes];
  for (let k = 0; k < lista.length; k += 80) {
    const parte = lista.slice(k, k + 80);
    const { results } = await env.DB.prepare("SELECT id, codigo, descricao, unidade, preco_venda FROM produtos WHERE lower(descricao) IN (" + parte.map(() => "?").join(",") + ") ORDER BY id").bind(...parte).all();
    for (const r of results) { const key = String(r.descricao).toLowerCase(); if (!mapa.nomes[key]) mapa.nomes[key] = r; }
  }
  const lid = [...ids];
  for (let k = 0; k < lid.length; k += 80) {
    const parte = lid.slice(k, k + 80);
    const { results } = await env.DB.prepare("SELECT id, codigo, descricao, unidade, preco_venda FROM produtos WHERE id IN (" + parte.map(() => "?").join(",") + ")").bind(...parte).all();
    for (const r of results) mapa.ids[r.id] = r;
  }
  return mapa;
}
function estProd(mapa, i) {
  const pid = parseInt(i.pid, 10);
  if (pid > 0 && mapa.ids[pid]) return mapa.ids[pid];
  const n = String(i.nome || "").trim().toLowerCase();
  return mapa.nomes[n] || mapa.nomes[estBaseNome(n)] || null;
}
function estPid(mapa, i) { const p = estProd(mapa, i); return p ? p.id : null; }

// ---------- OS: onde o material de cada OS deveria estar, comparado ao que já foi lançado ----------
async function estLocalEquipeDaOS(env, card) {
  let r = null;
  if (card.tecnicoId) r = await env.DB.prepare("SELECT id FROM equipes_tecnicas WHERE principal_id = ? ORDER BY ativo DESC, id LIMIT 1").bind(card.tecnicoId).first();
  if (!r && card.tecnico) r = await env.DB.prepare("SELECT id FROM equipes_tecnicas WHERE nome = ?").bind(card.tecnico).first();
  return r ? "eq:" + r.id : null;
}
async function estReconciliarOS(env, card, por) {
  if (!card || !card.id) return { lancados: 0 };
  if (por && !/\s/.test(por)) { try { const us = await env.DB.prepare("SELECT nome FROM usuarios WHERE login = ?").bind(por).first(); if (us && us.nome) por = us.nome; } catch (e) {} }
  const itens = Array.isArray(card.itens) ? card.itens : [];
  const alvo = {};
  const soma = (pid, local, q) => { const k = pid + "|" + local; alvo[k] = estQ((alvo[k] || 0) + q); };
  const mover = (pid, de, para, q) => { if (!(q > 0) || de === para) return; soma(pid, de, -q); soma(pid, para, q); };
  const usa = itens.filter((i) => i.st === "campo" || i.st === "aplicado" || (i.st === "extra" && card.stage >= 6));
  if (usa.length) {
    const eq = await estLocalEquipeDaOS(env, card);
    const mapa = await estMapaProdutos(env, usa);
    for (const i of usa) {
      const pid = estPid(mapa, i);
      if (!pid) continue;
      const q = parseInt(i.qtd, 10) || 1;
      if (i.st === "campo") { if (eq) mover(pid, "empresa", eq, q); }
      else if (i.st === "aplicado") {
        const usado = Math.max(0, parseInt(i.usado, 10) || 0);
        if (eq) { mover(pid, "empresa", eq, q); mover(pid, eq, "cliente", usado); mover(pid, eq, "empresa", Math.max(0, q - usado)); }
        else mover(pid, "empresa", "cliente", usado);
      } else if (i.st === "extra") {
        if (i.origem !== "empresa" && eq) mover(pid, eq, "cliente", q);
        else mover(pid, "empresa", "cliente", q);
      }
    }
  }
  const { results } = await env.DB.prepare("SELECT produto_id, de, para, qtd FROM estoque_mov WHERE os_id = ?").bind(card.id).all();
  const atual = {};
  for (const r of results) {
    atual[r.produto_id + "|" + r.de] = estQ((atual[r.produto_id + "|" + r.de] || 0) - r.qtd);
    atual[r.produto_id + "|" + r.para] = estQ((atual[r.produto_id + "|" + r.para] || 0) + r.qtd);
  }
  const porProd = {};
  for (const k of new Set([...Object.keys(alvo), ...Object.keys(atual)])) {
    const d = estQ((alvo[k] || 0) - (atual[k] || 0));
    if (Math.abs(d) < 1e-3) continue;
    const [pid, local] = [k.slice(0, k.indexOf("|")), k.slice(k.indexOf("|") + 1)];
    (porProd[pid] = porProd[pid] || []).push({ local, d });
  }
  const agora = Date.now(), ops = [];
  const tipoDe = (de, para) => para === "cliente" ? "os_cliente" : de === "cliente" ? "os_estorno" : de === "empresa" ? "os_saida" : para === "empresa" ? "os_retorno" : "os_transfer";
  for (const pid of Object.keys(porProd)) {
    const sai = porProd[pid].filter((x) => x.d < 0).map((x) => ({ local: x.local, q: -x.d }));
    const entra = porProd[pid].filter((x) => x.d > 0).map((x) => ({ local: x.local, q: x.d }));
    let a = 0, b = 0;
    while (a < sai.length && b < entra.length) {
      const q = estQ(Math.min(sai[a].q, entra[b].q));
      if (q > 0) ops.push(env.DB.prepare("INSERT INTO estoque_mov (quando, produto_id, qtd, de, para, tipo, os_id, os_num, doc_id, por, obs) VALUES (?,?,?,?,?,?,?,?,?,?,?)")
        .bind(agora, parseInt(pid, 10), q, sai[a].local, entra[b].local, tipoDe(sai[a].local, entra[b].local), card.id, String(card.num || ""), null, String(por || "sistema").slice(0, 80), estTxt("OS " + (card.num || "") + " · " + (card.cliente || ""), 160)));
      sai[a].q = estQ(sai[a].q - q); entra[b].q = estQ(entra[b].q - q);
      if (sai[a].q < 1e-3) a++;
      if (entra[b].q < 1e-3) b++;
    }
  }
  if (ops.length) await env.DB.batch(ops);
  return { lancados: ops.length };
}
// Compras: pedido entregue → entrada no estoque da empresa (uma vez por pedido)
async function estEntradaCompra(env, p, pd, u) {
  const ja = await env.DB.prepare("SELECT 1 FROM estoque_mov WHERE doc_id = ? AND tipo = 'compra' LIMIT 1").bind(p.id).first();
  if (ja) return 0;
  const itens = (pd.itens || []).map((i) => ({ pid: i.produto_id, nome: i.nome, qtd: i.qtd }));
  const mapa = await estMapaProdutos(env, itens), agora = Date.now(), ops = [];
  for (const i of itens) {
    const pid = estPid(mapa, i), q = estQ(i.qtd);
    if (pid && q > 0) ops.push(env.DB.prepare("INSERT INTO estoque_mov (quando, produto_id, qtd, de, para, tipo, os_id, os_num, doc_id, por, obs) VALUES (?,?,?,?,?,?,?,?,?,?,?)")
      .bind(agora, pid, q, "compra", "empresa", "compra", null, null, p.id, String(u.nome || u.login || ""), estTxt(p.num + " · " + (pd.fornecedor || ""), 160)));
  }
  if (ops.length) await env.DB.batch(ops);
  return ops.length;
}

// ---------- documentos: retirada (estoque → equipe, o técnico confirma) e devolução (equipe → estoque, o Estoque confere) ----------
async function estProxNum(env, prefixo) {
  const r = await env.DB.prepare("SELECT num FROM estoque_docs WHERE num LIKE ? ORDER BY num DESC LIMIT 1").bind(prefixo + "-%").first();
  const n = r ? (parseInt(String(r.num).split("-")[1], 10) || 0) + 1 : 1;
  return prefixo + "-" + String(n).padStart(4, "0");
}
function estDocSaida(r, nomes) {
  let itens = []; try { itens = JSON.parse(r.itens); } catch {}
  return { id: r.id, num: r.num, tipo: r.tipo, equipe_id: r.equipe_id, equipe: nomes["eq:" + r.equipe_id] || "Equipe " + r.equipe_id, status: r.status, itens, obs: r.obs, divergencia: r.divergencia, criado_em: r.criado_em, criado_por: r.criado_por, fechado_em: r.fechado_em, fechado_por: r.fechado_por };
}
async function estItensValidos(env, lista) {
  const ids = [...new Set((Array.isArray(lista) ? lista : []).map((i) => parseInt(i.produto_id, 10)).filter((n) => n > 0))].slice(0, 200);
  if (!ids.length) return [];
  const { results } = await env.DB.prepare("SELECT id, codigo, descricao, unidade FROM produtos WHERE id IN (" + ids.map(() => "?").join(",") + ")").bind(...ids).all();
  const p = {}; for (const r of results) p[r.id] = r;
  const out = [];
  for (const i of lista) {
    const pr = p[parseInt(i.produto_id, 10)], q = estQ(i.qtd);
    if (!pr || !(q > 0)) continue;
    const ex = out.find((x) => x.produto_id === pr.id);
    if (ex) ex.qtd = estQ(ex.qtd + q);
    else out.push({ produto_id: pr.id, codigo: pr.codigo, descricao: pr.descricao, unidade: pr.unidade, qtd: q });
  }
  return out;
}
async function estCriarDoc(env, tipo, eqId, itens, obs, quem) {
  const agora = Date.now();
  for (let t = 0; t < 3; t++) {
    const num = await estProxNum(env, tipo === "retirada" ? "RET" : "DEV"), id = "ed-" + aleatorio(8);
    try {
      await env.DB.prepare("INSERT INTO estoque_docs (id, num, tipo, equipe_id, status, itens, obs, criado_em, criado_por) VALUES (?,?,?,?,?,?,?,?,?)")
        .bind(id, num, tipo, eqId, "aguardando", JSON.stringify(itens), obs || null, agora, quem).run();
      return { id, num };
    } catch (e) { if (!/UNIQUE/i.test(String(e && e.message))) throw e; }
  }
  throw new Error("numeração");
}
function estMovDoc(env, doc, itens, de, para, tipo, quem, qtdDe) {
  const agora = Date.now();
  return itens.filter((i) => (qtdDe ? qtdDe(i) : i.qtd) > 0).map((i) => env.DB.prepare("INSERT INTO estoque_mov (quando, produto_id, qtd, de, para, tipo, os_id, os_num, doc_id, por, obs) VALUES (?,?,?,?,?,?,?,?,?,?,?)")
    .bind(agora, i.produto_id, estQ(qtdDe ? qtdDe(i) : i.qtd), de, para, tipo, null, null, doc.id, quem, doc.num));
}

// ---------- rotas do SGO (/api/estoque/...) ----------
async function estoqueRotas(request, env, url, u) {
  const c = url.pathname, m = request.method, quem = String(u.nome || u.login || "");
  const nomes = await estNomesLocais(env);
  if (c === "/api/estoque/locais" && m === "GET") {
    const eqs = await estEquipes(env);
    const { results } = await env.DB.prepare("SELECT tipo, equipe_id, COUNT(*) AS n FROM estoque_docs WHERE status = 'aguardando' GROUP BY tipo, equipe_id").all();
    const pend = {}; for (const r of results) { pend[r.equipe_id] = pend[r.equipe_id] || {}; pend[r.equipe_id][r.tipo] = r.n; }
    return json({ locais: [{ id: "empresa", nome: nomes.empresa, tipo: "empresa" }].concat(eqs.map((e) => ({ id: "eq:" + e.id, equipe_id: e.id, nome: e.nome, principal: e.principal, ativo: !!e.ativo, tipo: "equipe", aguardando: pend[e.id] || {} }))) });
  }
  if (c === "/api/estoque/saldo" && m === "GET") {
    const local = String(url.searchParams.get("local") || "empresa");
    if (!(local === "empresa" || /^eq:\d+$/.test(local)) || !nomes[local]) return json({ erro: "Local inválido." }, 400);
    const q = estTxt(url.searchParams.get("q"), 80).toLowerCase(), todos = url.searchParams.get("todos") === "1";
    const saldo = await estSaldoLocal(env, local);
    let emEquipes = {};
    if (local === "empresa") {
      const { results } = await env.DB.prepare("SELECT produto_id, SUM(CASE WHEN para LIKE 'eq:%' THEN qtd ELSE 0 END) - SUM(CASE WHEN de LIKE 'eq:%' THEN qtd ELSE 0 END) AS s FROM estoque_mov WHERE para LIKE 'eq:%' OR de LIKE 'eq:%' GROUP BY produto_id").all();
      for (const r of results) emEquipes[r.produto_id] = estQ(r.s);
    }
    const reservado = local.startsWith("eq:") ? await estReservado(env, parseInt(local.slice(3), 10)) : {};
    let rows;
    if (q || todos) {
      const like = "%" + q.replace(/[%_]/g, "") + "%";
      ({ results: rows } = await env.DB.prepare("SELECT id, codigo, descricao, unidade, familia, preco_venda FROM produtos WHERE situacao = 'Ativo' AND (? = '%%' OR lower(codigo) LIKE ? OR lower(descricao) LIKE ? OR busca LIKE ?) ORDER BY descricao LIMIT 300").bind(like, like, like, like).all());
    } else {
      const ids = [...new Set([...Object.keys(saldo), ...Object.keys(emEquipes), ...Object.keys(reservado)].map(Number))].filter((id) => (saldo[id] || 0) !== 0 || (emEquipes[id] || 0) !== 0 || reservado[id]);
      rows = [];
      for (let k = 0; k < ids.length; k += 90) {
        const parte = ids.slice(k, k + 90);
        const { results } = await env.DB.prepare("SELECT id, codigo, descricao, unidade, familia, preco_venda FROM produtos WHERE id IN (" + parte.map(() => "?").join(",") + ")").bind(...parte).all();
        rows = rows.concat(results);
      }
      rows.sort((a, b) => String(a.descricao).localeCompare(String(b.descricao), "pt-BR"));
    }
    return json({ local, nome: nomes[local], itens: rows.map((r) => ({ produto_id: r.id, codigo: r.codigo, descricao: r.descricao, unidade: r.unidade, familia: r.familia, preco: r.preco_venda, saldo: saldo[r.id] || 0, em_equipes: emEquipes[r.id] || 0, reservado: reservado[r.id] ? reservado[r.id].qtd : 0, reservado_os: reservado[r.id] ? reservado[r.id].os : [] })) });
  }
  if (c === "/api/estoque/produtos" && m === "GET") {
    const q = estTxt(url.searchParams.get("q"), 80).toLowerCase();
    if (q.length < 2) return json({ itens: [] });
    const like = "%" + q.replace(/[%_]/g, "") + "%";
    const { results } = await env.DB.prepare("SELECT id, codigo, descricao, unidade, preco_venda FROM produtos WHERE situacao = 'Ativo' AND (lower(codigo) LIKE ? OR lower(descricao) LIKE ? OR busca LIKE ?) ORDER BY descricao LIMIT 30").bind(like, like, like).all();
    const saldo = await estSaldoLocal(env, "empresa");
    return json({ itens: results.map((r) => ({ produto_id: r.id, codigo: r.codigo, descricao: r.descricao, unidade: r.unidade, preco: r.preco_venda, saldo: saldo[r.id] || 0 })) });
  }
  if (c === "/api/estoque/precos" && m === "POST") {
    let b = {}; try { b = await request.json(); } catch {}
    const itens = (Array.isArray(b.itens) ? b.itens : []).slice(0, 200).map((i) => ({ nome: estTxt(i.nome, 160), pid: i.pid }));
    const mapa = await estMapaProdutos(env, itens);
    return json({ itens: itens.map((i) => { const p = estProd(mapa, i); return p ? { nome: i.nome, produto_id: p.id, codigo: p.codigo, descricao: p.descricao, unidade: p.unidade, preco: p.preco_venda } : { nome: i.nome, produto_id: null }; }) });
  }
  if (c === "/api/estoque/mov" && m === "GET") {
    if (!estPode(u, "mov")) return json({ erro: "Sem permissão para ver as movimentações." }, 403);
    const sp = url.searchParams, w = [], v = [];
    const local = sp.get("local"); if (local) { w.push("(m.de = ? OR m.para = ?)"); v.push(local, local); }
    const os = sp.get("os"); if (os) { w.push("(m.os_num = ? OR m.os_id = ?)"); v.push(os.replace(/^OS\s*/i, ""), os); }
    const prod = parseInt(sp.get("produto"), 10); if (prod > 0) { w.push("m.produto_id = ?"); v.push(prod); }
    const tipo = sp.get("tipo"); if (tipo && EST_TIPOS[tipo]) { w.push("m.tipo = ?"); v.push(tipo); }
    const q = estTxt(sp.get("q"), 80).toLowerCase(); if (q) { w.push("(lower(p.descricao) LIKE ? OR lower(p.codigo) LIKE ? OR lower(m.obs) LIKE ?)"); const l = "%" + q.replace(/[%_]/g, "") + "%"; v.push(l, l, l); }
    const de = Date.parse(sp.get("de") || ""), ate = Date.parse(sp.get("ate") || "");
    if (de) { w.push("m.quando >= ?"); v.push(de + 3 * 36e5); }
    if (ate) { w.push("m.quando < ?"); v.push(ate + 864e5 + 3 * 36e5); }
    const lim = Math.min(2000, parseInt(sp.get("limite"), 10) || 500);
    const { results } = await env.DB.prepare("SELECT m.*, p.codigo, p.descricao, p.unidade FROM estoque_mov m LEFT JOIN produtos p ON p.id = m.produto_id" + (w.length ? " WHERE " + w.join(" AND ") : "") + " ORDER BY m.quando DESC, m.id DESC LIMIT " + lim).bind(...v).all();
    return json({ tipos: EST_TIPOS, nomes, itens: results });
  }
  if (c === "/api/estoque/contagem" && m === "POST") {
    if (!estPode(u, "emp")) return json({ erro: "Sem permissão para ajustar o estoque da empresa." }, 403);
    let b = {}; try { b = await request.json(); } catch {}
    const lista = (Array.isArray(b.itens) ? b.itens : []).slice(0, 300).map((i) => ({ produto_id: parseInt(i.produto_id, 10), contado: estQ(i.contado) })).filter((i) => i.produto_id > 0 && i.contado >= 0);
    if (!lista.length) return json({ erro: "Informe pelo menos uma quantidade contada." }, 400);
    const saldo = await estSaldoLocal(env, "empresa"), agora = Date.now(), obs = estTxt(b.obs, 200) || "Contagem de estoque", ops = [];
    for (const i of lista) {
      const d = estQ(i.contado - (saldo[i.produto_id] || 0));
      if (Math.abs(d) < 1e-3) continue;
      ops.push(env.DB.prepare("INSERT INTO estoque_mov (quando, produto_id, qtd, de, para, tipo, os_id, os_num, doc_id, por, obs) VALUES (?,?,?,?,?,?,?,?,?,?,?)")
        .bind(agora, i.produto_id, Math.abs(d), d > 0 ? "ajuste" : "empresa", d > 0 ? "empresa" : "ajuste", "contagem", null, null, null, quem, obs));
    }
    if (ops.length) await env.DB.batch(ops);
    return json({ ok: true, ajustados: ops.length });
  }
  if (c === "/api/estoque/docs" && m === "GET") {
    const sp = url.searchParams, w = [], v = [];
    const eq = parseInt(sp.get("equipe"), 10); if (eq > 0) { w.push("equipe_id = ?"); v.push(eq); }
    const st = sp.get("status"); if (st) { w.push("status = ?"); v.push(st); }
    const { results } = await env.DB.prepare("SELECT * FROM estoque_docs" + (w.length ? " WHERE " + w.join(" AND ") : "") + " ORDER BY criado_em DESC LIMIT 200").bind(...v).all();
    return json({ itens: results.map((r) => estDocSaida(r, nomes)) });
  }
  if (c === "/api/estoque/retiradas" && m === "POST") {
    if (!estPode(u, "tec")) return json({ erro: "Sem permissão para lançar retirada." }, 403);
    let b = {}; try { b = await request.json(); } catch {}
    const eqId = parseInt(b.equipe_id, 10);
    if (!nomes["eq:" + eqId]) return json({ erro: "Escolha a equipe técnica." }, 400);
    const itens = await estItensValidos(env, b.itens);
    if (!itens.length) return json({ erro: "Inclua pelo menos um produto com quantidade." }, 400);
    const d = await estCriarDoc(env, "retirada", eqId, itens, estTxt(b.obs, 300), quem);
    return json({ ok: true, id: d.id, num: d.num });
  }
  const dm = c.match(/^\/api\/estoque\/docs\/(ed-[a-z0-9]{8,32})\/(cancelar|conferir)$/);
  if (dm && m === "POST") {
    if (!estPode(u, "tec")) return json({ erro: "Sem permissão." }, 403);
    const r = await env.DB.prepare("SELECT * FROM estoque_docs WHERE id = ?").bind(dm[1]).first();
    if (!r) return json({ erro: "Documento não encontrado." }, 404);
    const doc = estDocSaida(r, nomes), agora = Date.now();
    let b = {}; try { b = await request.json(); } catch {}
    if (dm[2] === "cancelar") {
      if (!(r.status === "aguardando" || r.status === "divergencia")) return json({ erro: "Este documento já foi " + r.status + "." }, 409);
      await env.DB.prepare("UPDATE estoque_docs SET status = 'cancelada', fechado_em = ?, fechado_por = ?, divergencia = COALESCE(divergencia, ?) WHERE id = ? AND status = ?").bind(agora, quem, estTxt(b.motivo, 300) || null, r.id, r.status).run();
      return json({ ok: true });
    }
    if (r.tipo !== "devolucao" || r.status !== "aguardando") return json({ erro: "Só devoluções aguardando podem ser conferidas." }, 409);
    const rec = {}; for (const i of Array.isArray(b.itens) ? b.itens : []) rec[parseInt(i.produto_id, 10)] = estQ(i.recebido);
    const itens = doc.itens.map((i) => Object.assign({}, i, { recebido: Math.max(0, Math.min(i.qtd, rec[i.produto_id] != null ? rec[i.produto_id] : i.qtd)) }));
    const falta = itens.filter((i) => i.recebido < i.qtd).map((i) => estQ(i.qtd - i.recebido) + " " + i.descricao);
    const div = falta.length ? "Não chegou: " + falta.join(", ") + (estTxt(b.obs, 200) ? " · " + estTxt(b.obs, 200) : "") : estTxt(b.obs, 200) || null;
    const up = await env.DB.prepare("UPDATE estoque_docs SET status = 'conferida', itens = ?, divergencia = ?, fechado_em = ?, fechado_por = ? WHERE id = ? AND status = 'aguardando'").bind(JSON.stringify(itens), div, agora, quem, r.id).run();
    if (!up.meta.changes) return json({ erro: "Esta devolução acabou de ser alterada. Atualize a tela." }, 409);
    const ops = estMovDoc(env, doc, itens, "eq:" + r.equipe_id, "empresa", "devolucao", quem, (i) => i.recebido);
    if (ops.length) await env.DB.batch(ops);
    return json({ ok: true, divergencia: div });
  }
  return json({ erro: "Não encontrado" }, 404);
}

// ---------- rotas do App do Técnico (/api/tecnico/estoque...) ----------
async function estoqueTecnico(request, env, url, u) {
  if (u.perfil !== "tecnico") return json({ erro: "Disponível só para o perfil Técnico." }, 403);
  const eq = await env.DB.prepare("SELECT id, nome FROM equipes_tecnicas WHERE principal_id = ? AND ativo = 1 ORDER BY id LIMIT 1").bind(u.id).first();
  if (!eq) return json({ erro: "Você não é o principal de nenhuma equipe técnica ativa." }, 404);
  const c = url.pathname, m = request.method, local = "eq:" + eq.id, quem = String(u.nome || u.login || eq.nome);
  if (c === "/api/tecnico/estoque" && m === "GET") {
    const saldo = await estSaldoLocal(env, local), res = await estReservado(env, eq.id);
    const ids = [...new Set([...Object.keys(saldo), ...Object.keys(res)].map(Number))].filter((id) => (saldo[id] || 0) !== 0 || res[id]);
    let prods = [];
    if (ids.length) ({ results: prods } = await env.DB.prepare("SELECT id, codigo, descricao, unidade, preco_venda FROM produtos WHERE id IN (" + ids.map(() => "?").join(",") + ")").bind(...ids).all());
    prods.sort((a, b) => String(a.descricao).localeCompare(String(b.descricao), "pt-BR"));
    const nomes = { ["eq:" + eq.id]: eq.nome };
    const { results: docs } = await env.DB.prepare("SELECT * FROM estoque_docs WHERE equipe_id = ? AND (status IN ('aguardando','divergencia') OR fechado_em > ?) ORDER BY criado_em DESC LIMIT 30").bind(eq.id, Date.now() - 7 * 864e5).all();
    return json({
      equipe: { id: eq.id, nome: eq.nome },
      itens: prods.map((p) => ({ produto_id: p.id, codigo: p.codigo, descricao: p.descricao, unidade: p.unidade, saldo: saldo[p.id] || 0, reservado: res[p.id] ? res[p.id].qtd : 0, reservado_os: res[p.id] ? res[p.id].os : [] })),
      docs: docs.map((r) => estDocSaida(r, nomes)), agora: Date.now()
    });
  }
  const rm = c.match(/^\/api\/tecnico\/estoque\/retirada\/(ed-[a-z0-9]{8,32})$/);
  if (rm && m === "POST") {
    let b = {}; try { b = await request.json(); } catch {}
    const r = await env.DB.prepare("SELECT * FROM estoque_docs WHERE id = ? AND equipe_id = ? AND tipo = 'retirada'").bind(rm[1], eq.id).first();
    if (!r) return json({ erro: "Retirada não encontrada." }, 404);
    if (r.status !== "aguardando") return json({ erro: "Esta retirada já está " + r.status + "." }, 409);
    const agora = Date.now();
    if (b.acao === "divergencia") {
      const t = estTxt(b.texto, 400);
      if (!t) return json({ erro: "Descreva o que está diferente." }, 400);
      await env.DB.prepare("UPDATE estoque_docs SET status = 'divergencia', divergencia = ? WHERE id = ? AND status = 'aguardando'").bind(t, r.id).run();
      return json({ ok: true });
    }
    const up = await env.DB.prepare("UPDATE estoque_docs SET status = 'confirmada', fechado_em = ?, fechado_por = ? WHERE id = ? AND status = 'aguardando'").bind(agora, quem, r.id).run();
    if (!up.meta.changes) return json({ erro: "Esta retirada acabou de ser alterada." }, 409);
    const doc = estDocSaida(r, {});
    const ops = estMovDoc(env, doc, doc.itens, "empresa", local, "retirada", quem);
    if (ops.length) await env.DB.batch(ops);
    return json({ ok: true });
  }
  if (c === "/api/tecnico/estoque/devolucao" && m === "POST") {
    let b = {}; try { b = await request.json(); } catch {}
    const itens = await estItensValidos(env, b.itens);
    if (!itens.length) return json({ erro: "Informe o que você está devolvendo." }, 400);
    const saldo = await estSaldoLocal(env, local), res = await estReservado(env, eq.id);
    const { results: abertas } = await env.DB.prepare("SELECT itens FROM estoque_docs WHERE equipe_id = ? AND tipo = 'devolucao' AND status = 'aguardando'").bind(eq.id).all();
    const emDev = {}; for (const a of abertas) for (const i of JSON.parse(a.itens)) emDev[i.produto_id] = (emDev[i.produto_id] || 0) + i.qtd;
    for (const i of itens) {
      const disp = estQ((saldo[i.produto_id] || 0) - (res[i.produto_id] ? res[i.produto_id].qtd : 0) - (emDev[i.produto_id] || 0));
      if (i.qtd > disp + 1e-3) return json({ erro: "Você tem " + Math.max(0, disp) + " " + (i.unidade || "un").toLowerCase() + " de " + i.descricao + " para devolver." }, 400);
    }
    const d = await estCriarDoc(env, "devolucao", eq.id, itens, estTxt(b.obs, 300), quem);
    return json({ ok: true, num: d.num });
  }
  return json({ erro: "Não encontrado" }, 404);
}
var VIA_PAGINA = "<!DOCTYPE html><html lang=\"pt-BR\"><head><meta charset=\"utf-8\"><meta name=\"viewport\" content=\"width=device-width, initial-scale=1\"><meta name=\"robots\" content=\"noindex, nofollow\"><meta name=\"theme-color\" content=\"#141414\"><link rel=\"icon\" href=\"/img/logo-ancora.png\"><title>Via do cliente · Âncora Segurança</title></head><body style=\"margin:0;font:15px system-ui,sans-serif\"><p id=\"vc-car\" style=\"padding:28px\">Carregando a via do cliente…</p><script>/* Via do cliente da OS · montagem, PDF e página pública · v25\n   Usado na tela de OS (botões da via) e na página pública /v/<link> que o cliente abre.\n   Mostra só o que o cliente precisa: atendimento, tempo no local, produtos, valor fechado,\n   resolução, fotos e assinatura. Não mostra histórico interno nem motivo de ajuste. */\n(function () {\n  \"use strict\";\n  var H2P = \"https://cdnjs.cloudflare.com/ajax/libs/html2pdf.js/0.10.1/html2pdf.bundle.min.js\";\n  function esc(s) { return String(s == null ? \"\" : s).replace(/[&<>\"']/g, function (c) { return { \"&\": \"&amp;\", \"<\": \"&lt;\", \">\": \"&gt;\", '\"': \"&quot;\", \"'\": \"&#39;\" }[c]; }); }\n  function brl(v) { return (Number(v) || 0).toLocaleString(\"pt-BR\", { style: \"currency\", currency: \"BRL\" }); }\n  function p2(n) { return (n < 10 ? \"0\" : \"\") + n; }\n  var TZ = { timeZone: \"America/Sao_Paulo\" };\n  function data(ms) { try { return new Date(ms).toLocaleDateString(\"pt-BR\", TZ); } catch (e) { var d = new Date(ms); return p2(d.getDate()) + \"/\" + p2(d.getMonth() + 1) + \"/\" + d.getFullYear(); } }\n  function hora(ms) { try { return new Date(ms).toLocaleTimeString(\"pt-BR\", { timeZone: \"America/Sao_Paulo\", hour: \"2-digit\", minute: \"2-digit\" }); } catch (e) { var d = new Date(ms); return p2(d.getHours()) + \":\" + p2(d.getMinutes()); } }\n  function dataIso(s) { var m = /^(\\d{4})-(\\d{2})-(\\d{2})$/.exec(s || \"\"); return m ? m[3] + \"/\" + m[2] + \"/\" + m[1] : \"\"; }\n  function durTxt(min) { min = Math.max(0, Math.round(min || 0)); var h = Math.floor(min / 60), m = min % 60; return h ? h + \" h\" + (m ? \" \" + p2(m) + \" min\" : \"\") : m + \" min\"; }\n  function qtdTxt(q) { var s = String(q == null ? \"\" : q).trim(); return s.replace(/x$/i, \"\"); }\n  function tipoTxt(c) {\n    if (c.tipo === \"manut\") return \"Manutenção\" + (c.sub ? \" · \" + c.sub : \"\");\n    if (c.tipo === \"monit\") return \"Monitoramento\" + (c.sub ? \" · \" + c.sub : \"\");\n    if (c.tipo === \"visita\") return \"Visita técnica / orçamento\";\n    return \"Instalação\";\n  }\n\n  function visitas(c) {\n    var v = (c.fech && c.fech.visitas && c.fech.visitas.length ? c.fech.visitas : (c.visitas || [])).filter(function (x) { return x && x.ci; });\n    if (!v.length && c.ci) v = [{ ci: c.ci, co: c.co }];\n    return v.map(function (x) { return { ci: x.ci, co: x.co, min: x.min != null ? x.min : (x.co ? (x.co - x.ci) / 6e4 : 0) }; });\n  }\n  function produtos(c) {\n    return (c.itens || []).map(function (t) {\n      var q = t.st === \"aplicado\" && t.usado != null && t.usado !== \"\" ? t.usado : t.qtd;\n      return { qtd: qtdTxt(q), nome: t.nome };\n    }).filter(function (t) { return t.nome && String(t.qtd) !== \"0\"; });\n  }\n\n  function partes(c, opts) {\n    opts = opts || {};\n    var f = c.fech || {}, rel = c.rel || {}, V = visitas(c), P = produtos(c);\n    var minutos = f.minutos != null ? f.minutos : V.reduce(function (s, v) { return s + (v.min || 0); }, 0);\n    var fotos = (rel.fotos || []).filter(function (u) { return String(u).charAt(0) === \"/\"; });\n    var mo = (f.mo || []).filter(function (x) { return x.qtd > 0; });\n    var valor = f.valorMO != null ? f.valorMO : null;\n    var somaMO = mo.reduce(function (s, x) { return s + x.qtd * (x.preco || 0); }, 0);\n    var tecnicos = (f.pessoas && f.pessoas.length ? f.pessoas.join(\", \") : \"\") || c.tecnico || \"—\";\n    var aux = f.auxiliar || c.auxiliar;\n    var quando = c.finDate ? dataIso(c.finDate) : (f.quando ? data(f.quando) : data(Date.now()));\n    var css = \"@page{size:A4;margin:12mm}*{box-sizing:border-box;-webkit-print-color-adjust:exact;print-color-adjust:exact}\" +\n      \"body{margin:0;font:12px/1.45 Inter,system-ui,-apple-system,Segoe UI,Roboto,sans-serif;color:#141414}\" +\n      \".top{display:flex;align-items:center;gap:14px;border-bottom:4px solid #FFD200;padding-bottom:10px}.top img{width:58px;height:58px;object-fit:contain}\" +\n      \".top .emp{flex:1}.top .emp b{display:block;font-size:17px;letter-spacing:.3px}.top .emp span{color:#555;font-size:11px}\" +\n      \".top .os{text-align:right}.top .os .k{display:inline-block;background:#141414;color:#FFD200;font-weight:800;font-size:10.5px;letter-spacing:.6px;text-transform:uppercase;padding:3px 8px;border-radius:4px}\" +\n      \".top .os .n{font-size:20px;font-weight:800;margin-top:4px}.top .os .d{color:#555;font-size:11px}\" +\n      \"h2{font-size:11px;letter-spacing:.7px;text-transform:uppercase;color:#141414;margin:16px 0 6px;padding-bottom:4px;border-bottom:1px solid #ddd}\" +\n      \".g{display:grid;grid-template-columns:repeat(3,1fr);gap:6px 18px}.g .l{font-size:9.5px;letter-spacing:.5px;text-transform:uppercase;color:#666}.g .v{font-weight:600}\" +\n      \"table{width:100%;border-collapse:collapse}th{font-size:9.5px;letter-spacing:.5px;text-transform:uppercase;color:#666;text-align:left;font-weight:600;padding:4px 6px;border-bottom:1px solid #ccc}\" +\n      \"td{padding:5px 6px;border-bottom:1px solid #eee;vertical-align:top}td.n,th.n{text-align:right;white-space:nowrap}td.q{width:60px;font-weight:700}\" +\n      \".tot{display:flex;justify-content:space-between;align-items:center;background:#141414;color:#fff;border-radius:6px;padding:9px 12px;margin-top:8px}.tot b{color:#FFD200;font-size:17px}\" +\n      \".tempo{display:flex;justify-content:space-between;background:#f4f4f0;border-radius:6px;padding:7px 10px;margin-top:6px;font-weight:600}\" +\n      \".rel{white-space:pre-wrap;background:#f7f7f3;border-left:3px solid #FFD200;padding:8px 10px;border-radius:0 6px 6px 0}\" +\n      \".fotos{display:grid;grid-template-columns:repeat(3,1fr);gap:8px}.fotos img{width:100%;height:150px;object-fit:cover;border-radius:6px;border:1px solid #ddd;display:block}\" +\n      \".ass{display:grid;grid-template-columns:1.3fr 1fr;gap:24px;margin-top:6px;align-items:end;break-inside:avoid}\" +\n      \".ass .cx{border-bottom:1.5px solid #141414;height:90px;display:flex;align-items:flex-end;justify-content:center}.ass .cx img{max-height:86px;max-width:100%}\" +\n      \".ass .leg{font-size:10.5px;color:#444;margin-top:4px}.vazio{color:#777;font-style:italic}\" +\n      \".rod{margin-top:18px;border-top:1px solid #ddd;padding-top:6px;font-size:10px;color:#666;display:flex;justify-content:space-between;gap:10px}\" +\n      \"section{break-inside:avoid}.quebra{break-inside:auto}\" +\n      \".folha{max-width:186mm;margin:0 auto;background:#fff}\" +\n      \"@media screen{body{background:#ecece8}.folha{padding:14mm 12mm;margin:16px auto;box-shadow:0 2px 14px #0000001f;border-radius:4px}}\" +\n      \".vbar{position:sticky;top:0;z-index:5;display:flex;align-items:center;gap:10px;flex-wrap:wrap;background:#141414;color:#fff;padding:10px 16px;border-bottom:4px solid #FFD200}.vbar .t{flex:1;min-width:180px;font-weight:700}.vbar .t small{display:block;font-weight:500;color:#bdbdb5}\" +\n      \".vbar button{font:700 14px Inter,system-ui,sans-serif;min-height:44px;padding:0 16px;border-radius:9px;border:0;cursor:pointer;background:#fff;color:#141414}.vbar button.y{background:#FFD200}.vbar button:focus-visible{outline:3px solid #FFD200;outline-offset:2px}.vbar button:disabled{opacity:.55;cursor:wait}\" +\n      \"@media print{.vbar{display:none}body{background:#fff}.folha{padding:0;margin:0;box-shadow:none;max-width:none}}\" +\n      \"@media screen and (max-width:640px){.folha{padding:16px 14px;margin:0;border-radius:0;box-shadow:none}.g{grid-template-columns:1fr 1fr}.top{flex-wrap:wrap}.top .os{text-align:left;width:100%}.fotos{grid-template-columns:1fr 1fr}.fotos img{height:120px}.ass{grid-template-columns:1fr}td,th{padding:5px 4px}}\";\n    var h = '<div class=\"folha\">';\n    h += '<div class=\"top\"><img src=\"/img/logo-ancora.png\" alt=\"\"><div class=\"emp\"><b>ÂNCORA SEGURANÇA</b><span>Portaria remota · monitoramento · segurança eletrônica</span></div>' +\n      '<div class=\"os\"><span class=\"k\">Via do cliente</span><div class=\"n\">OS Nº ' + esc(c.num) + '</div><div class=\"d\">Finalizada em ' + esc(quando) + '</div></div></div>';\n    h += '<section><h2>Cliente e serviço</h2><div class=\"g\">' +\n      '<div><div class=\"l\">Cliente</div><div class=\"v\">' + esc(c.cliente || \"—\") + '</div></div>' +\n      '<div><div class=\"l\">Cidade</div><div class=\"v\">' + esc(c.cidade || \"—\") + '</div></div>' +\n      '<div><div class=\"l\">Tipo de atendimento</div><div class=\"v\">' + esc(tipoTxt(c)) + '</div></div>' +\n      '<div style=\"grid-column:span 2\"><div class=\"l\">Serviço</div><div class=\"v\">' + esc(c.servico || \"—\") + '</div></div>' +\n      '<div><div class=\"l\">Orçamento</div><div class=\"v\">' + esc((c.orcamento && c.orcamento.num) || c.orc || \"—\") + '</div></div>' +\n      '</div></section>';\n    h += '<section><h2>Atendimento no local</h2><div class=\"g\" style=\"margin-bottom:6px\">' +\n      '<div><div class=\"l\">Equipe técnica</div><div class=\"v\">' + esc(c.tecnico || \"—\") + '</div></div>' +\n      '<div><div class=\"l\">Técnico(s)</div><div class=\"v\">' + esc(tecnicos) + '</div></div>' +\n      '<div><div class=\"l\">Auxiliar</div><div class=\"v\">' + esc(aux || \"—\") + '</div></div></div>';\n    if (V.length) {\n      h += '<table><tr><th>Data</th><th>Chegada</th><th>Saída</th><th class=\"n\">Tempo</th></tr>' + V.map(function (v) {\n        return \"<tr><td>\" + data(v.ci) + \"</td><td>\" + hora(v.ci) + \"</td><td>\" + (v.co ? hora(v.co) : \"—\") + '</td><td class=\"n\">' + (v.co ? durTxt(v.min) : \"—\") + \"</td></tr>\";\n      }).join(\"\") + \"</table>\";\n    }\n    h += '<div class=\"tempo\"><span>Tempo total no local</span><span>' + (minutos > 0 ? durTxt(minutos) : \"—\") + \"</span></div></section>\";\n    h += '<section><h2>O que foi feito</h2><div class=\"rel\">' + (rel.texto ? esc(rel.texto) : '<span class=\"vazio\">Sem descrição registrada.</span>') + \"</div></section>\";\n    h += '<section class=\"quebra\"><h2>Produtos utilizados</h2>' + (P.length\n      ? '<table><tr><th>Qtd</th><th>Produto</th></tr>' + P.map(function (t) { return '<tr><td class=\"q\">' + esc(t.qtd) + \"</td><td>\" + esc(t.nome) + \"</td></tr>\"; }).join(\"\") + \"</table>\"\n      : '<div class=\"vazio\">Nenhum produto utilizado neste atendimento.</div>') + \"</section>\";\n    h += '<section><h2>Valor do atendimento</h2>';\n    if (mo.length) {\n      h += '<table><tr><th>Mão de obra</th><th class=\"n\">Qtd</th><th class=\"n\">Valor unit.</th><th class=\"n\">Total</th></tr>' + mo.map(function (x) {\n        return \"<tr><td>\" + esc(x.descricao) + '</td><td class=\"n\">' + esc(x.qtd) + \" \" + esc(String(x.unidade || \"\").toLowerCase()) + '</td><td class=\"n\">' + brl(x.preco) + '</td><td class=\"n\">' + brl(x.qtd * (x.preco || 0)) + \"</td></tr>\";\n      }).join(\"\") + (valor != null && Math.abs(valor - somaMO) > 0.009 ? '<tr><td colspan=\"3\">Ajuste no fechamento</td><td class=\"n\">' + brl(valor - somaMO) + \"</td></tr>\" : \"\") + \"</table>\";\n    }\n    var mat = (f.mat || []).filter(function (x) { return x && x.qtd > 0; });\n    if (mat.length) {\n      h += '<table style=\"margin-top:6px\"><tr><th>Material</th><th class=\"n\">Qtd</th><th class=\"n\">Valor unit.</th><th class=\"n\">Total</th></tr>' + mat.map(function (x) {\n        return \"<tr><td>\" + esc(x.descricao) + '</td><td class=\"n\">' + esc(x.qtd) + '</td><td class=\"n\">' + brl(x.preco) + '</td><td class=\"n\">' + brl(x.qtd * (x.preco || 0)) + \"</td></tr>\";\n      }).join(\"\") + \"</table>\";\n    }\n    var total = f.valorTotal != null ? f.valorTotal : valor != null ? valor + mat.reduce(function (t, x) { return t + x.qtd * (x.preco || 0); }, 0) : null;\n    h += total != null ? '<div class=\"tot\"><span>Valor fechado do atendimento</span><b>' + brl(total) + \"</b></div>\" : '<div class=\"vazio\">Valor não informado no fechamento.</div>';\n    h += \"</section>\";\n    if (fotos.length) h += '<section class=\"quebra\"><h2>Fotos do local</h2><div class=\"fotos\">' + fotos.map(function (u, i) { return '<img src=\"' + esc(u) + '\" alt=\"Foto ' + (i + 1) + '\">'; }).join(\"\") + \"</div></section>\";\n    var assImg = rel.assinatura && String(rel.assinatura).charAt(0) === \"/\" ? rel.assinatura : \"\";\n    h += '<section><h2>Recebimento do serviço</h2><div class=\"ass\"><div><div class=\"cx\">' + (assImg ? '<img src=\"' + esc(assImg) + '\" alt=\"Assinatura do cliente\">' : \"\") + '</div><div class=\"leg\">Assinatura do cliente' +\n      (rel.assinNome ? \" · \" + esc(rel.assinNome) : \" · nome legível: ______________________________\") + (assImg && rel.quando ? \" · \" + esc(rel.quando) : \"\") + '</div></div>' +\n      '<div><div class=\"cx\" style=\"height:40px\"><b style=\"font-size:12px\">' + esc(tecnicos) + '</b></div><div class=\"leg\">Técnico responsável</div></div></div></section>';\n    h += '<div class=\"rod\"><span>Âncora Segurança · atendimento@ancoraseguranca.com.br</span><span>Documento emitido em ' + data(Date.now()) + \" \" + hora(Date.now()) + \"</span></div>\";\n    return { titulo: \"OS-\" + c.num + \" · via do cliente\", css: css, corpo: h + \"</div>\" };\n  }\n\n\n  function montar(c, opts) {\n    var p = partes(c, opts);\n    return '<!DOCTYPE html><html lang=\"pt-BR\"><head><meta charset=\"utf-8\"><meta name=\"viewport\" content=\"width=device-width, initial-scale=1\"><title>' + esc(p.titulo) + \"</title><style>\" + p.css + \"</style></head><body>\" + p.corpo + \"</body></html>\";\n  }\n  function nomeArquivo(c) {\n    var cli = String(c.cliente || \"cliente\").replace(/[\\\\/:*?\"<>|]/g, \"\").replace(/\\s+/g, \" \").trim().slice(0, 80);\n    return (\"OS-\" + c.num + \" - \" + cli + \" - via do cliente\").slice(0, 120) + \".pdf\";\n  }\n  function lib(win) {\n    if (win.html2pdf) return Promise.resolve();\n    return new Promise(function (ok, erro) {\n      var s = win.document.createElement(\"script\"); s.src = H2P;\n      s.onload = function () { win.html2pdf ? ok() : erro(new Error(\"gerador de PDF indisponível\")); };\n      s.onerror = function () { erro(new Error(\"não foi possível carregar o gerador de PDF (verifique a internet)\")); };\n      win.document.head.appendChild(s);\n    });\n  }\n  function imagens(doc) {\n    return Promise.all([].slice.call(doc.images).map(function (im) {\n      return im.complete ? 0 : new Promise(function (ok) { im.onload = im.onerror = ok; setTimeout(ok, 8000); });\n    }));\n  }\n  /* Gera e baixa o PDF a partir da folha já desenhada na janela \"win\" */\n  function pdf(win, nome) {\n    var doc = win.document, folha = doc.querySelector(\".folha\");\n    return imagens(doc).then(function () { return lib(win); }).then(function () {\n      /* as opções são criadas dentro da própria janela: o html2pdf recusa listas vindas de outra janela */\n      var o = win.JSON.parse(JSON.stringify({\n        margin: [10, 10, 10, 10], filename: nome,\n        image: { type: \"jpeg\", quality: 0.92 },\n        html2canvas: { scale: 2, useCORS: true, backgroundColor: \"#ffffff\", windowWidth: 820 },\n        jsPDF: { unit: \"mm\", format: \"a4\", orientation: \"portrait\" },\n        pagebreak: { mode: [\"css\", \"legacy\"], avoid: [\"section:not(.quebra)\", \"tr\", \".fotos img\", \".ass\", \".tot\", \".tempo\"] }\n      }));\n      o.html2canvas.onclone = function (d) { d.documentElement.style.background = d.body.style.background = \"#fff\"; var f = d.querySelector(\".folha\"); if (f) f.style.cssText = \"padding:0;margin:0;box-shadow:none;max-width:186mm;border-radius:0;background:#fff\"; };\n      return win.html2pdf().set(o).from(folha).save();\n    });\n  }\n  /* Desenha a via numa janela escondida de largura fixa e baixa o PDF (mesmo layout no celular e no computador) */\n  function baixarPdf(c) {\n    var velho = document.getElementById(\"via-pdf-frame\");\n    if (velho) velho.remove();\n    var fr = document.createElement(\"iframe\");\n    fr.id = \"via-pdf-frame\"; fr.setAttribute(\"aria-hidden\", \"true\"); fr.tabIndex = -1;\n    fr.style.cssText = \"position:fixed;left:-10000px;top:0;width:820px;height:1200px;border:0\";\n    document.body.appendChild(fr);\n    var d = fr.contentWindow.document;\n    d.open(); d.write(montar(c)); d.close();\n    return pdf(fr.contentWindow, nomeArquivo(c)).then(function (r) { setTimeout(function () { fr.remove(); }, 1500); return r; }, function (e) { fr.remove(); throw e; });\n  }\n  /* Página pública: desenha a via com a barra de ações (baixar PDF / imprimir) */\n  function abrirPublica(c) {\n    var p = partes(c, { publico: true });\n    document.title = p.titulo + \" · Âncora Segurança\";\n    var st = document.createElement(\"style\"); st.textContent = p.css; document.head.appendChild(st);\n    document.body.innerHTML = '<div class=\"vbar\" data-html2canvas-ignore=\"true\"><div class=\"t\">Via do cliente · OS ' + esc(c.num) + \"<small>\" + esc(c.cliente || \"\") + '</small></div><button type=\"button\" class=\"y\" id=\"vb-pdf\">Baixar PDF</button><button type=\"button\" id=\"vb-print\">Imprimir</button></div>' + p.corpo;\n    document.getElementById(\"vb-print\").onclick = function () { window.print(); };\n    var bt = document.getElementById(\"vb-pdf\");\n    bt.onclick = function () {\n      bt.disabled = true; bt.textContent = \"Gerando PDF…\";\n      baixarPdf(c).catch(function (e) { alert(\"Não foi possível gerar o PDF: \" + e.message + \". Use o botão Imprimir e escolha “Salvar como PDF”.\"); })\n        .then(function () { bt.disabled = false; bt.textContent = \"Baixar PDF\"; });\n    };\n  }\n  window.sgoVia = { partes: partes, montar: montar, nomeArquivo: nomeArquivo, pdf: pdf, baixarPdf: baixarPdf, abrirPublica: abrirPublica };\n})();\n</script><script>(function(){var u=location.pathname.replace(/\\/$/,\"\")+\"/dados\";fetch(u,{credentials:\"omit\",cache:\"no-store\"}).then(function(r){if(!r.ok)throw 0;return r.json()}).then(function(c){window.sgoVia.abrirPublica(c)}).catch(function(){document.getElementById(\"vc-car\").textContent=\"Esta via não está disponível. Fale com a Âncora Segurança: atendimento@ancoraseguranca.com.br\"})})();</script></body></html>";
var VIA_INDISP = "<!DOCTYPE html><html lang=\"pt-BR\"><head><meta charset=\"utf-8\"><meta name=\"viewport\" content=\"width=device-width, initial-scale=1\"><meta name=\"robots\" content=\"noindex\"><title>Via não disponível · Âncora Segurança</title></head><body style=\"margin:0;font:16px/1.5 system-ui,sans-serif;background:#f3f3ef;color:#141414\"><div style=\"max-width:520px;margin:12vh auto;background:#fff;border-radius:14px;padding:28px;box-shadow:0 0 0 1px #0000000f;border-top:6px solid #FFD200\"><img src=\"/img/logo-ancora.png\" alt=\"Âncora Segurança\" width=\"64\" height=\"64\"><h1 style=\"font-size:20px;margin:12px 0 6px\">Via não disponível</h1><p style=\"margin:0;color:#3d3d3d\">Este link não está mais disponível. Fale com a Âncora Segurança pelo e-mail atendimento@ancoraseguranca.com.br.</p></div></body></html>";

// src/config.js · v27 — Configurações: integrações (chaves cifradas), chaves de acesso à API do SGO e banco de dados
var CFG_CATALOGO = [
  { tipo: "omie", nome: "Omie (ERP)", grupo: "Faturamento", desc: "Enviar a OS executada para faturar, separando produtos e serviços. As consultas continuam sempre no banco do SGO.", docs: "https://developer.omie.com.br/",
    campos: [{ k: "app_key", rot: "App Key", segredo: true }, { k: "app_secret", rot: "App Secret", segredo: true }] },
  { tipo: "moni", nome: "Moni (software de monitoramento)", grupo: "Monitoramento", desc: "Receber comandos e eventos do Moni (abrir OS, ticket, etc.) e, se precisar, consultar o Moni. Para o Moni chamar o SGO, crie uma chave de acesso em “Chaves de acesso à API do SGO”.",
    campos: [{ k: "url", rot: "Endereço do servidor do Moni", ph: "https://..." }, { k: "usuario", rot: "Usuário" }, { k: "senha", rot: "Senha", segredo: true }, { k: "token", rot: "Token da API do Moni", segredo: true }] },
  { tipo: "whatsapp", nome: "WhatsApp Business (API oficial da Meta)", grupo: "Atendimento", desc: "Enviar e receber mensagens pelo número oficial da empresa (agente do site, avisos de OS e da via do cliente).", docs: "https://developers.facebook.com/docs/whatsapp/cloud-api",
    campos: [{ k: "phone_number_id", rot: "Phone Number ID" }, { k: "waba_id", rot: "WhatsApp Business Account ID" }, { k: "token", rot: "Token de acesso permanente", segredo: true }, { k: "verify_token", rot: "Verify token do webhook", segredo: true }] },
  { tipo: "meta-leads", nome: "Meta Lead Ads (Facebook e Instagram)", grupo: "Comercial", desc: "Trazer os leads dos formulários de anúncio direto para Comercial › Leads.", docs: "https://developers.facebook.com/docs/marketing-api/guides/lead-ads",
    campos: [{ k: "app_id", rot: "App ID" }, { k: "page_id", rot: "ID da página" }, { k: "app_secret", rot: "App Secret", segredo: true }, { k: "page_token", rot: "Token da página", segredo: true }, { k: "verify_token", rot: "Verify token do webhook", segredo: true }] },
  { tipo: "email", nome: "E-mail de envio", grupo: "Atendimento", desc: "Enviar e-mails do sistema (via do cliente, propostas, avisos).",
    campos: [{ k: "provedor", rot: "Provedor", ph: "Resend, SendGrid, SMTP…" }, { k: "remetente", rot: "Remetente", ph: "atendimento@ancoraseguranca.com.br" }, { k: "api_key", rot: "Chave da API / senha SMTP", segredo: true }] }
];
var CFG_ESCOPOS = { ping: "Testar a conexão", "os:criar": "Abrir OS", "tickets:criar": "Abrir ticket", "eventos:receber": "Enviar eventos (alarmes, status)", "leads:criar": "Criar lead" };
async function cfgChave(env) {
  if (!env.VOIP_KEY) throw new Error("Chave de criptografia do servidor ausente.");
  const base = await crypto.subtle.importKey("raw", b64(env.VOIP_KEY), "HKDF", false, ["deriveKey"]);
  const te = new TextEncoder();
  return crypto.subtle.deriveKey({ name: "HKDF", hash: "SHA-256", salt: te.encode("sgo-config"), info: te.encode("integracoes-v1") }, base, { name: "AES-GCM", length: 256 }, false, ["encrypt", "decrypt"]);
}
async function cfgCifrar(env, texto) {
  const iv = new Uint8Array(12); crypto.getRandomValues(iv);
  const ct = await crypto.subtle.encrypt({ name: "AES-GCM", iv }, await cfgChave(env), new TextEncoder().encode(texto));
  return voipB64(iv) + "." + voipB64(new Uint8Array(ct));
}
async function cfgDecifrar(env, enc) {
  const [iv, ct] = String(enc || "").split(".");
  return new TextDecoder().decode(await crypto.subtle.decrypt({ name: "AES-GCM", iv: b64(iv) }, await cfgChave(env), b64(ct)));
}
// uso futuro pelas integrações: await cfgSegredo(env, "omie", "app_key")
async function cfgSegredo(env, id, campo) {
  const r = await env.DB.prepare("SELECT segredos FROM integracoes WHERE id = ?").bind(id).first();
  if (!r) return null;
  const s = JSON.parse(r.segredos || "{}");
  return s[campo] ? cfgDecifrar(env, s[campo]) : null;
}
async function cfgSha(t) { return [...new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(t)))].map((b) => b.toString(16).padStart(2, "0")).join(""); }
function cfgTxt(v, n) { return String(v == null ? "" : v).replace(/[\u0000-\u001f]/g, " ").trim().slice(0, n); }
async function cfgAudit(env, u, doc, acao) {
  try { await env.DB.prepare("INSERT INTO auditoria (quando, email, colecao, doc_id, num, acao) VALUES (?,?,?,?,?,?)").bind(Date.now(), u.login, "config", doc, null, String(acao).slice(0, 300)).run(); } catch (e) {}
}
function cfgSaida(r) {
  const dicas = JSON.parse(r.dicas || "{}"), seg = JSON.parse(r.segredos || "{}"), seg2 = {};
  for (const k of new Set([...Object.keys(seg), ...Object.keys(dicas)])) if (seg[k]) seg2[k] = Object.assign({ definido: true }, dicas[k] || {});
  return { id: r.id, nome: r.nome, tipo: r.tipo, ativo: !!r.ativo, config: JSON.parse(r.config || "{}"), campos: JSON.parse(r.campos || "null"), segredos: seg2, obs: r.obs, atualizado_em: r.atualizado_em, atualizado_por: r.atualizado_por };
}

// ---------- banco de dados ----------
var CFG_OCULTAS = { sessoes: "*", usuarios: ["senha_hash", "senha_salt", "senha_iter"], voip_contas: ["senha_enc"], os_via_links: ["token"], integracoes: ["segredos"], api_tokens: ["hash"] };
function cfgOculta(t, col, linha) {
  const o = CFG_OCULTAS[t];
  if (o === "*" || (o && o.includes(col))) return true;
  if ((t === "crm_config" || t === "voip_config") && col === "valor" && linha && /token|segredo|secret|senha|key/i.test(String(linha.chave || ""))) return true;
  return false;
}
function cfgMascarar(t, linha) { const o = {}; for (const k of Object.keys(linha)) o[k] = cfgOculta(t, k, linha) && linha[k] != null && linha[k] !== "" ? "[protegido]" : linha[k]; return o; }
async function cfgTabelas(env) {
  const { results } = await env.DB.prepare("SELECT name, sql FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%' AND name NOT LIKE '_cf_%' AND name NOT LIKE 'd1_%' ORDER BY name").all();
  return results;
}
async function cfgSqlDump(env, tabelas) {
  const q = (v) => v == null ? "NULL" : typeof v === "number" ? String(v) : "'" + String(v).replace(/'/g, "''") + "'";
  let out = "-- SGO Âncora · exportação do banco (SQLite / Cloudflare D1)\n-- Gerado em " + new Date().toISOString() + "\n-- Campos sensíveis (senhas, tokens, chaves) saem como [protegido]; a tabela sessoes não é exportada.\nPRAGMA foreign_keys = OFF;\nBEGIN TRANSACTION;\n";
  for (const t of tabelas) {
    if (CFG_OCULTAS[t.name] === "*") continue;
    out += "\n-- Tabela " + t.name + "\n" + t.sql + ";\n";
    const { results } = await env.DB.prepare('SELECT * FROM "' + t.name + '"').all();
    for (const r of results) { const m = cfgMascarar(t.name, r), ks = Object.keys(m); out += 'INSERT INTO "' + t.name + '" (' + ks.map((k) => '"' + k + '"').join(", ") + ") VALUES (" + ks.map((k) => q(m[k])).join(", ") + ");\n"; }
  }
  const nomes = tabelas.filter((t) => CFG_OCULTAS[t.name] !== "*").map((t) => t.name);
  const { results: idx } = await env.DB.prepare("SELECT tbl_name, sql FROM sqlite_master WHERE type = 'index' AND sql IS NOT NULL AND name NOT LIKE 'sqlite_%'").all();
  out += "\n-- Índices\n" + idx.filter((i) => nomes.includes(i.tbl_name)).map((i) => i.sql + ";").join("\n") + "\nCOMMIT;\n";
  return out;
}
function cfgCsv(linhas) {
  if (!linhas.length) return "﻿";
  const ks = Object.keys(linhas[0]);
  const c = (v) => { v = v == null ? "" : String(v); return /[;"\n\r]/.test(v) ? '"' + v.replace(/"/g, '""') + '"' : v; };
  return "﻿" + [ks.join(";")].concat(linhas.map((r) => ks.map((k) => c(r[k])).join(";"))).join("\r\n");
}

// ---------- rotas /api/config/... (somente administradores) ----------
async function configRotas(request, env, url, u) {
  if (!ehAdmin(u)) return json({ erro: "Configurações: disponível só para administradores." }, 403);
  const c = url.pathname, m = request.method, quem = String(u.nome || u.login);
  if (c === "/api/config/integracoes" && m === "GET") {
    const { results } = await env.DB.prepare("SELECT * FROM integracoes ORDER BY nome").all();
    const { results: tk } = await env.DB.prepare("SELECT id, nome, integracao, prefixo, escopos, ativo, criado_em, criado_por, ultimo_uso, ultimo_ip, revogado_em, revogado_por FROM api_tokens ORDER BY criado_em DESC").all();
    return json({ catalogo: CFG_CATALOGO, escopos: CFG_ESCOPOS, itens: results.map(cfgSaida), tokens: tk.map((t) => Object.assign(t, { escopos: JSON.parse(t.escopos || "[]"), ativo: !!t.ativo })), base: url.origin, cripto: !!env.VOIP_KEY });
  }
  const im = c.match(/^\/api\/config\/integracoes\/([a-z0-9-]{2,40})$/);
  if (im && (m === "PUT" || m === "DELETE")) {
    const id = im[1], cat = CFG_CATALOGO.find((x) => x.tipo === id), atual = await env.DB.prepare("SELECT * FROM integracoes WHERE id = ?").bind(id).first();
    if (m === "DELETE") {
      if (!atual) return json({ ok: true });
      await env.DB.prepare("DELETE FROM integracoes WHERE id = ?").bind(id).run();
      await cfgAudit(env, u, id, "Integração " + atual.nome + (cat ? " zerada (chaves apagadas)" : " excluída"));
      return json({ ok: true });
    }
    if (!cat && !id.startsWith("outra-")) return json({ erro: "Integração desconhecida." }, 404);
    let b = {}; try { b = await request.json(); } catch {}
    const campos = cat ? cat.campos : (Array.isArray(b.campos) ? b.campos : []).slice(0, 15).map((f) => ({ k: cfgTxt(f.k, 40).toLowerCase().replace(/[^a-z0-9_]/g, "_"), rot: cfgTxt(f.rot, 60), segredo: !!f.segredo })).filter((f) => f.k && f.rot);
    const nome = cat ? cat.nome : cfgTxt(b.nome, 80);
    if (!nome) return json({ erro: "Dê um nome para a integração." }, 400);
    const config = {}, seg = atual ? JSON.parse(atual.segredos || "{}") : {}, dicas = atual ? JSON.parse(atual.dicas || "{}") : {}, mud = [];
    for (const f of campos) {
      if (f.segredo) {
        const v = b.segredos ? b.segredos[f.k] : void 0;
        if (v === null) { if (seg[f.k]) mud.push(f.rot + " apagada"); delete seg[f.k]; delete dicas[f.k]; }
        else if (typeof v === "string" && v.trim()) { const t = v.trim().slice(0, 4000); seg[f.k] = await cfgCifrar(env, t); dicas[f.k] = { fim: t.length > 8 ? t.slice(-4) : "", tam: t.length, em: Date.now(), por: quem }; mud.push(f.rot + " " + (atual && JSON.parse(atual.segredos || "{}")[f.k] ? "trocada" : "definida")); }
      } else config[f.k] = cfgTxt(b.config && b.config[f.k], 300);
    }
    for (const k of Object.keys(seg)) if (!campos.some((f) => f.k === k && f.segredo)) { delete seg[k]; delete dicas[k]; }
    const agora = Date.now();
    await env.DB.prepare("INSERT INTO integracoes (id, nome, tipo, ativo, config, segredos, dicas, campos, obs, atualizado_em, atualizado_por) VALUES (?,?,?,?,?,?,?,?,?,?,?) ON CONFLICT(id) DO UPDATE SET nome = excluded.nome, ativo = excluded.ativo, config = excluded.config, segredos = excluded.segredos, dicas = excluded.dicas, campos = excluded.campos, obs = excluded.obs, atualizado_em = excluded.atualizado_em, atualizado_por = excluded.atualizado_por")
      .bind(id, nome, cat ? cat.tipo : "outra", b.ativo ? 1 : 0, JSON.stringify(config), JSON.stringify(seg), JSON.stringify(dicas), cat ? null : JSON.stringify(campos), cfgTxt(b.obs, 500) || null, agora, quem).run();
    await cfgAudit(env, u, id, "Integração " + nome + " salva" + (b.ativo ? " (ativa)" : " (inativa)") + (mud.length ? ": " + mud.join(", ") : ""));
    const r = await env.DB.prepare("SELECT * FROM integracoes WHERE id = ?").bind(id).first();
    return json({ ok: true, item: cfgSaida(r) });
  }
  if (c === "/api/config/tokens" && m === "POST") {
    let b = {}; try { b = await request.json(); } catch {}
    const nome = cfgTxt(b.nome, 80);
    if (!nome) return json({ erro: "Dê um nome para a chave (ex.: Moni da central)." }, 400);
    const esc = (Array.isArray(b.escopos) ? b.escopos : []).filter((e) => CFG_ESCOPOS[e]);
    if (!esc.includes("ping")) esc.unshift("ping");
    const al = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789", rnd = new Uint8Array(40); crypto.getRandomValues(rnd);
    const token = "sgo_" + [...rnd].map((x) => al[x % al.length]).join(""), id = "tk-" + aleatorio(6);
    await env.DB.prepare("INSERT INTO api_tokens (id, nome, integracao, prefixo, hash, escopos, ativo, criado_em, criado_por) VALUES (?,?,?,?,?,?,1,?,?)")
      .bind(id, nome, cfgTxt(b.integracao, 40) || null, token.slice(0, 10), await cfgSha(token), JSON.stringify(esc), Date.now(), quem).run();
    await cfgAudit(env, u, id, "Chave de acesso criada: " + nome + " (" + esc.join(", ") + ")");
    return json({ ok: true, id, token });
  }
  const tm = c.match(/^\/api\/config\/tokens\/(tk-[a-z0-9]{6,32})\/revogar$/);
  if (tm && m === "POST") {
    const r = await env.DB.prepare("UPDATE api_tokens SET ativo = 0, revogado_em = ?, revogado_por = ? WHERE id = ? AND ativo = 1").bind(Date.now(), quem, tm[1]).run();
    if (!r.meta.changes) return json({ erro: "Chave não encontrada ou já revogada." }, 404);
    await cfgAudit(env, u, tm[1], "Chave de acesso revogada");
    return json({ ok: true });
  }
  // banco de dados
  if (c === "/api/config/banco" && m === "GET") {
    const tabs = await cfgTabelas(env), out = [];
    for (const t of tabs) {
      const n = await env.DB.prepare('SELECT COUNT(*) AS n FROM "' + t.name + '"').first();
      const { results: cols } = await env.DB.prepare("SELECT name, type, pk, \"notnull\", dflt_value FROM pragma_table_info(?)").bind(t.name).all();
      const { results: idx } = await env.DB.prepare("SELECT name, sql FROM sqlite_master WHERE type = 'index' AND tbl_name = ? AND sql IS NOT NULL").bind(t.name).all();
      out.push({ nome: t.name, linhas: n.n, sql: t.sql, colunas: cols.map((x) => ({ nome: x.name, tipo: x.type, pk: !!x.pk, obrigatorio: !!x.notnull, padrao: x.dflt_value, protegido: cfgOculta(t.name, x.name, null) || (CFG_OCULTAS[t.name] === "*") })), indices: idx, exporta: CFG_OCULTAS[t.name] !== "*" });
    }
    const sm = await env.DB.prepare("SELECT versao, descricao, aplicada_em FROM schema_migracoes ORDER BY versao").all();
    let r2 = null;
    if (env.FOTOS) {
      try { const l = await env.FOTOS.list({ delimiter: "/", limit: 1000 }); r2 = { prefixos: l.delimitedPrefixes || [], soltos: l.objects.length }; } catch (e) { r2 = { erro: true }; }
    }
    return json({
      infra: (() => { const ev = (globalThis.process && globalThis.process.env) || {}; return { banco: "PostgreSQL", nome: ev.PGDATABASE || "—", id: (ev.PGHOST || "?") + ":" + (ev.PGPORT || "5432"), binding: "schema sgo", arquivos: "Pasta de arquivos", bucket: ev.SGO_ARQUIVOS_DIR || "data/arquivos", bucket_binding: "FOTOS", worker: "TanStack Start", dominio: url.hostname }; })(),
      migracoes: sm.results, tabelas: out, r2
    });
  }
  const bt = c.match(/^\/api\/config\/banco\/tabela\/([a-z0-9_]{1,60})$/);
  if (bt && m === "GET") {
    const tabs = await cfgTabelas(env), t = tabs.find((x) => x.name === bt[1]);
    if (!t) return json({ erro: "Tabela não encontrada." }, 404);
    if (CFG_OCULTAS[t.name] === "*") return json({ erro: "Esta tabela guarda sessões de login e não é exibida." }, 403);
    const lim = Math.min(200, Math.max(10, parseInt(url.searchParams.get("limite"), 10) || 50)), pag = Math.max(0, parseInt(url.searchParams.get("pagina"), 10) || 0);
    const n = await env.DB.prepare('SELECT COUNT(*) AS n FROM "' + t.name + '"').first();
    const { results } = await env.DB.prepare('SELECT * FROM "' + t.name + '" LIMIT ? OFFSET ?').bind(lim, pag * lim).all();
    return json({ tabela: t.name, total: n.n, pagina: pag, limite: lim, linhas: results.map((r) => cfgMascarar(t.name, r)) });
  }
  if (c === "/api/config/banco/exportar" && m === "GET") {
    const tabs = await cfgTabelas(env), nomeT = url.searchParams.get("tabela") || "*", fmt = url.searchParams.get("formato") || "sql";
    const dia = new Date(Date.now() - 3 * 36e5).toISOString().slice(0, 10);
    let corpo, tipo, arq;
    if (nomeT === "*") {
      if (fmt === "json") {
        const tudo = {};
        for (const t of tabs) if (CFG_OCULTAS[t.name] !== "*") tudo[t.name] = (await env.DB.prepare('SELECT * FROM "' + t.name + '"').all()).results.map((r) => cfgMascarar(t.name, r));
        corpo = JSON.stringify({ sistema: "SGO Âncora", gerado_em: new Date().toISOString(), tabelas: tudo }); tipo = "application/json"; arq = "sgo-banco-" + dia + ".json";
      } else { corpo = await cfgSqlDump(env, tabs); tipo = "application/sql"; arq = "sgo-banco-" + dia + ".sql"; }
    } else {
      const t = tabs.find((x) => x.name === nomeT);
      if (!t || CFG_OCULTAS[t.name] === "*") return json({ erro: "Tabela não disponível para exportação." }, 404);
      const linhas = (await env.DB.prepare('SELECT * FROM "' + t.name + '"').all()).results.map((r) => cfgMascarar(t.name, r));
      if (fmt === "csv") { corpo = cfgCsv(linhas); tipo = "text/csv"; arq = t.name + "-" + dia + ".csv"; }
      else if (fmt === "json") { corpo = JSON.stringify(linhas); tipo = "application/json"; arq = t.name + "-" + dia + ".json"; }
      else { corpo = await cfgSqlDump(env, [t]); tipo = "application/sql"; arq = t.name + "-" + dia + ".sql"; }
    }
    await cfgAudit(env, u, "banco", "Exportação do banco: " + (nomeT === "*" ? "todas as tabelas" : nomeT) + " (" + fmt + ")");
    return new Response(corpo, { headers: { "content-type": tipo + "; charset=utf-8", "content-disposition": 'attachment; filename="' + arq + '"', "cache-control": "no-store" } });
  }
  return json({ erro: "Não encontrado" }, 404);
}

// ---------- API externa do SGO (/api/externo/...) — chamada por outros sistemas com chave de acesso ----------
async function externoRotas(request, env, url) {
  const h = request.headers.get("authorization") || "", tok = (h.match(/^Bearer\s+(\S+)$/i) || [])[1] || request.headers.get("x-api-key") || "";
  const cors = { "access-control-allow-origin": "*", "access-control-allow-headers": "authorization, content-type, x-api-key", "access-control-allow-methods": "GET, POST, OPTIONS" };
  if (request.method === "OPTIONS") return new Response(null, { status: 204, headers: cors });
  if (!/^sgo_[A-Za-z0-9]{40}$/.test(tok)) return json({ erro: "Chave de acesso ausente ou inválida. Envie no cabeçalho Authorization: Bearer <chave>." }, 401, cors);
  const t = await env.DB.prepare("SELECT * FROM api_tokens WHERE hash = ? AND ativo = 1").bind(await cfgSha(tok)).first();
  if (!t) return json({ erro: "Chave de acesso inválida ou revogada." }, 401, cors);
  const esc = JSON.parse(t.escopos || "[]"), agora = Date.now();
  if (!t.ultimo_uso || agora - t.ultimo_uso > 6e4) { try { await env.DB.prepare("UPDATE api_tokens SET ultimo_uso = ?, ultimo_ip = ? WHERE id = ?").bind(agora, request.headers.get("cf-connecting-ip") || null, t.id).run(); } catch (e) {} }
  if (url.pathname === "/api/externo/ping") return json({ ok: true, sistema: "SGO Âncora", chave: t.nome, integracao: t.integracao, escopos: esc, hora: new Date(agora).toISOString() }, 200, cors);
  return json({ erro: "Comando ainda não disponível nesta versão do SGO.", disponiveis: ["GET /api/externo/ping"] }, 404, cors);
}
async function verFoto(env, caminho) {
  const m = caminho.match(FOTO);
  if (!m || !env.FOTOS) return json({ erro: "N\xE3o encontrado" }, 404);
  const obj = await env.FOTOS.get("os/" + m[1] + "/" + m[2] + ".jpg");
  if (!obj) return json({ erro: "Foto n\xE3o encontrada" }, 404);
  return new Response(obj.body, { headers: { "content-type": "image/jpeg", "cache-control": "private, max-age=86400", "x-content-type-options": "nosniff" } });
}
async function tecnicoFrota(request, env, url, u) {
  const c = url.pathname, m = request.method;
  if (c === "/api/tecnico/frota" && m === "GET") {
    const { results } = await env.DB.prepare(
      `SELECT v.id, v.name, v.plate, v.brand, v.model, v.current_odometer
         FROM usuario_veiculos uv
         JOIN fleet_vehicles v ON v.id = uv.vehicle_id
        WHERE uv.usuario_id = ?
        ORDER BY v.name COLLATE NOCASE`
    ).bind(u.id).all();
    return json({ ok: true, veiculos: results || [] });
  }
  if (c === "/api/tecnico/frota/km" && m === "POST") {
    let b = {};
    try { b = await lerJson(request, 4e3); } catch { return json({ erro: "Dados inválidos" }, 400); }
    const vehicleId = parseInt(b.vehicleId, 10);
    const odometer = Number(String(b.odometer ?? "").replace(",", "."));
    const reason = txt(b.reason || b.usageReason || "Uso assistência", 200);
    if (!(vehicleId > 0) || !(odometer >= 0)) return json({ erro: "Informe o veículo e o KM." }, 400);
    const dono = await env.DB.prepare("SELECT 1 AS ok FROM usuario_veiculos WHERE usuario_id = ? AND vehicle_id = ?").bind(u.id, vehicleId).first();
    if (!dono) return json({ erro: "Este veículo não está vinculado a você." }, 403);
    const atual = await env.DB.prepare("SELECT current_odometer FROM fleet_vehicles WHERE id = ?").bind(vehicleId).first();
    if (!atual) return json({ erro: "Veículo não encontrado." }, 404);
    const prev = Number(atual.current_odometer || 0);
    if (odometer + 0.05 < prev) return json({ erro: "O KM não pode ser menor que o atual do veículo (" + prev + ")." }, 400);
    const agora = new Date().toISOString();
    await env.DB.prepare(
      `INSERT INTO fleet_readings (vehicle_id, occurred_at, odometer, previous_odometer, kind, reason, profile, opened_at, odometer_open, usage_reason, notes)
       VALUES (?,?,?,?,?,?,?,?,?,?,?)`
    ).bind(vehicleId, agora, odometer, prev, "daily_km", reason, "assistencia", agora, odometer, reason, txt(b.notes, 300) || null).run();
    await env.DB.prepare("UPDATE fleet_vehicles SET current_odometer = ? WHERE id = ?").bind(odometer, vehicleId).run();
    return json({ ok: true });
  }
  return null;
}
async function rotaTecnico(request, env, url, u) {
  const caminho = url.pathname;
  if (u.perfil !== "tecnico") return json({ erro: "Dispon\xEDvel s\xF3 para o perfil T\xE9cnico." }, 403);
  const frota = await tecnicoFrota(request, env, url, u);
  if (frota) return frota;
  if (caminho === "/api/tecnico/os" && request.method === "GET") {
    return json({ docs: await listar(env, u), agora: Date.now(), eu: { id: u.id, nome: u.nome, equipe: u.equipe } });
  }
  if (caminho === "/api/tecnico/acoes" && request.method === "POST") {
    let d;
    try {
      d = await lerJson(request, 2e5);
    } catch {
      return json({ erro: "Dados inv\xE1lidos" }, 400);
    }
    const lista = Array.isArray(d.acoes) ? d.acoes.slice(0, 50) : [];
    const resultados = [];
    for (const a of lista) {
      const r = await aplicar(env, u, a);
      resultados.push(r);
      if (r.status === "erro") break;
    }
    return json({ resultados });
  }
  const f = caminho.match(FOTO);
  if (f && request.method === "PUT") return enviarFoto(request, env, u, f[1], f[2]);
  if (f && request.method === "GET") return verFoto(env, caminho);
  return json({ erro: "N\xE3o encontrado" }, 404);
}

// src/voip.js — softphone (WebRTC) integrado ao SGO
var VOIP_ARQS = { "ancora-softphone.html": "text/html; charset=utf-8", "ancora-phone-widget.js": "application/javascript; charset=utf-8" };
var VOIP_CFG_PADRAO = { wss: "wss://192.168.10.80:8089/ws", domain: "192.168.10.80", ice: "[]", dtmf: "RFC2833", expires: "300", contact_transport: "", contatos_padrao: "" };
var voipAdmin = (u) => ehAdmin(u) || u.permissoes.includes("voip");
function voipB64(u8) { let s = ""; for (let i = 0; i < u8.length; i++) s += String.fromCharCode(u8[i]); return btoa(s); }
async function voipChave(env) {
  if (!env.VOIP_KEY) throw new Error("VOIP_KEY ausente");
  return crypto.subtle.importKey("raw", b64(env.VOIP_KEY), "AES-GCM", false, ["encrypt", "decrypt"]);
}
async function voipCifrar(env, texto) {
  const iv = new Uint8Array(12); crypto.getRandomValues(iv);
  const ct = await crypto.subtle.encrypt({ name: "AES-GCM", iv }, await voipChave(env), new TextEncoder().encode(texto));
  return voipB64(iv) + "." + voipB64(new Uint8Array(ct));
}
async function voipDecifrar(env, enc) {
  const [iv, ct] = String(enc || "").split(".");
  const pt = await crypto.subtle.decrypt({ name: "AES-GCM", iv: b64(iv) }, await voipChave(env), b64(ct));
  return new TextDecoder().decode(pt);
}
async function voipConfig(env) {
  const { results } = await env.DB.prepare("SELECT chave, valor FROM voip_config").all();
  const c = Object.assign({}, VOIP_CFG_PADRAO);
  for (const r of results) c[r.chave] = r.valor;
  return c;
}
function voipLista(texto) {
  // "ramal;nome" por linha (aceita também "ramal - nome" ou "ramal,nome")
  return String(texto || "").split(/\r?\n/).map((l) => l.trim()).filter(Boolean).slice(0, 200).map((l) => {
    const m = l.match(/^([0-9*#+]{1,20})\s*[;,\-\t]\s*(.*)$/) || l.match(/^([0-9*#+]{1,20})$/);
    return m ? { num: m[1], name: String(m[2] || "").trim().slice(0, 60) || m[1] } : null;
  }).filter(Boolean);
}
function voipIce(texto) {
  const t = String(texto || "").trim();
  if (!t) return [];
  if (t[0] === "[") { const a = JSON.parse(t); if (!Array.isArray(a)) throw new Error("ice"); return a.slice(0, 10); }
  return t.split(/[\s,]+/).filter(Boolean).slice(0, 10).map((u) => ({ urls: u }));
}
async function voipSoftphoneInfo(env) {
  if (!env.FOTOS) return null;
  const o = await env.FOTOS.head("softphone/ancora-softphone.html");
  return o ? { tamanho: o.size, enviado: o.uploaded ? o.uploaded.getTime() : null, por: o.customMetadata && o.customMetadata.usuario || null } : null;
}
async function voipServirArquivo(request, env, nome) {
  const tipo = VOIP_ARQS[nome];
  if (!tipo) return new Response("N\xE3o encontrado", { status: 404, headers: SEG });
  const obj = env.FOTOS ? await env.FOTOS.get("softphone/" + nome) : null;
  const h = { "content-type": tipo, "cache-control": "no-cache", ...SEG };
  if (obj) {
    h.etag = obj.httpEtag;
    if (request.headers.get("if-none-match") === obj.httpEtag) return new Response(null, { status: 304, headers: h });
    return new Response(obj.body, { headers: h });
  }
  const emb = ARQUIVOS["/softphone/" + nome];
  if (emb) return new Response(emb.d, { headers: h });
  return new Response("Softphone ainda n\xE3o enviado ao SGO.", { status: 404, headers: { "content-type": "text/plain; charset=utf-8", ...SEG } });
}
async function voipMe(env, u) {
  const c = await env.DB.prepare("SELECT * FROM voip_contas WHERE usuario_id = ? AND ativo = 1").bind(u.id).first();
  if (!c) return json({ enabled: false }, 404);
  const cfg = await voipConfig(env);
  let senha;
  try { senha = await voipDecifrar(env, c.senha_enc); } catch (e) {
    return json({ enabled: false, erro: "A senha SIP deste ramal precisa ser cadastrada de novo na tela Ramais VoIP." }, 500);
  }
  let contatos = [];
  try { contatos = JSON.parse(c.ramais || "[]"); } catch {}
  if (!contatos.length) contatos = voipLista(cfg.contatos_padrao);
  let ice = [];
  try { ice = voipIce(cfg.ice); } catch {}
  const r = {
    enabled: true, wss: cfg.wss, domain: cfg.domain, ext: c.ramal, password: senha, authUser: c.auth_user || c.ramal,
    display: c.nome_exibicao || u.nome, contacts: contatos, iceServers: ice, dtmf: cfg.dtmf || "RFC2833", expires: parseInt(cfg.expires, 10) || 300
  };
  if (cfg.contact_transport) r.contactTransport = cfg.contact_transport;
  return json(r);
}
async function voipAdminGet(env) {
  const [contas, usuarios] = await env.DB.batch([
    env.DB.prepare(`SELECT v.usuario_id, v.ativo, v.ramal, v.auth_user, v.nome_exibicao, v.ramais, v.atualizado_em, v.atualizado_por,
                           v.senha_enc IS NOT NULL AS tem_senha, u.nome, u.login, u.ativo AS usuario_ativo
                      FROM voip_contas v JOIN usuarios u ON u.id = v.usuario_id ORDER BY CAST(v.ramal AS INTEGER), v.ramal`),
    env.DB.prepare("SELECT id, nome, login FROM usuarios WHERE ativo = 1 AND perfil <> 'tecnico' ORDER BY nome COLLATE NOCASE")
  ]);
  const cfg = await voipConfig(env);
  return json({
    config: cfg,
    contas: contas.results.map((c) => {
      let l = []; try { l = JSON.parse(c.ramais || "[]"); } catch {}
      return { ...c, ativo: !!c.ativo, usuario_ativo: !!c.usuario_ativo, tem_senha: !!c.tem_senha, ramais: l.map((x) => x.num + ";" + x.name).join("\n") };
    }),
    usuarios: usuarios.results,
    softphone: await voipSoftphoneInfo(env),
    chave: !!env.VOIP_KEY
  });
}
async function voipRotas(request, env, url, u) {
  const p = url.pathname, m = request.method;
  if (p === "/api/voip/me" && m === "GET") return voipMe(env, u);
  if (p === "/api/voip/status" && m === "GET") {
    const c = await env.DB.prepare("SELECT ramal FROM voip_contas WHERE usuario_id = ? AND ativo = 1").bind(u.id).first();
    const sp = c ? await voipSoftphoneInfo(env) : null;
    return json({ enabled: !!c, ramal: c ? c.ramal : null, softphone: !!sp, versao: sp ? sp.enviado : null });
  }
  if (!voipAdmin(u)) return json({ erro: "Sem permiss\xE3o para esta \xE1rea." }, 403);
  if (p === "/api/voip/admin" && m === "GET") return voipAdminGet(env);
  if (p === "/api/voip/admin/config" && m === "PUT") {
    let d; try { d = await lerJson(request, 2e4); } catch { return json({ erro: "Dados inv\xE1lidos" }, 400); }
    const v = {
      wss: String(d.wss || "").trim(), domain: String(d.domain || "").trim(), ice: String(d.ice || "").trim(),
      dtmf: d.dtmf === "INFO" ? "INFO" : "RFC2833", expires: String(Math.min(3600, Math.max(60, parseInt(d.expires, 10) || 300))),
      contact_transport: ["", "ws", "wss"].includes(d.contact_transport) ? d.contact_transport : "", contatos_padrao: String(d.contatos_padrao || "").slice(0, 8e3)
    };
    if (!/^wss?:\/\/[^\s]{3,200}$/i.test(v.wss)) return json({ erro: "Endere\xE7o WSS inv\xE1lido (ex.: wss://192.168.10.80:8089/ws)." }, 400);
    if (!/^[A-Za-z0-9.-]{1,120}$/.test(v.domain)) return json({ erro: "Dom\xEDnio SIP inv\xE1lido (ex.: 192.168.10.80)." }, 400);
    try { voipIce(v.ice); } catch { return json({ erro: "Servidores STUN/TURN: use uma URL por linha (stun:host:3478) ou JSON." }, 400); }
    v.contatos_padrao = voipLista(v.contatos_padrao).map((x) => x.num + ";" + x.name).join("\n");
    await env.DB.batch(Object.entries(v).map(([k, val]) => env.DB.prepare("INSERT INTO voip_config (chave, valor) VALUES (?, ?) ON CONFLICT(chave) DO UPDATE SET valor = excluded.valor").bind(k, val)));
    await env.DB.prepare("INSERT INTO auditoria (quando, email, colecao, doc_id, num, acao) VALUES (?,?,?,?,?,?)").bind(Date.now(), u.login, "voip", "config", null, "Servidor VoIP alterado").run();
    return json({ ok: true });
  }
  const mc = p.match(/^\/api\/voip\/admin\/conta\/(\d+)$/);
  if (mc) {
    const uid = parseInt(mc[1], 10);
    const alvo = await env.DB.prepare("SELECT id, nome, perfil FROM usuarios WHERE id = ?").bind(uid).first();
    if (!alvo) return json({ erro: "Usu\xE1rio n\xE3o encontrado." }, 404);
    const atual = await env.DB.prepare("SELECT ramal, senha_enc FROM voip_contas WHERE usuario_id = ?").bind(uid).first();
    if (m === "DELETE") {
      await env.DB.prepare("DELETE FROM voip_contas WHERE usuario_id = ?").bind(uid).run();
      await env.DB.prepare("INSERT INTO auditoria (quando, email, colecao, doc_id, num, acao) VALUES (?,?,?,?,?,?)").bind(Date.now(), u.login, "voip", String(uid), atual ? atual.ramal : null, "VoIP removido de " + alvo.nome).run();
      return json({ ok: true });
    }
    if (m !== "PUT") return json({ erro: "M\xE9todo n\xE3o permitido" }, 405);
    if (alvo.perfil === "tecnico") return json({ erro: "T\xE9cnicos usam o App do T\xE9cnico e n\xE3o recebem ramal VoIP." }, 400);
    let d; try { d = await lerJson(request, 2e4); } catch { return json({ erro: "Dados inv\xE1lidos" }, 400); }
    const ramal = String(d.ramal || "").trim(), auth = String(d.auth_user || "").trim(), senha = String(d.senha || "");
    const nomeEx = String(d.nome_exibicao || "").trim().slice(0, 60), ativo = d.ativo === false ? 0 : 1;
    if (!/^[0-9]{2,10}$/.test(ramal)) return json({ erro: "Ramal: s\xF3 n\xFAmeros (2 a 10 d\xEDgitos)." }, 400);
    if (auth && !/^[A-Za-z0-9._@-]{1,60}$/.test(auth)) return json({ erro: "Usu\xE1rio de autentica\xE7\xE3o inv\xE1lido." }, 400);
    if (!senha && !(atual && atual.senha_enc)) return json({ erro: "Informe a senha SIP (secret) do ramal no Issabel." }, 400);
    if (senha.length > 128) return json({ erro: "Senha SIP longa demais." }, 400);
    const dup = await env.DB.prepare("SELECT u.nome FROM voip_contas v JOIN usuarios u ON u.id = v.usuario_id WHERE v.ramal = ? AND v.usuario_id <> ?").bind(ramal, uid).first();
    if (dup) return json({ erro: `O ramal ${ramal} j\xE1 est\xE1 com ${dup.nome}.` }, 400);
    let enc = atual ? atual.senha_enc : null;
    if (senha) { try { enc = await voipCifrar(env, senha); } catch { return json({ erro: "Chave de criptografia do VoIP n\xE3o configurada no servidor." }, 500); } }
    const lista = JSON.stringify(voipLista(d.ramais));
    await env.DB.prepare(`INSERT INTO voip_contas (usuario_id, ativo, ramal, auth_user, senha_enc, nome_exibicao, ramais, atualizado_em, atualizado_por)
                          VALUES (?,?,?,?,?,?,?,datetime('now'),?)
                          ON CONFLICT(usuario_id) DO UPDATE SET ativo = excluded.ativo, ramal = excluded.ramal, auth_user = excluded.auth_user,
                            senha_enc = excluded.senha_enc, nome_exibicao = excluded.nome_exibicao, ramais = excluded.ramais,
                            atualizado_em = excluded.atualizado_em, atualizado_por = excluded.atualizado_por`)
      .bind(uid, ativo, ramal, auth || null, enc, nomeEx || null, lista, u.login).run();
    await env.DB.prepare("INSERT INTO auditoria (quando, email, colecao, doc_id, num, acao) VALUES (?,?,?,?,?,?)").bind(Date.now(), u.login, "voip", String(uid), ramal, (atual ? "VoIP alterado: " : "VoIP habilitado: ") + alvo.nome + " \xB7 ramal " + ramal + (senha ? " \xB7 senha SIP definida" : "")).run();
    return json({ ok: true });
  }
  const ma = p.match(/^\/api\/voip\/softphone\/([a-z0-9.-]+)$/);
  if (ma && m === "PUT") {
    const nome = ma[1];
    if (!VOIP_ARQS[nome]) return json({ erro: "Envie o arquivo ancora-softphone.html (ou ancora-phone-widget.js)." }, 400);
    if (!env.FOTOS) return json({ erro: "Armazenamento (R2) indispon\xEDvel." }, 503);
    const corpo = await request.arrayBuffer();
    if (!corpo.byteLength || corpo.byteLength > 3 * 1024 * 1024) return json({ erro: "Arquivo vazio ou maior que 3 MB." }, 400);
    const t = new TextDecoder().decode(corpo);
    if (nome.endsWith(".html") && !(/^\s*<!doctype html/i.test(t) && t.includes("JsSIP") && t.includes("AncoraPhone"))) return json({ erro: "Este n\xE3o parece ser o ancora-softphone.html gerado pelo build (arquivo \xFAnico com o JsSIP)." }, 400);
    if (nome.endsWith(".js") && !t.includes("AncoraPhoneWidget")) return json({ erro: "Este n\xE3o parece ser o ancora-phone-widget.js." }, 400);
    await env.FOTOS.put("softphone/" + nome, corpo, { httpMetadata: { contentType: VOIP_ARQS[nome] }, customMetadata: { usuario: u.login, enviado: String(Date.now()) } });
    await env.DB.prepare("INSERT INTO auditoria (quando, email, colecao, doc_id, num, acao) VALUES (?,?,?,?,?,?)").bind(Date.now(), u.login, "voip", nome, null, "Arquivo do softphone enviado (" + Math.round(corpo.byteLength / 1024) + " KB)").run();
    return json({ ok: true, tamanho: corpo.byteLength });
  }
  return json({ erro: "N\xE3o encontrado" }, 404);
}

// src/crm.js — CRM Comercial (oportunidades, integração com o Quadro de OS, comissões)
var CRM_PERM = { crm: "com-crm", rel: "com-crm-rel", com: "com-comissoes" };
var crmPode = (u, k) => ehAdmin(u) || u.permissoes.includes(CRM_PERM[k]);
var CRM_ETAPAS = ["montar", "montado", "enviado", "acao2", "acao3", "aprovado", "final"];
var CRM_CONTRATOS_PADRAO = [
  { id: "portaria", nome: "Portaria remota", modo: "mensal", venda: 3, equipe: 2 }, { id: "hibrida", nome: "Portaria híbrida", modo: "mensal", venda: 3, equipe: 2 },
  { id: "acesso", nome: "Controle de acesso", modo: "mensal", venda: 3, equipe: 2 }, { id: "monit", nome: "Monitoramento 24 horas", modo: "primeira", venda: 80, equipe: 20 },
  { id: "comodato", nome: "Comodato de equipamentos", modo: "primeira", venda: 80, equipe: 20 }, { id: "comodmonit", nome: "Comodato + monitoramento", modo: "primeira", venda: 80, equipe: 20 },
  { id: "rastreio", nome: "Rastreamento", modo: "primeira", venda: 80, equipe: 20 }];
var CRM_CONTRATO_POR_SERVICO = { "Portaria remota": "portaria", "Portaria híbrida": "hibrida", "Controle de acesso": "acesso", "Alarme monitorado": "monit" };
var CRM_REGRAS_PADRAO = { execucao: { venda: 3, equipe: 2 }, recorrente: { implantacao: false, inicio: 0 }, contratos: CRM_CONTRATOS_PADRAO, pesos: { auxiliar: 1, apoio: 1 } };
var crmHoje = () => isoDia(Date.now());
async function crmProxCod(env) {
  const r = await env.DB.prepare("SELECT MAX(CAST(substr(cod, 4) AS INTEGER)) AS n FROM crm_oportunidades").first();
  return "OP-" + String((r && r.n || 0) + 1).padStart(5, "0");
}
async function crmRegras(env) {
  const r = await env.DB.prepare("SELECT valor FROM crm_config WHERE chave = 'regras_comissao'").first();
  let R;
  try { R = r ? JSON.parse(r.valor) : CRM_REGRAS_PADRAO; } catch { R = CRM_REGRAS_PADRAO; }
  try { R = await crmRegrasComServicos(env, R); } catch (e) {}
  return R;
}
async function crmPessoas(env) {
  const [v, t] = await env.DB.batch([
    env.DB.prepare("SELECT id, nome FROM usuarios WHERE ativo = 1 AND vendedor = 1 ORDER BY nome COLLATE NOCASE"),
    env.DB.prepare("SELECT id, nome, equipe FROM usuarios WHERE ativo = 1 AND perfil = 'tecnico' ORDER BY nome COLLATE NOCASE")
  ]);
  return { vendedores: v.results, tecnicos: t.results };
}
async function crmInserir(env, op, quem) {
  const agora = Date.now();
  for (let tentativa = 0; tentativa < 3; tentativa++) {
    op.cod = await crmProxCod(env);
    try {
      await env.DB.batch([
        env.DB.prepare("INSERT INTO crm_oportunidades (id, cod, os_id, etapa, dados, versao, criado_em, atualizado_em, atualizado_por) VALUES (?,?,?,?,?,1,?,?,?)")
          .bind(op.id, op.cod, op.osId || null, op.etapa, JSON.stringify(op), agora, agora, quem),
        env.DB.prepare("INSERT INTO auditoria (quando, email, colecao, doc_id, num, acao) VALUES (?,?,?,?,?,?)").bind(agora, quem, "crm", op.id, op.cod, (op.hist && op.hist.length ? op.hist[op.hist.length - 1].texto : "Oportunidade criada").slice(0, 300))
      ]);
      return op;
    } catch (e) {
      if (/os_id/i.test(String(e && e.message))) return null;      // já existe oportunidade para esta OS
      if (!/UNIQUE/i.test(String(e && e.message))) throw e;
    }
  }
  throw new Error("cod");
}

// Visita de orçamento concluída no Quadro de OS (Executado/Finalizado, com orçamento levantado) → oportunidade no CRM
async function crmDaOS(env, os, quem) {
  if (!os || os.tipo !== "visita" || !(os.stage >= 6)) return;
  let lt = null;
  try { lt = await ltGarantir(env, os); } catch (e) {}
  if (!os.lev) os.lev = { itens: [], obs: "" };
  if (!Array.isArray(os.lev.itens)) os.lev.itens = [];
  const ja = await env.DB.prepare("SELECT id FROM crm_oportunidades WHERE os_id = ?").bind(os.id).first();
  if (ja) return;
  let contato = "", tel = "";
  if (os.ticket) {
    const t = await env.DB.prepare("SELECT dados FROM tickets WHERE num = ?").bind(os.ticket).first();
    if (t) { try { const d = JSON.parse(t.dados); contato = d.contato && d.contato !== "—" ? d.contato : ""; tel = d.tel || d.telefone || ""; } catch {} }
  }
  const hoje = crmHoje(), n = os.lev.itens.length;
  const op = {
    id: "op-" + aleatorio(8), cod: "", cliente: os.cliente || "", contato, tel, cidade: os.cidade && os.cidade !== "—" ? os.cidade : "",
    servico: "", descricao: os.servico || os.obs || "", os: "OS-" + os.num, osId: os.id, ticketCom: os.ticketCom || null,
    tecnico: os.tecnico || "", tecnicoId: os.tecnicoId || null, visita: os.agDate || hoje, vendedor: "", aux: [], apoio: [],
    etapa: "montar", desde: hoje, criado: hoje, valor: 0, total: 0, prazo: 36, validade: "",
    itens: os.lev.itens.map((i) => ({ q: parseInt(i.qtd, 10) || 1, d: String(i.nome || "") + (i.obs ? " (" + i.obs + ")" : "") })),
    levObs: os.lev.obs || "",
    hist: [{ data: hoje, tipo: "sis", autor: "Sistema", texto: "Criada automaticamente ao concluir a visita técnica da OS " + os.num + (lt ? " · levantamento técnico L.T. " + lt.num : "") + " · levantado por " + (os.tecnico || "técnico") + " (" + n + (n === 1 ? " item" : " itens") + ")" + (os.lev.obs ? ". Obs. do técnico: " + os.lev.obs : "") }]
  };
  await leadNaOportunidade(env, os, op);
  const criada = await crmInserir(env, op, quem);
  if (criada) await leadLigarOp(env, os, criada);
}

// Oportunidade FECHADA → OS "Pedido aprovado (instalação)" no Quadro de OS
async function crmCriarOS(env, op, u) {
  const agora = Date.now(), q = rotulo(agora);
  let orcRow = null, od = null;
  try { orcRow = await orcDaOp(env, op); od = orcRow ? JSON.parse(orcRow.dados) : null; } catch (e) { orcRow = null; od = null; }
  const orc = orcRow ? orcRow.num : String(op.orc || "").trim() || op.cod;
  let itens;
  const svs = od && od.mensal && od.mensal.itens ? od.mensal.itens : [];
  const txtMensal = svs.length ? ". Serviço mensal: " + svs.map((s) => (s.qtd > 1 ? (Math.round(s.qtd) || 1) + "x " : "") + s.descricao).join(", ") + (od.mensal.prazo_meses ? " · contrato de " + od.mensal.prazo_meses + " meses" : "") : "";
  if (od) {
    itens = (od.itens || []).filter((i) => i.tipo !== "servico").map((i) => ({ qtd: (Math.round(i.qtd) || 1) + "x", nome: (String(i.descricao || "") + (i.obs ? " (" + i.obs + ")" : "")).slice(0, 120), st: "pendente", prev: "" }));
    if (!itens.length) svs.forEach((s) => itens.push({ qtd: (Math.round(s.qtd) || 1) + "x", nome: (s.descricao + " (serviço mensal" + (s.obs ? " · " + s.obs : "") + ")").slice(0, 120), st: "pendente", prev: "" }));
  } else itens = (op.itens || []).map((i) => ({ qtd: (parseInt(i.q, 10) || 1) + "x", nome: String(i.d || "").slice(0, 120), st: "pendente", prev: "" })).filter((i) => i.nome);
  if (!itens.length && !(od && (od.itens || []).length)) itens = [{ qtd: "1x", nome: "Itens conforme orçamento " + orc, st: "pendente", prev: "" }];
  const tipoTxt = op.tv === "misto" ? "venda de execução + recorrente (contrato)" : op.tv === "recorrente" ? "venda recorrente (contrato)" : op.tv === "execucao" ? "venda de execução" : "venda";
  for (let tentativa = 0; tentativa < 3; tentativa++) {
    const num = await proximoNumero(env, "os"), id = "os-" + aleatorio(6);
    const dados = {
      id, num, tipo: "pedido", sub: null, orc, cliente: op.cliente || "", cidade: op.cidade || "—",
      obs: "Oportunidade " + op.cod + " fechada no CRM (" + tipoTxt + ")" + txtMensal + (op.descricao ? ". " + op.descricao : ""),
      servico: "Instalação conforme orçamento " + orc + (op.servico ? " · " + op.servico : ""),
      stage: 0, agenda: "A agendar", tecnico: null, pending: null, itens,
      hist: [{ quando: q, quem: u.nome, acao: "OS aberta a partir da oportunidade " + op.cod + " (CRM · cliente fechou · orçamento " + orc + ")" }],
      crm: { id: op.id, cod: op.cod }
    };
    if (orcRow) dados.orcamento = { id: orcRow.id, num: orcRow.num };
    if (od) dados.servicosOrc = orcServicos(od);
    try {
      await env.DB.batch([
        env.DB.prepare("INSERT INTO ordens_servico (id, num, stage, dados, versao, atualizado_em, atualizado_por) VALUES (?,?,0,?,1,?,?)").bind(id, num, JSON.stringify(dados), agora, u.login),
        env.DB.prepare("INSERT INTO auditoria (quando, email, colecao, doc_id, num, acao) VALUES (?,?,?,?,?,?)").bind(agora, u.login, "os", id, num, "OS aberta a partir da oportunidade " + op.cod + " (CRM)")
      ]);
      if (orcRow) {
        try {
          await env.DB.batch([
            env.DB.prepare("UPDATE orcamentos SET os_id = ?, os_num = ?, status = 'aprovado', versao = versao + 1, atualizado_em = ?, atualizado_por = ? WHERE id = ? AND os_id IS NULL").bind(id, num, agora, u.login, orcRow.id),
            env.DB.prepare("INSERT INTO auditoria (quando, email, colecao, doc_id, num, acao) VALUES (?,?,?,?,?,?)").bind(agora, u.login, "orcamentos", orcRow.id, orcRow.num, "Aprovado · oportunidade " + op.cod + " fechada · OS " + num)
          ]);
        } catch (e) {}
      }
      return { id, num, orc: orcRow ? orcRow.num : null, n: itens.length };
    } catch (e) {
      if (!/UNIQUE/i.test(String(e && e.message))) throw e;
    }
  }
  throw new Error("num");
}

// Cálculo da comissão (mesma regra da tela) — gravado como "foto" no fechamento
function crmCalcComissao(o, R) {
  // Execução: paga uma vez (base = valor total). Recorrente: o TIPO DE CONTRATO define a forma —
  // "mensal" = % de cada mensalidade, todo mês, pelo prazo do contrato (0 = até o encerramento);
  // "primeira" = % da 1ª parcela, uma vez. Implantação (uma vez, na 1ª) se marcado nas regras.
  const tvx = o.tv || (["Portaria remota", "Portaria híbrida", "Alarme monitorado"].includes(o.servico) ? "recorrente" : "execucao"), rec = tvx === "recorrente" || tvx === "misto", misto = tvx === "misto";
  const RR = R.recorrente || {}, pesos = R.pesos || {}, lista = Array.isArray(R.contratos) && R.contratos.length ? R.contratos : CRM_CONTRATOS_PADRAO;
  const tc = rec ? lista.find((t) => t.id === o.modalidade) || lista.find((t) => t.id === CRM_CONTRATO_POR_SERVICO[o.servico]) || lista[0] : null;
  const unica = !rec || tc.modo === "primeira", r = rec ? tc : R.execucao || {};
  const base = rec ? +o.valor || 0 : +o.total || 0, impl = rec && (misto || RR.implantacao) ? +o.total || 0 : 0;
  const pv = +r.venda || 0, pe = +r.equipe || 0, venda = base * pv / 100, pool = base * pe / 100, piv = misto ? +(R.execucao || {}).venda || 0 : pv, pie = misto ? +(R.execucao || {}).equipe || 0 : pe;
  const eq = [{ nome: o.vendedor, papel: "responsavel" }].concat((o.aux || []).filter((n) => n !== o.vendedor).map((n) => ({ nome: n, papel: "auxiliar" }))).concat((o.apoio || []).map((n) => ({ nome: n, papel: "apoio" })));
  // Responsável: só a comissão de venda. Comissão de equipe: dividida só entre auxiliares e apoio técnico (sem participantes, não é paga).
  const soma = eq.filter((p) => p.papel !== "responsavel").reduce((a, p) => a + (+pesos[p.papel] || 0), 0);
  const fr = (p) => p.papel === "responsavel" || !soma ? 0 : (+pesos[p.papel] || 0) / soma;
  return { rec, misto, unica, contrato: tc ? tc.nome : "", base, impl, parcelas: !rec || unica ? 1 : +o.prazo || 0, inicio: rec ? +RR.inicio || 0 : 0, pessoas: eq.map((p) => {
    const v = p.papel === "responsavel" ? venda : 0, e = pool * fr(p);
    return { ...p, venda: v, equipe: e, total: v + e, implVenda: p.papel === "responsavel" ? impl * piv / 100 : 0, implEquipe: impl * pie / 100 * fr(p) };
  }) };
}

async function crmSalvar(request, env, id, u) {
  if (!/^op-[a-z0-9]{6,40}$/.test(id)) return json({ erro: "Identificador inválido" }, 400);
  const corpo = await request.text();
  if (corpo.length > 3e5) return json({ erro: "Oportunidade grande demais" }, 413);
  let entrada; try { entrada = JSON.parse(corpo); } catch { return json({ erro: "JSON inválido" }, 400); }
  const dados = entrada && entrada.dados;
  if (!dados || typeof dados !== "object" || Array.isArray(dados)) return json({ erro: "Dados ausentes" }, 400);
  if (!CRM_ETAPAS.includes(dados.etapa)) return json({ erro: "Etapa inválida" }, 400);
  dados.id = id;
  const atual = await env.DB.prepare("SELECT versao, cod, os_id, dados FROM crm_oportunidades WHERE id = ?").bind(id).first();
  if (!atual) {
    if (!Array.isArray(dados.hist)) dados.hist = [];
    const op = await crmInserir(env, dados, u.login);
    return json({ id, versao: 1, dados: op });
  }
  if (entrada.versao !== atual.versao) return json({ erro: "conflito", atual: { versao: atual.versao, dados: JSON.parse(atual.dados) } }, 409);
  const antes = JSON.parse(atual.dados);
  if (!(ehAdmin(u) || crmPode(u, "com") || crmPodeVer(antes, u))) return json({ erro: "Esta oportunidade está com o vendedor " + antes.vendedor + "." }, 403);
  dados.cod = atual.cod; dados.osId = antes.osId || dados.osId || null;
  if (antes.osInstalacao) dados.osInstalacao = antes.osInstalacao;      // a OS já criada nunca se perde
  if (antes.comRegras) dados.comRegras = antes.comRegras;                // regras de comissão do dia do fechamento não mudam
  let criouOS = null;
  const ops = [];
  if (dados.res && dados.res.st === "ganho" && !dados.osInstalacao) {
    criouOS = await crmCriarOS(env, dados, u);
    dados.osInstalacao = criouOS;
    if (Array.isArray(dados.hist)) dados.hist.push({ data: crmHoje(), tipo: "sis", autor: "Sistema", texto: "OS " + criouOS.num + " (Pedido aprovado · instalação) criada no Quadro de OS com " + (criouOS.n || (dados.itens || []).length || 1) + " item(ns)" + (criouOS.orc ? " do orçamento " + criouOS.orc : "") + "." });
    const R = await crmRegras(env), agora = Date.now();
    if (!dados.comRegras) dados.comRegras = R;
    if (!dados.modalidade && (dados.tv === "recorrente" || dados.tv === "misto")) { const c0 = crmCalcComissao(dados, R), t0 = (R.contratos || CRM_CONTRATOS_PADRAO).find((t) => t.nome === c0.contrato); if (t0) dados.modalidade = t0.id; }
    const c = crmCalcComissao(dados, dados.comRegras);
    ops.push(env.DB.prepare("DELETE FROM crm_comissoes WHERE op_id = ?").bind(id));
    for (const p of c.pessoas) ops.push(env.DB.prepare("INSERT OR REPLACE INTO crm_comissoes (op_id, pessoa, papel, base, venda, equipe, total, regras, fechado_em, criado_em) VALUES (?,?,?,?,?,?,?,?,?,?)")
      .bind(id, p.nome || "", p.papel, c.base, p.venda, p.equipe, p.total, JSON.stringify({ regras: dados.comRegras, recorrente: c.rec, contrato: c.contrato, unica: c.unica, parcelas: c.parcelas, inicio: c.inicio, implVenda: p.implVenda, implEquipe: p.implEquipe }), dados.res.data || crmHoje(), agora));
  }
  const agora = Date.now(), ult = Array.isArray(dados.hist) && dados.hist.length ? dados.hist[dados.hist.length - 1].texto : null;
  const r = await env.DB.batch([
    env.DB.prepare("UPDATE crm_oportunidades SET etapa = ?, dados = ?, versao = versao + 1, atualizado_em = ?, atualizado_por = ? WHERE id = ? AND versao = ?").bind(dados.etapa, JSON.stringify(dados), agora, u.login, id, atual.versao),
    env.DB.prepare("INSERT INTO auditoria (quando, email, colecao, doc_id, num, acao) VALUES (?,?,?,?,?,?)").bind(agora, u.login, "crm", id, atual.cod, String(ult || "Oportunidade alterada").slice(0, 300)),
    ...ops
  ]);
  if (!r[0].meta.changes) return json({ erro: "conflito" }, 409);
  return json({ id, versao: atual.versao + 1, dados, criouOS });
}

var CRM_ARQ = /^\/api\/crm\/arquivos\/(op-[a-z0-9]{6,40})\/(doc[0-9]{6,20})$/;
async function crmRotas(request, env, url, u) {
  const p = url.pathname, m = request.method;
  const pode = { crm: crmPode(u, "crm"), rel: crmPode(u, "rel"), com: crmPode(u, "com") };
  if (!pode.crm && !pode.rel && !pode.com) return json({ erro: "Sem permissão para esta área." }, 403);
  if (p === "/api/crm/ops" && m === "GET") {
    const { results } = await env.DB.prepare("SELECT versao, dados FROM crm_oportunidades ORDER BY criado_em").all();
    const verTudo = ehAdmin(u) || pode.com;
    return json({ docs: results.map((r) => ({ versao: r.versao, dados: JSON.parse(r.dados) })).filter((x) => verTudo || crmPodeVer(x.dados, u)), verTudo, pessoas: await crmPessoas(env), pode, eu: { id: u.id, nome: u.nome, login: u.login }, regras: await crmRegras(env), agora: Date.now(), vinc: await crmVinculos(env).catch(() => ({})) });
  }
  const mo = p.match(/^\/api\/crm\/ops\/([^/]+)$/);
  if (mo && m === "PUT") {
    if (!pode.crm) return json({ erro: "Sem permissão para alterar oportunidades." }, 403);
    return crmSalvar(request, env, mo[1], u);
  }
  if (p === "/api/crm/regras") {
    if (m === "GET") return json({ regras: await crmRegras(env) });
    if (!pode.com) return json({ erro: "Sem permissão para alterar as regras de comissão." }, 403);
    if (m === "PUT") {
      let d; try { d = await lerJson(request, 5e3); } catch { return json({ erro: "Dados inválidos" }, 400); }
      const n = (v) => Math.max(0, Math.min(100, +v || 0));
      const R = { execucao: { venda: n(d.execucao && d.execucao.venda), equipe: n(d.execucao && d.execucao.equipe) },
        recorrente: { implantacao: !!(d.recorrente && d.recorrente.implantacao), inicio: d.recorrente && +d.recorrente.inicio ? 1 : 0 },
        contratos: (Array.isArray(d.contratos) ? d.contratos : CRM_CONTRATOS_PADRAO).slice(0, 40).map((t, i) => ({ id: String(t.id || "t" + i).replace(/[^a-z0-9_-]/gi, "").slice(0, 30) || "t" + i, nome: String(t.nome || "Tipo " + (i + 1)).slice(0, 60), modo: t.modo === "mensal" ? "mensal" : "primeira", venda: n(t.venda), equipe: n(t.equipe) })),
        pesos: { auxiliar: n(d.pesos && d.pesos.auxiliar), apoio: n(d.pesos && d.pesos.apoio) } };
      await env.DB.prepare("INSERT INTO crm_config (chave, valor) VALUES ('regras_comissao', ?) ON CONFLICT(chave) DO UPDATE SET valor = excluded.valor").bind(JSON.stringify(R)).run();
      await env.DB.prepare("INSERT INTO auditoria (quando, email, colecao, doc_id, num, acao) VALUES (?,?,?,?,?,?)").bind(Date.now(), u.login, "crm", "regras", null, "Regras de comissão alteradas").run();
      return json({ ok: true, regras: await crmRegras(env) });
    }
  }
  if (p === "/api/crm/comissoes" && m === "GET") {
    // Administrador / Financeiro (acesso a Comissões) vê todos; os demais só as próprias.
    const { results } = pode.com ? await env.DB.prepare("SELECT * FROM crm_comissoes ORDER BY fechado_em").all()
      : await env.DB.prepare("SELECT * FROM crm_comissoes WHERE pessoa = ? ORDER BY fechado_em").bind(u.nome || "").all();
    return json({ comissoes: results });
  }
  const ma = p.match(CRM_ARQ);
  if (ma) {
    if (!env.FOTOS) return json({ erro: "Armazenamento indisponível." }, 503);
    const chave = "crm/" + ma[1] + "/" + ma[2];
    if (m === "GET") {
      const obj = await env.FOTOS.get(chave);
      if (!obj) return json({ erro: "Arquivo não encontrado" }, 404);
      const nome = (obj.customMetadata && obj.customMetadata.nome) || ma[2];
      return new Response(obj.body, { headers: { "content-type": obj.httpMetadata && obj.httpMetadata.contentType || "application/octet-stream", "content-disposition": "inline; filename*=UTF-8''" + encodeURIComponent(nome), "cache-control": "private, max-age=3600", "x-content-type-options": "nosniff" } });
    }
    if (!pode.crm) return json({ erro: "Sem permissão." }, 403);
    if (m === "PUT") {
      const corpo = await request.arrayBuffer();
      if (!corpo.byteLength || corpo.byteLength > 15 * 1024 * 1024) return json({ erro: "Arquivo vazio ou maior que 15 MB." }, 400);
      const nome = decodeURIComponent(request.headers.get("x-nome") || ma[2]).slice(0, 200);
      const tipo = (request.headers.get("content-type") || "application/octet-stream").slice(0, 100);
      await env.FOTOS.put(chave, corpo, { httpMetadata: { contentType: tipo }, customMetadata: { nome, usuario: u.login, enviado: String(Date.now()) } });
      return json({ ok: true, tamanho: corpo.byteLength });
    }
    if (m === "DELETE") { await env.FOTOS.delete(chave); return json({ ok: true }); }
  }
  return json({ erro: "Não encontrado" }, 404);
}


// Tela do CRM: arquivo guardado no R2 (atualiza sem nova publicação do Worker)
async function crmTela(env) {
  const obj = env.FOTOS ? await env.FOTOS.get("telas/crm.html") : null;
  if (!obj) return new Response("Tela do CRM ainda não enviada.", { status: 404, headers: { "content-type": "text/plain; charset=utf-8", ...SEG } });
  return new Response(obj.body, { headers: { "content-type": "text/html; charset=utf-8", "cache-control": "no-cache", ...SEG } });
}

var CAD_PERM={parceiros:"cad-parceiros",produtos:"cad-produtos"};var cadPode=(u,k)=>ehAdmin(u)||u.permissoes.includes(CAD_PERM[k]);var CAD_TAGS_PADRAO=["Cliente","Fornecedor","Transportadora","Funcionário","Belfer"];function cadNorm(s){return String(s==null?"":s).normalize("NFD").replace(/[\u0300-\u036f]/g,"").toLowerCase().replace(/[^a-z0-9]+/g," ").trim()}var soDig=s=>String(s==null?"":s).replace(/\D+/g,"");var cadTxt=(v,max)=>v==null||v===""?null:String(v).replace(/\s+/g," ").trim().slice(0,max||200)||null;function cadNum(v){if(v==null||v==="")return null;if(typeof v==="number")return isFinite(v)?v:null;let s=String(v).replace(/[^\d.,-]/g,"");if(!s)return null;if(s.indexOf(",")>=0)s=s.replace(/\./g,"").replace(",",".");const n=parseFloat(s);return isFinite(n)?n:null}function cadTags(v){let arr=Array.isArray(v)?v:String(v||"").split(",");const out=[];for(const t of arr){const x=String(t||"").replace(/\s+/g," ").trim().slice(0,30);if(x&&!out.some(o=>o.toLowerCase()===x.toLowerCase()))out.push(x)}return out.slice(0,12)}function cadBuscaParceiro(p){return cadNorm([p.razao,p.fantasia,p.documento,p.contato,p.cidade,p.email,p.telefone,(p.tags||[]).join(" ")].join(" "))}function cadBuscaProduto(p){return cadNorm([p.codigo,p.descricao,p.marca,p.modelo,p.ean,p.caracteristicas,p.familia].join(" "))}function cadLimpaParceiro(d){const doc=soDig(d.documento);const p={documento:doc||null,tipo_pessoa:doc.length===11?"PF":doc.length===14?"PJ":null,razao:cadTxt(d.razao,160),fantasia:cadTxt(d.fantasia,160),tags:cadTags(d.tags),situacao:d.situacao==="Inativo"?"Inativo":"Ativo",telefone:cadTxt(d.telefone,80),contato:cadTxt(d.contato,120),email:cadTxt(d.email,200),cidade:cadTxt(d.cidade,80),uf:cadTxt(d.uf,2),endereco:cadTxt(d.endereco,200),bairro:cadTxt(d.bairro,100),cep:cadTxt(d.cep,10),ie:cadTxt(d.ie,30),im:cadTxt(d.im,30),obs:cadTxt(d.obs,1e3)};if(p.uf)p.uf=p.uf.toUpperCase();return p}function cadLimpaProduto(d){return{codigo:cadTxt(d.codigo,40),descricao:cadTxt(d.descricao,200),familia:cadTxt(d.familia,60),unidade:(cadTxt(d.unidade,6)||"UN").toUpperCase(),ncm:cadTxt(d.ncm,12),cest:cadTxt(d.cest,12),ean:cadTxt(d.ean,20),marca:cadTxt(d.marca,60),modelo:cadTxt(d.modelo,60),preco_venda:cadNum(d.preco_venda),custo:cadNum(d.custo),estoque:cadNum(d.estoque)||0,garantia_dias:cadNum(d.garantia_dias)==null?null:Math.round(cadNum(d.garantia_dias)),tipo_item:cadTxt(d.tipo_item,60),caracteristicas:cadTxt(d.caracteristicas,500),situacao:d.situacao==="Inativo"?"Inativo":"Ativo"}}var PARC_COLS=["documento","tipo_pessoa","razao","fantasia","tags","situacao","telefone","contato","email","cidade","uf","endereco","bairro","cep","ie","im","obs"];var PROD_COLS=["codigo","descricao","familia","unidade","ncm","cest","ean","marca","modelo","preco_venda","custo","estoque","garantia_dias","tipo_item","caracteristicas","situacao"];function cadSaidaParceiro(r){if(!r)return r;const o=Object.assign({},r);try{o.tags=JSON.parse(r.tags||"[]")}catch{o.tags=[]}try{o.extra=JSON.parse(r.extra||"{}")}catch{o.extra={}}delete o.busca;return o}function cadSaidaProduto(r){if(!r)return r;const o=Object.assign({},r);try{o.extra=JSON.parse(r.extra||"{}")}catch{o.extra={}}delete o.busca;return o}function cadWhereBusca(q,alias){const pal=cadNorm(q).split(" ").filter(Boolean).slice(0,6);const sql=pal.map(()=>`${alias}.busca LIKE ?`).join(" AND ");return{sql:sql,args:pal.map(p=>"%"+p+"%")}}async function cadUltimasCompras(env,ids){const out={};if(!ids.length)return out;const marc=ids.map(()=>"?").join(",");const{results:results}=await env.DB.prepare(`SELECT h.produto_id, h.preco, h.fornecedor_nome, h.data FROM compras_historico h\n      WHERE h.produto_id IN (${marc})\n        AND h.id = (SELECT h2.id FROM compras_historico h2 WHERE h2.produto_id = h.produto_id ORDER BY h2.data DESC, h2.id DESC LIMIT 1)`).bind(...ids).all();for(const r of results)out[r.produto_id]={preco:r.preco,fornecedor:r.fornecedor_nome,data:r.data};return out}async function cadBusca(env,url){const tipo=url.searchParams.get("tipo")||"produto";const q=(url.searchParams.get("q")||"").slice(0,80);const lim=Math.min(30,Math.max(1,parseInt(url.searchParams.get("limite")||"12",10)||12));const w=cadWhereBusca(q,"t");if(tipo==="produto"){const qn=cadNorm(q);const{results:results}=await env.DB.prepare(`SELECT t.id, t.codigo, t.descricao, t.unidade, t.estoque, t.preco_venda, t.custo, t.marca, t.modelo, t.situacao\n         FROM produtos t WHERE t.situacao = 'Ativo' ${w.sql?"AND "+w.sql:""}\n        ORDER BY (t.origem = 'omie') DESC, (lower(t.codigo) = ?) DESC, (lower(t.descricao) = ?) DESC, (lower(t.descricao) LIKE ?) DESC, (t.busca LIKE ?) DESC, length(t.descricao), t.descricao COLLATE NOCASE LIMIT ?`).bind(...w.args,String(q).trim().toLowerCase(),String(q).trim().toLowerCase(),String(q).trim().toLowerCase()+"%",qn+"%",lim).all();return json({itens:results})}const tag=tipo==="cliente"?"Cliente":tipo==="fornecedor"?"Fornecedor":tipo==="transportadora"?"Transportadora":null;const{results:results}=await env.DB.prepare(`SELECT t.id, t.documento, t.tipo_pessoa, t.razao, t.fantasia, t.tags, t.telefone, t.contato, t.email, t.cidade, t.uf, t.endereco, t.bairro, t.situacao\n       FROM parceiros t\n      WHERE t.situacao = 'Ativo' ${tag?"AND EXISTS (SELECT 1 FROM json_each(t.tags) j WHERE j.value = ?)":""} ${w.sql?"AND "+w.sql:""}\n      ORDER BY (t.origem = 'omie') DESC, COALESCE(t.fantasia, t.razao) COLLATE NOCASE LIMIT ?`).bind(...tag?[tag]:[],...w.args,lim).all();return json({itens:results.map(cadSaidaParceiro)})}async function cadListar(env,url,tipo){const q=(url.searchParams.get("q")||"").slice(0,80);const pag=Math.max(1,parseInt(url.searchParams.get("pagina")||"1",10)||1);const por=50;const sit=url.searchParams.get("situacao")||"Ativo";const w=cadWhereBusca(q,"t");const cond=[],args=[];if(sit!=="todos"){cond.push("t.situacao = ?");args.push(sit==="Inativo"?"Inativo":"Ativo")}if(w.sql){cond.push(w.sql);args.push(...w.args)}if(tipo==="parceiros"){const tags=(url.searchParams.get("tags")||"").split(",").map(s=>s.trim()).filter(Boolean).slice(0,5);for(const t of tags){cond.push("EXISTS (SELECT 1 FROM json_each(t.tags) j WHERE j.value = ?)");args.push(t)}}if(tipo==="produtos"&&url.searchParams.get("estoque")==="1")cond.push("t.estoque > 0");const where=cond.length?"WHERE "+cond.join(" AND "):"";const tabela=tipo==="parceiros"?"parceiros":"produtos";const ordem=tipo==="parceiros"?"COALESCE(t.fantasia, t.razao) COLLATE NOCASE":"t.descricao COLLATE NOCASE";const[lista,total]=await env.DB.batch([env.DB.prepare(`SELECT t.* FROM ${tabela} t ${where} ORDER BY ${ordem} LIMIT ? OFFSET ?`).bind(...args,por,(pag-1)*por),env.DB.prepare(`SELECT COUNT(*) AS n FROM ${tabela} t ${where}`).bind(...args)]);const out={total:total.results[0].n,pagina:pag,por:por,itens:[]};if(tipo==="parceiros"){out.itens=lista.results.map(cadSaidaParceiro);const{results:results}=await env.DB.prepare("SELECT j.value AS tag, COUNT(*) AS n FROM parceiros p, json_each(p.tags) j GROUP BY j.value ORDER BY n DESC").all();const vistas=results.map(r=>({tag:r.tag,n:r.n}));for(const t of CAD_TAGS_PADRAO)if(!vistas.some(v=>v.tag===t))vistas.push({tag:t,n:0});out.tags=vistas}else{out.itens=lista.results.map(cadSaidaProduto);const ult=await cadUltimasCompras(env,out.itens.map(p=>p.id));out.itens.forEach(p=>p.ultima=ult[p.id]||null)}return json(out)}async function cadSalvar(env,request,u,tipo,id){let d;try{d=await lerJson(request,2e4)}catch{return json({erro:"Dados inválidos"},400)}const agora=Date.now();if(tipo==="parceiros"){const p=cadLimpaParceiro(d);if(!p.razao)return json({erro:"Informe a razão social ou o nome."},400);if(!p.tags.length)return json({erro:"Marque pelo menos uma tag (Cliente, Fornecedor…)."},400);const busca=cadBuscaParceiro(p);const vals=PARC_COLS.map(c=>c==="tags"?JSON.stringify(p.tags):p[c]);if(!id){const r=await env.DB.prepare(`INSERT INTO parceiros (${PARC_COLS.join(",")}, busca, origem, criado_em, atualizado_em, atualizado_por) VALUES (${PARC_COLS.map(()=>"?").join(",")},?,?,?,?,?)`).bind(...vals,busca,"sgo",agora,agora,u.login).run();const novo=await env.DB.prepare("SELECT * FROM parceiros WHERE id = ?").bind(r.meta.last_row_id).first();return json({item:cadSaidaParceiro(novo)},201)}const r=await env.DB.prepare(`UPDATE parceiros SET ${PARC_COLS.map(c=>c+" = ?").join(", ")}, busca = ?, atualizado_em = ?, atualizado_por = ?, versao = versao + 1 WHERE id = ? AND versao = ?`).bind(...vals,busca,agora,u.login,id,parseInt(d.versao,10)||0).run();if(!r.meta.changes)return json({erro:"Outra pessoa alterou este cadastro. Abra de novo para ver a versão atual."},409);return json({item:cadSaidaParceiro(await env.DB.prepare("SELECT * FROM parceiros WHERE id = ?").bind(id).first())})}const p=cadLimpaProduto(d);if(!p.codigo||!p.descricao)return json({erro:"Informe o código e a descrição."},400);const busca=cadBuscaProduto(p);const vals=PROD_COLS.map(c=>p[c]);try{if(!id){const r=await env.DB.prepare(`INSERT INTO produtos (${PROD_COLS.join(",")}, busca, origem, criado_em, atualizado_em, atualizado_por) VALUES (${PROD_COLS.map(()=>"?").join(",")},?,?,?,?,?)`).bind(...vals,busca,"sgo",agora,agora,u.login).run();return json({item:cadSaidaProduto(await env.DB.prepare("SELECT * FROM produtos WHERE id = ?").bind(r.meta.last_row_id).first())},201)}const r=await env.DB.prepare(`UPDATE produtos SET ${PROD_COLS.map(c=>c+" = ?").join(", ")}, busca = ?, atualizado_em = ?, atualizado_por = ?, versao = versao + 1 WHERE id = ? AND versao = ?`).bind(...vals,busca,agora,u.login,id,parseInt(d.versao,10)||0).run();if(!r.meta.changes)return json({erro:"Outra pessoa alterou este produto. Abra de novo para ver a versão atual."},409);return json({item:cadSaidaProduto(await env.DB.prepare("SELECT * FROM produtos WHERE id = ?").bind(id).first())})}catch(e){if(/UNIQUE/i.test(String(e&&e.message)))return json({erro:"Já existe um produto com o código "+p.codigo+"."},409);throw e}}async function cadImportar(env,request,u){let d;try{d=await lerJson(request,9e5)}catch{return json({erro:"Arquivo grande demais para um lote"},413)}const tipo=d.tipo==="produtos"?"produtos":"parceiros";if(!cadPode(u,tipo))return json({erro:"Sem permissão para importar "+(tipo==="produtos"?"produtos":"clientes e fornecedores")+"."},403);const linhas=Array.isArray(d.linhas)?d.linhas.slice(0,600):[];const agora=Date.now();let novos=0,atualizados=0,ignorados=0;const ops=[];if(tipo==="produtos"){const{results:results}=await env.DB.prepare("SELECT id, codigo FROM produtos").all();const porCod=new Map(results.map(r=>[r.codigo.toLowerCase(),r.id]));for(const l of linhas){const p=cadLimpaProduto(l);if(!p.codigo||!p.descricao){ignorados++;continue}const extra=JSON.stringify(l.extra||{});const busca=cadBuscaProduto(p);const ex=porCod.get(p.codigo.toLowerCase());if(ex){ops.push(env.DB.prepare(`UPDATE produtos SET ${PROD_COLS.filter(c=>c!=="custo").map(c=>c+" = ?").join(", ")}, custo = COALESCE(?, custo), extra = ?, busca = ?, origem = 'omie', atualizado_em = ?, atualizado_por = ?, versao = versao + 1 WHERE id = ?`).bind(...PROD_COLS.filter(c=>c!=="custo").map(c=>p[c]),p.custo,extra,busca,agora,u.login,ex));atualizados++}else{ops.push(env.DB.prepare(`INSERT INTO produtos (${PROD_COLS.join(",")}, extra, busca, origem, criado_em, atualizado_em, atualizado_por) VALUES (${PROD_COLS.map(()=>"?").join(",")},?,?,'omie',?,?,?)`).bind(...PROD_COLS.map(c=>p[c]),extra,busca,agora,agora,u.login));porCod.set(p.codigo.toLowerCase(),-1);novos++}}}else{const{results:results}=await env.DB.prepare("SELECT id, documento, endereco, razao, tags FROM parceiros").all();const chave=(doc,end,raz)=>doc?doc+"|"+cadNorm(end):"s|"+cadNorm(raz);const mapa=new Map(results.map(r=>[chave(r.documento,r.endereco,r.razao),r]));for(const l of linhas){const p=cadLimpaParceiro(l);if(!p.razao){ignorados++;continue}const k=chave(p.documento,p.endereco,p.razao);const ex=mapa.get(k);const extra=JSON.stringify(l.extra||{});if(ex){let tagsAnt=[];try{tagsAnt=JSON.parse(ex.tags||"[]")}catch{}p.tags=cadTags(tagsAnt.concat(p.tags));const busca=cadBuscaParceiro(p);ops.push(env.DB.prepare(`UPDATE parceiros SET ${PARC_COLS.map(c=>c+" = ?").join(", ")}, extra = ?, busca = ?, origem = 'omie', atualizado_em = ?, atualizado_por = ?, versao = versao + 1 WHERE id = ?`).bind(...PARC_COLS.map(c=>c==="tags"?JSON.stringify(p.tags):p[c]),extra,busca,agora,u.login,ex.id));ex.tags=JSON.stringify(p.tags);atualizados++}else{const busca=cadBuscaParceiro(p);ops.push(env.DB.prepare(`INSERT INTO parceiros (${PARC_COLS.join(",")}, extra, busca, origem, criado_em, atualizado_em, atualizado_por) VALUES (${PARC_COLS.map(()=>"?").join(",")},?,?,'omie',?,?,?)`).bind(...PARC_COLS.map(c=>c==="tags"?JSON.stringify(p.tags):p[c]),extra,busca,agora,agora,u.login));mapa.set(k,{id:-1,tags:JSON.stringify(p.tags)});novos++}}}for(let i=0;i<ops.length;i+=80)await env.DB.batch(ops.slice(i,i+80));await env.DB.prepare("INSERT INTO auditoria (quando, email, colecao, doc_id, num, acao) VALUES (?,?,?,?,?,?)").bind(agora,u.login,"cadastros",tipo,null,`Importação Omie: ${novos} novos, ${atualizados} atualizados, ${ignorados} ignorados`).run();return json({ok:true,novos:novos,atualizados:atualizados,ignorados:ignorados})}async function cadRotas(request,env,url,u){const p=url.pathname,m=request.method;if(p==="/api/cadastros/busca"&&m==="GET")return cadBusca(env,url);if(p==="/api/cadastros/importar"&&m==="POST")return cadImportar(env,request,u);const r=p.match(/^\/api\/cadastros\/(parceiros|produtos)(?:\/(\d+))?$/);if(!r)return json({erro:"Não encontrado"},404);const tipo=r[1],id=r[2]?parseInt(r[2],10):null;if(m==="GET"&&id){const row=await env.DB.prepare(`SELECT * FROM ${tipo} WHERE id = ?`).bind(id).first();if(!row)return json({erro:"Não encontrado"},404);return json({item:tipo==="parceiros"?cadSaidaParceiro(row):cadSaidaProduto(row)})}if(!cadPode(u,tipo)&&!(m==="GET"&&u.permissoes.includes("op-compras")))return json({erro:"Sem permissão para esta área."},403);if(m==="GET")return cadListar(env,url,tipo);if(m==="POST"&&!id)return cadSalvar(env,request,u,tipo,null);if(m==="PUT"&&id)return cadSalvar(env,request,u,tipo,id);return json({erro:"Não encontrado"},404)}var COMPRAS_PERM="op-compras";var cmpPode=u=>ehAdmin(u)||u.permissoes.includes(COMPRAS_PERM);var cmpHoje=()=>isoDia(Date.now());function cmpAddUteis(iso,n){const[a,mm,dd]=iso.split("-").map(Number);const d=new Date(Date.UTC(a,mm-1,dd));let c=0;while(c<n){d.setUTCDate(d.getUTCDate()+1);const w=d.getUTCDay();if(w!==0&&w!==6)c++}return d.toISOString().slice(0,10)}var cmpQtd=q=>Math.max(1,parseInt(String(q==null?"":q).replace(/\D+/g,""),10)||1);async function cmpProxNum(env,tabela,pre,dig){const r=await env.DB.prepare(`SELECT MAX(CAST(substr(num, ${pre.length+2}) AS INTEGER)) AS n FROM ${tabela}`).first();return pre+"-"+String((r&&r.n||0)+1).padStart(dig||4,"0")}async function cmpCatalogo(env){const[p,v]=await env.DB.batch([env.DB.prepare("SELECT id, codigo, descricao, unidade, estoque, custo, preco_venda FROM produtos"),env.DB.prepare("SELECT chave, produto_id FROM compras_vinculos")]);const porId=new Map,porDesc=new Map,porCod=new Map;for(const r of p.results){porId.set(r.id,r);porDesc.set(cadNorm(r.descricao),r.id);porCod.set(String(r.codigo).toLowerCase(),r.id)}const vinc=new Map(v.results.map(r=>[r.chave,r.produto_id]));const resolver=nome=>{const n=cadNorm(nome);if(vinc.has(n)&&porId.has(vinc.get(n)))return vinc.get(n);if(porDesc.has(n))return porDesc.get(n);const m=String(nome||"").match(/\[(?:c[oó]d\.?\s*)?([^\]]{1,40})\]\s*$/i);if(m&&porCod.has(m[1].trim().toLowerCase()))return porCod.get(m[1].trim().toLowerCase());return null};return{porId:porId,resolver:resolver}}async function cmpCotacoesAbertas(env){const{results:results}=await env.DB.prepare("SELECT id, num, dados FROM compras_cotacoes WHERE status = 'aberta'").all();return results.map(r=>({id:r.id,num:r.num,dados:JSON.parse(r.dados)}))}async function cmpFila(env){const[osR,scR,cotR,pedR]=await env.DB.batch([env.DB.prepare("SELECT id, num, stage, dados, atualizado_em FROM ordens_servico WHERE stage BETWEEN 1 AND 3"),env.DB.prepare("SELECT * FROM compras_solicitacoes WHERE status IN ('aberto','cotacao','comprado') ORDER BY criado_em DESC LIMIT 300"),env.DB.prepare("SELECT id, num, status, dados, criado_em, atualizado_em FROM compras_cotacoes ORDER BY criado_em DESC LIMIT 60"),env.DB.prepare("SELECT * FROM compras_pedidos ORDER BY criado_em DESC LIMIT 60")]);const cat=await cmpCatalogo(env);const naCot=new Map;for(const c of cotR.results){if(c.status!=="aberta")continue;const d=JSON.parse(c.dados);for(const l of d.linhas||[])for(const o of l.origem||[])naCot.set(o.tipo==="os"?"os:"+o.os_id+":"+o.idx:"sc:"+o.id,c.num)}const prodInfo=pid=>{const p=pid?cat.porId.get(pid):null;return p?{id:p.id,codigo:p.codigo,descricao:p.descricao,unidade:p.unidade,estoque:p.estoque,custo:p.custo}:null};const origens=[];for(const r of osR.results){let d;try{d=JSON.parse(r.dados)}catch{continue}const itens=[];(d.itens||[]).forEach((it,idx)=>{if(it.st!=="comprar"&&it.st!=="comprado")return;const k="os:"+r.id+":"+idx;const st=it.st==="comprado"?"comprado":naCot.has(k)?"cotacao":"aberto";itens.push({chave:k,idx:idx,qtd:cmpQtd(it.qtd),nome:it.nome,st:st,cot:naCot.get(k)||null,prev:it.prev||null,produto:prodInfo(cat.resolver(it.nome))})});if(!itens.length)continue;origens.push({tipo:"os",id:r.id,num:"OS "+r.num,cliente:d.cliente||"",cidade:d.cidade||"",agenda:d.agDate||d.agenda||"",desde:r.atualizado_em,osTipo:d.tipo,itens:itens})}for(const r of scR.results){const d=JSON.parse(r.dados);const k="sc:"+r.id;origens.push({tipo:"sc",id:r.id,num:r.num,cliente:d.titulo||"",solicitante:d.solicitante,setor:d.setor,motivo:d.motivo||"",precisa:d.precisa||"",urgente:!!d.urgente,desde:r.criado_em,destino:d.destino,itens:[{chave:k,qtd:d.qtd,nome:d.descricao,st:r.status==="comprado"?"comprado":naCot.has(k)?"cotacao":"aberto",cot:naCot.get(k)||null,prev:r.prev,produto:prodInfo(d.produto_id),un:d.unidade}]})}const cotacoes=cotR.results.map(c=>{const d=JSON.parse(c.dados);const resp=(d.forn||[]).map((f,i)=>(d.linhas||[]).filter(l=>cadNum((d.precos[l.k]||[])[i])!=null).length);return{id:c.id,num:c.num,status:c.status,criado_em:c.criado_em,origens:[...new Set((d.linhas||[]).flatMap(l=>(l.origem||[]).map(o=>o.num)))],produtos:(d.linhas||[]).length,forn:(d.forn||[]).map((f,i)=>({nome:f.nome,respondeu:resp[i]})),total:d.totalEscolha||null}});const pedidos=pedR.results.map(p=>Object.assign({},p,{dados:JSON.parse(p.dados)}));return json({hoje:cmpHoje(),origens:origens,cotacoes:cotacoes,pedidos:pedidos})}async function cmpCriarSC(env,request,u){let d;try{d=await lerJson(request,8e3)}catch{return json({erro:"Dados inválidos"},400)}const qtd=Math.round(cadNum(d.qtd)||0);if(!(qtd>0))return json({erro:"Informe a quantidade."},400);let prod=null;if(d.produto_id)prod=await env.DB.prepare("SELECT id, codigo, descricao, unidade FROM produtos WHERE id = ?").bind(parseInt(d.produto_id,10)).first();const descricao=prod?prod.descricao:cadTxt(d.descricao,160);if(!descricao)return json({erro:"Escolha o produto ou descreva o que comprar."},400);const solicitante=cadTxt(d.solicitante,80)||u.nome;let titulo="Reposição do estoque",os=null;if(d.destino==="interno")titulo="Uso interno · "+(cadTxt(d.setor,40)||"");else if(d.destino==="os"&&d.os_id){os=await env.DB.prepare("SELECT id, num, json_extract(dados,'$.cliente') AS cli FROM ordens_servico WHERE id = ?").bind(String(d.os_id)).first();if(os)titulo="Para a OS "+os.num+" · "+(os.cli||"")}const dados={produto_id:prod?prod.id:null,descricao:descricao,unidade:prod?prod.unidade:(cadTxt(d.unidade,6)||"UN").toUpperCase(),qtd:qtd,solicitante:solicitante,setor:cadTxt(d.setor,40),destino:os?"os":d.destino==="interno"?"interno":"estoque",os_id:os?os.id:null,os_num:os?os.num:null,titulo:titulo,precisa:/^\d{4}-\d{2}-\d{2}$/.test(d.precisa||"")?d.precisa:null,urgente:!!d.urgente,motivo:cadTxt(d.motivo,400)};const agora=Date.now();for(let t=0;t<3;t++){const num=await cmpProxNum(env,"compras_solicitacoes","SC");const id="sc-"+aleatorio(6);try{await env.DB.batch([env.DB.prepare("INSERT INTO compras_solicitacoes (id, num, status, dados, criado_em, criado_por, atualizado_em) VALUES (?,?,'aberto',?,?,?,?)").bind(id,num,JSON.stringify(dados),agora,u.login,agora),env.DB.prepare("INSERT INTO auditoria (quando, email, colecao, doc_id, num, acao) VALUES (?,?,?,?,?,?)").bind(agora,u.login,"compras",id,num,"Solicitação de compra: "+qtd+" "+descricao)]);return json({id:id,num:num},201)}catch(e){if(!/UNIQUE/i.test(String(e&&e.message)))throw e}}throw new Error("num")}async function cmpAcaoSC(env,request,u,id){let d;try{d=await lerJson(request,2e3)}catch{return json({erro:"Dados inválidos"},400)}const novo=d.acao==="cancelar"?"cancelado":d.acao==="recebido"?"recebido":null;if(!novo)return json({erro:"Ação inválida"},400);const de=novo==="cancelado"?"('aberto')":"('comprado')";const r=await env.DB.prepare(`UPDATE compras_solicitacoes SET status = ?, atualizado_em = ? WHERE id = ? AND status IN ${de}`).bind(novo,Date.now(),id).run();if(!r.meta.changes)return json({erro:novo==="cancelado"?"Só dá para cancelar solicitação que ainda não entrou em cotação.":"Esta solicitação não está aguardando entrega."},409);return json({ok:true})}async function cmpVincular(env,request,u){let d;try{d=await lerJson(request,2e3)}catch{return json({erro:"Dados inválidos"},400)}const chave=cadNorm(d.nome);const pid=parseInt(d.produto_id,10);if(!chave)return json({erro:"Dados inválidos"},400);if(!pid){await env.DB.prepare("DELETE FROM compras_vinculos WHERE chave = ?").bind(chave).run();return json({ok:true})}await env.DB.prepare("INSERT INTO compras_vinculos (chave, produto_id, atualizado_em) VALUES (?,?,?) ON CONFLICT(chave) DO UPDATE SET produto_id = excluded.produto_id, atualizado_em = excluded.atualizado_em").bind(chave,pid,Date.now()).run();return json({ok:true})}async function cmpMontarCotacao(env,request,u){let d;try{d=await lerJson(request,3e4)}catch{return json({erro:"Dados inválidos"},400)}const chaves=Array.isArray(d.itens)?d.itens.slice(0,300).map(String):[];if(!chaves.length)return json({erro:"Selecione os itens."},400);const cat=await cmpCatalogo(env);const abertas=await cmpCotacoesAbertas(env);const ocupados=new Set;for(const c of abertas)for(const l of c.dados.linhas||[])for(const o of l.origem||[])ocupados.add(o.tipo==="os"?"os:"+o.os_id+":"+o.idx:"sc:"+o.id);const novos=[];const osCache=new Map;for(const k of chaves){if(ocupados.has(k))continue;let m=k.match(/^os:([A-Za-z0-9_-]+):(\d+)$/);if(m){if(!osCache.has(m[1]))osCache.set(m[1],await env.DB.prepare("SELECT id, num, dados FROM ordens_servico WHERE id = ?").bind(m[1]).first());const os=osCache.get(m[1]);if(!os)continue;const it=(JSON.parse(os.dados).itens||[])[+m[2]];if(!it||it.st!=="comprar")continue;novos.push({origem:{tipo:"os",os_id:os.id,num:"OS "+os.num,idx:+m[2],qtd:cmpQtd(it.qtd),nome:it.nome},produto_id:cat.resolver(it.nome),nome:it.nome,qtd:cmpQtd(it.qtd)});continue}m=k.match(/^sc:([A-Za-z0-9_-]+)$/);if(m){const sc=await env.DB.prepare("SELECT id, num, status, dados FROM compras_solicitacoes WHERE id = ?").bind(m[1]).first();if(!sc||sc.status!=="aberto")continue;const sd=JSON.parse(sc.dados);novos.push({origem:{tipo:"sc",id:sc.id,num:sc.num,qtd:sd.qtd,nome:sd.descricao},produto_id:sd.produto_id||null,nome:sd.descricao,qtd:sd.qtd,un:sd.unidade})}}if(!novos.length)return json({erro:"Esses itens já estão em cotação ou não estão mais marcados como “A comprar”."},409);const agora=Date.now();let cot=d.cot_id?abertas.find(c=>c.id===d.cot_id):null;let versao=1,num,id;if(cot){const row=await env.DB.prepare("SELECT versao FROM compras_cotacoes WHERE id = ?").bind(cot.id).first();versao=row.versao;num=cot.num;id=cot.id}const dados=cot?cot.dados:{forn:[0,1,2].map(()=>({parceiro_id:null,nome:"",prazo:"",frete:"",pgto:"",validade:""})),linhas:[],precos:{},esc:{},imp:{},obs:""};let seq=dados.linhas.reduce((mx,l)=>Math.max(mx,parseInt(String(l.k).slice(1),10)||0),0);for(const n of novos){const chaveLinha=n.produto_id?"p"+n.produto_id:"t"+cadNorm(n.nome);let l=dados.linhas.find(x=>(x.produto_id?"p"+x.produto_id:"t"+cadNorm(x.nome))===chaveLinha);if(!l){const p=n.produto_id?cat.porId.get(n.produto_id):null;l={k:"L"+ ++seq,produto_id:n.produto_id||null,nome:p?p.descricao:n.nome,un:p?p.unidade:n.un||"UN",qtd:0,origem:[]};dados.linhas.push(l)}l.qtd+=n.qtd;l.origem.push(n.origem)}if(cot){const r=await env.DB.prepare("UPDATE compras_cotacoes SET dados = ?, versao = versao + 1, atualizado_em = ?, atualizado_por = ? WHERE id = ? AND versao = ?").bind(JSON.stringify(dados),agora,u.login,id,versao).run();if(!r.meta.changes)return json({erro:"A cotação foi alterada por outra pessoa. Tente de novo."},409)}else{for(let t=0;t<3;t++){num=await cmpProxNum(env,"compras_cotacoes","COT");id="cot-"+aleatorio(6);try{await env.DB.prepare("INSERT INTO compras_cotacoes (id, num, status, dados, versao, criado_em, criado_por, atualizado_em, atualizado_por) VALUES (?,?,'aberta',?,1,?,?,?,?)").bind(id,num,JSON.stringify(dados),agora,u.login,agora,u.login).run();break}catch(e){if(!/UNIQUE/i.test(String(e&&e.message)))throw e;num=null}}if(!num)throw new Error("num")}const scIds=novos.filter(n=>n.origem.tipo==="sc").map(n=>n.origem.id);const ops=scIds.map(sid=>env.DB.prepare("UPDATE compras_solicitacoes SET status = 'cotacao', cot_id = ?, atualizado_em = ? WHERE id = ?").bind(id,agora,sid));ops.push(env.DB.prepare("INSERT INTO auditoria (quando, email, colecao, doc_id, num, acao) VALUES (?,?,?,?,?,?)").bind(agora,u.login,"compras",id,num,(cot?"Itens somados à cotação: ":"Cotação criada com ")+novos.length+" item(ns)"));await env.DB.batch(ops);return json({id:id,num:num,adicionados:novos.length,ignorados:chaves.length-novos.length})}async function cmpDetalheCotacao(env,id){const c=await env.DB.prepare("SELECT * FROM compras_cotacoes WHERE id = ?").bind(id).first();if(!c)return json({erro:"Cotação não encontrada"},404);const dados=JSON.parse(c.dados);const ids=[...new Set(dados.linhas.map(l=>l.produto_id).filter(Boolean))];const prods={};if(ids.length){const{results:results}=await env.DB.prepare(`SELECT id, codigo, descricao, unidade, estoque, custo, preco_venda FROM produtos WHERE id IN (${ids.map(()=>"?").join(",")})`).bind(...ids).all();for(const r of results)prods[r.id]=r}const ult=await cadUltimasCompras(env,ids);const fids=(dados.forn||[]).map(f=>f.parceiro_id).filter(Boolean);let depara=[];if(fids.length){depara=(await env.DB.prepare(`SELECT fornecedor_id, chave, produto_id FROM compras_depara WHERE fornecedor_id IN (${fids.map(()=>"?").join(",")})`).bind(...fids).all()).results}const fornInfo={};if(fids.length){const{results:results}=await env.DB.prepare(`SELECT id, razao, fantasia, documento, email, telefone, contato FROM parceiros WHERE id IN (${fids.map(()=>"?").join(",")})`).bind(...fids).all();for(const r of results)fornInfo[r.id]=r}return json({id:c.id,num:c.num,status:c.status,versao:c.versao,criado_em:c.criado_em,criado_por:c.criado_por,dados:dados,produtos:prods,ultimas:ult,depara:depara,fornInfo:fornInfo,hoje:cmpHoje()})}async function cmpSalvarCotacao(env,request,u,id){let d;try{d=await lerJson(request,2e5)}catch{return json({erro:"Dados inválidos"},400)}const c=await env.DB.prepare("SELECT * FROM compras_cotacoes WHERE id = ?").bind(id).first();if(!c)return json({erro:"Cotação não encontrada"},404);if(c.status!=="aberta")return json({erro:"Esta cotação já foi aprovada."},409);const atual=JSON.parse(c.dados),novo=d.dados||{};const f3=(novo.forn||atual.forn).slice(0,3).map(f=>({parceiro_id:f.parceiro_id?parseInt(f.parceiro_id,10):null,nome:cadTxt(f.nome,120)||"",prazo:cadTxt(f.prazo,6)||"",frete:cadTxt(f.frete,20)||"",pgto:cadTxt(f.pgto,60)||"",validade:cadTxt(f.validade,40)||""}));while(f3.length<3)f3.push({parceiro_id:null,nome:"",prazo:"",frete:"",pgto:"",validade:""});const ks=new Set(atual.linhas.map(l=>l.k));const precos={},esc={},imp={};for(const k of ks){const p=(novo.precos||{})[k];if(Array.isArray(p))precos[k]=[0,1,2].map(i=>cadTxt(p[i],20)||"");const e=(novo.esc||{})[k];if(e===0||e===1||e===2)esc[k]=e;for(const i of[0,1,2])if((novo.imp||{})[k+"_"+i])imp[k+"_"+i]=1}const linhas=atual.linhas.map(l=>{const nl=(novo.linhas||[]).find(x=>x.k===l.k);if(nl&&"produto_id"in nl){const pid=nl.produto_id?parseInt(nl.produto_id,10):null;if(pid!==l.produto_id)Object.assign(l,{produto_id:pid,nome:cadTxt(nl.nome,200)||l.nome,un:cadTxt(nl.un,6)||l.un})}return l});const dados=Object.assign(atual,{forn:f3,precos:precos,esc:esc,imp:imp,linhas:linhas,obs:cadTxt(novo.obs,1e3)||"",totalEscolha:cadNum(novo.totalEscolha)});const agora=Date.now();const r=await env.DB.prepare("UPDATE compras_cotacoes SET dados = ?, versao = versao + 1, atualizado_em = ?, atualizado_por = ? WHERE id = ? AND versao = ?").bind(JSON.stringify(dados),agora,u.login,id,parseInt(d.versao,10)||0).run();if(!r.meta.changes)return json({erro:"Outra pessoa alterou esta cotação. Atualizando…"},409);return json({ok:true,versao:(parseInt(d.versao,10)||0)+1})}async function cmpDepara(env,request,u){let d;try{d=await lerJson(request,5e4)}catch{return json({erro:"Dados inválidos"},400)}const fid=parseInt(d.fornecedor_id,10);if(!fid)return json({ok:true,salvos:0});const agora=Date.now();const ops=(Array.isArray(d.itens)?d.itens:[]).slice(0,300).filter(i=>i&&i.chave&&parseInt(i.produto_id,10)).map(i=>env.DB.prepare("INSERT INTO compras_depara (fornecedor_id, chave, produto_id, atualizado_em) VALUES (?,?,?,?) ON CONFLICT(fornecedor_id, chave) DO UPDATE SET produto_id = excluded.produto_id, atualizado_em = excluded.atualizado_em").bind(fid,String(i.chave).slice(0,200),parseInt(i.produto_id,10),agora));if(ops.length)await env.DB.batch(ops);return json({ok:true,salvos:ops.length})}async function cmpAprovar(env,request,u,id){let d;try{d=await lerJson(request,2e3)}catch{d={}}const c=await env.DB.prepare("SELECT * FROM compras_cotacoes WHERE id = ?").bind(id).first();if(!c)return json({erro:"Cotação não encontrada"},404);if(c.status!=="aberta")return json({erro:"Esta cotação já foi aprovada."},409);if(d.versao!=null&&parseInt(d.versao,10)!==c.versao)return json({erro:"A cotação mudou desde que você abriu. Atualizando…"},409);const dados=JSON.parse(c.dados);const escolha={};const semPreco=[];for(const l of dados.linhas){const pr=(dados.precos[l.k]||[]).map(cadNum);let e=dados.esc[l.k];if(e==null||pr[e]==null){e=null;pr.forEach((v,i)=>{if(v!=null&&(e==null||v<pr[e]))e=i})}if(e==null)semPreco.push(l.nome);else escolha[l.k]={i:e,preco:pr[e]}}if(semPreco.length)return json({erro:"Faltam preços em "+semPreco.length+" item(ns): "+semPreco.slice(0,3).join(", ")},400);for(const i of[0,1,2]){if(dados.linhas.some(l=>escolha[l.k].i===i)&&!String(dados.forn[i].nome||"").trim())return json({erro:"Informe o nome do Fornecedor "+"ABC"[i]+"."},400)}const hoje=cmpHoje(),agora=Date.now(),q=rotulo(agora);const pedidos=[],ops=[],prevPorLinha={};let base=await cmpProxNum(env,"compras_pedidos","PC");let nBase=parseInt(base.slice(3),10);for(const i of[0,1,2]){const ls=dados.linhas.filter(l=>escolha[l.k].i===i);if(!ls.length)continue;const f=dados.forn[i];const prazo=parseInt(f.prazo,10)||0;const prev=cmpAddUteis(hoje,prazo);const frete=cadNum(f.frete)||0;const itens=ls.map(l=>{prevPorLinha[l.k]={prev:prev,pedido:null,forn:f.nome};const preco=escolha[l.k].preco;return{k:l.k,produto_id:l.produto_id,nome:l.nome,un:l.un,qtd:l.qtd,preco:preco,total:Math.round(preco*l.qtd*100)/100,destinos:l.origem.map(o=>({num:o.num,qtd:o.qtd}))}});const total=Math.round((itens.reduce((s,x)=>s+x.total,0)+frete)*100)/100;const pid="pc-"+aleatorio(6),num="PC-"+String(nBase++).padStart(4,"0");ls.forEach(l=>prevPorLinha[l.k].pedido=num);const pd={fornecedor:f.nome,parceiro_id:f.parceiro_id,prazo:prazo,frete:frete,pgto:f.pgto,validade:f.validade,cot_num:c.num,itens:itens,enviado:null};pedidos.push({id:pid,num:num,fornecedor:f.nome,total:total,prev:prev});ops.push(env.DB.prepare("INSERT INTO compras_pedidos (id, num, cot_id, fornecedor_id, status, prev, total, dados, criado_em, criado_por, atualizado_em) VALUES (?,?,?,?,'aguardando',?,?,?,?,?,?)").bind(pid,num,c.id,f.parceiro_id||null,prev,total,JSON.stringify(pd),agora,u.login,agora));for(const it of itens)if(it.produto_id)ops.push(env.DB.prepare("INSERT INTO compras_historico (produto_id, fornecedor_id, fornecedor_nome, preco, qtd, data, pedido_id) VALUES (?,?,?,?,?,?,?)").bind(it.produto_id,f.parceiro_id||null,f.nome,it.preco,it.qtd,hoje,pid))}dados.pedidos=pedidos.map(p=>p.num);const trava=await env.DB.prepare("UPDATE compras_cotacoes SET status = 'aprovada', dados = ?, versao = versao + 1, atualizado_em = ?, atualizado_por = ? WHERE id = ? AND versao = ? AND status = 'aberta'").bind(JSON.stringify(dados),agora,u.login,c.id,c.versao).run();if(!trava.meta.changes)return json({erro:"A cotação mudou desde que você abriu. Atualizando…"},409);for(const l of dados.linhas)for(const o of l.origem)if(o.tipo==="sc")ops.push(env.DB.prepare("UPDATE compras_solicitacoes SET status = 'comprado', prev = ?, atualizado_em = ? WHERE id = ?").bind(prevPorLinha[l.k].prev,agora,o.id));ops.push(env.DB.prepare("INSERT INTO auditoria (quando, email, colecao, doc_id, num, acao) VALUES (?,?,?,?,?,?)").bind(agora,u.login,"compras",c.id,c.num,"Cotação aprovada · pedidos "+dados.pedidos.join(", ")));await env.DB.batch(ops);const porOS=new Map;for(const l of dados.linhas)for(const o of l.origem)if(o.tipo==="os"){if(!porOS.has(o.os_id))porOS.set(o.os_id,[]);porOS.get(o.os_id).push({idx:o.idx,nome:o.nome,...prevPorLinha[l.k]})}const avisos=[];for(const[osId,its]of porOS){let ok=false;for(let t=0;t<4&&!ok;t++){const row=await env.DB.prepare("SELECT id, num, versao, dados FROM ordens_servico WHERE id = ?").bind(osId).first();if(!row)break;const od=JSON.parse(row.dados);let n=0;const peds=new Set;for(const x of its){const it=(od.itens||[])[x.idx];if(!it||it.nome!==x.nome||it.st!=="comprar"){avisos.push("OS "+row.num+": “"+x.nome+"” mudou na OS e não foi marcado como comprado");continue}od.itens[x.idx]=Object.assign({},it,{st:"comprado",prev:x.prev,pc:x.pedido});n++;peds.add(x.pedido+" ("+x.forn+", chega "+x.prev.slice(8,10)+"/"+x.prev.slice(5,7)+")")}if(!n){ok=true;break}od.hist=(od.hist||[]).concat([{quando:q,quem:u.nome,acao:"Compras: "+n+(n===1?" item comprado":" itens comprados")+" · pedido "+[...peds].join(", ")}]);const r=await env.DB.batch([env.DB.prepare("UPDATE ordens_servico SET dados = ?, versao = versao + 1, atualizado_em = ?, atualizado_por = ? WHERE id = ? AND versao = ?").bind(JSON.stringify(od),agora,u.login,osId,row.versao),env.DB.prepare("INSERT INTO auditoria (quando, email, colecao, doc_id, num, acao) VALUES (?,?,?,?,?,?)").bind(agora,u.login,"os",osId,row.num,"Compras: "+n+" item(ns) comprado(s) · cotação "+c.num)]);ok=!!r[0].meta.changes}}return json({ok:true,pedidos:pedidos,avisos:avisos})}async function cmpCancelarCotacao(env,u,id){const c=await env.DB.prepare("SELECT * FROM compras_cotacoes WHERE id = ?").bind(id).first();if(!c||c.status!=="aberta")return json({erro:"Só dá para cancelar cotação aberta."},409);const agora=Date.now();await env.DB.batch([env.DB.prepare("UPDATE compras_cotacoes SET status = 'cancelada', atualizado_em = ?, atualizado_por = ? WHERE id = ?").bind(agora,u.login,id),env.DB.prepare("UPDATE compras_solicitacoes SET status = 'aberto', cot_id = NULL, atualizado_em = ? WHERE cot_id = ? AND status = 'cotacao'").bind(agora,id),env.DB.prepare("INSERT INTO auditoria (quando, email, colecao, doc_id, num, acao) VALUES (?,?,?,?,?,?)").bind(agora,u.login,"compras",id,c.num,"Cotação cancelada · itens voltaram para a fila")]);return json({ok:true})}async function cmpAcaoPedido(env,request,u,id){let d;try{d=await lerJson(request,2e3)}catch{return json({erro:"Dados inválidos"},400)}const novo=d.acao==="entregue"?"entregue":d.acao==="cancelar"?"cancelado":null;if(!novo)return json({erro:"Ação inválida"},400);const p=await env.DB.prepare("SELECT * FROM compras_pedidos WHERE id = ?").bind(id).first();if(!p||p.status!=="aguardando")return json({erro:"Este pedido não está aguardando entrega."},409);const agora=Date.now();const ops=[env.DB.prepare("UPDATE compras_pedidos SET status = ?, atualizado_em = ? WHERE id = ?").bind(novo,agora,id),env.DB.prepare("INSERT INTO auditoria (quando, email, colecao, doc_id, num, acao) VALUES (?,?,?,?,?,?)").bind(agora,u.login,"compras",id,p.num,novo==="entregue"?"Pedido entregue":"Pedido cancelado")];if(novo==="entregue"&&p.cot_id){const cot=await env.DB.prepare("SELECT dados FROM compras_cotacoes WHERE id = ?").bind(p.cot_id).first();const pd=JSON.parse(p.dados);const ks=new Set((pd.itens||[]).map(i=>i.k));if(cot)for(const l of JSON.parse(cot.dados).linhas||[])if(ks.has(l.k))for(const o of l.origem)if(o.tipo==="sc")ops.push(env.DB.prepare("UPDATE compras_solicitacoes SET status = 'recebido', atualizado_em = ? WHERE id = ? AND status = 'comprado'").bind(agora,o.id))}await env.DB.batch(ops);return json({ok:true})}async function cmpRotas(request,env,url,u){if(!cmpPode(u))return json({erro:"Sem permissão para esta área."},403);const p=url.pathname,m=request.method;if(p==="/api/compras/fila"&&m==="GET")return cmpFila(env);if(p==="/api/compras/solicitacoes"&&m==="POST")return cmpCriarSC(env,request,u);let r=p.match(/^\/api\/compras\/solicitacoes\/([A-Za-z0-9_-]+)$/);if(r&&m==="PUT")return cmpAcaoSC(env,request,u,r[1]);if(p==="/api/compras/vincular"&&m==="POST")return cmpVincular(env,request,u);if(p==="/api/compras/depara"&&m==="POST")return cmpDepara(env,request,u);if(p==="/api/compras/cotacoes"&&m==="POST")return cmpMontarCotacao(env,request,u);r=p.match(/^\/api\/compras\/cotacoes\/([A-Za-z0-9_-]+)(?:\/(aprovar|cancelar))?$/);if(r){if(!r[2]&&m==="GET")return cmpDetalheCotacao(env,r[1]);if(!r[2]&&m==="PUT")return cmpSalvarCotacao(env,request,u,r[1]);if(r[2]==="aprovar"&&m==="POST")return cmpAprovar(env,request,u,r[1]);if(r[2]==="cancelar"&&m==="POST")return cmpCancelarCotacao(env,u,r[1])}r=p.match(/^\/api\/compras\/pedidos\/([A-Za-z0-9_-]+)$/);if(r&&m==="PUT")return cmpAcaoPedido2(env,request,u,r[1]);return json({erro:"Não encontrado"},404)}async function telaR2(env,nome){const obj=env.FOTOS?await env.FOTOS.get("telas/"+nome+".html"):null;if(!obj)return new Response("Tela ainda não enviada.",{status:404,headers:{"content-type":"text/plain; charset=utf-8",...SEG}});return new Response(obj.body,{headers:{"content-type":"text/html; charset=utf-8","cache-control":"no-cache",...SEG}})}
// ===== Orçamento de postos (Comercial) =====
var POSTO_PERM = "com-postos";
var postoPode = (u) => ehAdmin(u) || u.permissoes.includes(POSTO_PERM);
var postoAno = () => new Date(Date.now() - 3 * 3600e3).getUTCFullYear();
function postoSaida(r, completo) {
  const o = { id: r.id, num: r.num, parceiro_id: r.parceiro_id, cliente: r.cliente, valor_mensal: r.valor_mensal, qtd: r.qtd, total: r.total, versao: r.versao, criado_em: r.criado_em, criado_por: r.criado_por, atualizado_em: r.atualizado_em, atualizado_por: r.atualizado_por };
  try { o.resumo = JSON.parse(r.resumo || "{}"); } catch { o.resumo = {}; }
  if (completo) { try { o.dados = JSON.parse(r.dados || "{}"); } catch { o.dados = {}; } }
  if (r.p_doc !== undefined) o.parceiro = r.parceiro_id ? { documento: r.p_doc, cidade: r.p_cidade, razao: r.p_razao, fantasia: r.p_fantasia } : null;
  return o;
}
async function postoLer(request) {
  let d;
  try { d = await lerJson(request, 6e4); } catch { return { erro: json({ erro: "Dados inválidos" }, 400) }; }
  const pid = parseInt(d.parceiro_id, 10);
  if (!pid) return { erro: json({ erro: "Escolha o cliente no cadastro de clientes." }, 400) };
  if (!d.dados || typeof d.dados !== "object") return { erro: json({ erro: "Dados do orçamento ausentes." }, 400) };
  const r = d.resumo && typeof d.resumo === "object" ? d.resumo : {};
  const num = (v) => { const n = Number(v); return isFinite(n) ? Math.round(n * 100) / 100 : null; };
  const qtd = Math.max(1, parseInt(r.qtd, 10) || 1);
  const mensal = num(r.mensal);
  return { d, pid, resumo: r, qtd, mensal, total: mensal == null ? null : Math.round(mensal * qtd * 100) / 100 };
}
async function postoCliente(env, pid) {
  return env.DB.prepare("SELECT id, razao, fantasia FROM parceiros WHERE id = ?").bind(pid).first();
}
async function postoRotas(request, env, url, u) {
  if (!postoPode(u)) return json({ erro: "Sem permissão para esta área." }, 403);
  const p = url.pathname, m = request.method;
  const SEL = "SELECT o.*, p.documento AS p_doc, p.cidade AS p_cidade, p.razao AS p_razao, p.fantasia AS p_fantasia FROM orcamentos_posto o LEFT JOIN parceiros p ON p.id = o.parceiro_id";
  if (p === "/api/postos" && m === "GET") {
    const { results } = await env.DB.prepare(SEL + " WHERE o.excluido = 0 ORDER BY o.ano DESC, o.seq DESC LIMIT 1000").all();
    return json({ itens: results.map((r) => postoSaida(r)) });
  }
  if (p === "/api/postos" && m === "POST") {
    const x = await postoLer(request);
    if (x.erro) return x.erro;
    const cli = await postoCliente(env, x.pid);
    if (!cli) return json({ erro: "Cliente não encontrado no cadastro." }, 400);
    const nomeCli = cli.fantasia || cli.razao;
    const agora = Date.now(), ano = postoAno();
    for (let t = 0; t < 4; t++) {
      const r = await env.DB.prepare("SELECT MAX(seq) AS n FROM orcamentos_posto WHERE ano = ?").bind(ano).first();
      const seq = (r && r.n || 0) + 1;
      const num = ano + " " + String(seq).padStart(4, "0");
      const id = "pst-" + aleatorio(8);
      try {
        await env.DB.batch([
          env.DB.prepare("INSERT INTO orcamentos_posto (id, ano, seq, num, parceiro_id, cliente, resumo, dados, valor_mensal, qtd, total, versao, criado_em, criado_por, atualizado_em, atualizado_por) VALUES (?,?,?,?,?,?,?,?,?,?,?,1,?,?,?,?)")
            .bind(id, ano, seq, num, x.pid, nomeCli, JSON.stringify(x.resumo), JSON.stringify(x.d.dados), x.mensal, x.qtd, x.total, agora, u.login, agora, u.login),
          env.DB.prepare("INSERT INTO auditoria (quando, email, colecao, doc_id, num, acao) VALUES (?,?,?,?,?,?)").bind(agora, u.login, "postos", id, num, "Orçamento de posto salvo · " + nomeCli),
        ]);
        const row = await env.DB.prepare(SEL + " WHERE o.id = ?").bind(id).first();
        return json({ item: postoSaida(row, true) }, 201);
      } catch (e) {
        if (!/UNIQUE/i.test(String(e && e.message))) throw e;
      }
    }
    return json({ erro: "Não foi possível gerar o número. Tente de novo." }, 409);
  }
  const r = p.match(/^\/api\/postos\/([A-Za-z0-9_-]+)$/);
  if (!r) return json({ erro: "Não encontrado" }, 404);
  const id = r[1];
  if (m === "GET") {
    const row = await env.DB.prepare(SEL + " WHERE o.id = ? AND o.excluido = 0").bind(id).first();
    if (!row) return json({ erro: "Orçamento não encontrado" }, 404);
    return json({ item: postoSaida(row, true) });
  }
  if (m === "PUT") {
    const x = await postoLer(request);
    if (x.erro) return x.erro;
    const cli = await postoCliente(env, x.pid);
    if (!cli) return json({ erro: "Cliente não encontrado no cadastro." }, 400);
    const nomeCli = cli.fantasia || cli.razao, agora = Date.now();
    const atual = await env.DB.prepare("SELECT num FROM orcamentos_posto WHERE id = ? AND excluido = 0").bind(id).first();
    if (!atual) return json({ erro: "Orçamento não encontrado" }, 404);
    const res = await env.DB.prepare("UPDATE orcamentos_posto SET parceiro_id = ?, cliente = ?, resumo = ?, dados = ?, valor_mensal = ?, qtd = ?, total = ?, versao = versao + 1, atualizado_em = ?, atualizado_por = ? WHERE id = ? AND versao = ? AND excluido = 0")
      .bind(x.pid, nomeCli, JSON.stringify(x.resumo), JSON.stringify(x.d.dados), x.mensal, x.qtd, x.total, agora, u.login, id, parseInt(x.d.versao, 10) || 0).run();
    if (!res.meta.changes) return json({ erro: "Outra pessoa alterou este orçamento. Abra de novo pela lista para ver a versão atual." }, 409);
    await env.DB.prepare("INSERT INTO auditoria (quando, email, colecao, doc_id, num, acao) VALUES (?,?,?,?,?,?)").bind(agora, u.login, "postos", id, atual.num, "Orçamento de posto alterado · " + nomeCli).run();
    const row = await env.DB.prepare(SEL + " WHERE o.id = ?").bind(id).first();
    return json({ item: postoSaida(row, true) });
  }
  if (m === "DELETE") {
    const atual = await env.DB.prepare("SELECT num, criado_por FROM orcamentos_posto WHERE id = ? AND excluido = 0").bind(id).first();
    if (!atual) return json({ erro: "Orçamento não encontrado" }, 404);
    if (!ehAdmin(u) && atual.criado_por !== u.login) return json({ erro: "Só quem criou o orçamento ou um administrador pode excluir." }, 403);
    const agora = Date.now();
    await env.DB.batch([
      env.DB.prepare("UPDATE orcamentos_posto SET excluido = 1, atualizado_em = ?, atualizado_por = ? WHERE id = ?").bind(agora, u.login, id),
      env.DB.prepare("INSERT INTO auditoria (quando, email, colecao, doc_id, num, acao) VALUES (?,?,?,?,?,?)").bind(agora, u.login, "postos", id, atual.num, "Orçamento de posto excluído"),
    ]);
    return json({ ok: true });
  }
  return json({ erro: "Não encontrado" }, 404);
}

// ===== Orçamentos de produtos (Comercial) e Levantamentos técnicos (L.T.) =====
var ORC_PERM = "com-orc";
var orcPode = (u) => ehAdmin(u) || u.permissoes.includes(ORC_PERM);
var orcAno = () => new Date(Date.now() - 3 * 3600e3).getUTCFullYear();
var orcHoje = () => new Date(Date.now() - 3 * 3600e3).toISOString().slice(0, 10);
var orcR2 = (v) => Math.round((+v || 0) * 100) / 100;
var ORC_STATUS = ["salvo", "enviado", "aprovado", "recusado"];

// ---- Levantamentos: criados a partir das OS de visita concluídas que têm itens levantados pelo técnico
async function ltSincronizar(env) {
  const { results } = await env.DB.prepare(
    "SELECT o.id, o.num, o.dados FROM ordens_servico o WHERE json_extract(o.dados,'$.tipo') = 'visita' AND o.stage >= 6 " +
    "AND NOT EXISTS (SELECT 1 FROM levantamentos l WHERE l.os_id = o.id) ORDER BY o.num"
  ).all();
  for (const r of results) {
    let d; try { d = JSON.parse(r.dados); } catch { continue; }
    await ltGarantir(env, d);
  }
}
// Cria (se ainda não existir) o L.T. da OS de visita concluída e devolve { id, num }
async function ltGarantir(env, d) {
  if (!d || !d.id || d.tipo !== "visita" || !(d.stage >= 6)) return null;
  const ja = await env.DB.prepare("SELECT id, num, status FROM levantamentos WHERE os_id = ?").bind(d.id).first();
  if (ja) return ja;
  const lev = d.lev || {};
  const itens = (Array.isArray(lev.itens) ? lev.itens : []).map((i) => ({ qtd: parseInt(String(i.qtd || "").replace(/\D+/g, ""), 10) || 1, nome: String(i.nome || "").trim().slice(0, 160), obs: String(i.obs || "").trim().slice(0, 160) })).filter((i) => i.nome);
  {
    const r = { id: d.id, num: d.num };
    const agora = Date.now();
    for (let t = 0; t < 3; t++) {
      const m = await env.DB.prepare("SELECT MAX(seq) AS n FROM levantamentos").first();
      const seq = (m && m.n || 0) + 1, num = String(seq).padStart(4, "0");
      try {
        await env.DB.prepare("INSERT INTO levantamentos (id, seq, num, os_id, os_num, cliente, cidade, tecnico, data, itens, obs, status, criado_em, atualizado_em) VALUES (?,?,?,?,?,?,?,?,?,?,?,'pendente',?,?)")
          .bind("lt-" + aleatorio(6), seq, num, r.id, r.num, d.cliente || "", d.cidade && d.cidade !== "—" ? d.cidade : "", d.tecnico || "", d.agDate || "", JSON.stringify(itens), String(lev.obs || "").slice(0, 2000), agora, agora).run();
        break;
      } catch (e) {
        if (!/UNIQUE/i.test(String(e && e.message))) throw e;
        if (await env.DB.prepare("SELECT 1 FROM levantamentos WHERE os_id = ?").bind(r.id).first()) break;
      }
    }
  }
  return await env.DB.prepare("SELECT id, num, status FROM levantamentos WHERE os_id = ?").bind(d.id).first();
}
function ltSaida(r) {
  const o = Object.assign({}, r);
  try { o.itens = JSON.parse(r.itens || "[]"); } catch { o.itens = []; }
  return o;
}
async function ltListar(env) {
  await ltSincronizar(env);
  const { results } = await env.DB.prepare("SELECT l.*, o.num AS orc_num FROM levantamentos l LEFT JOIN orcamentos o ON o.id = l.orc_id ORDER BY l.seq DESC LIMIT 500").all();
  return json({ itens: results.map(ltSaida) });
}
// Sugestão para converter: cliente e produto de cada item (vínculo salvo, descrição exata ou "[código]")
async function ltSugestao(env, id) {
  const l = await env.DB.prepare("SELECT * FROM levantamentos WHERE id = ?").bind(id).first();
  if (!l) return json({ erro: "Levantamento não encontrado" }, 404);
  const lt = ltSaida(l);
  const cn = cadNorm(lt.cliente);
  let cliente = null, clientes = [];
  if (cn) {
    const { results } = await env.DB.prepare("SELECT id, razao, fantasia, documento, cidade, uf FROM parceiros WHERE situacao = 'Ativo' AND busca LIKE ? LIMIT 20").bind("%" + cn + "%").all();
    clientes = results;
    const exatos = results.filter((p) => cadNorm(p.fantasia) === cn || cadNorm(p.razao) === cn);
    if (exatos.length === 1) cliente = exatos[0];
  }
  const cat = await cmpCatalogo(env);
  const itens = lt.itens.map((i) => {
    const pid = cat.resolver(i.nome);
    const p = pid ? cat.porId.get(pid) : null;
    return Object.assign({}, i, { produto: p ? { id: p.id, codigo: p.codigo, descricao: p.descricao, unidade: p.unidade, preco_venda: p.preco_venda } : null });
  });
  const op = await env.DB.prepare("SELECT id, cod FROM crm_oportunidades WHERE os_id = ?").bind(lt.os_id).first();
  return json({ lt: Object.assign(lt, { itens }), cliente, clientes, op: op || null });
}

// ---- Orçamentos
function orcSaida(r, completo) {
  const o = { id: r.id, num: r.num, parceiro_id: r.parceiro_id, cliente: r.cliente, status: r.status, total: r.total, lt_id: r.lt_id, lt_num: r.lt_num || null, op_id: r.op_id || null, op_cod: r.op_cod || null, os_id: r.os_id, os_num: r.os_num, versao: r.versao, criado_em: r.criado_em, criado_por: r.criado_por, criado_nome: r.criado_nome, atualizado_em: r.atualizado_em, atualizado_por: r.atualizado_por };
  let d = {};
  try { d = JSON.parse(r.dados || "{}"); } catch {}
  if (completo) o.dados = d;
  o.mensal = r.mensal || 0;
  if (!completo) { o.n_servicos = d.mensal && d.mensal.itens ? d.mensal.itens.length : 0; o.prazo_meses = d.mensal && d.mensal.prazo_meses || null; }
  if (!completo) { o.n_itens = (d.itens || []).length; o.cidade = d.cliente && d.cliente.cidade || ""; o.documento = d.cliente && d.cliente.documento || ""; o.validade = d.validade || ""; }
  return o;
}
var ORC_SEL = "SELECT o.*, l.num AS lt_num, c.cod AS op_cod FROM orcamentos o LEFT JOIN levantamentos l ON l.id = o.lt_id LEFT JOIN crm_oportunidades c ON c.id = o.op_id";

// Valida e completa o orçamento com os dados do banco (cliente e produtos) — o total é sempre calculado aqui
async function orcMontar(env, d) {
  const pid = parseInt(d.parceiro_id, 10);
  if (!pid) return { erro: "Escolha o cliente no cadastro de clientes." };
  const p = await env.DB.prepare("SELECT * FROM parceiros WHERE id = ?").bind(pid).first();
  if (!p) return { erro: "Cliente não encontrado no cadastro." };
  const D = d.dados && typeof d.dados === "object" ? d.dados : {};
  const brutos = Array.isArray(D.itens) ? D.itens.slice(0, 300) : [];
  const Ms = D.mensal && typeof D.mensal === "object" ? D.mensal : {};
  const mAtivo = !!Ms.ativo;
  const sBrutos = mAtivo && Array.isArray(Ms.itens) ? Ms.itens.slice(0, 100) : [];
  if (mAtivo && !sBrutos.length) return { erro: "Inclua pelo menos um serviço mensal ou desmarque “Incluir serviço mensal”." };
  if (!brutos.length && !sBrutos.length) return { erro: "Inclua pelo menos um produto no orçamento (ou marque “Incluir serviço mensal”)." };
  // v23 · itens de serviço (mão de obra do cadastro) entram na mesma lista, depois dos produtos
  const ehSvc = (i) => !!i && i.tipo === "servico";
  const moBrutos = brutos.filter(ehSvc), pBrutos = brutos.filter((i) => !ehSvc(i));
  const ids = [...new Set(pBrutos.map((i) => parseInt(i.produto_id, 10)).filter(Boolean))];
  const prods = new Map();
  if (ids.length) {
    for (let i = 0; i < ids.length; i += 90) {
      const parte = ids.slice(i, i + 90);
      const { results } = await env.DB.prepare(`SELECT id, codigo, descricao, unidade FROM produtos WHERE id IN (${parte.map(() => "?").join(",")})`).bind(...parte).all();
      for (const r of results) prods.set(r.id, r);
    }
  }
  const semProd = pBrutos.filter((i) => !prods.has(parseInt(i.produto_id, 10)));
  if (semProd.length) return { erro: semProd.length === 1 ? "Há 1 item sem produto do cadastro. Escolha o produto em todas as linhas." : "Há " + semProd.length + " itens sem produto do cadastro. Escolha o produto em todas as linhas." };
  const moIds = [...new Set(moBrutos.map((i) => parseInt(i.mo_id, 10)).filter(Boolean))];
  const mos = new Map();
  if (moIds.length) {
    const { results } = await env.DB.prepare(`SELECT id, codigo, descricao, unidade FROM mao_obra WHERE id IN (${moIds.map(() => "?").join(",")})`).bind(...moIds).all();
    for (const r of results) mos.set(r.id, r);
  }
  const semMo = moBrutos.filter((i) => !mos.has(parseInt(i.mo_id, 10))).length;
  if (semMo) return { erro: semMo === 1 ? "Há 1 serviço que não está no cadastro de mão de obra." : "Há " + semMo + " serviços que não estão no cadastro de mão de obra." };
  const itens = pBrutos.map((i) => {
    const pr = prods.get(parseInt(i.produto_id, 10));
    const qtd = Math.max(0.001, +String(i.qtd).replace(",", ".") || 1);
    const preco = Math.max(0, orcR2(i.preco));
    const desc = Math.min(100, Math.max(0, +i.desc || 0));
    return { produto_id: pr.id, codigo: pr.codigo, descricao: pr.descricao, unidade: pr.unidade || "UN", qtd, preco, desc, obs: cadTxt(i.obs, 200) || "", lt_nome: cadTxt(i.lt_nome, 160) || undefined, total: orcR2(qtd * preco * (1 - desc / 100)) };
  }).concat(moBrutos.map((i) => {
    const mo = mos.get(parseInt(i.mo_id, 10));
    const qtd = Math.max(0.001, +String(i.qtd).replace(",", ".") || 1);
    const preco = Math.max(0, orcR2(i.preco));
    const desc = Math.min(100, Math.max(0, +i.desc || 0));
    return { tipo: "servico", mo_id: mo.id, codigo: mo.codigo, descricao: mo.descricao, unidade: mo.unidade || "HORA", qtd, preco, desc, obs: cadTxt(i.obs, 200) || "", total: orcR2(qtd * preco * (1 - desc / 100)) };
  }));
  const subtotal = orcR2(itens.reduce((s, i) => s + i.total, 0));
  const descGeral = Math.min(subtotal, Math.max(0, orcR2(D.desconto)));
  const total = orcR2(subtotal - descGeral);
  // serviços mensais: precisam existir no cadastro de serviços
  const sIds = [...new Set(sBrutos.map((i) => parseInt(i.servico_id, 10)).filter(Boolean))];
  const svcs = new Map();
  if (sIds.length) {
    const { results } = await env.DB.prepare(`SELECT id, codigo, descricao, unidade FROM servicos WHERE id IN (${sIds.map(() => "?").join(",")})`).bind(...sIds).all();
    for (const r of results) svcs.set(r.id, r);
  }
  const semSvc = sBrutos.filter((i) => !svcs.has(parseInt(i.servico_id, 10))).length;
  if (semSvc) return { erro: semSvc === 1 ? "Há 1 serviço mensal que não está no cadastro de serviços." : "Há " + semSvc + " serviços mensais que não estão no cadastro de serviços." };
  const servicos = sBrutos.map((i) => {
    const sv = svcs.get(parseInt(i.servico_id, 10));
    const qtd = Math.max(0.001, +String(i.qtd).replace(",", ".") || 1);
    const preco = Math.max(0, orcR2(i.preco));
    const desc = Math.min(100, Math.max(0, +i.desc || 0));
    return { servico_id: sv.id, codigo: sv.codigo, descricao: sv.descricao, unidade: sv.unidade || "MÊS", qtd, preco, desc, obs: cadTxt(i.obs, 200) || "", total: orcR2(qtd * preco * (1 - desc / 100)) };
  });
  const mensalTotal = orcR2(servicos.reduce((s, i) => s + i.total, 0));
  const prazoMeses = Math.min(240, Math.max(0, parseInt(Ms.prazo_meses, 10) || 0));
  const cliente = { razao: p.razao, fantasia: p.fantasia, documento: p.documento, tipo_pessoa: p.tipo_pessoa, endereco: p.endereco, bairro: p.bairro, cidade: p.cidade, uf: p.uf, cep: p.cep, telefone: p.telefone, email: p.email, contato: p.contato, ie: p.ie };
  const dados = {
    cliente, itens, subtotal, desconto: descGeral, total,
    validade: /^\d{4}-\d{2}-\d{2}$/.test(D.validade || "") ? D.validade : "",
    pagamento: cadTxt(D.pagamento, 200) || "", prazo: cadTxt(D.prazo, 200) || "", garantia: cadTxt(D.garantia, 200) || "",
    obs: String(D.obs || "").slice(0, 3000), ocultarItens: !!D.ocultarItens, ocultarTotal: !!D.ocultarTotal, ref: cadTxt(D.ref, 160) || "",
    mensal: mAtivo ? { ativo: true, itens: servicos, total: mensalTotal, prazo_meses: prazoMeses || null, inicio: cadTxt(Ms.inicio, 200) || "" } : null
  };
  return { pid, nome: p.fantasia || p.razao, dados, total, itens, mensal: mAtivo ? mensalTotal : 0 };
}
async function orcVincular(env, itens) {
  const agora = Date.now();
  const ops = itens.filter((i) => i.lt_nome && cadNorm(i.lt_nome)).map((i) =>
    env.DB.prepare("INSERT INTO compras_vinculos (chave, produto_id, atualizado_em) VALUES (?,?,?) ON CONFLICT(chave) DO UPDATE SET produto_id = excluded.produto_id, atualizado_em = excluded.atualizado_em").bind(cadNorm(i.lt_nome), i.produto_id, agora));
  if (ops.length) await env.DB.batch(ops);
}
async function orcNotaCRM(env, osId, texto, u, orcNum) {
  if (!osId) return;
  const op = await env.DB.prepare("SELECT id, dados FROM crm_oportunidades WHERE os_id = ?").bind(osId).first();
  if (!op) return;
  try {
    const d = JSON.parse(op.dados);
    d.hist = (d.hist || []).concat([{ data: orcHoje(), tipo: "nota", autor: u.nome, texto }]);
    if (orcNum && !d.orc) d.orc = orcNum;
    await env.DB.prepare("UPDATE crm_oportunidades SET dados = ?, versao = versao + 1 WHERE id = ?").bind(JSON.stringify(d), op.id).run();
  } catch {}
}
// Orçamento salvo → a oportunidade passa a mostrar o número e os valores (até ser finalizada)
async function orcAtualizarOp(env, opId, num, m, u, texto) {
  if (!opId) return;
  const op = await env.DB.prepare("SELECT id, etapa, dados FROM crm_oportunidades WHERE id = ?").bind(opId).first();
  if (!op || op.etapa === "final") return;
  try {
    const d = JSON.parse(op.dados), mm = m.dados && m.dados.mensal;
    d.orc = num;
    d.total = m.total;
    if (m.mensal > 0) { d.valor = m.mensal; if (mm && mm.prazo_meses) d.prazo = mm.prazo_meses; }
    // tipo de venda pelo orçamento (enquanto o vendedor não escolher outro): produtos + mensal = execução + recorrente
    // tipo de contrato (comissão) = serviço mensal do orçamento (o de maior valor), enquanto o vendedor não escolher outro
    if (mm && mm.itens && mm.itens.length && (!d.modalidade || d.modAuto)) { const top = mm.itens.slice().sort((x, y) => (y.total || 0) - (x.total || 0))[0]; d.modalidade = "srv-" + top.servico_id; d.modAuto = true; }
    if (!d.tv || d.tvAuto) { d.tv = m.mensal > 0 ? (m.total > 0 ? "misto" : "recorrente") : "execucao"; d.tvAuto = true; }
    if (m.dados && m.dados.validade) d.validade = m.dados.validade;
    d.hist = (d.hist || []).concat([{ data: orcHoje(), tipo: "sis", autor: u.nome || "Sistema", texto }]);
    await env.DB.prepare("UPDATE crm_oportunidades SET dados = ?, versao = versao + 1, atualizado_em = ?, atualizado_por = ? WHERE id = ?").bind(JSON.stringify(d), Date.now(), u.login, op.id).run();
  } catch {}
}
var orcValTxt = (m) => "R$ " + m.total.toLocaleString("pt-BR", { minimumFractionDigits: 2 }) + (m.mensal ? " + R$ " + m.mensal.toLocaleString("pt-BR", { minimumFractionDigits: 2 }) + "/mês" : "");
async function orcCriar(env, request, u) {
  let d; try { d = await lerJson(request, 3e5); } catch { return json({ erro: "Dados inválidos" }, 400); }
  const m = await orcMontar(env, d);
  if (m.erro) return json({ erro: m.erro }, 400);
  let lt = null;
  if (d.lt_id) {
    lt = await env.DB.prepare("SELECT * FROM levantamentos WHERE id = ?").bind(String(d.lt_id)).first();
    if (!lt) return json({ erro: "Levantamento não encontrado." }, 404);
    if (lt.status === "convertido") return json({ erro: "O L.T. " + lt.num + " já foi convertido em orçamento." }, 409);
  }
  // oportunidade do CRM: a do L.T. (mesma OS de visita) ou a informada (“Montar orçamento” dentro da oportunidade)
  let opId = null;
  if (lt) { const o = await env.DB.prepare("SELECT id FROM crm_oportunidades WHERE os_id = ?").bind(lt.os_id).first(); opId = o ? o.id : null; }
  if (!opId && d.op_id) { const o = await env.DB.prepare("SELECT id, etapa FROM crm_oportunidades WHERE id = ?").bind(String(d.op_id)).first(); if (o && o.etapa !== "final") opId = o.id; }
  const agora = Date.now(), ano = orcAno();
  for (let t = 0; t < 4; t++) {
    const r = await env.DB.prepare("SELECT MAX(seq) AS n FROM orcamentos WHERE ano = ?").bind(ano).first();
    const seq = (r && r.n || 0) + 1, num = "ORC-" + ano + "-" + String(seq).padStart(5, "0"), id = "orc-" + aleatorio(8);
    const ops = [
      env.DB.prepare("INSERT INTO orcamentos (id, ano, seq, num, parceiro_id, cliente, status, total, mensal, lt_id, op_id, dados, versao, criado_em, criado_por, criado_nome, atualizado_em, atualizado_por) VALUES (?,?,?,?,?,?,'salvo',?,?,?,?,?,1,?,?,?,?,?)")
        .bind(id, ano, seq, num, m.pid, m.nome, m.total, m.mensal, lt ? lt.id : null, opId, JSON.stringify(m.dados), agora, u.login, u.nome, agora, u.login),
      env.DB.prepare("INSERT INTO auditoria (quando, email, colecao, doc_id, num, acao) VALUES (?,?,?,?,?,?)").bind(agora, u.login, "orcamentos", id, num, "Orçamento criado · " + m.nome + (m.mensal ? " · mensal R$ " + m.mensal.toFixed(2) : "") + (lt ? " · a partir do L.T. " + lt.num : ""))
    ];
    if (lt) ops.push(env.DB.prepare("UPDATE levantamentos SET status = 'convertido', orc_id = ?, atualizado_em = ?, atualizado_por = ? WHERE id = ? AND status <> 'convertido'").bind(id, agora, u.login, lt.id));
    try {
      const res = await env.DB.batch(ops);
      if (lt && !res[2].meta.changes) {
        await env.DB.batch([env.DB.prepare("DELETE FROM orcamentos WHERE id = ?").bind(id)]);
        return json({ erro: "O L.T. " + lt.num + " já foi convertido em orçamento por outra pessoa." }, 409);
      }
      await orcVincular(env, m.itens);
      if (opId) await orcAtualizarOp(env, opId, num, m, u, "Orçamento " + num + " montado" + (lt ? " a partir do L.T. " + lt.num : "") + " por " + (u.nome || u.login) + " (" + orcValTxt(m) + ").");
      const row = await env.DB.prepare(ORC_SEL + " WHERE o.id = ?").bind(id).first();
      return json({ item: orcSaida(row, true) }, 201);
    } catch (e) {
      if (!/UNIQUE/i.test(String(e && e.message))) throw e;
    }
  }
  return json({ erro: "Não foi possível gerar o número. Tente de novo." }, 409);
}
async function orcRotas(request, env, url, u) {
  if (!orcPode(u)) return json({ erro: "Sem permissão para esta área." }, 403);
  const p = url.pathname, m = request.method;
  if (p === "/api/levantamentos" && m === "GET") return ltListar(env);
  let r = p.match(/^\/api\/levantamentos\/([A-Za-z0-9_-]+)(?:\/(sugestao|descartar|reabrir))?$/);
  if (r) {
    if (r[2] === "sugestao" && m === "GET") return ltSugestao(env, r[1]);
    if ((r[2] === "descartar" || r[2] === "reabrir") && m === "POST") {
      const de = r[2] === "descartar" ? "pendente" : "descartado", para = r[2] === "descartar" ? "descartado" : "pendente";
      const res = await env.DB.prepare("UPDATE levantamentos SET status = ?, atualizado_em = ?, atualizado_por = ? WHERE id = ? AND status = ?").bind(para, Date.now(), u.login, r[1], de).run();
      if (!res.meta.changes) return json({ erro: "Este levantamento mudou. Atualize a lista." }, 409);
      return json({ ok: true });
    }
    return json({ erro: "Não encontrado" }, 404);
  }
  if (p === "/api/orcamentos" && m === "GET") {
    const { results } = await env.DB.prepare(ORC_SEL + " WHERE o.excluido = 0 ORDER BY o.ano DESC, o.seq DESC LIMIT 2000").all();
    return json({ itens: results.map((x) => orcSaida(x)) });
  }
  if (p === "/api/orcamentos" && m === "POST") return orcCriar(env, request, u);
  if (p === "/api/orcamentos/vendedores" && m === "GET") {
    const { results } = await env.DB.prepare("SELECT id, nome FROM usuarios WHERE ativo = 1 AND vendedor = 1 ORDER BY nome COLLATE NOCASE").all();
    return json({ vendedores: results });
  }
  r = p.match(/^\/api\/orcamentos\/([A-Za-z0-9_-]+)(?:\/(status|pedido|oportunidade))?$/);
  if (!r) return json({ erro: "Não encontrado" }, 404);
  const id = r[1];
  const atual = await env.DB.prepare(ORC_SEL + " WHERE o.id = ? AND o.excluido = 0").bind(id).first();
  if (!atual) return json({ erro: "Orçamento não encontrado" }, 404);
  if (!r[2] && m === "GET") return json({ item: orcSaida(atual, true) });
  const agora = Date.now();
  if (!r[2] && m === "PUT") {
    if (atual.os_id) return json({ erro: "Este orçamento já foi enviado ao pedido (OS " + atual.os_num + "). Para mudar, duplique o orçamento." }, 409);
    let d; try { d = await lerJson(request, 3e5); } catch { return json({ erro: "Dados inválidos" }, 400); }
    const mm = await orcMontar(env, d);
    if (mm.erro) return json({ erro: mm.erro }, 400);
    const res = await env.DB.prepare("UPDATE orcamentos SET parceiro_id = ?, cliente = ?, total = ?, mensal = ?, dados = ?, versao = versao + 1, atualizado_em = ?, atualizado_por = ? WHERE id = ? AND versao = ? AND excluido = 0 AND os_id IS NULL")
      .bind(mm.pid, mm.nome, mm.total, mm.mensal, JSON.stringify(mm.dados), agora, u.login, id, parseInt(d.versao, 10) || 0).run();
    if (!res.meta.changes) return json({ erro: "Outra pessoa alterou este orçamento. Abra de novo pela lista para ver a versão atual." }, 409);
    await env.DB.prepare("INSERT INTO auditoria (quando, email, colecao, doc_id, num, acao) VALUES (?,?,?,?,?,?)").bind(agora, u.login, "orcamentos", id, atual.num, "Orçamento alterado · total R$ " + mm.total.toFixed(2) + (mm.mensal ? " · mensal R$ " + mm.mensal.toFixed(2) : "")).run();
    await orcVincular(env, mm.itens);
    if (atual.op_id) await orcAtualizarOp(env, atual.op_id, atual.num, mm, u, "Orçamento " + atual.num + " alterado por " + (u.nome || u.login) + " (" + orcValTxt(mm) + ").");
    return json({ item: orcSaida(await env.DB.prepare(ORC_SEL + " WHERE o.id = ?").bind(id).first(), true) });
  }
  if (r[2] === "status" && m === "POST") {
    let d; try { d = await lerJson(request, 2e3); } catch { d = {}; }
    if (!ORC_STATUS.includes(d.status)) return json({ erro: "Situação inválida" }, 400);
    if (atual.os_id && d.status !== "aprovado") return json({ erro: "Orçamento já enviado ao pedido: a situação fica como Aprovado." }, 409);
    await env.DB.batch([
      env.DB.prepare("UPDATE orcamentos SET status = ?, versao = versao + 1, atualizado_em = ?, atualizado_por = ? WHERE id = ?").bind(d.status, agora, u.login, id),
      env.DB.prepare("INSERT INTO auditoria (quando, email, colecao, doc_id, num, acao) VALUES (?,?,?,?,?,?)").bind(agora, u.login, "orcamentos", id, atual.num, "Situação: " + d.status)
    ]);
    return json({ item: orcSaida(await env.DB.prepare(ORC_SEL + " WHERE o.id = ?").bind(id).first(), true) });
  }
  if (r[2] === "oportunidade" && m === "POST") return orcParaOportunidade(env, request, u, atual);
  if (r[2] === "pedido" && m === "POST") {
    if (atual.op_id) return json({ erro: "Este orçamento é da oportunidade " + (atual.op_cod || "do CRM") + ". A OS de instalação é gerada ao finalizar a oportunidade como Fechado no CRM." }, 409);
    // trava: só um pedido por orçamento
    const trava = await env.DB.prepare("UPDATE orcamentos SET os_id = 'gerando', atualizado_em = ? WHERE id = ? AND os_id IS NULL AND excluido = 0").bind(agora, id).run();
    if (!trava.meta.changes) return json({ erro: "Este orçamento já foi enviado ao pedido." }, 409);
    try {
      const d = JSON.parse(atual.dados), q = rotulo(agora);
      const itens = (d.itens || []).filter((i) => i.tipo !== "servico").map((i) => ({ qtd: (Math.round(i.qtd) || 1) + "x", nome: (String(i.descricao || "") + (i.obs ? " (" + i.obs + ")" : "")).slice(0, 120), st: "pendente", prev: "" }));
      const svs = d.mensal && d.mensal.itens ? d.mensal.itens : [];
      const txtMensal = svs.length ? "Serviço mensal: " + svs.map((s) => (s.qtd > 1 ? (Math.round(s.qtd) || 1) + "x " : "") + s.descricao).join(", ") + (d.mensal.prazo_meses ? " · contrato de " + d.mensal.prazo_meses + " meses" : "") : "";
      if (!itens.length) svs.forEach((s) => itens.push({ qtd: (Math.round(s.qtd) || 1) + "x", nome: (s.descricao + " (serviço mensal" + (s.obs ? " · " + s.obs : "") + ")").slice(0, 120), st: "pendente", prev: "" }));
      const cid = d.cliente && d.cliente.cidade ? String(d.cliente.cidade).replace(/\s*\([A-Z]{2}\)\s*$/, "") : "";
      let os = null;
      for (let t = 0; t < 3 && !os; t++) {
        const num = await proximoNumero(env, "os"), oid = "os-" + aleatorio(6);
        const dados = {
          id: oid, num, tipo: "pedido", sub: null, orc: atual.num, cliente: atual.cliente, cidade: cid || "—",
          obs: "Orçamento " + atual.num + " aprovado" + (txtMensal ? ". " + txtMensal : "") + (d.obs ? ". " + String(d.obs).slice(0, 300) : ""),
          servico: ((d.itens || []).length ? "Instalação" : "Ativação do serviço mensal") + " conforme orçamento " + atual.num, stage: 0, agenda: "A agendar", tecnico: null, pending: null, itens,
          hist: [{ quando: q, quem: u.nome, acao: "OS aberta a partir do orçamento " + atual.num + " (Comercial · enviado ao pedido)" }],
          orcamento: { id: atual.id, num: atual.num }, servicosOrc: orcServicos(d)
        };
        try {
          await env.DB.batch([
            env.DB.prepare("INSERT INTO ordens_servico (id, num, stage, dados, versao, atualizado_em, atualizado_por) VALUES (?,?,0,?,1,?,?)").bind(oid, num, JSON.stringify(dados), agora, u.login),
            env.DB.prepare("INSERT INTO auditoria (quando, email, colecao, doc_id, num, acao) VALUES (?,?,?,?,?,?)").bind(agora, u.login, "os", oid, num, "OS aberta a partir do orçamento " + atual.num)
          ]);
          os = { id: oid, num };
        } catch (e) { if (!/UNIQUE/i.test(String(e && e.message))) throw e; }
      }
      if (!os) throw new Error("num");
      await env.DB.batch([
        env.DB.prepare("UPDATE orcamentos SET os_id = ?, os_num = ?, status = 'aprovado', versao = versao + 1, atualizado_em = ?, atualizado_por = ? WHERE id = ?").bind(os.id, os.num, agora, u.login, id),
        env.DB.prepare("INSERT INTO auditoria (quando, email, colecao, doc_id, num, acao) VALUES (?,?,?,?,?,?)").bind(agora, u.login, "orcamentos", id, atual.num, "Enviado ao pedido · OS " + os.num)
      ]);
      if (atual.lt_id) {
        const lt = await env.DB.prepare("SELECT os_id FROM levantamentos WHERE id = ?").bind(atual.lt_id).first();
        if (lt) await orcNotaCRM(env, lt.os_id, "Orçamento " + atual.num + " enviado ao pedido · OS " + os.num + " aberta no Quadro de OS.", u, null);
      }
      return json({ item: orcSaida(await env.DB.prepare(ORC_SEL + " WHERE o.id = ?").bind(id).first(), true), os });
    } catch (e) {
      await env.DB.prepare("UPDATE orcamentos SET os_id = NULL WHERE id = ? AND os_id = 'gerando'").bind(id).run();
      throw e;
    }
  }
  if (!r[2] && m === "DELETE") {
    if (atual.os_id) return json({ erro: "Orçamento já enviado ao pedido (OS " + atual.os_num + ") não pode ser excluído." }, 409);
    if (!ehAdmin(u) && atual.criado_por !== u.login) return json({ erro: "Só quem criou o orçamento ou um administrador pode excluir." }, 403);
    const ops = [
      env.DB.prepare("UPDATE orcamentos SET excluido = 1, atualizado_em = ?, atualizado_por = ? WHERE id = ?").bind(agora, u.login, id),
      env.DB.prepare("INSERT INTO auditoria (quando, email, colecao, doc_id, num, acao) VALUES (?,?,?,?,?,?)").bind(agora, u.login, "orcamentos", id, atual.num, "Orçamento excluído")
    ];
    if (atual.lt_id) ops.push(env.DB.prepare("UPDATE levantamentos SET status = 'pendente', orc_id = NULL, atualizado_em = ?, atualizado_por = ? WHERE id = ? AND orc_id = ?").bind(agora, u.login, atual.lt_id, id));
    await env.DB.batch(ops);
    if (atual.op_id) {
      const op = await env.DB.prepare("SELECT id, etapa, dados FROM crm_oportunidades WHERE id = ?").bind(atual.op_id).first();
      if (op && op.etapa !== "final") { try { const d = JSON.parse(op.dados); if (d.orc === atual.num) d.orc = ""; d.hist = (d.hist || []).concat([{ data: orcHoje(), tipo: "sis", autor: u.nome || "Sistema", texto: "Orçamento " + atual.num + " excluído por " + (u.nome || u.login) + "." }]); await env.DB.prepare("UPDATE crm_oportunidades SET dados = ?, versao = versao + 1 WHERE id = ?").bind(JSON.stringify(d), op.id).run(); } catch {} }
    }
    return json({ ok: true });
  }
  return json({ erro: "Não encontrado" }, 404);
}

// ---- Cadastro de serviços mensais (monitoramento, rastreamento…) usados nos orçamentos
var SVC_PERM = "cad-servicos";
var svcPode = (u) => ehAdmin(u) || u.permissoes.includes(SVC_PERM);
var SVC_COLS = ["codigo", "descricao", "categoria", "unidade", "preco_venda", "custo", "situacao", "obs"];
function svcLimpa(d) {
  return {
    codigo: cadTxt(d.codigo, 40), descricao: cadTxt(d.descricao, 200), categoria: cadTxt(d.categoria, 60),
    unidade: (cadTxt(d.unidade, 6) || "MÊS").toUpperCase(), preco_venda: cadNum(d.preco_venda), custo: cadNum(d.custo),
    situacao: d.situacao === "Inativo" ? "Inativo" : "Ativo", obs: String(d.obs || "").trim().slice(0, 1000) || null
  };
}
async function svcRotas(request, env, url, u) {
  const r = url.pathname.match(/^\/api\/cadastros\/servicos(?:\/(\d+))?$/), m = request.method;
  if (!r) return json({ erro: "Não encontrado" }, 404);
  const id = r[1] ? parseInt(r[1], 10) : null;
  if (m === "GET") {
    if (!svcPode(u) && !orcPode(u)) return json({ erro: "Sem permissão para esta área." }, 403);
    if (id) {
      const row = await env.DB.prepare("SELECT * FROM servicos WHERE id = ?").bind(id).first();
      return row ? json({ item: row }) : json({ erro: "Não encontrado" }, 404);
    }
    const q = cadNorm(url.searchParams.get("q") || "").slice(0, 80), sit = url.searchParams.get("situacao") || "Ativo";
    const cond = [], args = [];
    if (sit !== "todos") { cond.push("situacao = ?"); args.push(sit === "Inativo" ? "Inativo" : "Ativo"); }
    for (const t of q.split(" ").filter(Boolean).slice(0, 6)) { cond.push("busca LIKE ?"); args.push("%" + t + "%"); }
    const { results } = await env.DB.prepare("SELECT * FROM servicos " + (cond.length ? "WHERE " + cond.join(" AND ") : "") + " ORDER BY descricao COLLATE NOCASE LIMIT 500").bind(...args).all();
    return json({ total: results.length, pagina: 1, por: 500, itens: results });
  }
  if (!svcPode(u)) return json({ erro: "Sem permissão para alterar os serviços mensais." }, 403);
  if (!((m === "POST" && !id) || (m === "PUT" && id))) return json({ erro: "Não encontrado" }, 404);
  let d; try { d = await lerJson(request, 2e4); } catch { return json({ erro: "Dados inválidos" }, 400); }
  const s = svcLimpa(d), agora = Date.now();
  if (!s.descricao) return json({ erro: "Informe a descrição do serviço." }, 400);
  if (!s.codigo) {
    if (id) return json({ erro: "Informe o código." }, 400);
    const mx = await env.DB.prepare("SELECT MAX(CAST(substr(codigo, 5) AS INTEGER)) AS n FROM servicos WHERE codigo LIKE 'SRV-%'").first();
    s.codigo = "SRV-" + String(((mx && mx.n) || 0) + 1).padStart(4, "0");
  }
  const busca = cadNorm([s.codigo, s.descricao, s.categoria].join(" "));
  const vals = SVC_COLS.map((c) => s[c]);
  try {
    if (!id) {
      const res = await env.DB.prepare(`INSERT INTO servicos (${SVC_COLS.join(",")}, busca, criado_em, atualizado_em, atualizado_por) VALUES (${SVC_COLS.map(() => "?").join(",")},?,?,?,?)`).bind(...vals, busca, agora, agora, u.login).run();
      await env.DB.prepare("INSERT INTO auditoria (quando, email, colecao, doc_id, num, acao) VALUES (?,?,?,?,?,?)").bind(agora, u.login, "servicos", String(res.meta.last_row_id), s.codigo, "Serviço mensal criado · " + s.descricao).run();
      return json({ item: await env.DB.prepare("SELECT * FROM servicos WHERE id = ?").bind(res.meta.last_row_id).first() }, 201);
    }
    const res = await env.DB.prepare(`UPDATE servicos SET ${SVC_COLS.map((c) => c + " = ?").join(", ")}, busca = ?, atualizado_em = ?, atualizado_por = ?, versao = versao + 1 WHERE id = ? AND versao = ?`).bind(...vals, busca, agora, u.login, id, parseInt(d.versao, 10) || 0).run();
    if (!res.meta.changes) return json({ erro: "Outra pessoa alterou este serviço. Abra de novo para ver a versão atual." }, 409);
    await env.DB.prepare("INSERT INTO auditoria (quando, email, colecao, doc_id, num, acao) VALUES (?,?,?,?,?,?)").bind(agora, u.login, "servicos", String(id), s.codigo, "Serviço mensal alterado · " + s.descricao).run();
    return json({ item: await env.DB.prepare("SELECT * FROM servicos WHERE id = ?").bind(id).first() });
  } catch (e) {
    if (/UNIQUE/i.test(String(e && e.message))) return json({ erro: "Já existe um serviço com o código " + s.codigo + "." }, 409);
    throw e;
  }
}

// ---- Ligações com o CRM: L.T. e orçamentos de cada oportunidade
async function crmVinculos(env) {
  const [a, b] = await env.DB.batch([
    env.DB.prepare("SELECT c.id AS op, l.id, l.num, l.status, l.os_num, json_array_length(l.itens) AS n FROM crm_oportunidades c JOIN levantamentos l ON l.os_id = c.os_id"),
    env.DB.prepare("SELECT id, num, op_id, total, mensal, status, os_num, atualizado_em FROM orcamentos WHERE excluido = 0 AND op_id IS NOT NULL ORDER BY ano, seq")
  ]);
  const v = {};
  for (const r of a.results) v[r.op] = { lt: { id: r.id, num: r.num, status: r.status, os_num: r.os_num, n: r.n }, orcs: [] };
  for (const r of b.results) (v[r.op_id] = v[r.op_id] || { lt: null, orcs: [] }).orcs.push({ id: r.id, num: r.num, total: r.total, mensal: r.mensal, status: r.status, os_num: r.os_num });
  return v;
}
// Orçamento que vale para a oportunidade: o do campo "Nº do orçamento" ou o último ligado a ela
async function orcDaOp(env, op) {
  const n = String(op.orc || "").trim();
  let r = null;
  if (n) r = await env.DB.prepare("SELECT * FROM orcamentos WHERE excluido = 0 AND num = ? AND (op_id = ? OR op_id IS NULL)").bind(n, op.id).first();
  if (!r) r = await env.DB.prepare("SELECT * FROM orcamentos WHERE excluido = 0 AND op_id = ? ORDER BY atualizado_em DESC LIMIT 1").bind(op.id).first();
  return r;
}

// Documento do orçamento "anexado" à OS e à oportunidade: leitura para quem trabalha na OS, CRM, Compras e Estoque
async function orcVer(env, chave) {
  const k = decodeURIComponent(String(chave || "")).slice(0, 40);
  if (!/^[A-Za-z0-9_-]{3,40}$/.test(k)) return json({ erro: "Orçamento inválido" }, 400);
  const row = await env.DB.prepare(ORC_SEL + " WHERE (o.id = ? OR o.num = ?) AND o.excluido = 0").bind(k, k.toUpperCase()).first();
  if (!row) return json({ erro: "Orçamento não encontrado" }, 404);
  return json({ item: orcSaida(row, true) });
}

// Regras de comissão: os tipos de contrato são os serviços mensais do cadastro (o % e a forma de pagar ficam nas regras)
async function crmRegrasComServicos(env, R) {
  const { results } = await env.DB.prepare("SELECT id, descricao, situacao FROM servicos ORDER BY descricao COLLATE NOCASE").all();
  if (!results.length) return R;
  const antigos = Array.isArray(R.contratos) ? R.contratos : [];
  const contratos = results.map((s) => {
    const id = "srv-" + s.id, a = antigos.find((t) => t.id === id) || antigos.find((t) => cadNorm(t.nome) === cadNorm(s.descricao));
    return { id, nome: s.descricao + (s.situacao === "Ativo" ? "" : " (inativo)"), modo: a && a.modo === "primeira" ? "primeira" : "mensal", venda: a ? +a.venda || 0 : 3, equipe: a ? +a.equipe || 0 : 2, servico_id: s.id };
  });
  return Object.assign({}, R, { contratos });
}

// Orçamento avulso → oportunidade no CRM (com ou sem vendedor responsável)
async function orcParaOportunidade(env, request, u, atual) {
  if (atual.op_id) return json({ erro: "Este orçamento já está na oportunidade " + (atual.op_cod || "do CRM") + "." }, 409);
  if (atual.os_id) return json({ erro: "Este orçamento já foi enviado ao pedido (OS " + atual.os_num + ")." }, 409);
  let b; try { b = await lerJson(request, 2e3); } catch { b = {}; }
  const vend = cadTxt(b.vendedor, 120) || "";
  if (vend && !(await env.DB.prepare("SELECT 1 FROM usuarios WHERE ativo = 1 AND vendedor = 1 AND nome = ?").bind(vend).first())) return json({ erro: "Vendedor não encontrado (marque “Vendedor” no cadastro de usuários)." }, 400);
  let D = {}; try { D = JSON.parse(atual.dados); } catch {}
  const c = D.cliente || {}, mm = D.mensal && D.mensal.ativo ? D.mensal : null, hoje = orcHoje();
  const total = +atual.total || 0, mensal = +atual.mensal || 0;
  const itens = (D.itens || []).map((i) => ({ q: Math.round(i.qtd) || 1, d: String(i.descricao || "") + (i.obs ? " (" + i.obs + ")" : "") }))
    .concat(mm ? (mm.itens || []).map((i) => ({ q: Math.round(i.qtd) || 1, d: String(i.descricao || "") + " (serviço mensal)" })) : []);
  const op = {
    id: "op-" + aleatorio(8), cod: "", cliente: atual.cliente || "", contato: c.contato || "", tel: c.telefone || "",
    cidade: String(c.cidade || "").replace(/\s*\([A-Z]{2}\)\s*$/, ""), servico: "", descricao: D.ref || String(D.obs || "").slice(0, 200),
    os: "", osId: null, tecnico: "", visita: "", vendedor: vend, aux: [], apoio: [], etapa: "montado", desde: hoje, criado: hoje,
    valor: mensal, total, prazo: (mm && mm.prazo_meses) || 36, validade: D.validade || "", orc: atual.num,
    tv: mensal > 0 ? (total > 0 ? "misto" : "recorrente") : "execucao", tvAuto: true, itens, levObs: "",
    hist: [{ data: hoje, tipo: "sis", autor: u.nome || "Sistema", texto: "Criada a partir do orçamento " + atual.num + " por " + (u.nome || u.login) + (vend ? " · responsável: " + vend : " · sem vendedor (visível para todos)") + " (" + orcValTxt({ total, mensal }) + ")." }]
  };
  if (mm && mm.itens && mm.itens.length) { const top = mm.itens.slice().sort((x, y) => (y.total || 0) - (x.total || 0))[0]; op.modalidade = "srv-" + top.servico_id; op.modAuto = true; }
  const criada = await crmInserir(env, op, u.login);
  if (!criada) return json({ erro: "Não foi possível criar a oportunidade." }, 500);
  const agora = Date.now();
  await env.DB.batch([
    env.DB.prepare("UPDATE orcamentos SET op_id = ?, versao = versao + 1, atualizado_em = ?, atualizado_por = ? WHERE id = ? AND op_id IS NULL").bind(op.id, agora, u.login, atual.id),
    env.DB.prepare("INSERT INTO auditoria (quando, email, colecao, doc_id, num, acao) VALUES (?,?,?,?,?,?)").bind(agora, u.login, "orcamentos", atual.id, atual.num, "Enviado para a oportunidade " + criada.cod + (vend ? " · " + vend : ""))
  ]);
  return json({ item: orcSaida(await env.DB.prepare(ORC_SEL + " WHERE o.id = ?").bind(atual.id).first(), true), op: { id: op.id, cod: criada.cod } });
}
// CRM: oportunidade sem vendedor é de todos; com vendedor, só dele (e de quem participa) — administrador e financeiro veem tudo
function crmPodeVer(d, u) {
  if (!d || !d.vendedor) return true;
  const n = u.nome || "";
  return d.vendedor === n || (d.aux || []).includes(n) || (d.apoio || []).includes(n);
}

// ===== Leads (Comercial · pré-venda) =====
// Lead = contato que chegou (Instagram, Facebook, WhatsApp, bot do site, formulário, indicação, telefone).
// Etapas: novo → contato → qualificado → convertido (oportunidade ou visita técnica) | descartado.
// Visibilidade igual às oportunidades: sem vendedor = todos; com vendedor = só ele; admin e Comissões veem tudo.
var LEAD_PERM = "com-leads";
var LEAD_ETAPAS = ["novo", "contato", "qualificado", "convertido", "descartado"];
var LEAD_ORIGENS = { instagram: "Instagram", facebook: "Facebook", whatsapp: "WhatsApp", bot: "Bot do site", site: "Formulário do site", indicacao: "Indicação", telefone: "Telefone", outro: "Outro" };
var LEAD_MOTIVOS = ["Sem interesse", "Fora da área de atendimento", "Só pesquisando preço", "Contato inválido / não responde", "Duplicado", "Já é cliente (encaminhado ao atendimento)", "Outro"];
var LEAD_SEL = "SELECT id, cod, etapa, vendedor, op_id, os_id, dados, versao, criado_em, atualizado_em FROM leads";
var leadTelNorm = (t) => {
  let d = String(t || "").replace(/\D/g, "");
  if (d.length > 11 && d.startsWith("55")) d = d.slice(2);
  return d.length >= 8 ? d.slice(-11) : "";
};
var leadVerTudo = (u) => ehAdmin(u) || u.permissoes.includes("com-comissoes");
function leadPodeVer(d, u) {
  return leadVerTudo(u) || !d.vendedor || d.vendedor === (u.nome || "");
}
function leadSaida(r) {
  let d = {};
  try { d = JSON.parse(r.dados); } catch {}
  d.id = r.id; d.cod = r.cod; d.etapa = r.etapa; d.vendedor = r.vendedor || ""; d.versao = r.versao;
  return d;
}
function leadLimparEntrada(b) {
  const t = (v, n) => String(v == null ? "" : v).replace(/\s+/g, " ").trim().slice(0, n);
  const origem = String(b.origem || "").toLowerCase().trim();
  return {
    nome: t(b.nome, 120),
    empresa: t(b.empresa, 160),
    tel: t(b.telefone || b.tel || b.whatsapp, 40),
    email: t(b.email, 120).toLowerCase(),
    cidade: t(b.cidade, 80),
    origem: LEAD_ORIGENS[origem] ? origem : "outro",
    campanha: t(b.campanha || b.anuncio, 160),
    pagina: t(b.pagina, 300),
    mensagem: String(b.mensagem || "").trim().slice(0, 4000),
    conversa: String(b.conversa || "").trim().slice(0, 20000),
    interesse: t(b.interesse, 80),
    tipoCliente: t(b.tipo_cliente || b.tipoCliente, 40),
    melhorHorario: t(b.melhor_horario || b.melhorHorario, 80),
  };
}
async function leadProxCod(env) {
  const r = await env.DB.prepare("SELECT COALESCE(MAX(seq),0) AS m FROM leads").first();
  const seq = (r ? r.m : 0) + 1;
  return { seq, cod: "LD-" + String(seq).padStart(5, "0") };
}
// cria o lead (ou junta ao lead aberto com o mesmo telefone/e-mail)
async function leadCriar(env, e, quem, autor, vendedor) {
  const agora = Date.now();
  const tn = leadTelNorm(e.tel);
  let dup = null;
  if (tn) dup = await env.DB.prepare(LEAD_SEL + " WHERE tel_norm = ? AND etapa IN ('novo','contato','qualificado') ORDER BY criado_em DESC LIMIT 1").bind(tn).first();
  if (!dup && e.email) dup = await env.DB.prepare(LEAD_SEL + " WHERE email = ? AND etapa IN ('novo','contato','qualificado') ORDER BY criado_em DESC LIMIT 1").bind(e.email).first();
  if (dup) {
    const d = leadSaida(dup);
    for (const k of ["nome", "empresa", "tel", "email", "cidade", "campanha", "interesse", "tipoCliente", "melhorHorario"]) if (!d[k] && e[k]) d[k] = e[k];
    if (e.conversa) d.conversa = (d.conversa ? d.conversa + "\n\n— nova conversa —\n" : "") + e.conversa;
    d.hist = d.hist || [];
    d.hist.push({ q: agora, autor, tipo: "sis", texto: "Novo contato pelo canal " + LEAD_ORIGENS[e.origem] + (e.mensagem ? ": " + e.mensagem.slice(0, 600) : "") + " (lead já estava aberto — juntado a este card)." });
    d.novoContato = agora;
    await env.DB.prepare("UPDATE leads SET dados = ?, versao = versao + 1, atualizado_em = ?, atualizado_por = ? WHERE id = ?").bind(JSON.stringify(d), agora, quem, dup.id).run();
    return { id: dup.id, cod: dup.cod, duplicado: true };
  }
  const pre = !!(e.interesse && e.cidade);
  const d = Object.assign({}, e, {
    chegou: agora, desde: agora, primeiroContato: null, contatos: [], retorno: "",
    preQualificado: pre,
    hist: [{ q: agora, autor, tipo: "sis", texto: "Lead recebido · " + LEAD_ORIGENS[e.origem] + (e.campanha ? " · " + e.campanha : "") + (vendedor ? " · responsável: " + vendedor : " · sem vendedor (visível para todos)") + (pre ? " · já chegou com interesse e cidade (pré-qualificado)" : "") }],
  });
  for (let i = 0; i < 3; i++) {
    const { seq, cod } = await leadProxCod(env);
    const id = "ld-" + aleatorio(8);
    try {
      await env.DB.batch([
        env.DB.prepare("INSERT INTO leads (id, seq, cod, etapa, origem, tel_norm, email, vendedor, dados, versao, criado_em, atualizado_em, atualizado_por) VALUES (?,?,?,?,?,?,?,?,?,1,?,?,?)")
          .bind(id, seq, cod, "novo", e.origem, tn || null, e.email || null, vendedor || null, JSON.stringify(d), agora, agora, quem),
        env.DB.prepare("INSERT INTO auditoria (quando, email, colecao, doc_id, num, acao) VALUES (?,?,?,?,?,?)").bind(agora, quem, "leads", id, cod, "Lead recebido · " + LEAD_ORIGENS[e.origem]),
      ]);
      return { id, cod, duplicado: false };
    } catch (err) {
      if (!/UNIQUE/i.test(String(err && err.message))) throw err;
    }
  }
  throw new Error("Não foi possível gerar o número do lead.");
}
async function leadVendedores(env) {
  const { results } = await env.DB.prepare("SELECT nome FROM usuarios WHERE ativo = 1 AND vendedor = 1 ORDER BY nome COLLATE NOCASE").all();
  return results.map((r) => r.nome);
}
async function leadToken(env, novo) {
  let r = await env.DB.prepare("SELECT valor FROM crm_config WHERE chave = 'leads_token'").first();
  if (!r || novo) {
    const t = "ld_" + aleatorio(24);
    await env.DB.prepare("INSERT INTO crm_config (chave, valor) VALUES ('leads_token', ?) ON CONFLICT(chave) DO UPDATE SET valor = excluded.valor").bind(t).run();
    return t;
  }
  return r.valor;
}
// ---- entrada pública (bot do site, formulário, Meta, WhatsApp) ----
var LEAD_CORS = { "access-control-allow-origin": "*", "access-control-allow-methods": "POST, OPTIONS", "access-control-allow-headers": "content-type, x-sgo-chave", "access-control-max-age": "86400" };
async function leadEntrada(request, env) {
  if (request.method === "OPTIONS") return new Response(null, { status: 204, headers: LEAD_CORS });
  if (request.method !== "POST") return json({ erro: "Use POST." }, 405, LEAD_CORS);
  let b;
  try { b = await lerJson(request, 3e4); } catch { return json({ erro: "JSON inválido." }, 400, LEAD_CORS); }
  const chave = request.headers.get("x-sgo-chave") || String(b.chave || "");
  const r = await env.DB.prepare("SELECT valor FROM crm_config WHERE chave = 'leads_token'").first();
  if (!r || !chave || !iguais(chave, r.valor)) return json({ erro: "Chave inválida." }, 401, LEAD_CORS);
  if (b.site_url) return json({ ok: true }, 200, LEAD_CORS); // armadilha anti-robô do formulário (campo escondido)
  const e = leadLimparEntrada(b);
  if (!e.nome && !e.tel && !e.email) return json({ erro: "Informe pelo menos nome e telefone ou e-mail." }, 400, LEAD_CORS);
  if (!e.tel && !e.email) return json({ erro: "Informe telefone ou e-mail para contato." }, 400, LEAD_CORS);
  if (!b.origem) e.origem = "site";
  const res = await leadCriar(env, e, "integracao", LEAD_ORIGENS[e.origem], "");
  return json({ ok: true, lead: res.cod, duplicado: res.duplicado }, 200, LEAD_CORS);
}
// ---- rotas internas ----
async function leadRotas(request, env, url, u) {
  const p = url.pathname, m = request.method;
  if (p === "/api/leads" && m === "GET") {
    const { results } = await env.DB.prepare(LEAD_SEL + " ORDER BY criado_em DESC LIMIT 3000").all();
    const docs = results.map(leadSaida).filter((d) => leadPodeVer(d, u));
    return json({ docs, eu: { nome: u.nome, admin: ehAdmin(u), verTudo: leadVerTudo(u) }, vendedores: await leadVendedores(env), motivos: LEAD_MOTIVOS, origens: LEAD_ORIGENS });
  }
  if (p === "/api/leads" && m === "POST") {
    let b;
    try { b = await lerJson(request, 3e4); } catch { return json({ erro: "Dados inválidos." }, 400); }
    const e = leadLimparEntrada(b);
    if (!e.nome) return json({ erro: "Informe o nome do contato." }, 400);
    if (!e.tel && !e.email) return json({ erro: "Informe o telefone ou o e-mail." }, 400);
    if (!b.origem) return json({ erro: "Escolha a origem do lead." }, 400);
    let vend = String(b.vendedor || "").trim();
    if (vend && !(await leadVendedores(env)).includes(vend)) return json({ erro: "Vendedor não encontrado." }, 400);
    const res = await leadCriar(env, e, u.login, u.nome || u.login, vend);
    return json({ ok: true, id: res.id, cod: res.cod, duplicado: res.duplicado });
  }
  if (p === "/api/leads/config") {
    if (!ehAdmin(u)) return json({ erro: "Só o administrador vê a chave da integração." }, 403);
    const token = await leadToken(env, m === "POST");
    return json({ token, url: url.origin + "/api/leads/entrada" });
  }
  const r = p.match(/^\/api\/leads\/(ld-[a-z0-9]{6,40})\/acao$/);
  if (!r || m !== "POST") return json({ erro: "Não encontrado" }, 404);
  const row = await env.DB.prepare(LEAD_SEL + " WHERE id = ?").bind(r[1]).first();
  if (!row) return json({ erro: "Lead não encontrado." }, 404);
  const d = leadSaida(row);
  if (!leadPodeVer(d, u)) return json({ erro: "Este lead está com o vendedor " + d.vendedor + "." }, 403);
  let b;
  try { b = await lerJson(request, 3e4); } catch { return json({ erro: "Dados inválidos." }, 400); }
  if (b.versao && +b.versao !== row.versao) return json({ erro: "Outra pessoa alterou este lead. Atualizando…" }, 409);
  const agora = Date.now(), autor = u.nome || u.login, t = (v, n) => String(v == null ? "" : v).trim().slice(0, n);
  const fim = d.etapa === "convertido" || d.etapa === "descartado";
  const hist = (texto, tipo = "nota") => { d.hist = d.hist || []; d.hist.push({ q: agora, autor, tipo, texto }); };
  const souVend = async () => ehAdmin(u) || (await leadVendedores(env)).includes(autor);
  let extra = {};
  switch (b.acao) {
    case "assumir": {
      if (fim) return json({ erro: "Lead finalizado." }, 400);
      if (d.vendedor && d.vendedor !== autor && !leadVerTudo(u)) return json({ erro: "Lead já está com " + d.vendedor + "." }, 409);
      if (!(await souVend())) return json({ erro: "Só quem está marcado como Vendedor pode assumir leads." }, 403);
      d.vendedor = autor; hist("Assumido por " + autor + ".", "sis"); break;
    }
    case "encaminhar": {
      if (fim) return json({ erro: "Lead finalizado." }, 400);
      if (d.vendedor && d.vendedor !== autor && !leadVerTudo(u)) return json({ erro: "Só o responsável pode encaminhar." }, 403);
      const v = t(b.vendedor, 120);
      if (v && !(await leadVendedores(env)).includes(v)) return json({ erro: "Vendedor não encontrado." }, 400);
      const mot = t(b.motivo, 300);
      if (!mot) return json({ erro: "Informe o motivo do encaminhamento." }, 400);
      hist((v ? "Encaminhado de " + (d.vendedor || "ninguém") + " para " + v : "Devolvido para todos (sem vendedor)") + " · " + mot, "sis");
      d.vendedor = v; break;
    }
    case "contato": {
      if (fim) return json({ erro: "Lead finalizado." }, 400);
      const tipos = { ligacao: "Ligação", whatsapp: "WhatsApp", email: "E-mail", direct: "Mensagem no Instagram/Facebook", presencial: "Presencial" };
      const res = { falou: "Falou com o cliente", sem_resposta: "Sem resposta", retornar: "Pediu para retornar" };
      if (!tipos[b.tipo]) return json({ erro: "Escolha como foi o contato." }, 400);
      if (!res[b.resultado]) return json({ erro: "Escolha o resultado do contato." }, 400);
      const txt = t(b.texto, 2000);
      if (!txt) return json({ erro: "Descreva o que aconteceu no contato." }, 400);
      const ret = /^\d{4}-\d{2}-\d{2}$/.test(String(b.retorno || "")) ? b.retorno : "";
      if (b.resultado === "retornar" && !ret) return json({ erro: "Informe a data do retorno." }, 400);
      if (!d.vendedor) { if (!(await souVend())) return json({ erro: "Só quem está marcado como Vendedor pode atender leads." }, 403); d.vendedor = autor; }
      d.contatos = d.contatos || [];
      d.contatos.push({ q: agora, tipo: b.tipo, resultado: b.resultado, texto: txt, retorno: ret, autor });
      if (!d.primeiroContato) d.primeiroContato = agora;
      d.retorno = ret;
      d.novoContato = null;
      hist(tipos[b.tipo] + " · " + res[b.resultado] + (ret ? " · retornar em " + ret.split("-").reverse().join("/") : "") + ": " + txt, "contato");
      if (d.etapa === "novo") { d.etapa = "contato"; d.desde = agora; }
      break;
    }
    case "qualificar": {
      if (fim) return json({ erro: "Lead finalizado." }, 400);
      const q = { interesse: t(b.interesse, 80), tipoCliente: t(b.tipoCliente, 40), cidade: t(b.cidade, 80), porte: t(b.porte, 120), obsQualif: t(b.obs, 2000) };
      if (!q.interesse) return json({ erro: "Escolha o serviço de interesse." }, 400);
      if (!q.tipoCliente) return json({ erro: "Escolha o tipo de cliente." }, 400);
      if (!q.cidade) return json({ erro: "Informe a cidade." }, 400);
      if (!d.primeiroContato) return json({ erro: "Registre o primeiro contato antes de qualificar." }, 400);
      Object.assign(d, q);
      if (!d.vendedor) d.vendedor = autor;
      hist("Qualificado: " + q.interesse + " · " + q.tipoCliente + " · " + q.cidade + (q.porte ? " · " + q.porte : "") + (q.obsQualif ? ". " + q.obsQualif : ""), "sis");
      if (d.etapa !== "qualificado") { d.etapa = "qualificado"; d.desde = agora; }
      break;
    }
    case "converter": {
      if (d.etapa !== "qualificado") return json({ erro: "Qualifique o lead antes de converter." }, 400);
      const vend = t(b.vendedor, 120);
      if (vend && vend !== d.vendedor && !(await leadVendedores(env)).includes(vend)) return json({ erro: "Vendedor não encontrado." }, 400);
      const cliente = d.empresa || d.nome;
      const desc = [d.interesse, d.tipoCliente, d.porte, d.obsQualif || d.mensagem].filter(Boolean).join(" · ").slice(0, 400);
      if (b.destino === "oportunidade") {
        const hoje = crmHoje();
        const op = {
          id: "op-" + aleatorio(8), cod: "", cliente, contato: d.nome, tel: d.tel, cidade: d.cidade || "",
          servico: d.interesse || "", descricao: desc, os: "", osId: null, tecnico: "", visita: "",
          vendedor: vend, aux: [], apoio: [], etapa: "montar", desde: hoje, criado: hoje,
          valor: 0, total: 0, prazo: 36, validade: "", itens: [], levObs: "",
          lead: { id: d.id, cod: d.cod, origem: LEAD_ORIGENS[d.origem] || "" },
          hist: [{ data: hoje, tipo: "sis", autor, texto: "Criada a partir do lead " + d.cod + " (" + (LEAD_ORIGENS[d.origem] || "") + (d.campanha ? " · " + d.campanha : "") + ") · orçar sem visita técnica" + (vend ? " · responsável: " + vend : "") + (desc ? ". " + desc : "") }],
        };
        const criada = await crmInserir(env, op, u.login);
        if (!criada) return json({ erro: "Não foi possível criar a oportunidade." }, 500);
        d.op = { id: op.id, cod: criada.cod }; d.destino = "oportunidade";
        hist("Convertido em oportunidade " + criada.cod + " (orçamento a montar).", "sis");
        extra.op_id = op.id;
      } else if (b.destino === "visita") {
        const q = rotulo(agora);
        let os = null;
        for (let i = 0; i < 3 && !os; i++) {
          const num = await proximoNumero(env, "os"), id = "os-" + aleatorio(6);
          const dados = {
            id, num, tipo: "visita", sub: null, orc: null, cliente, cidade: d.cidade || "—",
            obs: "Lead " + d.cod + " (" + (LEAD_ORIGENS[d.origem] || "") + ") · contato: " + d.nome + (d.tel ? " · " + d.tel : "") + (desc ? ". " + desc : "") + (t(b.obs, 600) ? ". " + t(b.obs, 600) : ""),
            servico: "Levantamento para orçamento" + (d.interesse ? " · " + d.interesse : ""),
            stage: 3, agenda: "A agendar", tecnico: null, pending: null, itens: [],
            lead: { id: d.id, cod: d.cod, vendedor: vend, contato: d.nome, tel: d.tel, origem: LEAD_ORIGENS[d.origem] || "" },
            hist: [{ quando: q, quem: autor, acao: "OS de visita técnica aberta a partir do lead " + d.cod + " (Comercial) · direto para agendamento" }],
          };
          try {
            await env.DB.batch([
              env.DB.prepare("INSERT INTO ordens_servico (id, num, stage, dados, versao, atualizado_em, atualizado_por) VALUES (?,?,3,?,1,?,?)").bind(id, num, JSON.stringify(dados), agora, u.login),
              env.DB.prepare("INSERT INTO auditoria (quando, email, colecao, doc_id, num, acao) VALUES (?,?,?,?,?,?)").bind(agora, u.login, "os", id, num, "OS de visita aberta a partir do lead " + d.cod),
            ]);
            os = { id, num };
          } catch (err) { if (!/UNIQUE/i.test(String(err && err.message))) throw err; }
        }
        if (!os) return json({ erro: "Não foi possível abrir a OS de visita." }, 500);
        d.os = os; d.destino = "visita";
        hist("Convertido em visita técnica · OS " + os.num + " aberta em Aguardando agendamento. Quando a visita for concluída, a oportunidade nasce com " + (vend || "o vendedor") + " como responsável.", "sis");
        extra.os_id = os.id;
      } else return json({ erro: "Escolha: visita técnica ou oportunidade." }, 400);
      d.vendedor = vend; d.etapa = "convertido"; d.desde = agora; d.convertido = agora;
      break;
    }
    case "descartar": {
      if (fim) return json({ erro: "Lead já finalizado." }, 400);
      const mot = t(b.motivo, 120), obs = t(b.obs, 1000);
      if (!LEAD_MOTIVOS.includes(mot)) return json({ erro: "Escolha o motivo do descarte." }, 400);
      if (mot === "Outro" && !obs) return json({ erro: "Descreva o motivo." }, 400);
      d.motivo = mot; d.motivoObs = obs; d.etapaAnterior = d.etapa; d.etapa = "descartado"; d.desde = agora; d.descartado = agora;
      hist("Descartado · " + mot + (obs ? ": " + obs : ""), "sis");
      break;
    }
    case "reabrir": {
      if (d.etapa !== "descartado") return json({ erro: "Só lead descartado pode ser reaberto." }, 400);
      const mot = t(b.motivo, 300);
      if (!mot) return json({ erro: "Informe o motivo para reabrir." }, 400);
      d.etapa = d.primeiroContato ? "contato" : "novo"; d.desde = agora; d.motivo = ""; d.motivoObs = "";
      hist("Reaberto: " + mot, "sis");
      break;
    }
    case "nota": {
      const txt = t(b.texto, 2000);
      if (!txt) return json({ erro: "Escreva a anotação." }, 400);
      hist(txt, "nota"); break;
    }
    case "editar": {
      if (fim) return json({ erro: "Lead finalizado não pode ser editado." }, 400);
      const e = leadLimparEntrada(Object.assign({ origem: d.origem }, b.campos || {}));
      if (!e.nome) return json({ erro: "Informe o nome do contato." }, 400);
      if (!e.tel && !e.email) return json({ erro: "Informe o telefone ou o e-mail." }, 400);
      const mud = [];
      for (const k of ["nome", "empresa", "tel", "email", "cidade", "origem", "campanha", "melhorHorario"]) if ((d[k] || "") !== e[k]) { mud.push(k); d[k] = e[k]; }
      if (!mud.length) return json({ ok: true, item: d });
      hist("Dados do contato alterados (" + mud.join(", ") + ").", "sis");
      break;
    }
    default:
      return json({ erro: "Ação desconhecida." }, 400);
  }
  const set = ["dados = ?", "etapa = ?", "vendedor = ?", "origem = ?", "tel_norm = ?", "email = ?", "versao = versao + 1", "atualizado_em = ?", "atualizado_por = ?"];
  const vals = [JSON.stringify(Object.assign({}, d, { versao: undefined })), d.etapa, d.vendedor || null, d.origem, leadTelNorm(d.tel) || null, d.email || null, agora, u.login];
  if (extra.op_id) { set.push("op_id = ?"); vals.push(extra.op_id); }
  if (extra.os_id) { set.push("os_id = ?"); vals.push(extra.os_id); }
  const up = await env.DB.prepare("UPDATE leads SET " + set.join(", ") + " WHERE id = ? AND versao = ?").bind(...vals, row.id, row.versao).run();
  if (!up.meta || !up.meta.changes) return json({ erro: "Outra pessoa alterou este lead. Atualizando…" }, 409);
  await env.DB.prepare("INSERT INTO auditoria (quando, email, colecao, doc_id, num, acao) VALUES (?,?,?,?,?,?)").bind(agora, u.login, "leads", row.id, row.cod, (d.hist[d.hist.length - 1] || {}).texto ? d.hist[d.hist.length - 1].texto.slice(0, 300) : b.acao).run();
  const novo = await env.DB.prepare(LEAD_SEL + " WHERE id = ?").bind(row.id).first();
  return json({ ok: true, item: leadSaida(novo) });
}
// visita técnica de um lead concluída → a oportunidade criada pelo crmDaOS herda vendedor, contato e telefone do lead
async function leadNaOportunidade(env, os, op) {
  if (!os || !os.lead || !op) return;
  op.lead = { id: os.lead.id, cod: os.lead.cod, origem: os.lead.origem || "" };
  if (!op.vendedor && os.lead.vendedor) op.vendedor = os.lead.vendedor;
  if (!op.contato && os.lead.contato) op.contato = os.lead.contato;
  if (!op.tel && os.lead.tel) op.tel = os.lead.tel;
  if (op.hist && op.hist[0]) op.hist[0].texto += " · origem: lead " + os.lead.cod + (os.lead.origem ? " (" + os.lead.origem + ")" : "") + (op.vendedor ? " · responsável: " + op.vendedor : "");
}
async function leadLigarOp(env, os, op) {
  if (!os || !os.lead || !op || !op.cod) return;
  try {
    const row = await env.DB.prepare(LEAD_SEL + " WHERE id = ?").bind(os.lead.id).first();
    if (!row) return;
    const d = leadSaida(row);
    d.op = { id: op.id, cod: op.cod };
    d.hist = d.hist || [];
    d.hist.push({ q: Date.now(), autor: "Sistema", tipo: "sis", texto: "Visita técnica da OS " + os.num + " concluída · oportunidade " + op.cod + " criada no CRM." });
    delete d.versao;
    await env.DB.prepare("UPDATE leads SET dados = ?, op_id = ?, versao = versao + 1, atualizado_em = ? WHERE id = ?").bind(JSON.stringify(d), op.id, Date.now(), row.id).run();
  } catch (e) {}
}

// ===== Compras · ciclo do pedido (v20) =====
// Pedido nasce "Aguardando enviar ao fornecedor" (status 'aguardando' + dados.enviado vazio)
// → Marcar pedido enviado (dados.enviado, nova previsão) → "Aguardando entrega"
// → Marcar entregue: por Compras (aqui) ou pelo Estoque no Quadro de OS ("Chegou · dar entrada"), e um atualiza o outro.
async function cmpOrigensPedido(env, p) {
  if (!p.cot_id) return [];
  const cot = await env.DB.prepare("SELECT dados FROM compras_cotacoes WHERE id = ?").bind(p.cot_id).first();
  if (!cot) return [];
  let pd = {};
  try { pd = JSON.parse(p.dados); } catch {}
  const ks = new Set((pd.itens || []).map((i) => i.k));
  const out = [];
  for (const l of JSON.parse(cot.dados).linhas || []) if (ks.has(l.k)) for (const o of l.origem || []) out.push(Object.assign({ k: l.k }, o));
  return out;
}
var cmpChegou = (st) => st && st !== "comprar" && st !== "comprado";
// itens das OS desse pedido: muda situação/previsão com controle de versão
async function cmpAtualizarOS(env, origens, u, fn, textoHist) {
  const porOS = new Map();
  for (const o of origens) if (o.tipo === "os") {
    if (!porOS.has(o.os_id)) porOS.set(o.os_id, []);
    porOS.get(o.os_id).push(o);
  }
  const agora = Date.now(), q = rotulo(agora), mexidas = [];
  for (const [osId, its] of porOS) {
    for (let t = 0; t < 4; t++) {
      const row = await env.DB.prepare("SELECT id, num, versao, dados FROM ordens_servico WHERE id = ?").bind(osId).first();
      if (!row) break;
      const od = JSON.parse(row.dados);
      let n = 0;
      for (const o of its) {
        const it = (od.itens || [])[o.idx];
        if (!it || it.nome !== o.nome) continue;
        const novo = fn(it);
        if (novo) { od.itens[o.idx] = Object.assign({}, it, novo); n++; }
      }
      if (!n) break;
      const falta = (od.itens || []).filter((x) => x.st === "comprar" || x.st === "comprado").length;
      let extra = "";
      if (textoHist.volta && !falta && od.stage === 2) { od.stage = 1; od.fromCompras = true; extra = " · todo o material chegou, volta para Separação"; }
      od.hist = (od.hist || []).concat([{ quando: q, quem: u.nome || u.login, acao: textoHist.txt(n) + extra }]);
      const r = await env.DB.batch([
        env.DB.prepare("UPDATE ordens_servico SET stage = ?, dados = ?, versao = versao + 1, atualizado_em = ?, atualizado_por = ? WHERE id = ? AND versao = ?").bind(od.stage, JSON.stringify(od), agora, u.login, osId, row.versao),
        env.DB.prepare("INSERT INTO auditoria (quando, email, colecao, doc_id, num, acao) VALUES (?,?,?,?,?,?)").bind(agora, u.login, "os", osId, row.num, (textoHist.txt(n) + extra).slice(0, 300)),
      ]);
      if (r[0].meta.changes) { mexidas.push(row.num); break; }
    }
  }
  return mexidas;
}
async function cmpEntregar(env, p, u, origem) {
  const agora = Date.now(), pd = JSON.parse(p.dados);
  if (!pd.enviado) pd.enviado = { em: agora, por: u.nome || u.login, obs: "marcado junto com a entrega" };
  pd.entregue = { em: agora, por: u.nome || u.login, origem };
  const r = await env.DB.prepare("UPDATE compras_pedidos SET status = 'entregue', dados = ?, atualizado_em = ? WHERE id = ? AND status = 'aguardando'").bind(JSON.stringify(pd), agora, p.id).run();
  if (!r.meta.changes) return false;
  const origens = await cmpOrigensPedido(env, p);
  const ops = [env.DB.prepare("INSERT INTO auditoria (quando, email, colecao, doc_id, num, acao) VALUES (?,?,?,?,?,?)").bind(agora, u.login, "compras", p.id, p.num, "Pedido entregue · " + (origem === "estoque" ? "entrada dada pelo Estoque no Quadro de OS" : "marcado por Compras"))];
  for (const o of origens) if (o.tipo === "sc") ops.push(env.DB.prepare("UPDATE compras_solicitacoes SET status = 'recebido', atualizado_em = ? WHERE id = ? AND status = 'comprado'").bind(agora, o.id));
  await env.DB.batch(ops);
  try { await estEntradaCompra(env, p, pd, u); } catch (e) {}
  return origens;
}
async function cmpAcaoPedido2(env, request, u, id) {
  let d;
  try { d = await lerJson(request, 4e3); } catch { return json({ erro: "Dados inválidos" }, 400); }
  const p = await env.DB.prepare("SELECT * FROM compras_pedidos WHERE id = ?").bind(id).first();
  if (!p) return json({ erro: "Pedido não encontrado." }, 404);
  if (p.status !== "aguardando") return json({ erro: "Este pedido já está " + (p.status === "entregue" ? "entregue" : "cancelado") + "." }, 409);
  const pd = JSON.parse(p.dados), agora = Date.now();
  if (d.acao === "enviado") {
    if (pd.enviado) return json({ erro: "Este pedido já foi enviado ao fornecedor." }, 409);
    const hoje = cmpHoje();
    let prev = /^\d{4}-\d{2}-\d{2}$/.test(String(d.prev || "")) ? d.prev : cmpAddUteis(hoje, parseInt(pd.prazo, 10) || 0);
    if (prev < hoje) return json({ erro: "A previsão de entrega não pode ser antes de hoje." }, 400);
    pd.enviado = { em: agora, por: u.nome || u.login, obs: cadTxt(d.obs, 300) || "" };
    const origens = await cmpOrigensPedido(env, p);
    const ops = [
      env.DB.prepare("UPDATE compras_pedidos SET dados = ?, prev = ?, atualizado_em = ? WHERE id = ? AND status = 'aguardando'").bind(JSON.stringify(pd), prev, agora, id),
      env.DB.prepare("INSERT INTO auditoria (quando, email, colecao, doc_id, num, acao) VALUES (?,?,?,?,?,?)").bind(agora, u.login, "compras", id, p.num, "Pedido enviado ao fornecedor " + pd.fornecedor + " · previsão " + prev + (pd.enviado.obs ? " · " + pd.enviado.obs : "")),
    ];
    for (const o of origens) if (o.tipo === "sc") ops.push(env.DB.prepare("UPDATE compras_solicitacoes SET prev = ?, atualizado_em = ? WHERE id = ?").bind(prev, agora, o.id));
    await env.DB.batch(ops);
    const pv = prev.slice(8, 10) + "/" + prev.slice(5, 7);
    await cmpAtualizarOS(env, origens, u, (it) => (it.st === "comprado" ? { prev, pc: p.num } : null), { txt: (n) => "Compras: pedido " + p.num + " enviado ao fornecedor " + pd.fornecedor + " · " + n + (n === 1 ? " item chega " : " itens chegam ") + pv });
    return json({ ok: true, prev });
  }
  if (d.acao === "entregue") {
    const origens = await cmpEntregar(env, p, u, "compras");
    if (!origens) return json({ erro: "Este pedido mudou. Atualize a tela." }, 409);
    const os = await cmpAtualizarOS(env, origens, u, (it) => (it.st === "comprado" ? { st: "recebido", pc: p.num } : null), { volta: true, txt: (n) => "Entrada no estoque: " + n + (n === 1 ? " item" : " itens") + " do pedido " + p.num + " (" + pd.fornecedor + ") · entrega marcada por Compras" });
    return json({ ok: true, os });
  }
  if (d.acao === "cancelar") {
    await env.DB.batch([
      env.DB.prepare("UPDATE compras_pedidos SET status = 'cancelado', atualizado_em = ? WHERE id = ?").bind(agora, id),
      env.DB.prepare("INSERT INTO auditoria (quando, email, colecao, doc_id, num, acao) VALUES (?,?,?,?,?,?)").bind(agora, u.login, "compras", id, p.num, "Pedido cancelado"),
    ]);
    return json({ ok: true });
  }
  return json({ erro: "Ação inválida" }, 400);
}
// Estoque deu entrada no Quadro de OS → quando todos os itens de OS de um pedido chegaram, o pedido fica "Entregue"
async function cmpSyncDaOS(env, os, email) {
  if (!os || !Array.isArray(os.itens) || !os.itens.some((i) => i && i.pc && cmpChegou(i.st))) return;
  const pcs = [...new Set(os.itens.filter((i) => i && i.pc && cmpChegou(i.st)).map((i) => i.pc))];
  for (const num of pcs) {
    const p = await env.DB.prepare("SELECT * FROM compras_pedidos WHERE num = ? AND status = 'aguardando'").bind(num).first();
    if (!p) continue;
    const origens = (await cmpOrigensPedido(env, p)).filter((o) => o.tipo === "os");
    if (!origens.length) continue;
    let todos = true;
    const cache = new Map([[os.id, os]]);
    for (const o of origens) {
      let od = cache.get(o.os_id);
      if (!od) {
        const row = await env.DB.prepare("SELECT dados FROM ordens_servico WHERE id = ?").bind(o.os_id).first();
        od = row ? JSON.parse(row.dados) : null;
        cache.set(o.os_id, od);
      }
      const it = od && (od.itens || [])[o.idx];
      if (!it || !cmpChegou(it.st)) { todos = false; break; }
    }
    if (todos) {
      const us = await env.DB.prepare("SELECT nome FROM usuarios WHERE login = ?").bind(email).first();
      await cmpEntregar(env, p, { login: email, nome: us ? us.nome : email }, "estoque");
    }
  }
}

// ===== Mão de obra (Cadastros) e Tabela de preços (Comercial) · v21 =====
var MO_PERM = "cad-maoobra";
var moPode = (u) => ehAdmin(u) || u.permissoes.includes(MO_PERM);
var precosPode = (u) => ehAdmin(u) || u.permissoes.includes("com-precos");
var MO_COLS = ["codigo", "descricao", "categoria", "unidade", "preco_venda", "custo", "situacao", "obs"];
function moLimpa(d) {
  return {
    codigo: cadTxt(d.codigo, 40), descricao: cadTxt(d.descricao, 200), categoria: cadTxt(d.categoria, 60),
    unidade: (cadTxt(d.unidade, 12) || "HORA").toUpperCase(), preco_venda: cadNum(d.preco_venda), custo: cadNum(d.custo),
    situacao: d.situacao === "Inativo" ? "Inativo" : "Ativo", obs: String(d.obs || "").trim().slice(0, 1000) || null
  };
}
async function moRotas(request, env, url, u) {
  const r = url.pathname.match(/^\/api\/cadastros\/maoobra(?:\/(\d+))?$/), m = request.method;
  if (!r) return json({ erro: "Não encontrado" }, 404);
  const id = r[1] ? parseInt(r[1], 10) : null;
  if (m === "GET") {
    if (!moPode(u) && !precosPode(u) && !u.permissoes.includes("com-orc") && !u.permissoes.includes("com-crm") && !u.permissoes.includes("at-os")) return json({ erro: "Sem permissão para esta área." }, 403);
    if (id) {
      const row = await env.DB.prepare("SELECT * FROM mao_obra WHERE id = ?").bind(id).first();
      return row ? json({ item: row }) : json({ erro: "Não encontrado" }, 404);
    }
    const q = cadNorm(url.searchParams.get("q") || "").slice(0, 80), sit = url.searchParams.get("situacao") || "Ativo";
    const cond = [], args = [];
    if (sit !== "todos") { cond.push("situacao = ?"); args.push(sit === "Inativo" ? "Inativo" : "Ativo"); }
    for (const t of q.split(" ").filter(Boolean).slice(0, 6)) { cond.push("busca LIKE ?"); args.push("%" + t + "%"); }
    const { results } = await env.DB.prepare("SELECT * FROM mao_obra " + (cond.length ? "WHERE " + cond.join(" AND ") : "") + " ORDER BY codigo LIMIT 500").bind(...args).all();
    return json({ total: results.length, pagina: 1, por: 500, itens: results });
  }
  if (!moPode(u)) return json({ erro: "Sem permissão para alterar a mão de obra." }, 403);
  if (!((m === "POST" && !id) || (m === "PUT" && id))) return json({ erro: "Não encontrado" }, 404);
  let d; try { d = await lerJson(request, 2e4); } catch { return json({ erro: "Dados inválidos" }, 400); }
  const s = moLimpa(d), agora = Date.now();
  if (!s.descricao) return json({ erro: "Informe a descrição da mão de obra." }, 400);
  if (!s.codigo) {
    if (id) return json({ erro: "Informe o código." }, 400);
    const mx = await env.DB.prepare("SELECT MAX(CAST(substr(codigo, 4) AS INTEGER)) AS n FROM mao_obra WHERE codigo LIKE 'MO-%'").first();
    s.codigo = "MO-" + String(((mx && mx.n) || 0) + 1).padStart(4, "0");
  }
  const busca = cadNorm([s.codigo, s.descricao, s.categoria, s.unidade].join(" "));
  const vals = MO_COLS.map((c) => s[c]);
  try {
    if (!id) {
      const res = await env.DB.prepare(`INSERT INTO mao_obra (${MO_COLS.join(",")}, busca, criado_em, atualizado_em, atualizado_por) VALUES (${MO_COLS.map(() => "?").join(",")},?,?,?,?)`).bind(...vals, busca, agora, agora, u.login).run();
      await env.DB.prepare("INSERT INTO auditoria (quando, email, colecao, doc_id, num, acao) VALUES (?,?,?,?,?,?)").bind(agora, u.login, "mao_obra", String(res.meta.last_row_id), s.codigo, "Mão de obra criada · " + s.descricao).run();
      return json({ item: await env.DB.prepare("SELECT * FROM mao_obra WHERE id = ?").bind(res.meta.last_row_id).first() }, 201);
    }
    const res = await env.DB.prepare(`UPDATE mao_obra SET ${MO_COLS.map((c) => c + " = ?").join(", ")}, busca = ?, atualizado_em = ?, atualizado_por = ?, versao = versao + 1 WHERE id = ? AND versao = ?`).bind(...vals, busca, agora, u.login, id, parseInt(d.versao, 10) || 0).run();
    if (!res.meta.changes) return json({ erro: "Outra pessoa alterou este item. Abra de novo para ver a versão atual." }, 409);
    await env.DB.prepare("INSERT INTO auditoria (quando, email, colecao, doc_id, num, acao) VALUES (?,?,?,?,?,?)").bind(agora, u.login, "mao_obra", String(id), s.codigo, "Mão de obra alterada · " + s.descricao).run();
    return json({ item: await env.DB.prepare("SELECT * FROM mao_obra WHERE id = ?").bind(id).first() });
  } catch (e) {
    if (/UNIQUE/i.test(String(e && e.message))) return json({ erro: "Já existe um item com o código " + s.codigo + "." }, 409);
    throw e;
  }
}
// Tabela de preços: só o que está ativo; custo e margem só para o administrador
async function precosRotas(request, env, url, u) {
  if (url.pathname !== "/api/precos" || request.method !== "GET") return json({ erro: "Não encontrado" }, 404);
  const custo = ehAdmin(u);
  const sel = (t) => "SELECT id, codigo, descricao, categoria, unidade, preco_venda, " + (custo ? "custo, " : "") + "obs, atualizado_em FROM " + t + " WHERE situacao = 'Ativo' ORDER BY " + (t === "mao_obra" ? "codigo" : "categoria IS NULL, categoria COLLATE NOCASE, descricao COLLATE NOCASE");
  const [a, b] = await env.DB.batch([env.DB.prepare(sel("servicos")), env.DB.prepare(sel("mao_obra"))]);
  const ult = Math.max(0, ...a.results.map((x) => x.atualizado_em || 0), ...b.results.map((x) => x.atualizado_em || 0));
  return json({ servicos: a.results, maoobra: b.results, verCusto: custo, atualizado: ult || null, podeEditar: { servicos: svcPode(u), maoobra: moPode(u) } });
}

// ===== Equipes técnicas (Assistência Técnica) · v22 =====
// A equipe tem um nome, um técnico principal e 1 ou mais técnicos (usuários com perfil Técnico).
// A OS enviada para a equipe vai para o App do Técnico do principal.
var EQ_PERM = "at-equipes";
var eqPode = (u) => ehAdmin(u) || u.permissoes.includes(EQ_PERM);
function eqIds(v) {
  let l = v;
  if (typeof l === "string") { try { l = JSON.parse(l); } catch { l = []; } }
  return Array.isArray(l) ? [...new Set(l.map((x) => parseInt(x, 10)).filter((x) => x > 0))] : [];
}
async function eqCarregar(env, soAtivas) {
  const [e, t] = await env.DB.batch([
    env.DB.prepare("SELECT * FROM equipes_tecnicas " + (soAtivas ? "WHERE ativo = 1 " : "") + "ORDER BY nome COLLATE NOCASE"),
    env.DB.prepare("SELECT id, nome, login, ativo FROM usuarios WHERE perfil = 'tecnico' ORDER BY nome COLLATE NOCASE")
  ]);
  const tec = new Map(t.results.map((x) => [x.id, x]));
  const equipes = e.results.map((r) => {
    const ids = eqIds(r.membros);
    if (!ids.includes(r.principal_id)) ids.unshift(r.principal_id);
    const membros = ids.map((id) => tec.get(id)).filter(Boolean).map((x) => ({ id: x.id, nome: x.nome, ativo: !!x.ativo, principal: x.id === r.principal_id }));
    membros.sort((a, b) => (b.principal ? 1 : 0) - (a.principal ? 1 : 0));
    const p = tec.get(r.principal_id);
    return { id: r.id, nome: r.nome, ativo: !!r.ativo, obs: r.obs || "", versao: r.versao, principal_id: r.principal_id, principal: p ? p.nome : "", principalAtivo: !!(p && p.ativo), membros, atualizado_em: r.atualizado_em, atualizado_por: r.atualizado_por };
  });
  return { equipes, tecnicos: t.results.map((x) => ({ id: x.id, nome: x.nome, login: x.login, ativo: !!x.ativo })) };
}
// Atualiza o nome de equipe mostrado no App do Técnico (cabeçalho e menu)
async function eqSincronizarUsuarios(env) {
  const { equipes, tecnicos } = await eqCarregar(env, true);
  const ops = tecnicos.map((t) => {
    const pri = equipes.filter((e) => e.principal_id === t.id).map((e) => e.nome);
    const mem = equipes.filter((e) => e.principal_id !== t.id && e.membros.some((m) => m.id === t.id)).map((e) => e.nome);
    const nome = (pri.length ? pri : mem).join(" / ").slice(0, 80) || null;
    return env.DB.prepare("UPDATE usuarios SET equipe = ? WHERE id = ?").bind(nome, t.id);
  });
  if (ops.length) await env.DB.batch(ops);
}
// Lista usada no Quadro de OS (agendar e colocar em execução): cada equipe ativa com o técnico principal ativo
async function eqParaOS(env) {
  const [{ equipes }, a, mo] = await Promise.all([
    eqCarregar(env, true),
    env.DB.prepare("SELECT id, nome FROM auxiliares WHERE ativo = 1 ORDER BY nome COLLATE NOCASE").all(),
    env.DB.prepare("SELECT id, codigo, descricao, categoria, unidade, preco_venda FROM mao_obra WHERE situacao = 'Ativo' AND preco_venda IS NOT NULL ORDER BY codigo").all()
  ]);
  const tecnicos = equipes.filter((e) => e.principalAtivo).map((e) => ({
    id: e.principal_id, nome: e.principal, equipe: e.nome, equipeId: e.id,
    outros: e.membros.filter((m) => !m.principal && m.ativo).map((m) => m.nome)
  }));
  return json({ tecnicos, auxiliares: a.results, maoobra: mo.results });
}
async function eqRotas(request, env, url, u) {
  const r = url.pathname.match(/^\/api\/equipes-tecnicas(?:\/(\d+))?$/), m = request.method;
  if (!r) return json({ erro: "Não encontrado" }, 404);
  if (!eqPode(u)) return json({ erro: "Sem permissão para as equipes técnicas." }, 403);
  const id = r[1] ? parseInt(r[1], 10) : null;
  if (m === "GET" && !id) return json(await eqCarregar(env, false));
  if (!((m === "POST" && !id) || (m === "PUT" && id))) return json({ erro: "Não encontrado" }, 404);
  let d; try { d = await lerJson(request, 1e4); } catch { return json({ erro: "Dados inválidos" }, 400); }
  const nome = String(d.nome || "").replace(/\s+/g, " ").trim();
  if (!nome || nome.length > 40) return json({ erro: "Informe o nome da equipe (até 40 caracteres)." }, 400);
  const membros = eqIds(d.membros).slice(0, 10);
  if (!membros.length) return json({ erro: "Vincule pelo menos um técnico à equipe." }, 400);
  let principal = parseInt(d.principal_id, 10);
  if (!membros.includes(principal)) principal = membros[0];
  const ordem = [principal].concat(membros.filter((y) => y !== principal));
  const { results: tec } = await env.DB.prepare(`SELECT id, nome, ativo FROM usuarios WHERE perfil = 'tecnico' AND id IN (${ordem.map(() => "?").join(",")})`).bind(...ordem).all();
  if (tec.length !== ordem.length) return json({ erro: "Só usuários com o perfil Técnico podem fazer parte da equipe." }, 400);
  const pri = tec.find((t) => t.id === principal);
  if (!pri.ativo) return json({ erro: "O técnico principal (" + pri.nome + ") está desativado em Usuários." }, 400);
  const ativo = d.ativo === false ? 0 : 1, obs = String(d.obs || "").trim().slice(0, 500) || null, agora = Date.now();
  const nomes = ordem.map((x) => tec.find((t) => t.id === x).nome).join(", ");
  try {
    let novoId = id;
    if (!id) {
      const res = await env.DB.prepare("INSERT INTO equipes_tecnicas (nome, principal_id, membros, ativo, obs, criado_em, atualizado_em, atualizado_por) VALUES (?,?,?,?,?,?,?,?)").bind(nome, principal, JSON.stringify(ordem), ativo, obs, agora, agora, u.login).run();
      novoId = res.meta.last_row_id;
      await env.DB.prepare("INSERT INTO auditoria (quando, email, colecao, doc_id, num, acao) VALUES (?,?,?,?,?,?)").bind(agora, u.login, "equipes", String(novoId), nome, ("Equipe criada · " + nomes).slice(0, 300)).run();
    } else {
      const antes = await env.DB.prepare("SELECT nome FROM equipes_tecnicas WHERE id = ?").bind(id).first();
      if (!antes) return json({ erro: "Equipe não encontrada." }, 404);
      const res = await env.DB.prepare("UPDATE equipes_tecnicas SET nome = ?, principal_id = ?, membros = ?, ativo = ?, obs = ?, atualizado_em = ?, atualizado_por = ?, versao = versao + 1 WHERE id = ? AND versao = ?").bind(nome, principal, JSON.stringify(ordem), ativo, obs, agora, u.login, id, parseInt(d.versao, 10) || 0).run();
      if (!res.meta.changes) return json({ erro: "Outra pessoa alterou esta equipe. Abra de novo para ver a versão atual." }, 409);
      const ren = antes.nome !== nome ? " · renomeada de " + antes.nome : "";
      await env.DB.prepare("INSERT INTO auditoria (quando, email, colecao, doc_id, num, acao) VALUES (?,?,?,?,?,?)").bind(agora, u.login, "equipes", String(id), nome, ("Equipe alterada · " + (ativo ? "" : "desativada · ") + nomes + ren).slice(0, 300)).run();
    }
    await eqSincronizarUsuarios(env);
    const { equipes } = await eqCarregar(env, false);
    return json({ item: equipes.find((e) => e.id === novoId) }, id ? 200 : 201);
  } catch (e) {
    if (/UNIQUE/i.test(String(e && e.message))) return json({ erro: "Já existe uma equipe chamada " + nome + "." }, 409);
    throw e;
  }
}
// ===== Relatórios de OS (Assistência Técnica) · v22 =====
// OS finalizadas no período: tipo, tempo no cliente, mão de obra fechada, valor do orçamento (pedidos),
// equipe, técnicos e auxiliar. A tela agrupa por técnico, equipe, auxiliar e tipo.
var RELOS_PERM = "at-rel";
function relOsMin(c) {
  if (c.fech && c.fech.minutos > 0) return c.fech.minutos;
  const l = (c.visitas || []).slice();
  if (c.ci) l.push({ ci: c.ci, co: c.co || null });
  return Math.round(l.reduce((s, v) => { const f = v.co || v.fim; return s + (f && f > v.ci ? (f - v.ci) / 6e4 : 0); }, 0));
}
async function relatoriosOsRotas(request, env, url, u) {
  if (url.pathname !== "/api/relatorios/os" || request.method !== "GET") return json({ erro: "Não encontrado" }, 404);
  if (!(ehAdmin(u) || u.permissoes.includes(RELOS_PERM))) return json({ erro: "Sem permissão para os relatórios de OS." }, 403);
  const dia = /^\d{4}-\d{2}-\d{2}$/;
  let de = url.searchParams.get("de") || "", ate = url.searchParams.get("ate") || "";
  if (!dia.test(de) || !dia.test(ate) || de > ate) return json({ erro: "Período inválido." }, 400);
  const { results } = await env.DB.prepare("SELECT id, num, stage, dados FROM ordens_servico WHERE stage >= 6").all();
  const orcIds = new Set(), linhas = [];
  let pendentes = 0;
  for (const r of results) {
    let c; try { c = JSON.parse(r.dados); } catch { continue; }
    if (r.stage === 6) { pendentes++; continue; }
    const fim = c.finDate || "";
    if (!fim || fim < de || fim > ate) continue;
    const f = c.fech || null;
    const orc = c.tipo === "pedido" && c.orcamento && c.orcamento.id ? c.orcamento.id : null;
    if (orc) orcIds.add(orc);
    linhas.push({
      id: r.id, num: r.num, tipo: c.tipo || "pedido", sub: c.sub || "", cliente: c.cliente || "", cidade: c.cidade || "", servico: c.servico || "",
      fim, agDate: c.agDate || "", equipe: (f && f.equipe) || c.tecnico || "", pessoas: f && f.pessoas && f.pessoas.length ? f.pessoas : (c.tecnico ? [c.tecnico] : []),
      auxiliar: (f && f.auxiliar) || c.auxiliar || "", minutos: relOsMin(c), manual: !!(f && f.manual),
      valorMO: f ? Number(f.valorMO) || 0 : 0, sugestao: f && f.sugestao ? f.sugestao.valor : null, ajuste: f ? f.ajuste || null : null,
      mo: f ? (f.mo || []).map((x) => x.qtd + " × " + x.descricao).join(" + ") : "",
      valorAux: f ? Math.round((f.mo || []).filter((x) => /aux/i.test(String(x.categoria || "") + " " + String(x.descricao || ""))).reduce((t, x) => t + (Number(x.qtd) || 0) * (Number(x.preco) || 0), 0) * 100) / 100 : 0, fechado: !!f, fechadoPor: f ? f.por || "" : "",
      orcId: orc, orcNum: orc ? (c.orcamento.num || c.orc || "") : (c.orc || ""), valorOrc: 0, mensal: 0, nItens: (c.itens || []).length
    });
  }
  if (orcIds.size) {
    const ids = [...orcIds];
    for (let i = 0; i < ids.length; i += 80) {
      const parte = ids.slice(i, i + 80);
      const { results: os } = await env.DB.prepare(`SELECT id, total, mensal, dados FROM orcamentos WHERE id IN (${parte.map(() => "?").join(",")})`).bind(...parte).all();
      const m = new Map(os.map((o) => [o.id, o]));
      for (const l of linhas) if (l.orcId && m.has(l.orcId)) {
        const o = m.get(l.orcId); let it = []; try { it = JSON.parse(o.dados).itens || []; } catch (e) {}
        const tot = Number(o.total) || 0, sub = it.reduce((s, x) => s + (Number(x.total) || 0), 0), f = sub > 0 ? tot / sub : 1;
        const sv = it.filter((x) => x.tipo === "servico").reduce((s, x) => s + (Number(x.total) || 0), 0);
        l.valorOrc = Math.round((sub - sv) * f * 100) / 100; l.valorOrcSvc = Math.round(sv * f * 100) / 100; l.mensal = Number(o.mensal) || 0;
      }
    }
  }
  linhas.sort((a, b) => (a.fim < b.fim ? -1 : a.fim > b.fim ? 1 : String(a.num).localeCompare(String(b.num))));
  return json({ de, ate, os: linhas, pendentes });
}

// emb:estatico
function servirEstatico(request) {
  return servirArquivo(new URL(request.url).pathname);
}

// v23 · serviços (mão de obra) do orçamento guardados na OS para o fechamento
function orcServicos(d) {
  return (d && Array.isArray(d.itens) ? d.itens : []).filter((i) => i && i.tipo === "servico").map((i) => ({ mo_id: i.mo_id, codigo: i.codigo, descricao: i.descricao, unidade: i.unidade, qtd: i.qtd, preco: i.preco, desc: i.desc || 0, total: i.total }));
}
// src/worker.js
var PUBLICOS = /* @__PURE__ */ new Set(["/login", "/login.html", "/img/logo-ancora.png", "/favicon.ico", "/api/login", "/api/health"]);
var REGRAS = [
  [/^\/api\/config\//, ["config", "cfg-integracoes", "cfg-banco"]],
  [/^\/(telas\/config|configuracoes)(\/|\.html|$)/, ["config", "cfg-integracoes", "cfg-banco"]],
  [/^\/api\/estoque\//, ["op-estoque", "op-est-emp", "op-est-tec", "op-est-mov", "op-est-sep", "op-est-conf", "at-os", "at-agenda"]],
  [/^\/(telas\/estoque|operacoes\/estoque)(\/|\.html|$)/, ["op-est-emp", "op-est-tec", "op-est-mov"]],
  [/^\/(api\/os|telas\/os|assistencia\/os|assistencia\/agenda)(\/|\.html|$)/, ["at-os", "at-agenda"]],
  [/^\/(api\/tickets|telas\/tickets|tickets)(\/|\.html|$)/, ["tickets"]],
  [/^\/(painel|views\/painel)(\/|\.html|$)/, ["painel"]],
  [/^\/(usuarios|api\/usuarios|api\/auxiliares)(\/|\.html|$)/, ["usuarios"]],
  [/^\/api\/equipes$/, ["at-os", "at-agenda", "usuarios", "at-equipes"]],
  [/^\/(api\/equipes-tecnicas|telas\/equipes|assistencia\/equipes)(\/|\.html|$)/, ["at-equipes"]],
  [/^\/(api\/relatorios\/os|telas\/relatorios-os|assistencia\/relatorios)(\/|\.html|$)/, ["at-rel"]],
  [/^\/api\/fotos\//, ["at-os", "at-agenda"]],
  [/^\/(voip|api\/voip\/admin|api\/voip\/softphone)(\/|\.html|$)/, ["voip"]],
  [/^\/(telas\/crm|api\/crm)(\/|\.html|$)/, ["com-crm", "com-crm-rel", "com-comissoes"]],
  [/^\/(telas\/compras|api\/compras)(\/|\.html|$)/, ["op-compras"]],
  [/^\/telas\/cadastros(\/|\.html|$)/, ["cad-parceiros", "cad-produtos", "cad-servicos", "cad-maoobra"]],
  [/^\/(telas\/precos|api\/precos)(\/|\.html|$)/, ["com-precos"]],
  [/^\/(telas\/postos|api\/postos)(\/|\.html|$)/, ["com-postos"]],
  [/^\/(orcamento\/ver|api\/orcamento-ver)\//, ["com-orc", "com-crm", "com-crm-rel", "at-os", "at-agenda", "op-compras", "op-estoque", "op-est-sep", "op-est-conf", "op-est-tec"]],
  [/^\/(telas\/orcamentos|api\/orcamentos|api\/levantamentos)(\/|\.html|$)/, ["com-orc"]],
  [/^\/(telas\/leads|api\/leads)(\/|\.html|$)/, ["com-leads"]]
];
var TECNICO_LIVRE = /^\/(app(\.html)?|app-sw\.js|tecnico\/.*|img\/.*|api\/eu(\/senha)?|api\/tecnico\/.*)$/;
function podeAcessar(u, caminho) {
  for (const [re, itens] of REGRAS) {
    if (re.test(caminho)) return itens.some((i) => u.permissoes.includes(i));
  }
  return true;
}
async function painelDados(env) {
  const agora = Date.now();
  const BR = 3 * 3600e3;
  const hojeBR = new Date(agora - BR);
  const hoje = hojeBR.toISOString().slice(0, 10);
  const y = hojeBR.getUTCFullYear(), m = hojeBR.getUTCMonth();
  const iniMes = Date.UTC(y, m, 1) + BR;
  const dow = (hojeBR.getUTCDay() + 6) % 7;
  const iniSem = Date.UTC(y, m, hojeBR.getUTCDate() - dow) + BR;
  const mesStr = hoje.slice(0, 7);
  const semStr = new Date(iniSem - BR).toISOString().slice(0, 10);
  const js = (s, d) => { try { return JSON.parse(s); } catch (e) { return d; } };
  const all = async (sql, ...b) => (await env.DB.prepare(sql).bind(...b).all()).results || [];
  const [osR, tkR, eqR, pcR, orcR, ltR, setR, movR, docR, prodR] = await Promise.all([
    all("SELECT id, num, stage, dados, criado_em, atualizado_em FROM ordens_servico WHERE stage < 7 OR atualizado_em > ?", agora - 70 * 864e5),
    all("SELECT num, status, setores, dados, criado_em, atualizado_em FROM tickets WHERE status NOT IN ('resolvido','os') OR criado_em > ?", Math.min(iniMes, iniSem)),
    all("SELECT id, nome, principal_id FROM equipes_tecnicas WHERE ativo = 1 ORDER BY nome"),
    all("SELECT num, status, prev, dados FROM compras_pedidos WHERE status = 'aguardando'"),
    all("SELECT num, status, total, mensal, cliente FROM orcamentos WHERE excluido = 0 AND criado_em >= ?", iniMes),
    all("SELECT num, cliente, os_num FROM levantamentos WHERE status = 'pendente' ORDER BY seq"),
    all("SELECT id, nome_curto FROM setores WHERE ativo = 1 AND recebe_tickets = 1 ORDER BY nome"),
    all("SELECT de, para, SUM(qtd) q FROM estoque_mov WHERE de LIKE 'eq:%' OR para LIKE 'eq:%' GROUP BY de, para"),
    all("SELECT num, tipo, equipe_id FROM estoque_docs WHERE status = 'pendente'"),
    all("SELECT COUNT(*) n, SUM(CASE WHEN estoque > 0 THEN 1 ELSE 0 END) comsaldo FROM produtos WHERE situacao = 'Ativo'")
  ]);
  const os = osR.map((r) => Object.assign(js(r.dados, {}), { _id: r.id, num: r.num, stage: r.stage, _cri: r.criado_em, _upd: r.atualizado_em }));
  const ativas = os.filter((o) => o.stage < 7);
  const tipoN = { pedido: 0, manut: 0, monit: 0, visita: 0 };
  ativas.forEach((o) => { if (tipoN[o.tipo] != null) tipoN[o.tipo]++; });
  const etapas = [0, 0, 0, 0, 0, 0, 0, 0], parado = [0, 0, 0, 0, 0, 0, 0, 0];
  ativas.forEach((o) => { if (o.stage >= 0 && o.stage < 7) { etapas[o.stage]++; if (agora - o._upd > 2 * 864e5) parado[o.stage]++; } });
  const finSem = os.filter((o) => o.stage === 7 && (o.finDate || "") >= semStr);
  etapas[7] = finSem.length;
  const finMes = os.filter((o) => o.stage === 7 && (o.finDate || "").slice(0, 7) === mesStr);
  const media = (a) => a.length ? a.reduce((s, x) => s + x, 0) / a.length : null;
  const tPedido = media(os.filter((o) => o.tipo === "pedido" && o.co && o._cri).map((o) => (o.co - o._cri) / 864e5).filter((x) => x >= 0));
  const tManut = media(os.filter((o) => o.tipo === "manut" && o.ci && o._cri).map((o) => (o.ci - o._cri) / 864e5).filter((x) => x >= 0));
  const noLocal = { pedido: [], manut: [], monit: [], visita: [] };
  os.forEach((o) => {
    if (!noLocal[o.tipo]) return;
    const quando = o.co || (o.fech && o.fech.quando);
    if (!quando || quando < iniMes) return;
    let min = o.fech && o.fech.minCheck != null ? o.fech.minCheck : null;
    if (min == null && o.ci && o.co) min = Math.round((o.co - o.ci) / 6e4);
    if (min != null && min >= 0) noLocal[o.tipo].push(min);
  });
  const tempoLocal = {};
  Object.keys(noLocal).forEach((k) => { tempoLocal[k] = { min: media(noLocal[k]), n: noLocal[k].length }; });

  // Equipes hoje
  const equipes = eqR.map((e) => {
    const minhas = ativas.filter((o) => o.tecnicoId === e.principal_id || o.tecnico === e.nome);
    const exec = minhas.filter((o) => o.stage === 5);
    const local = exec.find((o) => o.ci && !o.co);
    const atual = local || exec[0] || null;
    const prox = minhas.filter((o) => o.stage === 4 && o.agDate && o.agDate >= hoje && (!atual || o.num !== atual.num))
      .sort((a, b) => (a.agDate + (a.hora || "")).localeCompare(b.agDate + (b.hora || "")))[0] || null;
    const st = local ? "local" : atual ? "execucao" : minhas.some((o) => o.stage === 4 && o.agDate === hoje) ? "agendada" : "livre";
    const r = (o) => o ? { num: o.num, cliente: o.cliente || "", cidade: o.cidade || "", agDate: o.agDate || null, periodo: o.periodo || null, hora: o.hora || null, ci: o.ci || null } : null;
    return { nome: e.nome, status: st, atual: r(atual), proxima: r(prox), hoje: minhas.filter((o) => o.agDate === hoje && o.stage >= 4).length };
  });

  // Tickets
  const abertos = tkR.filter((t) => ["aberto", "andamento", "encaminhado"].includes(t.status)).map((t) => Object.assign(js(t.dados, {}), { _st: t.status, _set: js(t.setores, []), _cri: t.criado_em }));
  const mais24 = abertos.filter((t) => agora - t._cri > 864e5).length;
  const urg = abertos.filter((t) => t.prio === "Urgente").length;
  const porSetor = setR.map((s) => ({ id: s.id, nome: s.nome_curto, n: abertos.filter((t) => t._set.includes(s.id)).length }));
  const tkSem = tkR.filter((t) => t.criado_em >= iniSem).map((t) => js(t.dados, {}));
  const prim = tkSem.map((t) => {
    const tl = (t.tl || []).filter((x) => x.tipo !== "abertura");
    if (!tl.length || !t.criado) return null;
    return (Date.parse(tl[0].t) - Date.parse(t.criado)) / 6e4;
  }).filter((x) => x != null && x >= 0);
  const tkMes = tkR.filter((t) => t.criado_em >= iniMes);
  const viraramOS = tkMes.filter((t) => t.status === "os").length;

  // Compras
  const atrasados = pcR.filter((p) => p.prev && p.prev < hoje).map((p) => { const d = js(p.dados, {}); return { num: p.num, prev: p.prev, fornecedor: d.fornecedor || "", destinos: [...new Set((d.itens || []).flatMap((i) => (i.destinos || []).map((x) => x.num)))].slice(0, 3) }; });

  // Orçamentos do mês
  const orc = { salvos: orcR.length, enviados: orcR.filter((o) => o.status !== "salvo").length, aprovados: orcR.filter((o) => o.status === "aprovado").length, recusados: orcR.filter((o) => o.status === "recusado").length };
  orc.valorAprovado = orcR.filter((o) => o.status === "aprovado").reduce((s, o) => s + (o.total || 0), 0);
  orc.mensalAprovado = orcR.filter((o) => o.status === "aprovado").reduce((s, o) => s + (o.mensal || 0), 0);

  // Estoque
  const saldoEq = {};
  movR.forEach((r) => {
    if (r.para.startsWith("eq:")) saldoEq[r.para] = (saldoEq[r.para] || 0) + r.q;
    if (r.de.startsWith("eq:")) saldoEq[r.de] = (saldoEq[r.de] || 0) - r.q;
  });
  const comEquipes = Object.values(saldoEq).reduce((s, x) => s + Math.max(0, x), 0);
  let aComprar = 0;
  ativas.forEach((o) => (o.itens || []).forEach((i) => { if (i.st === "comprar") aComprar++; }));
  const confPend = ativas.filter((o) => o.confPend).length;

  // Precisa de atenção
  const att = [];
  atrasados.forEach((p) => att.push({ cor: "red", t: "Pedido de compra atrasado · " + p.num, s: "Compras · previsto " + p.prev.split("-").reverse().slice(0, 2).join("/") + " · " + p.fornecedor + (p.destinos.length ? " · " + p.destinos.join(", ") : ""), link: "/operacoes/compras" }));
  abertos.filter((t) => t.prio === "Urgente" && t._st === "aberto").forEach((t) => att.push({ cor: "red", t: "Ticket urgente sem atendimento · " + t.num, s: (t.cli || "") + " · há " + Math.max(1, Math.round((agora - t._cri) / 36e5)) + " h", link: "/tickets" }));
  abertos.filter((t) => t.prio !== "Urgente" && t._st === "aberto" && agora - t._cri > 864e5).forEach((t) => att.push({ cor: "yel", t: "Ticket sem atendimento há mais de 24 h · " + t.num, s: (t.cli || "") + " · " + (t.desc || "").slice(0, 60), link: "/tickets" }));
  ativas.filter((o) => o.pending).forEach((o) => att.push({ cor: "yel", t: "Retorno aguardando aprovação · OS " + o.num, s: (o.cliente || "") + " · Administrador", link: "/assistencia/os" }));
  ativas.filter((o) => o.confPend).forEach((o) => att.push({ cor: "yel", t: "Conferência aguardando aceite · OS " + o.num, s: (o.tecnico || "") + " · app do técnico", link: "/assistencia/os" }));
  ativas.filter((o) => o.stage < 7 && agora - o._upd > 2 * 864e5).forEach((o) => att.push({ cor: "yel", t: "OS parada há " + Math.floor((agora - o._upd) / 864e5) + " dias · OS " + o.num, s: (o.cliente || "") + " · etapa " + (o.stage + 1), link: "/assistencia/os" }));
  ltR.forEach((l) => att.push({ cor: "blue", t: "Levantamento técnico para orçar · L.T. " + l.num, s: (l.cliente || "") + (l.os_num ? " · OS " + l.os_num : ""), link: "/comercial/orcamentos" }));
  docR.forEach((d) => att.push({ cor: "blue", t: (d.tipo === "retirada" ? "Retirada" : "Devolução") + " aguardando confirmação · " + d.num, s: "Estoque dos técnicos", link: "/operacoes/estoque/tecnicos" }));

  return {
    gerado: agora,
    tickets: { abertos: abertos.length, mais24, urgentes: urg, porSetor, primeiroMin: media(prim), viraramOS, mes: tkMes.length },
    os: { andamento: ativas.length, tipos: tipoN, etapas, parado, finMes: finMes.length, finMesExtras: finMes.filter((o) => (o.itens || []).some((i) => i.st === "extra")).length, tPedidoDias: tPedido, tManutDias: tManut, tempoLocal },
    equipes,
    compras: { atrasadas: atrasados.length, aguardando: pcR.length },
    orcamentos: orc,
    levantamentos: ltR.length,
    estoque: { produtos: prodR[0] ? prodR[0].n : 0, comSaldo: prodR[0] ? prodR[0].comsaldo || 0 : 0, paraSeparar: etapas[1], aComprar, comEquipes, confPend, docsPend: docR.length },
    atencao: att.slice(0, 10),
    atencaoTotal: att.length
  };
}
async function menu(env, permitidos) {
  const { results } = await env.DB.prepare(
    `SELECT id, grupo, titulo, ordem, destino, url, pai
       FROM menu_itens
      WHERE ativo = 1
      ORDER BY ordem`
  ).all();
  const arvore = [];
  const grupos = /* @__PURE__ */ new Map();
  const porId = /* @__PURE__ */ new Map();
  const filhos = [];
  for (const item of results) {
    if (!permitidos.has(item.id) && !results.some((x) => x.pai === item.id && permitidos.has(x.id))) continue;
    const no = { id: item.id, titulo: item.titulo, destino: item.destino, url: item.url, filhos: [] };
    porId.set(item.id, no);
    if (item.pai) {
      filhos.push([item.pai, no]);
      continue;
    }
    if (!item.grupo) {
      arvore.push({ tipo: "item", ...no });
      continue;
    }
    let g = grupos.get(item.grupo);
    if (!g) {
      g = { tipo: "grupo", id: "g-" + item.grupo, titulo: item.grupo, itens: [] };
      grupos.set(item.grupo, g);
      arvore.push(g);
    }
    g.itens.push(no);
  }
  for (const [paiId, no] of filhos) {
    const pai = porId.get(paiId);
    if (pai) pai.filhos.push(no);
  }
  return arvore;
}
var worker_default = {
  async fetch(request, env) {
    const url = new URL(request.url);
    const caminho = url.pathname;
    const cors = corsDe(request);
    corsDev = cors || {};
    if (request.method === "OPTIONS" && cors) return new Response(null, { status: 204, headers: cors });
    if (caminho === "/api/health") {
      const row = await env.DB.prepare("SELECT MAX(versao) AS versao FROM schema_migracoes").first();
      return json({ ok: true, banco: "D1", versao_schema: row ? row.versao : null });
    }
    if (caminho === "/api/leads/entrada") {
      try {
        return await leadEntrada(request, env);
      } catch (e) {
        return json({ erro: "Falha ao receber o lead." }, 500, LEAD_CORS);
      }
    }
    if (caminho.startsWith("/api/externo/")) {
      try {
        return await externoRotas(request, env, url);
      } catch (e) {
        return json({ erro: "Falha na API do SGO." }, 500);
      }
    }
    if (caminho.startsWith("/api/") && request.method !== "GET" && request.headers.get("x-sgo") !== "1") {
      return json({ erro: "Requisi\xE7\xE3o recusada" }, 403);
    }
    if (caminho === "/api/login" && request.method === "POST") return login(request, env);
    if (caminho === "/api/logout" && request.method === "POST") return logout(request, env);
    if (caminho === "/img/logo-sgo.png") {
      const obj = await env.FOTOS.get("img/logo-sgo.png");
      if (!obj) return Response.redirect(new URL("/img/logo-ancora.png", request.url).toString(), 302);
      return new Response(obj.body, { headers: { "content-type": "image/png", "cache-control": "public, max-age=86400" } });
    }
    if (PUBLICOS.has(caminho)) return servirEstatico(request, env);
    if (caminho === "/app-sw.js" || /^\/tecnico\/[a-z0-9.-]+$/.test(caminho)) return servirEstatico(request, env);
    const viaM = request.method === "GET" ? caminho.match(VIA_RE) : null;
    if (viaM) {
      try {
        return await viaPublica(env, viaM);
      } catch (e) {
        return new Response("Via indispon\xEDvel no momento. Tente de novo.", { status: 500, headers: { "content-type": "text/plain; charset=utf-8" } });
      }
    }
    const u = await usuarioDaSessao(request, env);
    if (!u) {
      if (caminho.startsWith("/api/")) return json({ erro: "Sess\xE3o expirada. Entre novamente." }, 401);
      const navegacao = (request.headers.get("accept") || "").includes("text/html");
      if (!navegacao) return new Response("N\xE3o autorizado", { status: 401 });
      const volta = caminho === "/" ? "" : "?volta=" + encodeURIComponent(caminho + url.search);
      return Response.redirect(url.origin + "/login" + volta, 302);
    }
    if (caminho === "/login" || caminho === "/login.html") return Response.redirect(url.origin + (u.perfil === "tecnico" ? "/app" : "/painel"), 302);
    if (u.perfil === "tecnico" && !TECNICO_LIVRE.test(caminho)) {
      if (caminho.startsWith("/api/")) return json({ erro: "Sem permiss\xE3o para esta \xE1rea." }, 403);
      return Response.redirect(url.origin + "/app", 302);
    }
    if (!podeAcessar(u, caminho)) {
      if (caminho.startsWith("/api/")) return json({ erro: "Sem permiss\xE3o para esta \xE1rea." }, 403);
      if (caminho.startsWith("/telas/") || caminho.startsWith("/views/")) return new Response("Sem permiss\xE3o", { status: 403 });
    }
    if (caminho === "/api/eu") {
      const extra = u.perfil === "tecnico" ? { "set-cookie": cookieSessao(cookie(request, COOKIE), duracao(u.perfil) / 1e3) } : {};
      return json({ id: u.id, login: u.login, nome: u.nome, perfil: u.perfil, admin: ehAdmin(u), setor: u.setor_id, setor_nome: u.setor_nome, equipe: u.equipe || null, permissoes: u.permissoes }, 200, extra);
    }
    if (caminho === "/api/eu/senha" && request.method === "POST") return trocarSenha(request, env, u);
    if (caminho === "/api/menu") {
      try {
        return json({ menu: await menu(env, new Set(u.permissoes)) });
      } catch (e) {
        return json({ erro: "Falha ao carregar o menu" }, 500);
      }
    }
    if (caminho === "/api/painel") {
      if (!u.permissoes.includes("painel")) return json({ erro: "Sem acesso ao Painel" }, 403);
      try {
        return json(await painelDados(env));
      } catch (e) {
        return json({ erro: "Falha ao montar o Painel" }, 500);
      }
    }
    if (caminho === "/api/contadores") {
      try {
        if (!u.permissoes.includes("tickets")) return json({ tickets_abertos: null });
        const row = await env.DB.prepare(`SELECT COUNT(*) AS n FROM tickets WHERE status IN ('aberto','andamento','encaminhado')`).first();
        return json({ tickets_abertos: row ? row.n : 0 });
      } catch (e) {
        return json({ tickets_abertos: null });
      }
    }
    if (caminho.startsWith("/api/voip/")) {
      try {
        return await voipRotas(request, env, url, u);
      } catch (e) {
        return json({ erro: "Falha no VoIP. Tente de novo." }, 500);
      }
    }
    const spm = caminho.match(/^\/softphone\/([a-z0-9.-]+)$/);
    if (spm && request.method === "GET") return voipServirArquivo(request, env, spm[1]);
    if (caminho === "/api/equipes") return eqParaOS(env);
    if (caminho === "/api/equipes-tecnicas" || caminho.startsWith("/api/equipes-tecnicas/")) {
      try {
        return await eqRotas(request, env, url, u);
      } catch (e) {
        return json({ erro: "Falha nas equipes técnicas. Tente de novo." }, 500);
      }
    }
    if (caminho === "/api/relatorios/os") {
      try {
        return await relatoriosOsRotas(request, env, url, u);
      } catch (e) {
        return json({ erro: "Falha no relatório de OS. Tente de novo." }, 500);
      }
    }
    if (caminho === "/api/tecnico/estoque" || caminho.startsWith("/api/tecnico/estoque/")) {
      try {
        return await estoqueTecnico(request, env, url, u);
      } catch (e) {
        return json({ erro: "Falha no estoque. Tente de novo." }, 500);
      }
    }
    if (caminho.startsWith("/api/tecnico/")) {
      try {
        return await rotaTecnico(request, env, url, u);
      } catch (e) {
        return json({ erro: "Falha no servidor. Tente de novo." }, 500);
      }
    }
    if (caminho.startsWith("/api/fotos/") && request.method === "GET") return verFoto(env, caminho);
    if (caminho === "/api/os/via-link") {
      try {
        return await viaCriarLink(request, env, url, u);
      } catch (e) {
        return json({ erro: "Falha ao gerar o link da via. Tente de novo." }, 500);
      }
    }
    if (caminho.startsWith("/api/config/")) {
      try {
        return await configRotas(request, env, url, u);
      } catch (e) {
        return json({ erro: "Falha nas configurações: " + (e && e.message || "erro") }, 500);
      }
    }
    if (caminho.startsWith("/api/estoque/")) {
      try {
        return await estoqueRotas(request, env, url, u);
      } catch (e) {
        return json({ erro: "Falha no estoque. Tente de novo." }, 500);
      }
    }
    if (caminho.startsWith("/api/auxiliares")) {
      try {
        const r = await rotaAuxiliares(request, env, url);
        if (r) return r;
      } catch (e) {
        return json({ erro: "Falha ao salvar o auxiliar" }, 500);
      }
    }
    if (caminho.startsWith("/api/usuarios")) {
      try {
        const r = await rotaUsuarios(request, env, url, u);
        if (r) return r;
      } catch (e) {
        return json({ erro: "Falha ao salvar o usu\xE1rio" }, 500);
      }
    }
    if (caminho === "/telas/crm") return crmTela(env);
    if (caminho.startsWith("/ajuda/")) {
      const mA = caminho.match(/^\/ajuda\/(app\.js|img\/[a-z0-9-]{1,60}\.jpg|pdf\/[A-Za-z0-9._-]{1,90}\.pdf)$/);
      if (!mA) return new Response("N\u00e3o encontrado", { status: 404 });
      const objA = env.FOTOS ? await env.FOTOS.get("ajuda/" + mA[1]) : null;
      if (!objA) return new Response("N\u00e3o encontrado", { status: 404 });
      const tipoA = mA[1].endsWith(".js") ? "application/javascript; charset=utf-8" : mA[1].endsWith(".pdf") ? "application/pdf" : "image/jpeg";
      const hA = { "content-type": tipoA, "cache-control": mA[1] === "app.js" ? "no-cache" : "private, max-age=3600", "x-content-type-options": "nosniff" };
      if (mA[1].endsWith(".pdf")) hA["content-disposition"] = (url.searchParams.get("baixar") ? "attachment" : "inline") + '; filename="' + mA[1].slice(4) + '"';
      return new Response(objA.body, { headers: hA });
    }
    if (caminho.startsWith("/api/ajuda/")) {
      if (caminho === "/api/ajuda/pdfs" && request.method === "GET") {
        const oL = env.FOTOS ? await env.FOTOS.get("ajuda/pdfs.json") : null;
        let lista = null; if (oL) { try { lista = JSON.parse(await oL.text()); } catch (e) {} }
        return json({ pdfs: lista, admin: ehAdmin(u) });
      }
      if (!ehAdmin(u)) return json({ erro: "Só o administrador altera os arquivos da ajuda." }, 403);
      if (caminho === "/api/ajuda/pdfs" && request.method === "PUT") {
        let d; try { d = await lerJson(request, 1e5); } catch (e) { return json({ erro: "Dados inválidos" }, 400); }
        const lista = (Array.isArray(d.pdfs) ? d.pdfs : []).slice(0, 200).filter((p) => p && /^[A-Za-z0-9._-]{1,90}\.pdf$/.test(String(p.arq || ""))).map((p) => ({ nome: String(p.nome || p.arq).slice(0, 120), arq: String(p.arq), desc: String(p.desc || "").slice(0, 300) }));
        await env.FOTOS.put("ajuda/pdfs.json", JSON.stringify(lista), { httpMetadata: { contentType: "application/json" } });
        await env.DB.prepare("INSERT INTO auditoria (quando, email, colecao, doc_id, num, acao) VALUES (?,?,?,?,?,?)").bind(Date.now(), u.login, "ajuda", "pdfs", null, "Lista de manuais atualizada (" + lista.length + ")").run();
        return json({ ok: true, pdfs: lista });
      }
      const mU = caminho.match(/^\/api\/ajuda\/arquivo\/(img\/[a-z0-9-]{1,60}\.jpg|pdf\/[A-Za-z0-9._-]{1,90}\.pdf)$/);
      if (mU && request.method === "PUT") {
        const corpo = await request.arrayBuffer();
        if (!corpo.byteLength || corpo.byteLength > 25e6) return json({ erro: "Arquivo vazio ou maior que 25 MB." }, 400);
        const ini = new Uint8Array(corpo.slice(0, 4));
        const ehPdf = mU[1].endsWith(".pdf");
        if (ehPdf ? !(ini[0] === 0x25 && ini[1] === 0x50 && ini[2] === 0x44 && ini[3] === 0x46) : !(ini[0] === 0xff && ini[1] === 0xd8)) return json({ erro: "O arquivo não é um " + (ehPdf ? "PDF" : "JPG") + " válido." }, 400);
        await env.FOTOS.put("ajuda/" + mU[1], corpo, { httpMetadata: { contentType: ehPdf ? "application/pdf" : "image/jpeg" } });
        await env.DB.prepare("INSERT INTO auditoria (quando, email, colecao, doc_id, num, acao) VALUES (?,?,?,?,?,?)").bind(Date.now(), u.login, "ajuda", mU[1], null, "Arquivo da ajuda enviado (" + Math.round(corpo.byteLength / 1024) + " KB)").run();
        return json({ ok: true, arquivo: mU[1] });
      }
      if (mU && request.method === "DELETE" && mU[1].startsWith("pdf/")) {
        await env.FOTOS.delete("ajuda/" + mU[1]);
        return json({ ok: true });
      }
      return json({ erro: "Não encontrado" }, 404);
    }
    if (caminho === "/telas/compras" || caminho === "/telas/cadastros" || caminho === "/telas/postos" || caminho === "/telas/orcamentos" || caminho === "/telas/leads" || caminho === "/telas/precos" || caminho === "/telas/equipes" || caminho === "/telas/relatorios-os" || caminho === "/telas/estoque" || caminho === "/telas/config") return telaR2(env, caminho.slice(7));
    if (/^\/orcamento\/ver\/[A-Za-z0-9_-]{3,40}$/.test(caminho)) return telaR2(env, "orcamentos");
    if (caminho.startsWith("/api/orcamento-ver/") && request.method === "GET") {
      try {
        return await orcVer(env, caminho.slice(19));
      } catch (e) {
        return json({ erro: "Falha ao abrir o orçamento." }, 500);
      }
    }
    if (caminho === "/api/orcamentos" || caminho.startsWith("/api/orcamentos/") || caminho === "/api/levantamentos" || caminho.startsWith("/api/levantamentos/")) {
      try {
        return await orcRotas(request, env, url, u);
      } catch (e) {
        return json({ erro: "Falha nos orçamentos. Tente de novo." }, 500);
      }
    }
    if (caminho === "/api/leads" || caminho.startsWith("/api/leads/")) {
      try {
        return await leadRotas(request, env, url, u);
      } catch (e) {
        return json({ erro: "Falha nos leads. Tente de novo." }, 500);
      }
    }
    if (caminho === "/api/postos" || caminho.startsWith("/api/postos/")) {
      try {
        return await postoRotas(request, env, url, u);
      } catch (e) {
        return json({ erro: "Falha nos orçamentos de posto. Tente de novo." }, 500);
      }
    }
    if (caminho === "/api/cadastros/maoobra" || caminho.startsWith("/api/cadastros/maoobra/")) {
      try {
        return await moRotas(request, env, url, u);
      } catch (e) {
        return json({ erro: "Falha na mão de obra. Tente de novo." }, 500);
      }
    }
    if (caminho === "/api/precos") {
      try {
        return await precosRotas(request, env, url, u);
      } catch (e) {
        return json({ erro: "Falha na tabela de preços. Tente de novo." }, 500);
      }
    }
    if (caminho === "/api/cadastros/servicos" || caminho.startsWith("/api/cadastros/servicos/")) {
      try {
        return await svcRotas(request, env, url, u);
      } catch (e) {
        return json({ erro: "Falha nos serviços mensais. Tente de novo." }, 500);
      }
    }
    if (caminho.startsWith("/api/cadastros/")) {
      try {
        return await cadRotas(request, env, url, u);
      } catch (e) {
        return json({ erro: "Falha nos cadastros. Tente de novo." }, 500);
      }
    }
    if (caminho.startsWith("/api/compras/")) {
      try {
        return await cmpRotas(request, env, url, u);
      } catch (e) {
        return json({ erro: "Falha em Compras. Tente de novo." }, 500);
      }
    }
    if (caminho.startsWith("/api/crm/")) {
      try {
        return await crmRotas(request, env, url, u);
      } catch (e) {
        return json({ erro: "Falha no CRM. Tente de novo." }, 500);
      }
    }
    if (caminho.startsWith("/api/")) {
      const r = await rotaDocs(request, env, url, u.login);
      if (r) return r;
      return json({ erro: "N\xE3o encontrado" }, 404);
    }
    return servirEstatico(request, env);
  }
};
export {
  worker_default as default
};

// Usado pela ponte de sessão com as telas do sistema base (src/sgo/server/sessao.ts)
export { usuarioDaSessao, ehAdmin };
