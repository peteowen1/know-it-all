#!/usr/bin/env python
"""Build src/data/vocab.json for Word play: hand-written families plus WordNet ones.

Run:
  python -m pip install wordfreq nltk gensim
  python scripts/build-vocab.py

One-off downloads: the WordNet corpus (via nltk) and the GloVe word vectors
glove-wiki-gigaword-100 (128 MB, via gensim, stored in ~/gensim-data).

The file holds two kinds of family. Hand-written ones (no `src`) are the
editable source and are kept as they are. WordNet ones (`src: "wordnet"`) are
regenerated on every run, so edit this script rather than those entries.

Three things are computed:

1. Frequencies. Every word gets a Zipf value from wordfreq: log10 of uses per
   billion words (7 is "the", 4 is "ban", 1 is very rare). Test mode uses it as
   difficulty. British spellings take the higher of the two spellings, and a
   few words the corpus scores wrongly are set by hand in OVERRIDES.

2. WordNet families. A WordNet synset (one meaning with the words that express
   it) becomes a family when at least three of its words are single words at
   Zipf 1 to 4.5, in that meaning as one of their top two meanings (the main
   meaning for common words), and not slang, slurs or vulgar. Spelling and
   word-form variants are collapsed so a synonym question is never
   "skillful/skilful".

3. Clashes. Two families must never share a question as wrong options if a
   reader could call them synonyms or opposites. WordNet's own links caught
   only 7 of 36 clashes the reviews found by hand, so clashes come from word
   vectors instead: families clash when any word of one is within CLASH_AT
   (cosine similarity) of any word of the other or of its opposite family. At
   0.45 that caught 21/21 of the first review's clashes and 19/21 of the
   second's, which it was not tuned on, at the cost of ruling out about two
   thirds of family pairs as decoys. The result is stored as a bit matrix,
   alongside the hand-written `near` lists, which stay in force.
"""
import base64
import collections
import json
import re
from pathlib import Path

import gensim.downloader as api
import numpy as np
from nltk.corpus import wordnet as wn
from wordfreq import zipf_frequency

PATH = Path(__file__).resolve().parent.parent / 'src' / 'data' / 'vocab.json'

FLOOR = 1.0
OVERRIDES = {
    'open-handed': 2.0,  # scored 4.38 from "open" + "handed"
    'frank': 3.0,        # scored 4.75, mostly the name Frank
}
SPELLINGS = [('ise', 'ize'), ('isation', 'ization'), ('our', 'or'), ('ae', 'e'), ('ll', 'l')]
CLASH_AT = 0.45

POS = {'a': 'adj', 's': 'adj', 'v': 'verb', 'n': 'noun'}
BAD_DOMAINS = {'slang.n.02', 'vulgarism.n.01', 'obscenity.n.02', 'ethnic_slur.n.01', 'disparagement.n.01',
               'colloquialism.n.01', 'archaism.n.01', 'trademark.n.01'}
# Nouns are kept only for these kinds; the rest are mostly lists of plants,
# animals, body parts, substances and objects.
NOUN_KINDS = {'noun.act', 'noun.attribute', 'noun.cognition', 'noun.communication', 'noun.event', 'noun.feeling',
              'noun.motive', 'noun.person', 'noun.phenomenon', 'noun.process', 'noun.state', 'noun.group'}
MAX_WORDS = 5
# A word is dropped when ANY of its meanings is tagged as a slur or vulgar,
# not only the meaning in use: "spic" arrived innocently inside "spotless".
# The lists below catch what WordNet's tags miss; found by reading every
# family whose words or sense matched a list of sensitive stems.
BLOCK_WORDS = {'pissed', 'midget', 'bastard', 'bollocks', 'retard', 'moron', 'cretin', 'spic', 'queer', 'raped',
               'gimpy', 'crippled', 'whore', 'slut', 'slattern', 'slatternly', 'blowsy', 'blowzy', 'wino'}
BLOCK_FAMILIES = {'prostitute.n.01', 'homosexuality.n.01', 'idiot.n.01', 'blowsy.s.01', 'crippled.s.01'}


def zipf(word):
    if word in OVERRIDES:
        return OVERRIDES[word]
    forms = {word, word.lower()} | {word.replace(uk, us) for uk, us in SPELLINGS if uk in word}
    z = max(zipf_frequency(f, 'en') for f in forms)
    return round(z, 2) if z > 0 else FLOOR


def level_of(zs):
    med = sorted(zs)[len(zs) // 2]
    return 1 if med >= 3.3 else 2 if med >= 2.3 else 3


def tainted(word):
    return word in BLOCK_WORDS or any({d.name() for d in x.usage_domains()} & BAD_DOMAINS for x in wn.synsets(word))


def usable_synset(s):
    if s.name() in BLOCK_FAMILIES or {d.name() for d in s.usage_domains()} & BAD_DOMAINS:
        return False
    if s.pos() == 'n' and s.lexname() not in NOUN_KINDS:
        return False
    return s.lexname() not in ('adj.pert', 'verb.weather')


def sense_rank(word, s):
    ranked = [x for x in wn.synsets(word) if POS.get(x.pos()) == POS[s.pos()]]
    return ranked.index(s) if s in ranked else 99


def dedupe(words):
    """Keep the commonest word of each spelling or word-form variant set."""
    keep = []
    for w in sorted(words, key=lambda x: -zipf(x)):
        if not any(w[:min(5, len(k), len(w))] == k[:min(5, len(k), len(w))] for k in keep):
            keep.append(w)
    return keep


def wordnet_families(taken, vectors):
    best = {}  # word -> (synset, rank): the synset where it is used in its highest-ranked meaning
    for s in wn.all_synsets():
        if s.pos() not in POS or not usable_synset(s):
            continue
        for lemma in s.lemmas():
            w = lemma.name()
            if not re.fullmatch(r'[a-z]{4,}', w) or w in taken or w not in vectors or tainted(w):
                continue
            z = zipf(w)
            if not 1.0 <= z <= 4.5:
                continue
            rank = sense_rank(w, s)
            # Common words must be in their main meaning: "hood" as a thug or
            # "grind" as a swot reads as a mistake.
            if rank > (0 if z >= 3.5 else 1):
                continue
            if w not in best or rank < best[w][1]:
                best[w] = (s, rank)

    by_synset = collections.defaultdict(list)
    for w, (s, _) in best.items():
        by_synset[s].append(w)

    drops = collections.Counter()
    fams = {}
    for s, ws in by_synset.items():
        definition = s.definition().strip()
        if any(re.search(rf'\b{w}', definition.lower()) for w in ws):
            drops['definition contains a family word'] += 1
            continue
        ws = dedupe(ws)
        if len(ws) < 3:
            drops['fewer than 3 words'] += 1
            continue
        if s.pos() == 'n' and sum(w.endswith(('er', 'or', 'ist')) for w in ws) >= 2:
            drops['mostly -er/-or/-ist agent nouns'] += 1
            continue
        if min(zipf(w) for w in ws) >= 3.5:
            drops['no word rarer than Zipf 3.5'] += 1
            continue
        ws = ws[:MAX_WORDS]
        zs = [zipf(w) for w in ws]
        sense = re.split(r';', definition)[0]
        fams[s] = {
            'id': f'wn-{s.name()}',
            'src': 'wordnet',
            'pos': POS[s.pos()],
            'level': level_of(zs),
            'sense': sense if len(sense) <= 60 else sense[:57].rsplit(' ', 1)[0] + '…',
            'words': [[w, definition, z] for w, z in zip(ws, zs)],
        }

    # Opposites. WordNet stores antonyms mostly on "head" adjectives (good/bad),
    # which are too common to become families; the rarer satellites hang off
    # them. So a family's opposite is found by going satellite -> head ->
    # antonym head -> that head's satellites. A family gets an opposite only
    # when exactly one family is reachable that way.
    def heads(s):
        return [s] + list(s.similar_tos()) if s.pos() == 's' else [s]

    name_to_id = {s.name(): f['id'] for s, f in fams.items()}
    by_id = {f['id']: f for f in fams.values()}
    for s, f in fams.items():
        reach = set()
        for h in heads(s):
            for lemma in h.lemmas():
                for a in lemma.antonyms():
                    t = a.synset()
                    for x in [t] + list(t.similar_tos()):
                        if x.name() in name_to_id and x != s:
                            reach.add(name_to_id[x.name()])
        if len(reach) == 1:
            f['ant'] = next(iter(reach))
    del by_id
    print('WordNet families dropped:', dict(drops))
    return list(fams.values())


def clash_bits(groups, vectors):
    """Bit (i, j) is set when families i and j must not appear together as wrong options."""
    words = sorted({w[0] for g in groups for w in g['words'] if w[0] in vectors})
    index = {w: i for i, w in enumerate(words)}
    mat = np.array([vectors[w] for w in words], dtype=np.float32)
    mat /= np.linalg.norm(mat, axis=1, keepdims=True)
    sim = mat @ mat.T
    member = [[index[w[0]] for w in g['words'] if w[0] in index] for g in groups]
    ids = {g['id']: i for i, g in enumerate(groups)}
    n = len(groups)
    # max similarity between each family and every word: n x len(words)
    fam_word = np.full((n, len(words)), -1.0, dtype=np.float32)
    for i, m in enumerate(member):
        if m:
            fam_word[i] = sim[m].max(axis=0)
    fam_fam = np.full((n, n), -1.0, dtype=np.float32)
    for j, m in enumerate(member):
        if m:
            fam_fam[:, j] = fam_word[:, m].max(axis=1)
    score = fam_fam.copy()
    # A family that sits close to another's OPPOSITE clashes with it in an opposites question.
    for i, g in enumerate(groups):
        a = ids.get(g.get('ant'))
        if a is not None:
            score[i] = np.maximum(score[i], fam_fam[a])
            score[:, i] = np.maximum(score[:, i], fam_fam[:, a])
    pos = np.array([g['pos'] for g in groups])
    clash = (np.maximum(score, score.T) >= CLASH_AT) & (pos[:, None] == pos[None, :])
    np.fill_diagonal(clash, False)
    bits = np.packbits(clash.astype(np.uint8), axis=None, bitorder='little')
    same_pos = (pos[:, None] == pos[None, :]).sum() - n
    print(f'clash table: {n} families, {clash.sum() // 2} of {same_pos // 2} same-kind pairs ruled out '
          f'({100 * clash.sum() / max(same_pos, 1):.0f}%)')
    return base64.b64encode(bits.tobytes()).decode('ascii')


def main():
    data = json.loads(PATH.read_text(encoding='utf8'))
    hand = [g for g in data['groups'] if g.get('src') != 'wordnet']
    for g in hand:
        g['words'] = [[w, d, zipf(w)] for w, d, *_ in g['words']]
    vectors = api.load('glove-wiki-gigaword-100')
    taken = {w[0].lower() for g in hand for w in g['words']}
    generated = wordnet_families(taken, vectors)
    groups = hand + sorted(generated, key=lambda g: g['id'])
    data['groups'] = groups
    data['clash'] = {'at': CLASH_AT, 'n': len(groups), 'bits': clash_bits(groups, vectors)}
    PATH.write_text(json.dumps(data, indent=1, ensure_ascii=False) + '\n', encoding='utf8')

    zs = sorted(w[2] for g in groups for w in g['words'])
    bands = collections.Counter(int(z) for z in zs)
    print(f'{len(hand)} hand-written + {len(generated)} WordNet families; {len(zs)} words, '
          f'Zipf {zs[0]} to {zs[-1]}; words per Zipf band: {dict(sorted(bands.items()))}')
    print('WordNet families by kind:', dict(collections.Counter(g['pos'] for g in generated)),
          '| with an opposite:', sum(1 for g in generated if g.get('ant')))


if __name__ == '__main__':
    main()
