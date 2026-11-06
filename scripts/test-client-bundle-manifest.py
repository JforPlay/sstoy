import hashlib
import tempfile
import unittest
from pathlib import Path
from client_bundle_manifest import ClientBundleManifest


class ManifestSelectionTest(unittest.TestCase):
    def test_rejects_nonempty_stale_cache_even_when_same_size(self):
        with tempfile.TemporaryDirectory() as temporary:
            game=Path(temporary)
            cache=game/'Persistent_Store/AssetBundles'
            install=game/'StellaSora_Data/StreamingAssets/InstallResource'
            cache.mkdir(parents=True);install.mkdir(parents=True)
            (cache/'character.unity3d').write_bytes(b'old!')
            (install/'character.unity3d').write_bytes(b'new!')
            digest=hashlib.md5(b'new!').hexdigest()
            (cache.parent/'ss_win.mani').write_text(f'$RES_VER:1\ncharacter.unity3d|{digest}|4|0|\n')
            manifest=ClientBundleManifest(game)
            self.assertEqual(manifest.select('character.unity3d'),install/'character.unity3d')
            self.assertEqual(len(manifest.rejected),1)
            self.assertEqual((cache/'character.unity3d').read_bytes(),b'old!')

    def test_prefers_a_verified_patch_but_never_an_unlisted_or_corrupt_file(self):
        with tempfile.TemporaryDirectory() as temporary:
            game=Path(temporary);cache=game/'Persistent_Store/AssetBundles';cache.mkdir(parents=True)
            (cache/'character.unity3d').write_bytes(b'patch')
            digest=hashlib.md5(b'patch').hexdigest()
            (cache.parent/'ss_win.mani').write_text(f'$RES_VER:2\ncharacter.unity3d|{digest}|5|0|\nmissing.unity3d|{digest}|5|0|\n')
            manifest=ClientBundleManifest(game)
            self.assertEqual(manifest.select('character.unity3d'),cache/'character.unity3d')
            self.assertIsNone(manifest.select('missing.unity3d',optional=True))
            with self.assertRaises(FileNotFoundError):manifest.select('unlisted.unity3d')
            with self.assertRaises(FileNotFoundError):manifest.select('missing.unity3d')

if __name__=='__main__':unittest.main()
