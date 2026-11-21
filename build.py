#!/usr/bin/env python3
"""figcut 构建：把 index.html + styles/ + src/ 打成一个可双击的单文件 HTML。

fail-fast：缺文件、缺导出、循环 import、名字冲突、残留 import/export、语法错误
全部直接失败，绝不产出半坏的包。pdf.js 走 CDN（unpkg，版本钉死）。

用法：
  python3 build.py            # 产出 figure-workbench.html
  python3 build.py --check    # 只校验，不写文件
"""
import pathlib
import re
import sys
import tempfile
import subprocess

ROOT = pathlib.Path(__file__).resolve().parent
OUT = ROOT / "figure-workbench.html"

RE_CSS = re.compile(r'<link rel="stylesheet" href="([^"]+)"\s*/?>')
RE_MODULE = re.compile(r'<script type="module" src="([^"]+)"></script>')
RE_NS_IMPORT = re.compile(r"^import \* as (\w+) from '([^']+)';?$", re.M)
RE_NAMED_IMPORT = re.compile(r"^import \{([^}]*)\} from '([^']+)';?$", re.M)
RE_EXPORT_DECL = re.compile(r"^export (async )?(function|const|let|var|class) ([A-Za-z_$][\w$]*)", re.M)
RE_EXPORT_BLOCK = re.compile(r"^export \{(.*?)\};?$", re.M)
RE_RESIDUAL = re.compile(r"^(import|export)\b", re.M)
RE_TOP_DECL = re.compile(r"^(?:const|let|var|function|class)\s+([A-Za-z_$][\w$]*)", re.M)


def die(msg):
    print("构建失败: " + msg, file=sys.stderr)
    raise SystemExit(1)


def key_of(rel_path):
    return pathlib.PurePosixPath(rel_path).as_posix()


def resolve(from_key, spec):
    parts = []
    for seg in (pathlib.PurePosixPath(from_key).parent / spec).parts:
        if seg == "..":
            if not parts:
                die("import 越出 src/: " + from_key + " -> " + spec)
            parts.pop()
        elif seg != ".":
            parts.append(seg)
    return "/".join(parts)


def read_module(key):
    p = ROOT / "src" / key
    if not p.exists():
        die("找不到模块: src/" + key)
    return p.read_text(encoding="utf-8")


def parse(key, src):
    named = []
    for m in RE_NAMED_IMPORT.finditer(src):
        target = resolve(key, m.group(2))
        for piece in m.group(1).split(","):
            piece = piece.strip()
            if not piece:
                continue
            parts = piece.split(" as ")
            named.append((target, parts[0].strip(), parts[-1].strip()))
    ns = [(resolve(key, m.group(2)), m.group(1)) for m in RE_NS_IMPORT.finditer(src)]
    exports = [m.group(3) for m in RE_EXPORT_DECL.finditer(src)]
    for m in RE_EXPORT_BLOCK.finditer(src):
        for piece in m.group(1).split(","):
            piece = piece.strip()
            if piece:
                exports.append(piece.split(" as ")[-1].strip())
    return named, ns, exports


def load(key, seen, order, exports_of, named_of, ns_of):
    if key in seen:
        if seen[key] == "visiting":
            die("循环 import: " + key)
        return
    seen[key] = "visiting"
    src = read_module(key)
    named, ns, exports = parse(key, src)
    named_of[key] = named
    ns_of[key] = ns
    exports_of[key] = exports
    for target, _, _ in named:
        load(target, seen, order, exports_of, named_of, ns_of)
    for target, _ in ns:
        load(target, seen, order, exports_of, named_of, ns_of)
    seen[key] = "done"
    order.append(key)


def strip_module(key, src, exported):
    named, ns, _ = parse(key, src)
    out = RE_NS_IMPORT.sub("", src)
    out = RE_NAMED_IMPORT.sub("", out)
    out = RE_EXPORT_BLOCK.sub("", out)
    out = RE_EXPORT_DECL.sub(lambda m: (m.group(1) or "") + m.group(2) + " " + m.group(3), out)
    leftovers = [l for l in RE_RESIDUAL.findall(out)]
    if leftovers:
        die("src/" + key + " 里有转换后残留的 import/export")
    for target, name, _ in named:
        if name not in exported.get(target, []):
            die("src/" + key + " 从 " + target + " 导入的 " + name + " 没有导出")
    for target, _ in ns:
        if not exported.get(target):
            die("src/" + key + " 的命名空间导入目标 " + target + " 没有导出")
    return out


def main():
    check_only = "--check" in sys.argv
    html = (ROOT / "index.html").read_text(encoding="utf-8")

    css_files = RE_CSS.findall(html)
    if not css_files:
        die("index.html 里找不到样式表引用")
    m = RE_MODULE.search(html)
    if not m:
        die("index.html 里找不到 <script type=\"module\"> 入口")
    entry = resolve("index.html", m.group(1))
    if entry.startswith("src/"):
        entry = entry[len("src/"):]

    seen, order = {}, []
    exports_of, named_of, ns_of = {}, {}, {}
    load(entry, seen, order, exports_of, named_of, ns_of)

    declared = {}
    for key in order:
        for name in RE_TOP_DECL.findall(strip_module(key, read_module(key), exports_of)):
            if name in declared:
                die("顶层名字冲突: " + name + "（" + declared[name] + " 与 " + key + "）")
            declared[name] = key

    chunks = []
    for key in order:
        body = strip_module(key, read_module(key), exports_of)
        chunks.append("// ---- src/" + key + " ----\n" + body.strip("\n"))
        importers = [i for i in order if any(t == key for t, _ in ns_of.get(i, []))]
        if importers:
            fields = ", ".join(exports_of[key])
            for i in importers:
                for target, alias in ns_of[i]:
                    if target == key:
                        chunks.append("const __ns_" + alias + " = { " + fields + " };")

    js = "(function () {\n'use strict';\n\n" + "\n\n".join(chunks) + "\n\n})();"

    if "</script" in js:
        die("打包后的 JS 里出现 </script，会截断 HTML")

    styles = []
    for href in css_files:
        p = ROOT / href
        if not p.exists():
            die("找不到样式: " + href)
        styles.append("<style>\n" + p.read_text(encoding="utf-8") + "\n</style>")

    out = RE_CSS.sub("", html)
    out = out.replace("</head>", "\n".join(styles) + "\n</head>", 1)
    out = RE_MODULE.sub(lambda _: "<script>\n" + js + "\n</script>", out)

    with tempfile.NamedTemporaryFile("w", suffix=".js", delete=False, encoding="utf-8") as fh:
        fh.write(js)
        tmp = fh.name
    node = subprocess.run(["node", "--check", tmp], capture_output=True, text=True)
    if node.returncode != 0:
        die("node 语法检查不通过:\n" + node.stderr)

    print("模块 " + str(len(order)) + " 个，JS " + str(len(js) // 1024) + " KB，HTML " + str(len(out.encode("utf-8")) // 1024) + " KB")
    if check_only:
        print("校验通过（--check，未写文件）")
        return
    OUT.write_text(out, encoding="utf-8")
    print("产出 " + OUT.name)


if __name__ == "__main__":
    main()
