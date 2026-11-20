#!/usr/bin/env python3
"""开发期静态服务（交付物不依赖它）：python3 serve.py [端口]"""
import functools
import http.server
import pathlib
import socketserver
import sys

PORT = int(sys.argv[1]) if len(sys.argv) > 1 else 8765
ROOT = pathlib.Path(__file__).resolve().parent
handler = functools.partial(http.server.SimpleHTTPRequestHandler, directory=str(ROOT))

with socketserver.TCPServer(("127.0.0.1", PORT), handler) as httpd:
    print("http://127.0.0.1:" + str(PORT) + "/index.html")
    httpd.serve_forever()
