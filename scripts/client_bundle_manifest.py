"""Select local game bundles by the active client manifest, never file presence.

Client updates can leave old, nonempty files in Persistent_Store. Such a file is
not a patch unless both its declared size and MD5 match the current manifest.
This helper only reads the game installation; it does not delete stale caches.
"""
import hashlib
from pathlib import Path


class ClientBundleManifest:
    def __init__(self, game: Path):
        self.roots = [game / 'Persistent_Store/AssetBundles', game / 'StellaSora_Data/StreamingAssets/InstallResource']
        self.path = game / 'Persistent_Store/ss_win.mani'
        if not self.path.is_file():
            self.path = self.roots[1] / 'install_resource_manifest.mani'
        self.entries = {}
        self.metadata = {}
        self.rejected = {}
        self.selected = {}
        self._cache = {}
        self.sha256 = hashlib.sha256(self.path.read_bytes()).hexdigest()
        for line in self.path.read_text(encoding='utf-8-sig').splitlines():
            if line.startswith('$'):
                key, _, value = line.partition(':')
                if not key.startswith('$BIN_DIFF_PATCH_FILE'):
                    self.metadata[key.lstrip('$')] = value
                continue
            fields = line.split('|')
            if len(fields) < 3:
                continue
            name, digest, size = fields[:3]
            if len(digest) != 32 or not all(char in '0123456789abcdefABCDEF' for char in digest):
                raise ValueError(f'Invalid manifest digest: {name}')
            self.entries[name.lower()] = (digest.lower(), int(size))

    def select(self, name: str, optional=False):
        key = name.lower()
        if key not in self._cache:
            expected = self.entries.get(key)
            result = None
            if expected:
                for root in self.roots:
                    path = root / name
                    if not path.is_file():
                        continue
                    size = path.stat().st_size
                    digest = hashlib.md5(path.read_bytes()).hexdigest() if size == expected[1] else None
                    if size == expected[1] and digest == expected[0]:
                        result = path
                        self.selected[key] = {'file': str(path), 'md5': digest, 'size': size}
                        break
                    self.rejected[str(path)] = {'file': str(path), 'size': size, 'md5': digest,
                                                'expectedSize': expected[1], 'expectedMd5': expected[0]}
            self._cache[key] = result
        result = self._cache[key]
        if result is None and not optional:
            raise FileNotFoundError(f'No local bundle matches the active client manifest: {name}')
        return result

    def provenance(self):
        return {'file': str(self.path), 'sha256': self.sha256, 'metadata': self.metadata,
                'verifiedBundles': list(self.selected.values()), 'rejectedLocalCopies': list(self.rejected.values())}
