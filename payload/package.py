"""Incremental GMAD v3 / stored-ZIP writer, using the Panel's existing Python.

Format follows Facepunch/gmad create_gmad.cpp and Addon_Json.h. Each invocation
handles at most one approved asset; it never opens the live game filesystem.
"""
import hashlib
import json
import os
import re
import resource
import signal
import stat
import struct
import sys
import zlib

resource.setrlimit(resource.RLIMIT_CPU, (20, 20))
resource.setrlimit(resource.RLIMIT_AS, (128 * 1024 * 1024, 128 * 1024 * 1024))
resource.setrlimit(resource.RLIMIT_FSIZE, (3 * 1024 ** 3, 3 * 1024 ** 3))
signal.alarm(25)
root, request = sys.argv[1:]
if os.path.realpath(root) != root or os.path.dirname(request) != root:
    raise ValueError('Invalid private snapshot')


def key(name):
    return hashlib.sha256(('gmod-toolkit:export:' + name).encode()).hexdigest()


def opened(name, flags=os.O_RDONLY):
    if not re.fullmatch('[a-f0-9]{64}', name):
        raise ValueError('Invalid private object')
    fd = os.open(os.path.join(root, name), flags | os.O_NOFOLLOW, 0o600)
    info = os.fstat(fd)
    if not stat.S_ISREG(info.st_mode) or info.st_nlink != 1:
        os.close(fd)
        raise ValueError('Invalid private file')
    return os.fdopen(fd, 'r+b' if flags & os.O_RDWR else 'rb')


with opened(os.path.basename(request)) as source:
    if os.fstat(source.fileno()).st_size > 8 * 1024 ** 2:
        raise ValueError('Request exceeds limit')
    data = json.load(source)


def asset(entry, target=None, seed=0):
    digest = hashlib.sha256()
    crc, length = 0, 0
    with opened(entry['object']) as source:
        if os.fstat(source.fileno()).st_size != entry['bytes'] or not 0 < entry['bytes'] <= 128 * 1024 ** 2:
            raise ValueError('Snapshot size changed')
        while chunk := source.read(1024 * 1024):
            length += len(chunk)
            digest.update(chunk)
            crc = zlib.crc32(chunk, crc)
            if target:
                target.write(chunk)
                seed = zlib.crc32(chunk, seed)
    if length != entry['bytes'] or digest.hexdigest() != entry['sha256']:
        raise ValueError('Approved snapshot changed')
    return {'crc': crc, 'streamCrc': seed}


def local_header(name, crc=0, size=0, flags=0):
    encoded = name.encode('ascii')
    return struct.pack('<IHHHHHIIIHH', 0x04034B50, 20, flags, 0, 0, 33, crc, size, size, len(encoded), 0) + encoded


def central(name, crc, size, offset, flags=0):
    encoded = name.encode('ascii')
    return struct.pack('<IHHHHHHIIIHHHHHII', 0x02014B50, 20, 20, flags, 0, 0, 33, crc, size, size,
                       len(encoded), 0, 0, 0, 0, 0, offset) + encoded


def checked_archive():
    archive = opened(key('workshop.zip'), os.O_RDWR)
    offset = data['offset']
    if not isinstance(offset, int) or offset < 39 or os.fstat(archive.fileno()).st_size < offset:
        archive.close()
        raise ValueError('Incomplete package')
    archive.seek(offset)
    archive.truncate()  # Crash replay discards only the unfinished last step.
    return archive


mode = data['mode']
if mode == 'index':
    result = asset(data['entry'])
elif mode == 'init':
    entries, meta = data['entries'], data['metadata']
    if not 0 < len(entries) <= 5000 or sum(item['bytes'] for item in entries) > 2 * 1024 ** 3:
        raise ValueError('Package quota exceeded')
    description = {field: meta[field] for field in ['description', 'type', 'tags']}
    header = b'GMAD\x03' + struct.pack('<QQ', 0, data['created']) + b'\0'
    header += meta['title'].encode('utf-8') + b'\0' + json.dumps(description, ensure_ascii=False).encode('utf-8') + b'\0Server owner\0' + struct.pack('<I', 1)
    for number, entry in enumerate(entries, 1):
        path = entry['path']
        if not re.fullmatch('[a-z0-9_+./-]{1,240}', path) or '..' in path.split('/'):
            raise ValueError('Invalid addon path')
        header += struct.pack('<I', number) + path.encode('ascii') + b'\0' + struct.pack('<QI', entry['bytes'], entry['crc'])
    header += struct.pack('<I', 0)
    size = len(header) + sum(item['bytes'] for item in entries) + 4
    with opened(key('workshop.zip'), os.O_RDWR | os.O_CREAT) as target:
        target.truncate(0)
        target.write(local_header('addon.gma', flags=8))
        target.write(header)
        target.flush()
        os.fsync(target.fileno())
        result = {'offset': target.tell(), 'streamCrc': zlib.crc32(header), 'size': size}
elif mode == 'append':
    with checked_archive() as target:
        result = asset(data['entry'], target, data['streamCrc'])
        target.flush()
        os.fsync(target.fileno())
        result['offset'] = target.tell()
elif mode == 'finish':
    with opened(key('preview.jpg')) as source:
        cover = source.read(1048577)
    if len(cover) > 1048576 or not cover.startswith(b'\xff\xd8'):
        raise ValueError('Invalid cover image')
    meta = data['metadata']
    instructions = (
        'PUBLISH YOUR SERVER CONTENT PACK\n\n'
        '1. Extract all files from this ZIP. Only the approved public assets are inside addon.gma.\n'
        "2. Open Steam on your own PC, sign into the account that will own the addon, and install Garry's Mod.\n"
        "3. Use Garry's Mod bin/gmpublish (gmpublish.exe on Windows) to publish:\n\n"
        '   gmpublish.exe create -addon "FULL_PATH/addon.gma" -icon "FULL_PATH/preview.jpg"\n\n'
        '   On Linux/macOS use the corresponding gmpublish binary. Replace FULL_PATH with your extracted folder.\n'
        '4. Open the new item on Steam, review its visibility, title and description. '
        'Your chosen description is embedded in the GMA metadata and saved in description.txt.\n'
        '5. Edit your Steam collection and add the newly published item. Reload that collection in the Panel Workshop page, '
        'review it, and apply the client-download Lua. Restart the game server to load that Lua.\n\n'
        'Publishing and collection editing happen in your Steam account. This Panel export does not publish to Steam, '
        'change your collection, enable sv_downloadurl, or install/mount these assets on the game server.\n'
        'GMA paths are lowercase, matching the official gmad tool.\n'
    )
    with checked_archive() as target:
        footer = struct.pack('<I', data['streamCrc'])
        target.write(footer)
        crc = zlib.crc32(footer, data['streamCrc'])
        if target.tell() - len(local_header('addon.gma', flags=8)) != data['size']:
            raise ValueError('Addon size mismatch')
        target.write(struct.pack('<IIII', 0x08074B50, crc, data['size'], data['size']))
        directory = [central('addon.gma', crc, data['size'], 0, flags=8)]
        extras = {'preview.jpg': cover, 'addon.json': (json.dumps(meta, ensure_ascii=False, indent=2) + '\n').encode('utf-8'),
                  'description.txt': meta['description'].encode('utf-8'), 'PUBLISHING.txt': instructions.encode('utf-8')}
        for name, content in extras.items():
            offset, item_crc = target.tell(), zlib.crc32(content)
            target.write(local_header(name, item_crc, len(content)))
            target.write(content)
            directory.append(central(name, item_crc, len(content), offset))
        offset = target.tell()
        target.write(b''.join(directory))
        length = target.tell() - offset
        target.write(struct.pack('<IHHHHIIH', 0x06054B50, 0, 0, len(directory), len(directory), length, offset, 0))
        target.flush()
        os.fsync(target.fileno())
        result = {'bytes': target.tell()}
else:
    raise ValueError('Unsupported package phase')
print(json.dumps(result))
