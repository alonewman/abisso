// Zonas do oceano, escala de profundidade e raridade. Usado no servidor e no cliente.

export const MAX_PROFUNDIDADE = 7000; // 7 respostas x 1000 m
export const METROS_POR_LINHA = 250;
export const LINHAS = 28;

export type Zona = {
  id: "epi" | "meso" | "bati" | "abis" | "hadal";
  nome: string;
  tecnico: string;
  de: number;
  frase: string;
};

export const ZONAS: Zona[] = [
  { id: "epi", nome: "Zona da Luz", tecnico: "epipelágica", de: 0, frase: "Raso, claro e cheio de gente. Todo mundo pensou nisso." },
  { id: "meso", nome: "Zona do Crepúsculo", tecnico: "mesopelágica", de: 500, frase: "A luz está acabando, e você ainda conhece o caminho." },
  { id: "bati", nome: "Zona da Meia-Noite", tecnico: "batipelágica", de: 1500, frase: "Escuro, frio e com respostas bem pouco óbvias." },
  { id: "abis", nome: "O Abismo", tecnico: "abissopelágica", de: 3500, frase: "Pouquíssima gente chega aqui. Você tem cabeça de criatura abissal." },
  { id: "hadal", nome: "Fossa Hadal", tecnico: "hadal", de: 5500, frase: "O fundo do fundo. Ninguém jamais pensou o que você pensou." },
];

export function zonaDe(metros: number): Zona {
  let atual = ZONAS[0];
  for (const z of ZONAS) if (metros >= z.de) atual = z;
  return atual;
}

/** Profundidade ganha por uma resposta, a partir da fração de jogadores que deu a mesma. 0 a 1000 m. */
export function profundidadeDoShare(share: number): number {
  const s = Math.min(1, Math.max(share, 1e-9));
  return Math.round(100 * Math.min(10, Math.max(0, Math.log2(1 / s))));
}

export function raridade(share: number): { nome: string; nivel: 0 | 1 | 2 | 3 | 4 } {
  if (share >= 0.15) return { nome: "óbvia", nivel: 0 };
  if (share >= 0.05) return { nome: "comum", nivel: 1 };
  if (share >= 0.01) return { nome: "incomum", nivel: 2 };
  if (share >= 0.002) return { nome: "rara", nivel: 3 };
  return { nome: "quase única", nivel: 4 };
}

export function formatar(n: number): string {
  return Math.round(n).toLocaleString("pt-BR");
}
