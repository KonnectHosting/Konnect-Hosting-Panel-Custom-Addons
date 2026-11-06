#!/usr/bin/env python3
"""Node-local FastDL publisher. Python 3.11+, standard library only.

Never expose this listener directly. Proxy the two documented locations through
the node's HTTPS virtual host. API requests require a per-node HMAC key.
"""
import argparse
import bz2
import contextlib
import hashlib
import hmac
import json
import os
from pathlib import Path
import re
import secrets
import shutil
import sqlite3
import stat
import threading
import time
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from urllib.parse import unquote, urlsplit

API = '/gmod-toolkit-api/v1/'
UUID = re.compile(r'^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$')
HEX = re.compile(r'^[a-f0-9]{64}$')
ASSETS = {
    'maps': {'.bsp', '.nav', '.ain'},
    'materials': {'.vmt', '.vtf'},
    'models': {'.mdl', '.vvd', '.vtx', '.phy', '.ani'},
    'sound': {'.wav', '.mp3', '.ogg'},
    'particles': {'.pcf'},
    'resource': {'.ttf', '.otf'},
}
MAX_FILE = 128 * 1024 * 1024
MAX_TOTAL = 2 * 1024 * 1024 * 1024
MAX_FILES = 5000


class Rejected(Exception):
    def __init__(self, message, status=422):
        super().__init__(message)
        self.status = status


def allowed_path(path):
    if not isinstance(path, str) or len(path) > 240:
        return False
    parts = path.split('/')
    if len(parts) < 2 or len(parts) > 16 or parts[0] not in ASSETS:
        return False
    for part in parts:
        if not re.fullmatch(r'[A-Za-z0-9_+.-]+', part) or part.startswith('.') or part.endswith('.'):
            return False
        if re.search(r'(?:^|[_.-])(?:secret|password|passwd|token|credential|config|backup|private)(?:[_.-]|$)', part, re.I):
            return False
    return Path(parts[-1]).suffix.lower() in ASSETS[parts[0]]


@contextlib.contextmanager
def open_beneath(root, relative, directory=False):
    """Anchor every component with O_NOFOLLOW, including intermediate folders."""
    parts = relative.split('/')
    if any(not p or p in ('.', '..') or '/' in p or '\\' in p for p in parts):
        raise Rejected('Invalid source path')
    fd = os.open(root, os.O_RDONLY | os.O_DIRECTORY | os.O_NOFOLLOW)
    try:
        for index, part in enumerate(parts):
            flags = os.O_RDONLY | os.O_NOFOLLOW | os.O_NONBLOCK
            if index < len(parts) - 1 or directory:
                flags |= os.O_DIRECTORY
            nxt = os.open(part, flags, dir_fd=fd)
            os.close(fd)
            fd = nxt
        info = os.fstat(fd)
        if directory:
            if not stat.S_ISDIR(info.st_mode):
                raise Rejected('Source directory is not a directory')
        elif not stat.S_ISREG(info.st_mode) or info.st_nlink != 1:
            raise Rejected('Only regular, non-linked asset files can be published')
        yield fd
    finally:
        os.close(fd)


class Publisher:
    def __init__(self, config):
        self.key = bytes.fromhex(config['key'])
        if len(self.key) != 32:
            raise ValueError('key must be 64 hexadecimal characters')
        self.volumes = Path(config['volume_root']).resolve(strict=True)
        self.state = Path(config['state_root'])
        self.state.mkdir(mode=0o700, parents=True, exist_ok=True)
        if self.state.is_symlink() or self.state.resolve().is_relative_to(self.volumes):
            raise ValueError('state_root must be private, outside server volumes')
        os.chmod(self.state, 0o700)
        (self.state / 'generations').mkdir(mode=0o700, exist_ok=True)
        self.locks = {}
        self.lock_guard = threading.Lock()
        self.slots = threading.BoundedSemaphore(4)
        with self.db() as db:
            db.executescript('''
                CREATE TABLE IF NOT EXISTS servers (uuid TEXT PRIMARY KEY, token TEXT UNIQUE, generation TEXT, revision INTEGER NOT NULL DEFAULT 0);
                CREATE TABLE IF NOT EXISTS previews (id TEXT PRIMARY KEY, uuid TEXT, actor TEXT, expires INTEGER, revision INTEGER, entries TEXT);
                CREATE TABLE IF NOT EXISTS jobs (id TEXT PRIMARY KEY, uuid TEXT, actor TEXT, status TEXT, message TEXT, completed INTEGER, total INTEGER, created INTEGER);
                CREATE TABLE IF NOT EXISTS nonces (nonce TEXT PRIMARY KEY, expires INTEGER);
            ''')
            db.execute("UPDATE jobs SET status='failed', message='Node publisher restarted; preview and publish again' WHERE status='running'")
        # No unfinished generation is ever served after a restart.
        for item in (self.state / 'generations').glob('staging-*'):
            if item.is_dir() and not item.is_symlink():
                shutil.rmtree(item)

    @contextlib.contextmanager
    def db(self):
        db = sqlite3.connect(self.state / 'state.sqlite', timeout=10)
        db.row_factory = sqlite3.Row
        try:
            yield db
            db.commit()
        except BaseException:
            db.rollback()
            raise
        finally:
            db.close()

    def lock(self, uuid):
        # Striped locks avoid unbounded lock allocation from authenticated requests.
        with self.lock_guard:
            return self.locks.setdefault(int(hashlib.sha256(uuid.encode()).hexdigest()[:2], 16), threading.Lock())

    def authenticate(self, method, path, headers, body):
        timestamp = headers.get('X-Gmod-Time', '')
        nonce = headers.get('X-Gmod-Nonce', '')
        signature = headers.get('X-Gmod-Signature', '')
        if not re.fullmatch(r'[0-9]{10}', timestamp) or abs(time.time() - int(timestamp)) > 300 or not HEX.fullmatch(nonce):
            raise Rejected('Invalid API authentication', 401)
        canonical = '\n'.join([method, path, timestamp, nonce, hashlib.sha256(body).hexdigest()])
        expected = hmac.new(self.key, canonical.encode(), hashlib.sha256).hexdigest()
        if not hmac.compare_digest(expected, signature):
            raise Rejected('Invalid API authentication', 401)
        with self.db() as db:
            db.execute('DELETE FROM nonces WHERE expires < ?', (int(time.time()),))
            if db.execute('SELECT COUNT(*) FROM nonces').fetchone()[0] >= 20000:
                raise Rejected('API authentication capacity reached', 429)
            try:
                db.execute('INSERT INTO nonces VALUES (?,?)', (nonce, int(time.time()) + 600))
            except sqlite3.IntegrityError:
                raise Rejected('Replayed API request', 401)

    def server(self, db, uuid):
        db.execute('INSERT OR IGNORE INTO servers (uuid) VALUES (?)', (uuid,))
        return dict(db.execute('SELECT * FROM servers WHERE uuid=?', (uuid,)).fetchone())

    def manifest(self, generation):
        if not generation:
            return {}
        if not HEX.fullmatch(generation):
            raise Rejected('Invalid stored generation', 500)
        return json.loads((self.state / 'generations' / generation / 'manifest.json').read_text())

    def scan(self, uuid):
        found, skipped, total, visited = {}, 0, 0, 0
        deadline = time.monotonic() + 25

        def walk(fd, prefix, depth):
            nonlocal skipped, total, visited
            if depth > 14:
                raise Rejected('Asset directory depth exceeds limit')
            with os.scandir(fd) as entries:
                for entry in entries:
                    visited += 1
                    if visited > 20000 or time.monotonic() > deadline:
                        raise Rejected('Asset scan limit reached; reduce the asset set')
                    name = prefix + '/' + entry.name
                    info = entry.stat(follow_symlinks=False)
                    if stat.S_ISDIR(info.st_mode) and re.fullmatch(r'[A-Za-z0-9_+-][A-Za-z0-9_+.-]*', entry.name):
                        with open_beneath(self.volumes, uuid + '/garrysmod/' + name, True) as child:
                            walk(child, name, depth + 1)
                    elif stat.S_ISREG(info.st_mode) and allowed_path(name) and info.st_nlink == 1:
                        if info.st_size > MAX_FILE or total + info.st_size > MAX_TOTAL or len(found) >= MAX_FILES:
                            raise Rejected('FastDL quota exceeded (128 MiB/file, 2 GiB total, 5000 files)')
                        with open_beneath(self.volumes, uuid + '/garrysmod/' + name) as source:
                            before = os.fstat(source)
                            digest = hashlib.sha256()
                            size = 0
                            while chunk := os.read(source, 1024 * 1024):
                                digest.update(chunk)
                                size += len(chunk)
                                if size > MAX_FILE or total + size > MAX_TOTAL or time.monotonic() > deadline:
                                    raise Rejected('Asset scan size/time limit reached')
                            after = os.fstat(source)
                        if (before.st_size, before.st_mtime_ns, before.st_ino) != (after.st_size, after.st_mtime_ns, after.st_ino) or size != before.st_size:
                            raise Rejected('An asset changed during preview; retry')
                        total += size
                        found[name] = {'sha256': digest.hexdigest(), 'bytes': size}
                    else:
                        skipped += 1

        with open_beneath(self.volumes, uuid + '/garrysmod', True) as game:
            for folder in ASSETS:
                try:
                    fd = os.open(folder, os.O_RDONLY | os.O_DIRECTORY | os.O_NOFOLLOW, dir_fd=game)
                except FileNotFoundError:
                    continue
                except OSError:
                    skipped += 1
                    continue
                try:
                    walk(fd, folder, 0)
                finally:
                    os.close(fd)
        return dict(sorted(found.items())), skipped

    def action(self, action, data):
        uuid, actor = data.get('server', ''), data.get('actor', '')
        if not isinstance(uuid, str) or not UUID.fullmatch(uuid) or not isinstance(actor, str) or not re.fullmatch(r'[1-9][0-9]{0,19}', actor):
            raise Rejected('Invalid server or actor')
        if action == 'preview':
            with self.slots:
                entries, skipped = self.scan(uuid)
            with self.db() as db:
                current = self.server(db, uuid)
                old = self.manifest(current['generation'])
                preview = secrets.token_hex(32)
                db.execute('DELETE FROM previews WHERE expires < ?', (int(time.time()),))
                db.execute('INSERT INTO previews VALUES (?,?,?,?,?,?)', (preview, uuid, actor, int(time.time()) + 900, current['revision'], json.dumps(entries)))
            return {'preview': preview, 'files': len(entries), 'bytes': sum(f['bytes'] for f in entries.values()), 'skipped': skipped,
                    'added': [p for p in entries if p not in old], 'removed': [p for p in old if p not in entries],
                    'changed': [p for p in entries if p in old and entries[p]['sha256'] != old[p]['sha256']]}
        if action == 'publish':
            preview = data.get('preview', '')
            with self.lock(uuid):
                with self.db() as db:
                    current = self.server(db, uuid)
                    row = db.execute('SELECT * FROM previews WHERE id=? AND uuid=? AND actor=? AND expires>=?', (preview, uuid, actor, int(time.time()))).fetchone()
                    if not row or row['revision'] != current['revision']:
                        raise Rejected('Preview expired or publication changed; preview again', 409)
                    if db.execute("SELECT COUNT(*) FROM jobs WHERE status='running'").fetchone()[0] >= 4:
                        raise Rejected('Publisher is busy; retry shortly', 429)
                    if db.execute("SELECT 1 FROM jobs WHERE uuid=? AND status='running'", (uuid,)).fetchone():
                        raise Rejected('This server is already publishing', 409)
                    job = secrets.token_hex(32)
                    entries = json.loads(row['entries'])
                    db.execute('INSERT INTO jobs VALUES (?,?,?,?,?,?,?,?)', (job, uuid, actor, 'running', '', 0, len(entries), int(time.time())))
                    db.execute('DELETE FROM previews WHERE id=?', (preview,))
                threading.Thread(target=self.publish, args=(job, uuid, current['revision'], entries), daemon=True).start()
                return {'job': job, 'status': 'running'}
        if action == 'info':
            with self.db() as db:
                current = self.server(db, uuid)
                row = db.execute('SELECT id,status,message,completed,total FROM jobs WHERE uuid=? ORDER BY created DESC,rowid DESC LIMIT 1', (uuid,)).fetchone()
            return {'token': current['token'], 'files': len(self.manifest(current['generation'])), 'job': dict(row) if row else None}
        if action in ('rotate', 'revoke'):
            with self.lock(uuid), self.db() as db:
                current = self.server(db, uuid)
                token = secrets.token_hex(32) if action == 'rotate' and current['generation'] else None
                db.execute('UPDATE servers SET token=?,revision=revision+1 WHERE uuid=?', (token, uuid))
            return {'token': token}
        raise Rejected('Unknown API action', 404)

    def publish(self, job, uuid, revision, entries):
        with self.slots:
            self.publish_generation(job, uuid, revision, entries)

    def publish_generation(self, job, uuid, revision, entries):
        generation = secrets.token_hex(32)
        temporary = self.state / 'generations' / ('staging-' + generation)
        destination = self.state / 'generations' / generation
        old = None
        try:
            temporary.mkdir(mode=0o700)
            if shutil.disk_usage(self.state).free < sum(f['bytes'] for f in entries.values()) * 2 + 64 * 1024 * 1024:
                raise Rejected('Insufficient node disk space for a new FastDL generation')
            manifest = {}
            deadline = time.monotonic() + 900
            for index, (path, expected) in enumerate(entries.items()):
                if not allowed_path(path):
                    raise Rejected('Publication contains a forbidden asset')
                with self.db() as db:
                    if self.server(db, uuid)['revision'] != revision:
                        raise Rejected('Publication was revoked or replaced')
                object_id = hashlib.sha256(path.encode()).hexdigest()
                digest, size = hashlib.sha256(), 0
                with open_beneath(self.volumes, uuid + '/garrysmod/' + path) as source:
                    with open(temporary / object_id, 'xb') as raw, bz2.open(temporary / (object_id + '.bz2'), 'xb', compresslevel=9) as compressed:
                        while chunk := os.read(source, 1024 * 1024):
                            size += len(chunk)
                            if size > expected['bytes'] or time.monotonic() > deadline:
                                raise Rejected('Asset changed or publication time limit reached')
                            digest.update(chunk)
                            raw.write(chunk)
                            compressed.write(chunk)
                if size != expected['bytes'] or digest.hexdigest() != expected['sha256']:
                    raise Rejected('An asset changed since preview; create a new preview')
                manifest[path] = {**expected, 'object': object_id}
                with self.db() as db:
                    db.execute('UPDATE jobs SET completed=? WHERE id=?', (index + 1, job))
            (temporary / 'manifest.json').write_text(json.dumps(manifest))
            temporary.rename(destination)
            with self.lock(uuid), self.db() as db:
                current = self.server(db, uuid)
                if current['revision'] != revision:
                    raise Rejected('Publication changed; retry with a new preview')
                old = current['generation']
                db.execute('UPDATE servers SET generation=?,token=?,revision=revision+1 WHERE uuid=?', (generation, current['token'] or secrets.token_hex(32), uuid))
                db.execute("UPDATE jobs SET status='complete' WHERE id=?", (job,))
            if old and HEX.fullmatch(old):
                shutil.rmtree(self.state / 'generations' / old, ignore_errors=True)
        except Exception as error:
            # Do not echo source contents, absolute paths or credentials into customer errors.
            message = str(error) if isinstance(error, Rejected) else 'Node file operation failed; check the node configuration and retry'
            with self.db() as db:
                db.execute("UPDATE jobs SET status='failed',message=? WHERE id=?", (message, job))
            shutil.rmtree(temporary, ignore_errors=True)
            shutil.rmtree(destination, ignore_errors=True)

    def download(self, token, path):
        compressed = path.endswith('.bz2')
        original = path[:-4] if compressed else path
        if not HEX.fullmatch(token) or not allowed_path(original):
            raise Rejected('Not found', 404)
        with self.db() as db:
            row = db.execute('SELECT generation FROM servers WHERE token=?', (token,)).fetchone()
        if not row or not row['generation']:
            raise Rejected('Not found', 404)
        generation = row['generation']
        entry = self.manifest(generation).get(original)
        if not entry or not HEX.fullmatch(entry['object']):
            raise Rejected('Not found', 404)
        name = entry['object'] + ('.bz2' if compressed else '')
        with open_beneath(self.state / 'generations', generation + '/' + name) as fd:
            return os.fdopen(os.dup(fd), 'rb')


class Handler(BaseHTTPRequestHandler):
    server_version = 'GModToolkit/1.0'

    def log_message(self, *args):
        # URL paths contain bearer download tokens; never put them in access logs.
        pass

    def send_json(self, code, value):
        body = json.dumps(value).encode()
        self.send_response(code)
        self.send_header('Content-Type', 'application/json')
        self.send_header('Cache-Control', 'no-store')
        self.send_header('Content-Length', str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def do_POST(self):
        try:
            if not self.path.startswith(API) or self.path[len(API):] not in {'preview', 'publish', 'info', 'rotate', 'revoke'}:
                raise Rejected('Not found', 404)
            length = self.headers.get('Content-Length', '')
            if not length.isdecimal() or not 0 < int(length) <= 65536 or self.headers.get('Transfer-Encoding'):
                raise Rejected('Invalid request length', 413)
            self.connection.settimeout(30)
            body = self.rfile.read(int(length))
            if len(body) != int(length):
                raise Rejected('Incomplete request')
            self.server.publisher.authenticate('POST', self.path, self.headers, body)
            data = json.loads(body)
            if not isinstance(data, dict):
                raise Rejected('Expected JSON object')
            result = self.server.publisher.action(self.path[len(API):], data)
            self.send_json(200, result)
        except Rejected as error:
            self.send_json(error.status, {'message': str(error)})
        except (ValueError, KeyError, TypeError):
            self.send_json(422, {'message': 'Invalid request'})
        except Exception:
            self.send_json(503, {'message': 'Node publisher unavailable; check node configuration'})

    def do_GET(self):
        self.serve_asset(False)

    def do_HEAD(self):
        self.serve_asset(True)

    def serve_asset(self, head):
        try:
            path = urlsplit(self.path).path
            match = re.fullmatch(r'/fastdl/([a-f0-9]{64})/(.+)', path)
            if not match:
                raise Rejected('Not found', 404)
            name = unquote(match[2], errors='strict')
            with self.server.publisher.download(match[1], name) as source:
                self.send_response(200)
                self.send_header('Content-Type', 'application/octet-stream')
                self.send_header('X-Content-Type-Options', 'nosniff')
                self.send_header('Cache-Control', 'public, max-age=300')
                self.send_header('Content-Length', str(os.fstat(source.fileno()).st_size))
                self.end_headers()
                if not head:
                    shutil.copyfileobj(source, self.wfile, length=1024 * 1024)
        except (Rejected, FileNotFoundError, NotADirectoryError, UnicodeError):
            self.send_error(404)
        except (BrokenPipeError, ConnectionResetError):
            pass


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--config', default='/etc/gmod-toolkit/config.json')
    args = parser.parse_args()
    os.umask(0o077)
    config = json.loads(Path(args.config).read_text())
    publisher = Publisher(config)
    server = ThreadingHTTPServer(('127.0.0.1', 8099), Handler)
    server.daemon_threads = True
    server.publisher = publisher
    server.serve_forever()


if __name__ == '__main__':
    main()
