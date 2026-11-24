"""Transforma o script de lógica de uma tela "dc" em módulo ES: export function montar(EU) -> { Component, cfg }.
Scripts extras (complementos que definem window.sgo*) viram módulos de efeito colateral separados."""
import re, sys, os, json
pasta, extras_nomes = sys.argv[1], sys.argv[2:]
partes = open(os.path.join(pasta, "logica.raw.js"), encoding="utf-8").read().split("\n;\n")
main = partes[0]
n_eu = 0
main, n_eu = re.subn(r"var EU=\(function\(\)\{try\{var x=new XMLHttpRequest.*?catch\(e\)\{return null\}\}\)\(\)", "var EU=__EU", main, count=1, flags=re.S)
assert n_eu == 1, "EU não encontrado"
m = re.search(r"SGO_DC\.iniciar\(Component,\s*(\{.*?\})\);?\s*$", main, re.S)
assert m, "iniciar não encontrado"
cfg = m.group(1)
main = main[: m.start()] + f"return {{ Component: Component, cfg: {cfg} }};\n"
mod = f"""// Lógica original da tela (mesmas regras do SGO). Empacotada como módulo para o React.
/* eslint-disable */
// @ts-nocheck
export function montar(__EU) {{
  var DCLogic = window.DCLogic, SGO = window.SGO;
{main}
}}
"""
open(os.path.join(pasta, "logica.js"), "w", encoding="utf-8").write(mod)
for i, nome in enumerate(extras_nomes, start=1):
    if i >= len(partes):
        break
    open(os.path.join(pasta, nome + ".js"), "w", encoding="utf-8").write(
        "// Complemento original da tela (roda no navegador).\n/* eslint-disable */\n// @ts-nocheck\nif (typeof window !== \"undefined\") {\n" + partes[i] + "\n}\n")
print("ok", pasta, len(partes))
