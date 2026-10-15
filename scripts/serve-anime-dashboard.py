#!/usr/bin/env python3
"""Serve the built dashboard without exposing the repository or private records."""
import argparse
from functools import partial
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
import json
from urllib.parse import urlsplit
from urllib.request import Request, build_opener, ProxyHandler, HTTPRedirectHandler
from urllib.error import HTTPError, URLError

class NoRedirect(HTTPRedirectHandler):
    def redirect_request(self, req, fp, code, msg, headers, newurl):
        return None

class DashboardHandler(SimpleHTTPRequestHandler):
    def log_message(self, format, *args):
        # Calendar responses and request parameters must never enter the journal.
        pass

    def do_GET(self):
        parsed = urlsplit(self.path)
        if not parsed.path.startswith('/calendar/'):
            return super().do_GET()
        if parsed.path not in ('/calendar/api/v1/status', '/calendar/api/v1/events'):
            self.send_error(404)
            return
        target = 'http://127.0.0.1:18787/' + parsed.path[len('/calendar/'):]
        if parsed.query:
            target += '?' + parsed.query
        headers = {'Accept': 'application/json'}
        token_file = Path.home() / '.config' / 'photo-frame-dashboard' / 'calendar-token'
        if token_file.is_file():
            headers['Authorization'] = 'Bearer ' + token_file.read_text().strip()
        request = Request(target, headers=headers)
        try:
            response = build_opener(ProxyHandler({}), NoRedirect()).open(request, timeout=20)
        except HTTPError as error:
            response = error
        except (URLError, TimeoutError, OSError):
            body = json.dumps({'error': {'code': 'calendar_store_unavailable', 'message': 'CalendarGateway is unreachable through the SSH tunnel.'}}).encode()
            self.send_response(503)
            self.send_header('Content-Type', 'application/json')
            self.send_header('Content-Length', str(len(body)))
            self.end_headers()
            self.wfile.write(body)
            return
        with response:
            body = response.read()
            self.send_response(response.code)
            self.send_header('Content-Type', 'application/json')
            self.send_header('Content-Length', str(len(body)))
            if response.headers.get('Retry-After'):
                self.send_header('Retry-After', response.headers['Retry-After'])
            self.end_headers()
            self.wfile.write(body)

    def end_headers(self):
        self.send_header('Cache-Control', 'no-store')
        super().end_headers()

    def list_directory(self, path):
        self.send_error(404)
        return None

parser = argparse.ArgumentParser()
parser.add_argument('--host', required=True)
parser.add_argument('--port', type=int, default=5180)
args = parser.parse_args()
root = Path(__file__).resolve().parents[1] / 'anime-dashboard' / 'dist'
if not (root / 'index.html').is_file():
    parser.error('Build the dashboard first: npm run build --prefix anime-dashboard')
server = ThreadingHTTPServer((args.host, args.port), partial(DashboardHandler, directory=str(root)))
print(f'Serving Komorebi at http://{args.host}:{args.port}/', flush=True)
server.serve_forever()
