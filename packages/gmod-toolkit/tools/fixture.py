#!/usr/bin/env python3
"""Prepare an ABSENT disposable fixture, excluding live data and credentials."""
import argparse
import json
from pathlib import Path
import shutil

parser = argparse.ArgumentParser()
parser.add_argument('destination', type=Path)
parser.add_argument('--variant', choices=['stock', 'arix', 'arix-pack'], default='stock')
parser.add_argument('--frontend-only', action='store_true')
args = parser.parse_args()
repo = Path(__file__).resolve().parents[3]
addon = Path(__file__).resolve().parents[1] / 'addon'
out = args.destination.resolve()
if out.exists():
    parser.error('Destination must not exist; never target a live Panel')
out.mkdir(parents=True)

names = ['resources', 'public', 'package.json', 'yarn.lock', 'webpack.config.js', 'tsconfig.json',
         'babel.config.js', 'postcss.config.js', 'tailwind.config.js', '.eslintrc.js', '.prettierrc.json']
if not args.frontend_only:
    names += ['app', 'bootstrap', 'config', 'routes', 'database', 'artisan', 'composer.json', 'composer.lock', 'addon-manager']
for name in names:
    source = repo / name
    if source.is_dir():
        shutil.copytree(source, out / name, ignore=shutil.ignore_patterns('*.log', 'cache', '__pycache__'))
    elif source.is_file():
        shutil.copy2(source, out / name)

# Frontend overlays only; PHP runtime tests use stock host code and real deps.
if args.variant != 'stock':
    shutil.copytree(repo / 'arix/v2.1.3/resources', out / 'resources', dirs_exist_ok=True)
    shutil.copy2(repo / 'arix/v2.1.3/tailwind.config.js', out / 'tailwind.config.js')
if args.variant == 'arix-pack':
    shutil.copytree(repo / 'addons/v2.0.2/resources', out / 'resources', dirs_exist_ok=True)

manifest = json.loads((addon / 'manifest.json').read_text())
for file in manifest['files']:
    if args.frontend_only and not file['target'].startswith('resources/scripts/'):
        continue
    target = out / file['target']
    target.parent.mkdir(parents=True, exist_ok=True)
    shutil.copy2(addon / file['source'], target)
for patch in manifest['patches']:
    if args.frontend_only and not patch['target'].startswith('resources/scripts/'):
        continue
    path = out / patch['target']
    before = (addon / patch['find']).read_text()
    after = (addon / patch['replace']).read_text()
    content = path.read_text()
    if content.count(before) != 1:
        raise ValueError('Patch does not match exactly once: ' + patch['target'])
    path.write_text(content.replace(before, after))

if not args.frontend_only:
    for path in ['bootstrap/cache', 'storage/framework/cache/data', 'storage/framework/sessions',
                 'storage/framework/views', 'storage/logs', 'storage/app']:
        (out / path).mkdir(parents=True, exist_ok=True)
if (repo / 'node_modules').is_dir():
    (out / 'node_modules').symlink_to(repo / 'node_modules', target_is_directory=True)
print('Prepared disposable fixture:', out)
