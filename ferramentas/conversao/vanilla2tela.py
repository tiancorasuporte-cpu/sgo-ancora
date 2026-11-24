"""Tela SGO em página própria (HTML+CSS+JS puro) → pasta de tela isolada para o React:
marcacao.html, estilo.raw.css (convertido depois para estilo.css), logica.js (código original), meta.json"""
import re, sys, os, json
html_path, outdir = sys.argv[1:3]
t = open(html_path, encoding="utf-8").read()
sem_script = re.sub(r"<script[^>]*>.*?</script>", "", t, flags=re.S)
styles = re.findall(r"<style[^>]*>(.*?)</style>", sem_script, re.S)
links = re.findall(r'<link[^>]+rel="stylesheet"[^>]*href="([^"]+)"', sem_script)
body = re.search(r"<body([^>]*)>(.*?)</body>", sem_script, re.S)
body_attrs, body_html = body.group(1), body.group(2)
scripts = re.findall(r"<script([^>]*)>(.*?)</script>", t, re.S)
ext = [re.search(r'src="([^"]+)"', a).group(1) for a, b in scripts if "src=" in a]
inline = [b for a, b in scripts if "src=" not in a and "application/json" not in a and b.strip()]
os.makedirs(outdir, exist_ok=True)
open(os.path.join(outdir, "marcacao.html"), "w", encoding="utf-8").write(body_html.strip() + "\n")
open(os.path.join(outdir, "estilo.raw.css"), "w", encoding="utf-8").write("\n".join(styles))
open(os.path.join(outdir, "logica.js"), "w", encoding="utf-8").write(
    "/* Lógica original da tela do SGO (executada pelo motor de telas isoladas: src/sgo/lib/tela-isolada.ts). */\n"
    + "\n;\n".join(inline) + "\n")
cls = re.search(r'class="([^"]*)"', body_attrs)
meta = {"bibliotecas": [e for e in ext if e != "/busca-cadastros.js"], "buscaCadastros": "/busca-cadastros.js" in ext,
        "classeCorpo": cls.group(1) if cls else "", "folhasExternas": links}
json.dump(meta, open(os.path.join(outdir, "meta.json"), "w"), ensure_ascii=False, indent=1)
print(os.path.basename(outdir), meta, len(body_html), sum(map(len, inline)))
