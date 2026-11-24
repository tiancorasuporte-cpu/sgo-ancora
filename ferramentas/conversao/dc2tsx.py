"""Converte uma tela SGO feita no runtime "dc" (AST JSON + classe de lógica) em React.

Gera:
  <Nome>View.tsx  — JSX gerado do template (marcação idêntica à original)
  estilo.css      — CSS da tela com escopo em .tela-<id>
  logica.js       — classe de lógica original, empacotada como módulo (montar())
"""
import json, re, sys, os

html_path, tela_id, Nome, outdir = sys.argv[1:5]
t = open(html_path, encoding="utf-8").read()
scripts = re.findall(r"<script([^>]*)>(.*?)</script>", t, re.S)
styles = re.findall(r"<style[^>]*>(.*?)</style>", re.sub(r"<script[^>]*>.*?</script>", "", t, flags=re.S), re.S)
ast = json.loads([b for a, b in scripts if "dc-ast" in a][0])
inline = [b for a, b in scripts if not a.strip() and b.strip()]

ATTR = {"class": "className", "for": "htmlFor", "tabindex": "tabIndex", "readonly": "readOnly",
        "maxlength": "maxLength", "colspan": "colSpan", "rowspan": "rowSpan", "autocomplete": "autoComplete",
        "autofocus": "autoFocus", "crossorigin": "crossOrigin", "enctype": "encType", "novalidate": "noValidate",
        "xlink:href": "xlinkHref", "srcset": "srcSet", "spellcheck": "spellCheck", "inputmode": "inputMode",
        "contenteditable": "contentEditable"}
BOOL = {"checked", "disabled", "selected", "hidden", "required", "readonly", "multiple", "open", "autofocus"}
SVG_OK = {"viewBox"}

def jsstr(s):
    return json.dumps(s, ensure_ascii=False)

def path_expr(p, scope):
    parts = p.split(".")
    root = parts[0]
    if root in scope:
        e = scope[root]
    else:
        e = "v[" + jsstr(root) + "]"
    for k in parts[1:]:
        e += "?.[" + jsstr(k) + "]"
    return e

def val_expr(vs, scope):
    """g(): um único binding devolve o valor cru; senão concatena como texto."""
    if len(vs) == 1 and not isinstance(vs[0], str):
        return path_expr(vs[0]["p"], scope)
    if all(isinstance(x, str) for x in vs):
        return jsstr("".join(vs))
    parts = [jsstr(x) if isinstance(x, str) else "s(" + path_expr(x["p"], scope) + ")" for x in vs]
    return "(" + " + ".join(parts) + ")"

def static(vs):
    return all(isinstance(x, str) for x in vs)

def camel(n):
    return re.sub(r"-([a-z])", lambda m: m.group(1).upper(), n)

counter = [0]

def emit(node, scope, ind):
    pad = "  " * ind
    if isinstance(node, str):
        if not node.strip() and "\n" in node:
            return ""
        return pad + "{" + jsstr(node) + "}\n"
    if "x" in node:
        return pad + "{t(" + val_expr(node["x"], scope) + ")}\n"
    n = node["n"]
    if n == "sc-if":
        inner = "".join(emit(c, scope, ind + 2) for c in node["c"])
        return f"{pad}{{E({val_expr(node['v'], scope)}) ? (\n{pad}  <>\n{inner}{pad}  </>\n{pad}) : null}}\n"
    if n == "sc-for":
        counter[0] += 1
        var = f"_{re.sub(r'[^A-Za-z0-9_]', '_', node['as'])}{counter[0]}"
        idx = f"_i{counter[0]}"
        sc2 = dict(scope)
        sc2[node["as"]] = var
        inner = "".join(emit(c, sc2, ind + 3) for c in node["c"])
        lst = val_expr(node["l"], scope)
        return (f"{pad}{{arr({lst}).map(({var}: any, {idx}: number) => (\n"
                f"{pad}  <Fragment key={{chave({var}, {idx})}}>\n{inner}{pad}  </Fragment>\n{pad}))}}\n")
    attrs = node.get("a", [])
    tipo = None
    for k, vs in attrs:
        if k == "type":
            tipo = "".join(x for x in vs if isinstance(x, str)) if static(vs) else None
    has_change = any(k in ("onChange", "onInput") for k, _ in attrs)
    out = []
    for k, vs in attrs:
        lk = k.lower()
        if re.match(r"^on[A-Z]", k):
            ev = k
            if k == "onInput" and n in ("input", "textarea", "select") and tipo not in ("checkbox", "radio", "file"):
                ev = "onChange"
            out.append(f"{ev}={{fn({val_expr(vs, scope)})}}")
            continue
        if lk in BOOL:
            name = ATTR.get(lk, lk)
            out.append(f"{name}={{E({val_expr(vs, scope)})}}")
            continue
        if k == "style":
            out.append(f"style={{css({val_expr(vs, scope)})}}")
            continue
        if k == "value" and n in ("input", "textarea", "select"):
            if tipo == "file":
                continue
            if tipo in ("checkbox", "radio"):
                out.append(f"value={{s({val_expr(vs, scope)})}}")
                continue
            name = "value" if has_change else "defaultValue"
            out.append(f"{name}={{s({val_expr(vs, scope)})}}")
            continue
        name = ATTR.get(lk, k)
        if "-" in name and not (name.startswith("aria-") or name.startswith("data-")):
            name = camel(name)
        if static(vs):
            out.append(f"{name}={{{jsstr(''.join(vs))}}}")
        else:
            out.append(f"{name}={{a({val_expr(vs, scope)})}}")
    if n in ("input", "img", "br", "hr", "meta", "link", "source") or (not node.get("c") and n in ("path", "circle", "rect", "line", "polyline", "polygon", "ellipse")):
        return f"{pad}<{n} {' '.join(out)} />\n"
    inner = "".join(emit(c, scope, ind + 1) for c in node.get("c", []))
    if n == "textarea":
        inner = ""
    return f"{pad}<{n} {' '.join(out)}>\n{inner}{pad}</{n}>\n"

body = "".join(emit(n, {}, 3) for n in ast)
view = f"""/**
 * {Nome} — marcação da tela (gerada a partir do template original do SGO, sem alterações de layout).
 * Os valores vêm de `renderVals()` da lógica da tela (ver logica.js).
 */
/* eslint-disable */
// @ts-nocheck
import {{ Fragment }} from "react";

import {{ E, a, arr, chave, css, fn, s, t }} from "@/sgo/lib/dc";

export function {Nome}View({{ v }}: {{ v: any }}) {{
  return (
    <div className="tela-{tela_id}">
{body}    </div>
  );
}}
"""
os.makedirs(outdir, exist_ok=True)
open(os.path.join(outdir, f"{Nome}View.tsx"), "w", encoding="utf-8").write(view)
open(os.path.join(outdir, "estilo.raw.css"), "w", encoding="utf-8").write("\n".join(styles))
open(os.path.join(outdir, "logica.raw.js"), "w", encoding="utf-8").write("\n;\n".join(inline))
print("ok", len(view), len(styles), [len(x) for x in inline])
