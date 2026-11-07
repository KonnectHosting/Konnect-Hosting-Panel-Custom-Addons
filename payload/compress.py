"""Private runtime helper; uses Python already present on the Panel host."""
import bz2
import os
import stat
import sys
import resource
import signal

# Bound the helper independently, including if the queue worker is interrupted.
resource.setrlimit(resource.RLIMIT_CPU, (25, 25))
resource.setrlimit(resource.RLIMIT_AS, (256 * 1024 * 1024, 256 * 1024 * 1024))
resource.setrlimit(resource.RLIMIT_FSIZE, (150 * 1024 * 1024, 150 * 1024 * 1024))
signal.alarm(28)

source, destination = sys.argv[1:]
fd = os.open(source, os.O_RDONLY | os.O_NOFOLLOW)
try:
    info = os.fstat(fd)
    if not stat.S_ISREG(info.st_mode) or info.st_nlink != 1 or info.st_size > 128 * 1024 * 1024:
        raise ValueError('Invalid source asset')
    out = os.open(destination, os.O_WRONLY | os.O_CREAT | os.O_EXCL | os.O_NOFOLLOW, 0o600)
    with os.fdopen(out, 'wb') as target, bz2.BZ2File(target, 'w', compresslevel=1) as compressed:
        while chunk := os.read(fd, 1024 * 1024):
            compressed.write(chunk)
finally:
    os.close(fd)
