"""Validate an uploaded static release, activate atomically, revert on HTTP failure."""
import fcntl
import hashlib
import json
import os
from pathlib import Path
import re
import sys
import urllib.request

APPS = {'abc-garden', 'reading-garden', 'math-garden'}


def validate(target, app, release, expected):
    manifest = target / '.deploy-manifest.json'
    if manifest.is_symlink():
        raise ValueError('Manifest must not be a symlink')
    raw = manifest.read_bytes()
    if hashlib.sha256(raw).hexdigest() != expected:
        raise ValueError('Manifest checksum mismatch')
    data = json.loads(raw)
    if data['app'] != app or data['release'] != release:
        raise ValueError('Wrong application or release')
    actual = set()
    for path in target.rglob('*'):
        if path.is_symlink():
            raise ValueError('Symlinks are not allowed in an uploaded release')
        if path.is_file() and path != manifest:
            actual.add(path.relative_to(target).as_posix())
    if actual != set(data['files']):
        raise ValueError('Release file list mismatch')
    for name, expected_hash in data['files'].items():
        path = Path(name)
        if path.is_absolute() or '..' in path.parts or any(part.startswith('.') for part in path.parts):
            raise ValueError('Unsafe file path')
        if hashlib.sha256((target / name).read_bytes()).hexdigest() != expected_hash:
            raise ValueError(f'File checksum mismatch: {name}')
    for name in ['index.html', 'app/main.js', 'sw.js', 'manifest.webmanifest', '_release.json']:
        if name not in actual:
            raise ValueError(f'Missing required file: {name}')


def replace_link(link, target):
    temporary = link.with_name(link.name + '.next')
    if temporary.is_symlink():
        temporary.unlink()
    temporary.symlink_to(target)
    os.replace(temporary, link)


def smoke(app, target):
    opener = urllib.request.build_opener(urllib.request.ProxyHandler({}))
    base = 'http://127.0.0.1:8080/' + app + '/'
    for file in ['index.html', 'app/main.js', 'sw.js', 'manifest.webmanifest', '_release.json']:
        if not (target / file).exists():
            if file == '_release.json':  # Initial pre-migration releases have no metadata.
                continue
            raise ValueError(f'Missing entry: {file}')
        request = urllib.request.Request(base + file, headers={'Host': 'nmwei.cn'})
        with opener.open(request, timeout=15) as response:
            if response.status != 200 or response.read() != (target / file).read_bytes():
                raise ValueError(f'HTTP check failed: {file}')


def activate(site, target, check):
    current, previous = site / 'current', site / 'previous'
    if current.exists() and not current.is_symlink():
        raise ValueError('Refuse to replace a real current directory')
    old = current.resolve() if current.is_symlink() else None
    replace_link(current, target)
    try:
        check(target)
    except Exception:
        if old:
            replace_link(current, old)
        else:
            current.unlink()
        raise
    if old:
        replace_link(previous, old)


def main():
    app, action = sys.argv[1:3]
    if app not in APPS:
        raise ValueError('Unknown application')
    site = Path('/srv/gardens/sites') / app
    with (site / '.publish.lock').open('a') as lock:
        fcntl.flock(lock, fcntl.LOCK_EX)
        if action == 'rollback':
            if not (site / 'previous').is_symlink():
                raise ValueError('No previous release')
            target = (site / 'previous').resolve(strict=True)
        else:
            if not re.fullmatch(r'\d{8}T\d{9}Z-[a-f0-9]{8}', action):
                raise ValueError('Invalid release id')
            target = site / 'releases' / action
            if target.is_symlink():
                raise ValueError('Release directory must not be a symlink')
            validate(target, app, action, sys.argv[3])
        activate(site, target, lambda candidate: smoke(app, candidate))
        print(json.dumps({'app': app, 'status': 'verified', 'action': action, 'current': str(target)}))


if __name__ == '__main__':
    main()
