import hashlib
import importlib.util
import json
from pathlib import Path
import tempfile
import unittest

spec = importlib.util.spec_from_file_location('publisher', Path(__file__).parents[1] / 'scripts/publish-site.py')
publisher = importlib.util.module_from_spec(spec)
spec.loader.exec_module(publisher)


class PublishTests(unittest.TestCase):
    def test_integrity_and_extra_file_rejection(self):
        with tempfile.TemporaryDirectory() as temp:
            root = Path(temp)
            (root / 'app').mkdir()
            files = {}
            for name in ['index.html', 'app/main.js', 'sw.js', 'manifest.webmanifest', '_release.json']:
                (root / name).write_text(name)
                files[name] = hashlib.sha256(name.encode()).hexdigest()
            raw = json.dumps({'app': 'abc-garden', 'release': 'test', 'files': files}).encode()
            (root / '.deploy-manifest.json').write_bytes(raw)
            expected = hashlib.sha256(raw).hexdigest()
            publisher.validate(root, 'abc-garden', 'test', expected)
            (root / 'index.html').write_text('corrupt')
            with self.assertRaisesRegex(ValueError, 'checksum'):
                publisher.validate(root, 'abc-garden', 'test', expected)
            (root / 'index.html').write_text('index.html')
            (root / '.env').write_text('secret')
            with self.assertRaisesRegex(ValueError, 'file list'):
                publisher.validate(root, 'abc-garden', 'test', expected)

    def test_failed_activation_restores_previous_site(self):
        with tempfile.TemporaryDirectory() as temp:
            root = Path(temp)
            old, new = root / 'old', root / 'new'
            old.mkdir()
            new.mkdir()
            (root / 'current').symlink_to(old)
            def failed(_):
                raise ValueError('HTTP failure')
            with self.assertRaisesRegex(ValueError, 'HTTP failure'):
                publisher.activate(root, new, failed)
            self.assertEqual((root / 'current').resolve(), old.resolve())
            publisher.activate(root, new, lambda _: None)
            self.assertEqual((root / 'current').resolve(), new.resolve())
            self.assertEqual((root / 'previous').resolve(), old.resolve())

    def test_failed_first_deploy_does_not_leave_live_link(self):
        with tempfile.TemporaryDirectory() as temp:
            root = Path(temp)
            candidate = root / 'candidate'
            candidate.mkdir()
            with self.assertRaises(ZeroDivisionError):
                publisher.activate(root, candidate, lambda _: 1 / 0)
            self.assertFalse((root / 'current').is_symlink())


unittest.main()
