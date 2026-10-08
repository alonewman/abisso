#!/usr/bin/env python3
"""Gera data/frequencia-pt.json a partir do pacote wordfreq (pip install wordfreq).

Formato: { "palavra-sem-acento": zipf*10 (inteiro) }.
Dados de frequência: wordfreq (Robyn Speer et al.), licença CC BY-SA 4.0.
"""
import json, re, sys, unicodedata
from wordfreq import top_n_list, zipf_frequency

MIN_ZIPF = 1.5
def sem_acento(s):
    return ''.join(c for c in unicodedata.normalize('NFD', s) if unicodedata.category(c) != 'Mn')

saida = {}
for w in top_n_list('pt', 400000, wordlist='large'):
    if not re.fullmatch(r"[a-zà-ÿ]{2,}", w):
        continue
    z = zipf_frequency(w, 'pt', wordlist='large')
    if z < MIN_ZIPF:
        continue
    k = sem_acento(w)
    v = round(z * 10)
    if v > saida.get(k, 0):
        saida[k] = v

# palavras curtas muito comuns que o filtro acima já cobre; acrescenta siglas usuais
for extra, z in {"tv": 5.3, "pc": 4.5, "dvd": 4.0, "cd": 4.5, "dj": 4.0, "ps": 4.0}.items():
    saida.setdefault(extra, round(z * 10))

with open(sys.argv[1] if len(sys.argv) > 1 else 'data/frequencia-pt.json', 'w', encoding='utf-8') as f:
    json.dump(saida, f, ensure_ascii=False, separators=(',', ':'), sort_keys=True)
print(len(saida), 'palavras')
