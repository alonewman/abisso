// Cálculo da raridade de uma resposta. Funciona mesmo sem nenhum jogador:
//
//  1. MODELO: cada pergunta tem uma lista ranqueada das respostas mais comuns (lib/prompts.ts).
//     A posição na lista vira uma probabilidade (lei de potência, ~Zipf). Cerca de 22% da probabilidade
//     fica de fora da lista, para as respostas "fora do comum".
//  2. FORA DA LISTA: resposta que não está na lista é rara, e quanto mais rara a palavra no português
//     (frequência do wordfreq, lib/dicionario.ts), mais rara a resposta.
//  3. JOGADORES: as respostas reais entram por cima, como uma média ponderada. O modelo vale como K jogadores
//     "virtuais"; com 200 jogadores reais, modelo e realidade têm o mesmo peso, e depois a realidade vence.

import type { Pergunta } from "./prompts";
import { normalizar, ehProibida } from "./normalizar";
import { profundidadeDoShare } from "./zonas";

export const PESO_MODELO = 200; // K: o modelo vale como 200 jogadores
const CAUDA = 0.22; // probabilidade fora da lista
const EXPOENTE = 0.95;

type ItemModelo = { exibir: string; p: number };
type Modelo = { itens: Map<string, ItemModelo>; pUltima: number };

const cache = new Map<string, Modelo>();

export function modeloDe(pergunta: Pergunta): Modelo {
  const guardado = cache.get(pergunta.id);
  if (guardado) return guardado;
  const pesos = pergunta.comuns.map((_, i) => 1 / Math.pow(i + 1, EXPOENTE));
  const soma = pesos.reduce((a, b) => a + b, 0);
  const itens = new Map<string, ItemModelo>();
  let pUltima = 0;
  pergunta.comuns.forEach((c, i) => {
    const norm = normalizar(c);
    if (itens.has(norm)) return;
    const p = ((1 - CAUDA) * pesos[i]) / soma;
    itens.set(norm, { exibir: c, p });
    pUltima = p;
  });
  const modelo = { itens, pUltima };
  cache.set(pergunta.id, modelo);
  return modelo;
}

/** Probabilidade de uma resposta fora da lista: nunca maior que a última da lista; cai com a raridade da palavra. */
export function probabilidadeForaDaLista(pUltima: number, zipf: number): number {
  return pUltima * 0.8 * Math.pow(0.4, Math.max(0, 5.5 - zipf));
}

export type LinhaTop = { resposta: string; porcento: number; voce: boolean };

export type Estatistica = {
  minha: LinhaTop;
  compartilhamento: number; // fração (0 a 1) estimada de quem daria a mesma resposta
  porcento: number;
  profundidade: number;
  reaisIguais: number;
  jogadoresReais: number;
  estimativa: boolean; // o modelo ainda pesa mais que os jogadores
  pesoModelo: number; // 0 a 100
  noModelo: boolean;
  posicao: number;
  top: LinhaTop[];
};

export function arredondar(p: number): number {
  return p >= 10 ? Math.round(p) : Math.round(p * 10) / 10;
}

export function calcular(
  pergunta: Pergunta,
  reais: Record<string, string>,
  exibicao: Record<string, string>,
  minhaNorm: string,
  zipf: number,
): Estatistica {
  const jogadoresReais = Number(reais.__t ?? 0);
  const base = PESO_MODELO + jogadoresReais;
  const modelo = modeloDe(pergunta);

  // A própria resposta não conta contra si mesma: usamos só os "outros" jogadores.
  const doModelo = modelo.itens.get(minhaNorm);
  const pMeu = doModelo ? doModelo.p : probabilidadeForaDaLista(modelo.pUltima, zipf);
  const reaisMeus = Number(reais[minhaNorm] ?? 1);
  const outros = Math.max(0, reaisMeus - 1);
  const share = Math.min(1, (pMeu * PESO_MODELO + outros) / (PESO_MODELO + Math.max(0, jogadoresReais - 1)));

  const itens = new Map<string, { exibir: string; contagem: number; real: number; noModelo: boolean }>();
  modelo.itens.forEach((it, norm) => {
    itens.set(norm, { exibir: it.exibir, contagem: it.p * PESO_MODELO, real: 0, noModelo: true });
  });
  for (const [norm, v] of Object.entries(reais)) {
    if (norm === "__t") continue;
    const real = Number(v);
    const existente = itens.get(norm);
    if (existente) {
      existente.real = real;
      existente.contagem += real;
    } else {
      itens.set(norm, { exibir: exibicao[norm] ?? norm, contagem: real, real, noModelo: false });
    }
  }
  if (!itens.has(minhaNorm)) {
    itens.set(minhaNorm, {
      exibir: exibicao[minhaNorm] ?? minhaNorm,
      contagem: pMeu * PESO_MODELO + reaisMeus,
      real: reaisMeus,
      noModelo: false,
    });
  }

  const ordenado = [...itens.entries()]
    .filter(([n]) => !ehProibida(n))
    .sort((a, b) => b[1].contagem - a[1].contagem);

  const visiveis = ordenado.filter(([n, v]) => n === minhaNorm || v.noModelo || v.real >= 2);
  const top: LinhaTop[] = visiveis.slice(0, 5).map(([n, v]) => ({
    resposta: v.exibir,
    porcento: n === minhaNorm ? arredondar(share * 100) : arredondar((v.contagem / base) * 100),
    voce: n === minhaNorm,
  }));
  const posicao = Math.max(1, ordenado.findIndex(([n]) => n === minhaNorm) + 1);
  const meuItem = itens.get(minhaNorm);

  return {
    minha: {
      resposta: meuItem?.exibir ?? minhaNorm,
      porcento: arredondar(share * 100),
      voce: true,
    },
    compartilhamento: share,
    porcento: arredondar(share * 100),
    profundidade: profundidadeDoShare(share),
    reaisIguais: reaisMeus,
    jogadoresReais,
    estimativa: jogadoresReais < PESO_MODELO,
    pesoModelo: Math.round((PESO_MODELO / base) * 100),
    noModelo: !!doModelo,
    posicao,
    top,
  };
}
