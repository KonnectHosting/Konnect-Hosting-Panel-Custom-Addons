#!/usr/bin/env python3
"""Export the companion separately; it is not Panel deployment payload."""
import hashlib
from pathlib import Path
import zipfile

root = Path(__file__).resolve().parents[1]
output = root / 'dist/gmod-toolkit-node-1.0.0.zip'
checksum = output.with_name(output.name + '.sha256')
if output.exists() or checksum.exists():
    raise SystemExit('Output already exists; choose a new release version.')
output.parent.mkdir(exist_ok=True)
with zipfile.ZipFile(output, 'x', zipfile.ZIP_DEFLATED, compresslevel=9) as archive:
    for name in ['README.md', 'LICENSE.md', 'gmod_toolkit_agent.py', 'gmod-toolkit.service', 'nginx-locations.conf']:
        info = zipfile.ZipInfo('gmod-toolkit-node/' + name, (1980, 1, 1, 0, 0, 0))
        info.compress_type = zipfile.ZIP_DEFLATED
        info.external_attr = (0o100644 << 16)
        archive.writestr(info, (root / 'node' / name).read_bytes())
checksum.write_text(hashlib.sha256(output.read_bytes()).hexdigest() + '  ' + output.name + '\n')
print(output)
