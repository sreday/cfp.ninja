#!/usr/bin/env python3
"""The picks page in its own PC window (Marek, 2026-11-25: "open candidates for this and future jobs in a dedicated PC app").

    pythonw design/frog/tools/pick_app.py        # or the "Frog Ninja picks" shortcut on the Desktop

The same page as pick_site.py (same picks folder, same picks.json, new rounds show up by themselves), shown in a native
Windows window (pywebview, Edge WebView2) instead of a browser tab. If the pick server already runs, the window uses it;
otherwise it starts one inside this app and stops it when the window closes. A second launch just brings up another window.
"""
import os, socket, sys, threading
from http.server import ThreadingHTTPServer

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import pick_site
import webview


def running(port):
    with socket.socket() as s:
        s.settimeout(0.3)
        return s.connect_ex(('127.0.0.1', port)) == 0


def main():
    port = pick_site.PORT
    if not running(port):
        srv = ThreadingHTTPServer(('127.0.0.1', port), pick_site.H)
        threading.Thread(target=srv.serve_forever, daemon=True).start()
    webview.create_window('Frog Ninja picks', f'http://127.0.0.1:{port}/', width=1500, height=950, maximized=True,
                          background_color='#15171C', text_select=True)
    webview.start()


if __name__ == '__main__':
    main()
