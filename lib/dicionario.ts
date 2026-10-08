// Dicionário de frequência do português (somente servidor).
// Dados: wordfreq (Robyn Speer et al.), CC BY-SA 4.0. Gerado por scripts/gerar_frequencia.py.
// Cada palavra (sem acento) vale zipf*10, onde zipf ~ 1 (raríssima) a 7 (como "de", "a").

import dados from "@/data/frequencia-pt.json";
import { ARTIGOS_E_LIGACOES, semAcento } from "./normalizar";

const DIC = dados as unknown as Record<string, number>;

function variantes(w: string): string[] {
  const v = [w];
  if (w.endsWith("oes") || w.endsWith("aes")) v.push(w.slice(0, -3) + "ao");
  if (w.endsWith("ns")) v.push(w.slice(0, -2) + "m");
  if (w.endsWith("ais")) v.push(w.slice(0, -3) + "al");
  if (w.endsWith("eis")) v.push(w.slice(0, -3) + "el", w.slice(0, -3) + "il");
  if (w.endsWith("ois")) v.push(w.slice(0, -3) + "ol");
  if (w.endsWith("res") || w.endsWith("zes")) v.push(w.slice(0, -2));
  if (w.endsWith("s")) v.push(w.slice(0, -1));
  return v;
}

export type Analise = { conhecida: boolean; zipf: number };

/** Vê se todas as palavras de conteúdo da resposta existem em português e devolve a mais rara (zipf). */
export function analisar(texto: string): Analise {
  const palavras = semAcento(texto.toLowerCase())
    .split(/[^a-z0-9]+/)
    .filter(Boolean);
  const conteudo = palavras.filter((p) => !ARTIGOS_E_LIGACOES.has(p));
  const alvo = conteudo.length > 0 ? conteudo : palavras;
  if (alvo.length === 0) return { conhecida: false, zipf: 0 };

  let menor = Infinity;
  for (const p of alvo) {
    if (/^\d+$/.test(p)) {
      menor = Math.min(menor, 4);
      continue;
    }
    let melhor = 0;
    for (const v of variantes(p)) melhor = Math.max(melhor, DIC[v] ?? 0);
    if (melhor === 0) return { conhecida: false, zipf: 0 };
    menor = Math.min(menor, melhor / 10);
  }
  return { conhecida: true, zipf: menor };
}
