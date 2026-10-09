'use strict';

// Runs inside the restricted build container. Source/dependencies are read-only;
// only the bounded tmpfs assets directory and disposable /tmp are writable.
const fs = require('fs');
const path = require('path');
const child = require('child_process');
const root = '/work/public/assets';
const maximum = 128 * 1024 * 1024;

function emit(buffer) {
    let offset = 0;
    while (offset < buffer.length) offset += fs.writeSync(1, buffer, offset, buffer.length - offset);
}

try {
    fs.cpSync('/baseline-assets', root, { recursive: true, dereference: false });
    const result = child.spawnSync('yarn', ['--offline', 'build:production'], {
        cwd: '/work', stdio: ['ignore', 2, 2],
        env: { ...process.env, HOME: '/tmp', XDG_CACHE_HOME: '/tmp/cache', YARN_CACHE_FOLDER: '/tmp/yarn-cache' },
    });
    if (result.error || result.status !== 0) throw new Error('Panel frontend build failed.');
    const files = [];
    let bytes = 0;
    function walk(directory, prefix = '') {
        for (const entry of fs.readdirSync(directory, { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name))) {
            const relative = prefix + entry.name;
            if (!/^[A-Za-z0-9_@+./-]+$/.test(relative) || entry.isSymbolicLink()) throw new Error('Unsafe generated asset path.');
            if (entry.isDirectory()) walk(path.join(directory, entry.name), relative + '/');
            else if (entry.isFile()) {
                const size = fs.statSync(path.join(directory, entry.name)).size;
                bytes += size;
                if (size > 64 * 1024 * 1024 || bytes > maximum || files.length >= 4096) throw new Error('Generated assets exceed the bounded output limits.');
                files.push({ relative, size });
            } else throw new Error('Unsupported generated asset type.');
        }
    }
    walk(root);
    if (!files.some(file => file.relative === 'manifest.json')) throw new Error('Frontend manifest is missing.');
    emit(Buffer.from('KAMASSET1\n'));
    for (const file of files) {
        const name = Buffer.from(file.relative, 'utf8');
        if (name.length > 512) throw new Error('Generated asset path is too long.');
        const header = Buffer.alloc(6);
        header.writeUInt16BE(name.length, 0);
        header.writeUInt32BE(file.size, 2);
        emit(header); emit(name);
        const descriptor = fs.openSync(path.join(root, file.relative), 'r');
        try {
            const buffer = Buffer.alloc(65536);
            let remaining = file.size;
            while (remaining > 0) {
                const count = fs.readSync(descriptor, buffer, 0, Math.min(buffer.length, remaining), null);
                if (count === 0) throw new Error('Asset changed while being exported.');
                emit(buffer.subarray(0, count)); remaining -= count;
            }
        } finally { fs.closeSync(descriptor); }
    }
    emit(Buffer.alloc(6));
} catch (error) {
    process.stderr.write(String(error.message) + '\n');
    process.exit(1);
}
