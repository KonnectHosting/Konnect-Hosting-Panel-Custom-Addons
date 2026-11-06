import bz2
import hashlib
import hmac
import importlib.util
import json
import os
from pathlib import Path
import secrets
import tempfile
import threading
import time
import unittest
from unittest.mock import patch
from urllib.request import Request, urlopen
from urllib.error import HTTPError

spec = importlib.util.spec_from_file_location('agent', Path(__file__).resolve().parents[1] / 'node/gmod_toolkit_agent.py')
agent = importlib.util.module_from_spec(spec)
spec.loader.exec_module(agent)
SERVER = '12345678-1234-1234-1234-123456789abc'
OTHER = '87654321-1234-1234-1234-123456789abc'


class NodeTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.root = Path(self.temp.name)
        self.volumes = self.root / 'volumes'
        self.game = self.volumes / SERVER / 'garrysmod'
        self.game.mkdir(parents=True)
        self.config = {'key': 'ab' * 32, 'volume_root': str(self.volumes), 'state_root': str(self.root / 'state')}
        self.publisher = agent.Publisher(self.config)

    def tearDown(self):
        self.temp.cleanup()

    def asset(self, path='maps/test.bsp', data=b'VBSP' * 4000):
        target = self.game / path
        target.parent.mkdir(parents=True, exist_ok=True)
        target.write_bytes(data)
        return target

    def call(self, operation, actor='42', server=SERVER, **extra):
        return self.publisher.action(operation, {'server': server, 'actor': actor, **extra})

    def wait(self):
        for _ in range(1000):
            result = self.call('info')
            if result['job'] and result['job']['status'] != 'running':
                return result
            time.sleep(.01)
        self.fail('Publication did not finish')

    def publish(self):
        preview = self.call('preview')
        self.call('publish', preview=preview['preview'])
        result = self.wait()
        self.assertEqual('complete', result['job']['status'], result)
        return result

    def test_asset_allowlist(self):
        for path in ['maps/a.bsp', 'materials/x/a.vmt', 'models/a.dx90.vtx', 'sound/a.wav', 'particles/a.pcf', 'resource/fonts/a.ttf']:
            self.assertTrue(agent.allowed_path(path), path)
        for path in ['lua/a.lua', 'cfg/server.cfg', '.env', 'addons/test.gma', 'materials/x.zip', 'maps/a.bsp.bz2', 'maps/../a.bsp', 'maps/.env.bsp', 'maps/private.bsp', 'maps/foo/password.vtf', 'maps/a.php', 'maps/a.bsp/extra', '/maps/a.bsp', 'maps/a%2ebsp', 'maps/a\\b.bsp']:
            self.assertFalse(agent.allowed_path(path), path)

    def test_preview_publish_compression_and_rotating_revoking(self):
        self.asset()
        self.asset('lua/password.lua', b'secret')
        self.asset('cfg/server.cfg', b'rcon_password secret')
        self.asset('addons/private.gma', b'archive')
        self.asset('materials/private.vmt', b'password')
        preview = self.call('preview')
        self.assertEqual(['maps/test.bsp'], preview['added'])
        self.call('publish', preview=preview['preview'])
        result = self.wait()
        token = result['token']
        self.assertRegex(token, r'^[a-f0-9]{64}$')
        with self.publisher.download(token, 'maps/test.bsp') as raw:
            expected = raw.read()
        with self.publisher.download(token, 'maps/test.bsp.bz2') as compressed:
            self.assertEqual(expected, bz2.decompress(compressed.read()))
        for path in ['lua/password.lua', 'cfg/server.cfg', 'addons/private.gma', 'manifest.json', '../state.sqlite', 'materials/private.vmt']:
            with self.assertRaises(agent.Rejected):
                self.publisher.download(token, path)
        new = self.call('rotate')['token']
        self.assertNotEqual(token, new)
        with self.assertRaises(agent.Rejected): self.publisher.download(token, 'maps/test.bsp')
        self.call('revoke')
        with self.assertRaises(agent.Rejected): self.publisher.download(new, 'maps/test.bsp')

    def test_changed_source_preserves_previous_publication(self):
        target = self.asset(data=b'old')
        old = self.publish()
        target.write_bytes(b'new')
        preview = self.call('preview')
        self.assertEqual(['maps/test.bsp'], preview['changed'])
        target.write_bytes(b'modified after preview')
        self.call('publish', preview=preview['preview'])
        result = self.wait()
        self.assertEqual('failed', result['job']['status'])
        self.assertEqual(old['token'], result['token'])
        with self.publisher.download(old['token'], 'maps/test.bsp') as file:
            self.assertEqual(b'old', file.read())

    def test_preview_is_server_actor_and_revision_bound(self):
        self.asset()
        preview = self.call('preview')['preview']
        for extra in [{'actor': '43'}, {'server': OTHER}]:
            with self.assertRaises(agent.Rejected): self.call('publish', preview=preview, **extra)
        self.call('revoke')
        with self.assertRaises(agent.Rejected): self.call('publish', preview=preview)
        with self.assertRaises(agent.Rejected): self.call('info', server='../etc')

    def test_symlinks_hardlinks_special_files_and_ancestor_escape(self):
        self.asset()
        secret = self.root / 'secret'
        secret.write_bytes(b'secret')
        (self.game / 'maps/leak.bsp').symlink_to(secret)
        os.link(secret, self.game / 'maps/hardlink.bsp')
        os.mkfifo(self.game / 'maps/pipe.bsp')
        (self.game / 'materials').symlink_to(self.root, target_is_directory=True)
        self.assertEqual(['maps/test.bsp'], self.call('preview')['added'])
        with self.assertRaises(OSError):
            with agent.open_beneath(self.volumes, SERVER + '/garrysmod/maps/leak.bsp'): pass
        (self.volumes / OTHER).symlink_to(self.volumes / SERVER, target_is_directory=True)
        with self.assertRaises(OSError): self.call('preview', server=OTHER)

    def test_removed_assets_and_independent_server_tokens(self):
        path = self.asset()
        old = self.publish()
        other = self.volumes / OTHER / 'garrysmod/maps'
        other.mkdir(parents=True)
        (other / 'other.bsp').write_bytes(b'other')
        preview = self.call('preview', server=OTHER)
        self.call('publish', server=OTHER, preview=preview['preview'])
        for _ in range(200):
            second = self.call('info', server=OTHER)
            if second['job']['status'] == 'complete': break
            time.sleep(.01)
        self.assertNotEqual(old['token'], second['token'])
        with self.assertRaises(agent.Rejected): self.publisher.download(old['token'], 'maps/other.bsp')
        path.unlink()
        preview = self.call('preview')
        self.assertEqual(['maps/test.bsp'], preview['removed'])
        self.call('publish', preview=preview['preview'])
        result = self.wait()
        self.assertEqual(0, result['files'])
        with self.assertRaises(agent.Rejected): self.publisher.download(old['token'], 'maps/test.bsp')

    def test_hmac_replay_and_restart(self):
        body = b'{"server":"test"}'
        headers = {'X-Gmod-Time': str(int(time.time())), 'X-Gmod-Nonce': secrets.token_hex(32)}
        canonical = '\n'.join(['POST', agent.API + 'info', headers['X-Gmod-Time'], headers['X-Gmod-Nonce'], hashlib.sha256(body).hexdigest()])
        headers['X-Gmod-Signature'] = hmac.new(bytes.fromhex(self.config['key']), canonical.encode(), hashlib.sha256).hexdigest()
        self.publisher.authenticate('POST', agent.API + 'info', headers, body)
        for publisher in [self.publisher, agent.Publisher(self.config)]:
            with self.assertRaises(agent.Rejected): publisher.authenticate('POST', agent.API + 'info', headers, body)
        with self.assertRaises(agent.Rejected): self.publisher.authenticate('POST', agent.API + 'rotate', headers, body)

    def test_actual_http_api_and_download(self):
        self.asset()
        result = self.publish()
        server = agent.ThreadingHTTPServer(('127.0.0.1', 0), agent.Handler)
        server.publisher = self.publisher
        thread = threading.Thread(target=server.serve_forever, daemon=True)
        thread.start()
        origin = f'http://127.0.0.1:{server.server_port}'
        try:
            with urlopen(origin + '/fastdl/' + result['token'] + '/maps/test.bsp.bz2') as response:
                self.assertEqual(b'VBSP' * 4000, bz2.decompress(response.read()))
                self.assertEqual('nosniff', response.headers['X-Content-Type-Options'])
            for path in ['../state.sqlite', '%2e%2e/state.sqlite', 'maps/test.bsp%00', 'maps/test.bsp%252f../x']:
                with self.assertRaises(HTTPError): urlopen(origin + '/fastdl/' + result['token'] + '/' + path)
            with self.assertRaises(HTTPError) as error:
                urlopen(Request(origin + agent.API + 'info', data=b'{}', method='POST'))
            self.assertEqual(401, error.exception.code)
            body = json.dumps({'server': SERVER, 'actor': '42'}).encode()
            timestamp, nonce = str(int(time.time())), secrets.token_hex(32)
            canonical = '\n'.join(['POST', agent.API + 'info', timestamp, nonce, hashlib.sha256(body).hexdigest()])
            headers = {'X-Gmod-Time': timestamp, 'X-Gmod-Nonce': nonce,
                       'X-Gmod-Signature': hmac.new(bytes.fromhex(self.config['key']), canonical.encode(), hashlib.sha256).hexdigest()}
            request = Request(origin + agent.API + 'info', data=body, headers=headers, method='POST')
            with urlopen(request) as response:
                self.assertEqual(result['token'], json.load(response)['token'])
            with self.assertRaises(HTTPError) as error:
                urlopen(request)
            self.assertEqual(401, error.exception.code)
        finally:
            server.shutdown(); server.server_close(); thread.join()

    def test_expired_previews_and_quota_limits(self):
        self.asset(data=b'12345')
        with patch.object(agent, 'MAX_FILE', 4):
            with self.assertRaises(agent.Rejected): self.call('preview')
        preview = self.call('preview')['preview']
        with self.publisher.db() as db:
            db.execute('UPDATE previews SET expires=0 WHERE id=?', (preview,))
        with self.assertRaises(agent.Rejected): self.call('publish', preview=preview)

    def test_revocation_cancels_an_inflight_publication(self):
        self.asset()
        ready, resume = threading.Event(), threading.Event()
        original = self.publisher.publish_generation

        def paused(*args):
            ready.set()
            resume.wait(5)
            original(*args)

        self.publisher.publish_generation = paused
        preview = self.call('preview')
        self.call('publish', preview=preview['preview'])
        self.assertTrue(ready.wait(5))
        self.call('revoke')
        resume.set()
        result = self.wait()
        self.assertEqual('failed', result['job']['status'])
        self.assertIsNone(result['token'])

    def test_restart_recovers_unfinished_jobs_and_retains_published_data(self):
        self.asset()
        result = self.publish()
        with self.publisher.db() as db:
            db.execute('INSERT INTO jobs VALUES (?,?,?,?,?,?,?,?)', ('unfinished', SERVER, '42', 'running', '', 0, 1, int(time.time()) + 1))
        staging = self.root / 'state/generations/staging-abandoned'
        staging.mkdir()
        self.publisher = agent.Publisher(self.config)
        self.assertEqual('failed', self.call('info')['job']['status'])
        self.assertFalse(staging.exists())
        with self.publisher.download(result['token'], 'maps/test.bsp') as file:
            self.assertEqual(b'VBSP' * 4000, file.read())


if __name__ == '__main__':
    unittest.main()
