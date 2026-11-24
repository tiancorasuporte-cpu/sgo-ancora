import { createFileRoute } from "@tanstack/react-router";
import { useState, type FormEvent } from "react";

import estilo from "@/sgo/telas/login/estilo.css?url";

/** SGO Âncora — tela de entrada (mesma da casca original). */
export const Route = createFileRoute("/login")({
  head: () => ({
    meta: [{ title: "Entrar · SGO Âncora" }],
    links: [{ rel: "stylesheet", href: estilo }],
  }),
  component: Login,
});

function Login() {
  const [login, setLogin] = useState("");
  const [senha, setSenha] = useState("");
  const [ver, setVer] = useState(false);
  const [erro, setErro] = useState("");
  const [enviando, setEnviando] = useState(false);

  const entrar = (e: FormEvent) => {
    e.preventDefault();
    setErro("");
    const l = login.trim();
    if (!l || !senha) {
      setErro("Informe usuário e senha.");
      return;
    }
    setEnviando(true);
    fetch("/api/login", {
      method: "POST",
      credentials: "same-origin",
      headers: { "content-type": "application/json", "x-sgo": "1" },
      body: JSON.stringify({ login: l, senha }),
    })
      .then((r) => r.json().then((d: { erro?: string; destino?: string | null }) => ({ ok: r.ok, d })))
      .then((r) => {
        if (!r.ok) throw new Error(r.d.erro || "Não foi possível entrar.");
        if (r.d.destino) {
          location.replace(r.d.destino); // técnico → App do Técnico
          return;
        }
        let volta = new URLSearchParams(location.search).get("volta") || "/painel";
        if (volta.charAt(0) !== "/" || volta.charAt(1) === "/") volta = "/painel";
        location.replace(volta);
      })
      .catch((err: Error) => {
        setErro(err.message === "Failed to fetch" ? "Sem conexão com o servidor. Tente de novo." : err.message);
        setEnviando(false);
      });
  };

  return (
    <div className="tela-login">
      <div className="topo" aria-hidden="true" />
      <main className="centro">
        <div className="cartao">
          <div className="marca">
            <div className="logo">
              <img src="/img/logo-ancora.png" alt="Âncora Segurança Patrimonial" />
            </div>
            <h1>SGO Âncora</h1>
            <p>Sistema de Gestão Operacional</p>
          </div>
          <form id="f" noValidate onSubmit={entrar}>
            <div className={"erro" + (erro ? " on" : "")} id="erro" role="alert">
              {erro}
            </div>
            <div>
              <label htmlFor="login">Usuário</label>
              <input
                id="login"
                name="login"
                autoComplete="username"
                autoCapitalize="none"
                spellCheck={false}
                required
                autoFocus
                value={login}
                onChange={(e) => setLogin(e.target.value)}
              />
            </div>
            <div>
              <label htmlFor="senha">Senha</label>
              <div className="campo">
                <input
                  id="senha"
                  name="senha"
                  type={ver ? "text" : "password"}
                  autoComplete="current-password"
                  required
                  style={{ paddingRight: 76 }}
                  value={senha}
                  onChange={(e) => setSenha(e.target.value)}
                />
                <button type="button" className="ver" id="ver" aria-pressed={ver ? "true" : "false"} aria-controls="senha" onClick={() => setVer(!ver)}>
                  {ver ? "Ocultar" : "Mostrar"}
                </button>
              </div>
            </div>
            <button className="entrar" id="btn" type="submit" disabled={enviando}>
              {enviando ? "Entrando…" : "Entrar"}
            </button>
            <p className="ajuda">Esqueceu a senha? Peça ao administrador do sistema.</p>
          </form>
        </div>
      </main>
      <div className="rodape" style={{ background: "#141414" }}>
        Âncora Segurança Patrimonial · acesso restrito a colaboradores
      </div>
    </div>
  );
}
