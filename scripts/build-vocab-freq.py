#!/usr/bin/env python
"""Add a frequency (Zipf) to every word in src/data/vocab.json.

Run: python -m pip install wordfreq && python scripts/build-vocab-freq.py

Zipf is log10 of how often a word appears per billion words of English text
(wordfreq, which blends books, subtitles, news, web and social media): 7 is
"the", 4 is "ban", 2 is "loquacious", 1 is very rare. Word play's test mode
uses it as each word's difficulty.

Frequency is how often a word appears, not how well known it is, so three
kinds of word are corrected:
  - British spellings score low because the American form is more common in
    the corpus, so the higher of the two spellings is used.
  - Hyphenated words are scored from their parts ("open" + "handed"), and
    words that are also names or common nouns ("frank") score far too high.
    Both are set by hand in OVERRIDES, a judgement rather than a measurement.
  - Words below wordfreq's floor come back as 0; they get FLOOR instead.
"""
import json
from pathlib import Path
from wordfreq import zipf_frequency

PATH = Path(__file__).resolve().parent.parent / 'src' / 'data' / 'vocab.json'
FLOOR = 1.0
OVERRIDES = {
    'open-handed': 2.0,  # scored 4.38 from "open" + "handed"
    'frank': 3.0,        # scored 4.75, mostly the name Frank
}
SPELLINGS = [('ise', 'ize'), ('isation', 'ization'), ('our', 'or'), ('ae', 'e'), ('ll', 'l')]


def zipf(word):
    if word in OVERRIDES:
        return OVERRIDES[word]
    forms = {word, word.lower()} | {word.replace(uk, us) for uk, us in SPELLINGS if uk in word}
    z = max(zipf_frequency(f, 'en') for f in forms)
    return round(z, 2) if z > 0 else FLOOR


def main():
    data = json.loads(PATH.read_text(encoding='utf8'))
    for g in data['groups']:
        g['words'] = [[w, d, zipf(w)] for w, d, *_ in g['words']]
    PATH.write_text(json.dumps(data, indent=1, ensure_ascii=False) + '\n', encoding='utf8')
    zs = sorted(w[2] for g in data['groups'] for w in g['words'])
    print(f'{len(zs)} words, Zipf {zs[0]} to {zs[-1]}, median {zs[len(zs) // 2]}')
    bands = {}
    for z in zs:
        bands[int(z)] = bands.get(int(z), 0) + 1
    print('words per Zipf band:', dict(sorted(bands.items())))


if __name__ == '__main__':
    main()
