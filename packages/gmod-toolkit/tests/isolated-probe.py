#!/usr/bin/env python3
"""Run the addon through the original 2.0.1 probe with no database schema.

Requires a local disposable Docker daemon and a compatible Composer vendor
directory. No existing Panel, live database, .env or node is mounted.
"""
import argparse
import hashlib
import json
import os
from pathlib import Path
import subprocess
import sys
import tempfile

parser = argparse.ArgumentParser()
parser.add_argument('--vendor', type=Path, required=True)
parser.add_argument('--image', default='addon-manager-native-test:local')
args = parser.parse_args()
repo = Path(__file__).resolve().parents[3]
vendor = args.vendor.resolve(strict=True)
if os.geteuid() == 0 or not (vendor / 'autoload.php').is_file():
    parser.error('Run as an unprivileged development user with a prepared vendor directory')

manifest = json.loads((repo / 'packages/gmod-toolkit/addon/manifest.json').read_text())
if manifest.get('extensions', {}).get('schedules'):
    parser.error('This addon must not resolve the host scheduler during validation')

with tempfile.TemporaryDirectory(prefix='gmod-original-probe-') as temporary:
    root = Path(temporary)
    stage, job, probe = root / 'stage', root / 'job', root / 'probe'
    subprocess.run([sys.executable, str(repo / 'packages/gmod-toolkit/tools/fixture.py'), str(stage)], check=True)
    modules = stage / 'node_modules'
    if modules.is_symlink():
        modules.unlink()
    (stage / 'vendor').mkdir()
    job.mkdir()
    probe.mkdir()
    original = subprocess.check_output(['git', 'show', '5a899b28aa80b08f3ab8a5cbae3e5315cc5c2563:addon-manager/src/Runner/probe.php'], cwd=repo)
    (probe / 'probe.php').write_bytes(original)
    bootstrap = stage / 'bootstrap/app.php'
    content = bootstrap.read_text()
    anchor = 'return $app;'
    assert content.count(anchor) == 1
    bootstrap.write_text(content.replace(anchor, "require_once $app->basePath('addon-manager/bootstrap.php');\n$app->register(\\AddonManager\\Laravel\\AddonManagerServiceProvider::class);\n" + anchor))
    changed = {entry['target'] for entry in manifest['files']} | {entry['target'] for entry in manifest['patches']}
    hashes = {}
    for path in stage.rglob('*.php'):
        relative = path.relative_to(stage).as_posix()
        if relative in changed or relative.startswith(('addon-manager/', 'storage/', 'bootstrap/cache/')):
            continue
        hashes[relative] = hashlib.sha256(path.read_bytes()).hexdigest()
    (job / 'input.json').write_text(json.dumps({'manifests': [manifest], 'baselineHashes': hashes}))
    command = ['docker', '--host=unix:///var/run/docker.sock', 'run', '--rm', '--network', 'none', '--read-only',
               '--user', f'{os.geteuid()}:{os.getegid()}', '--cap-drop', 'ALL', '--security-opt', 'no-new-privileges',
               '--memory', '768m', '--cpus', '2', '--pids-limit', '128']
    owner = f'uid={os.geteuid()},gid={os.getegid()}'
    for destination, size in [('/tmp', '128m'), ('/work/storage', '64m'), ('/work/bootstrap/cache', '16m')]:
        command += ['--tmpfs', f'{destination}:rw,nosuid,nodev,size={size},{owner}']
    for source, destination in [(stage, '/work'), (job, '/job'), (probe, '/runner'), (vendor, '/work/vendor')]:
        command += ['-v', f'{source}:{destination}:ro']
    # Deliberately do not disable telemetry: this reproduces the installed probe.
    environment = {'APP_ENV': 'testing', 'APP_DEBUG': 'false', 'APP_ENVIRONMENT_ONLY': 'true',
                   'APP_KEY': 'base64:AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA=',
                   'DB_CONNECTION': 'sqlite', 'DB_DATABASE': '/tmp/validation.sqlite',
                   'CACHE_STORE': 'array', 'CACHE_DRIVER': 'array', 'SESSION_DRIVER': 'array',
                   'QUEUE_CONNECTION': 'sync', 'LOG_CHANNEL': 'stderr'}
    for name, value in environment.items():
        command += ['-e', f'{name}={value}']
    command += [args.image, 'php', '/runner/probe.php']
    execution_environment = os.environ.copy()
    for name in ['DOCKER_HOST', 'DOCKER_CONTEXT', 'DOCKER_TLS', 'DOCKER_TLS_VERIFY', 'DOCKER_CERT_PATH']:
        execution_environment.pop(name, None)
    result = subprocess.run(command, env=execution_environment, capture_output=True, text=True, timeout=120)
    if result.returncode:
        raise SystemExit(result.stderr + result.stdout)
    report = json.loads(result.stdout)
    assert report['passed'] is True and report['laravelBoot'] is True and report['schedules'] == 0
    assert report['handlerClasses'] == 2 and report['routes'] == 2 and report['pages'] == 1
    print(json.dumps({'originalProbe': True, 'emptySyntheticDatabase': True, 'checks': report}))
