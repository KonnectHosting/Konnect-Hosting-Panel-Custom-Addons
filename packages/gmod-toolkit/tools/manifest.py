#!/usr/bin/env python3
"""Produce declarations for reviewed addon bytes; SDK export still verifies them."""
import hashlib
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
ADDON = ROOT / 'addon'
REPO = ROOT.parents[1]


def digest(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()


files = []
for source in sorted((ADDON / 'payload').iterdir()):
    if source.suffix == '.php' and not source.name.endswith('.blade.php'):
        target = 'app/Addons/GmodToolkit/' + source.name
    elif source.name.endswith('.blade.php'):
        target = 'resources/views/addons/gmod_toolkit/' + source.name
    elif source.suffix == '.tsx':
        target = 'resources/scripts/components/server/gmodToolkit/' + source.name
    else:
        raise ValueError('Unmapped payload: ' + source.name)
    files.append({'source': 'payload/' + source.name, 'target': target, 'sha256': digest(source)})

specs = [
    ('client-api', 'routes/api-client.php',
     "    Route::get('/resources', Client\\Servers\\ResourceUtilizationController::class)->name('api:client:server.resources');\n",
     """
    // GMod Toolkit: retains the enclosing authenticated, per-server middleware.
    Route::prefix('/gmod-toolkit')->middleware(\\Pterodactyl\\Addons\\GmodToolkit\\Enabled::class)->group(function () {
        Route::get('/', [\\Pterodactyl\\Addons\\GmodToolkit\\ToolkitController::class, 'status']);
        Route::post('/workshop/preview', [\\Pterodactyl\\Addons\\GmodToolkit\\ToolkitController::class, 'preview']);
        Route::post('/workshop/apply', [\\Pterodactyl\\Addons\\GmodToolkit\\ToolkitController::class, 'apply']);
        Route::post('/fastdl/{action}', [\\Pterodactyl\\Addons\\GmodToolkit\\ToolkitController::class, 'fastdl'])->where('action', 'preview|publish|rotate|revoke');
    });
"""),
    ('server-tab', 'resources/scripts/routers/routes.ts', '    server: [\n',
     """        {
            path: '/gmod-toolkit',
            permission: 'file.read-content',
            name: 'GMod Toolkit',
            component: lazy(() => import('@/components/server/gmodToolkit/GmodToolkitContainer')),
            exact: true,
        },
"""),
]
patches = []
for name, target, find, addition in specs:
    before = ADDON / 'patches' / (name + '-find.txt')
    after = ADDON / 'patches' / (name + '-replace.txt')
    before.write_text(find)
    after.write_text(find + addition)
    patches.append({'id': name, 'target': target, 'owner': 'baseline', 'find': 'patches/' + before.name,
                    'replace': 'patches/' + after.name, 'beforeSha256': digest(before), 'afterSha256': digest(after)})

manifest = {
    'manifestVersion': 1, 'id': 'gmod.toolkit', 'name': 'GMod Toolkit', 'version': '1.0.0',
    'description': 'Workshop client Lua with previews/backups and node-local FastDL publishing with per-server permissions.',
    'compatibility': {'manager': '=2.0.1', 'php': '>=8.2 <9.0', 'panel': '=1.15.1'},
    'dependencies': [], 'incompatible': [], 'files': files, 'patches': patches,
    'extensions': {
        'pages': [{'id': 'settings-page', 'path': 'settings', 'title': 'GMod Toolkit', 'view': 'addons.gmod_toolkit.settings', 'permission': 'admin'}],
        'menus': [{'id': 'settings-menu', 'label': 'GMod Toolkit', 'page': 'settings-page'}],
        'routes': [
            {'id': 'settings-save', 'path': 'settings/save', 'method': 'POST', 'handler': 'Pterodactyl\\Addons\\GmodToolkit\\AdminController@save', 'permission': 'admin'},
            {'id': 'node-provision', 'path': 'nodes/provision', 'method': 'POST', 'handler': 'Pterodactyl\\Addons\\GmodToolkit\\AdminController@provision', 'permission': 'admin'},
        ],
    },
    'database': {'dataPolicy': 'preserve', 'migrations': []},
    'build': {'mode': 'panel', 'profile': 'panel-v1', 'outputs': ['public/assets']},
}
(ADDON / 'manifest.json').write_text(json.dumps(manifest, indent=2) + '\n')
print('Declared', len(files), 'payload files and', len(patches), 'exact patches')
