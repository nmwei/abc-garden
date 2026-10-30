"""Prepare Mandarin phonemes for Kokoro 1.1. Install misaki[zh] in a dev venv."""
import json
import sys
from contextlib import redirect_stdout

texts = json.load(sys.stdin)
result = {}
with redirect_stdout(sys.stderr):
    from misaki.zh import ZHG2P
    g2p = ZHG2P(version='1.1')
    for key, text in texts.items():
        phonemes, _ = g2p(text)
        if not phonemes or '❓' in phonemes:
            raise ValueError(f'Unsupported Mandarin prompt: {key}')
        result[key] = phonemes
json.dump(result, sys.stdout, ensure_ascii=False)
