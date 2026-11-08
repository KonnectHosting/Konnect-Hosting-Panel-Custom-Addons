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
    if source.suffix in ['.php', '.py'] and not source.name.endswith('.blade.php'):
        target = 'app/Addons/GmodToolkit/' + source.name
    elif source.name.endswith('.blade.php'):
        target = 'resources/views/addons/gmod_toolkit/' + source.name
    elif source.suffix == '.tsx':
        target = 'resources/scripts/components/server/gmodToolkit/' + source.name
    elif source.name == 'cover.jpg':
        target = 'app/Addons/GmodToolkit/' + source.name
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
        Route::get('/workshop', [\\Pterodactyl\\Addons\\GmodToolkit\\ToolkitController::class, 'workshopStatus']);
        Route::get('/fastdl', [\\Pterodactyl\\Addons\\GmodToolkit\\ToolkitController::class, 'fastdlStatus']);
        Route::get('/workshop/cover', [\\Pterodactyl\\Addons\\GmodToolkit\\ToolkitController::class, 'cover']);
        Route::get('/scanner', [\\Pterodactyl\\Addons\\GmodToolkit\\ScannerController::class, 'status']);
        Route::post('/scanner/start', [\\Pterodactyl\\Addons\\GmodToolkit\\ScannerController::class, 'start']);
        Route::post('/scanner/cancel', [\\Pterodactyl\\Addons\\GmodToolkit\\ScannerController::class, 'cancel']);
        Route::post('/scanner/settings', [\\Pterodactyl\\Addons\\GmodToolkit\\ScannerController::class, 'settings']);
        Route::post('/workshop/selection', [\\Pterodactyl\\Addons\\GmodToolkit\\ToolkitController::class, 'selection']);
        Route::post('/fastdl/addon', [\\Pterodactyl\\Addons\\GmodToolkit\\ToolkitController::class, 'buildAddon']);
        Route::get('/fastdl/addon/{id}', [\\Pterodactyl\\Addons\\GmodToolkit\\ToolkitController::class, 'downloadAddon'])->where('id', '[a-f0-9]{64}');
        Route::post('/workshop/preview', [\\Pterodactyl\\Addons\\GmodToolkit\\ToolkitController::class, 'preview']);
        Route::post('/workshop/apply', [\\Pterodactyl\\Addons\\GmodToolkit\\ToolkitController::class, 'apply']);
        Route::post('/fastdl/{action}', [\\Pterodactyl\\Addons\\GmodToolkit\\ToolkitController::class, 'fastdl'])->where('action', 'prepare|preview|publish|rotate|revoke');
    });
"""),
    ('server-tab', 'resources/scripts/routers/routes.ts', '    server: [\n',
     """        {
            path: '/backdoor-scanner',
            permission: 'file.read-content',
            name: 'Backdoor Scanner',
            component: lazy(() => import('@/components/server/gmodToolkit/ScannerContainer')),
            exact: true,
        },
        {
            path: '/fastdl',
            permission: 'file.read-content',
            name: 'FastDL',
            component: lazy(() => import('@/components/server/gmodToolkit/FastdlContainer')),
            exact: true,
        },
        {
            path: '/workshop',
            permission: 'file.read-content',
            name: 'Workshop',
            component: lazy(() => import('@/components/server/gmodToolkit/WorkshopContainer')),
            exact: true,
        },
        {
            path: '/gmod-toolkit',
            permission: 'file.read-content',
            name: undefined,
            component: lazy(() => import('@/components/server/gmodToolkit/GmodToolkitContainer')),
            exact: true,
        },
"""),
    ('public-fastdl', 'routes/base.php', 'use Pterodactyl\\Http\\Middleware\\RequireTwoFactorAuthentication;\n',
     """
// Only approved immutable asset snapshots are publicly downloadable.
Route::get('/fastdl/{token}/{path}', \\Pterodactyl\\Addons\\GmodToolkit\\DownloadController::class)
    ->where('token', '[a-f0-9]{64}')->where('path', '.+')
    ->withoutMiddleware(['auth.session', RequireTwoFactorAuthentication::class])
    ->middleware(\\Pterodactyl\\Addons\\GmodToolkit\\Enabled::class)
    ->name('gmod-toolkit.fastdl');
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
    'manifestVersion': 1, 'id': 'gmod.toolkit', 'name': 'GMod Toolkit', 'version': '1.6.0',
    'description': 'Workshop, Panel-hosted FastDL and private static backdoor scans using existing Wings and queue services.',
    'compatibility': {'manager': '=2.0.1', 'php': '>=8.2 <9.0', 'panel': '=1.15.1'},
    'dependencies': [], 'incompatible': [], 'files': files, 'patches': patches,
    'extensions': {
        'pages': [{'id': 'settings-page', 'path': 'settings', 'title': 'GMod Toolkit', 'view': 'addons.gmod_toolkit.settings', 'permission': 'admin'}],
        'menus': [{'id': 'settings-menu', 'label': 'GMod Toolkit', 'page': 'settings-page'}],
        'routes': [
            {'id': 'settings-save', 'path': 'settings/save', 'method': 'POST', 'handler': 'Pterodactyl\\Addons\\GmodToolkit\\AdminController@save', 'permission': 'admin'},
        ],
        'jobs': [{'id': 'fastdl-step', 'handler': 'Pterodactyl\\Addons\\GmodToolkit\\Fastdl@handle', 'permission': 'system'},
                 {'id': 'scanner-step', 'handler': 'Pterodactyl\\Addons\\GmodToolkit\\BackdoorScanner@handle', 'permission': 'system'}],
    },
    'database': {'dataPolicy': 'preserve', 'migrations': []},
    'build': {'mode': 'panel', 'profile': 'panel-v1', 'outputs': ['public/assets']},
}
(ADDON / 'manifest.json').write_text(json.dumps(manifest, indent=2) + '\n')
print('Declared', len(files), 'payload files and', len(patches), 'exact patches')
