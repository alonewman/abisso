// Utilidades do navegador: identificador anônimo, histórico local e chamadas à API.

export type Registro = {
  numero: number;
  total: number;
  percentil: number | null;
  jogadores: number;
  aoVivo: boolean; // jogado no próprio dia
  respostas: number[]; // profundidade de cada uma das 7 respostas
  tempoMs?: number; // tempo total do mergulho, quando medido
};
export type Historico = Record<number, Registro>;

const CHAVE_CID = "abisso:cid";
const CHAVE_HIST = "abisso:historico";
const CHAVE_LIVRE = "abisso:livre";

function gerarCid(): string {
  try {
    if (typeof crypto !== "undefined" && "randomUUID" in crypto) return crypto.randomUUID();
  } catch {
    /* segue */
  }
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    return (c === "x" ? r : (r & 3) | 8).toString(16);
  });
}

export function obterCid(): string {
  try {
    let cid = localStorage.getItem(CHAVE_CID);
    if (!cid) {
      cid = gerarCid();
      localStorage.setItem(CHAVE_CID, cid);
    }
    return cid;
  } catch {
    return gerarCid();
  }
}

export function lerHistorico(): Historico {
  try {
    const bruto = localStorage.getItem(CHAVE_HIST);
    return bruto ? (JSON.parse(bruto) as Historico) : {};
  } catch {
    return {};
  }
}

export function salvarRegistro(r: Registro): Historico {
  const h = lerHistorico();
  const antigo = h[r.numero];
  h[r.numero] = { ...r, aoVivo: r.aoVivo || (antigo?.aoVivo ?? false) };
  try {
    localStorage.setItem(CHAVE_HIST, JSON.stringify(h));
  } catch {
    /* sem armazenamento: segue sem salvar */
  }
  return h;
}

export function melhorSequencia(h: Historico): number {
  const dias = Object.values(h)
    .filter((r) => r.aoVivo)
    .map((r) => r.numero)
    .sort((a, b) => a - b);
  let melhor = 0;
  let corrida = 0;
  let anterior = -10;
  for (const n of dias) {
    corrida = n === anterior + 1 ? corrida + 1 : 1;
    melhor = Math.max(melhor, corrida);
    anterior = n;
  }
  return melhor;
}

export function sequenciaAtual(h: Historico, hoje: number): number {
  let n = h[hoje]?.aoVivo ? hoje : hoje - 1;
  let total = 0;
  while (n >= 1 && h[n]?.aoVivo) {
    total++;
    n--;
  }
  return total;
}

export function lerLivre(): string[] {
  try {
    const bruto = localStorage.getItem(CHAVE_LIVRE);
    return bruto ? (JSON.parse(bruto) as string[]) : [];
  } catch {
    return [];
  }
}
export function salvarLivre(ids: string[]) {
  try {
    localStorage.setItem(CHAVE_LIVRE, JSON.stringify(ids));
  } catch {
    /* ignora */
  }
}

export async function api<T>(url: string, corpo?: unknown): Promise<T> {
  const resp = await fetch(url, {
    method: corpo === undefined ? "GET" : "POST",
    headers: corpo === undefined ? undefined : { "Content-Type": "application/json" },
    body: corpo === undefined ? undefined : JSON.stringify(corpo),
    cache: "no-store",
  });
  let dados: unknown = null;
  try {
    dados = await resp.json();
  } catch {
    /* sem corpo */
  }
  if (!resp.ok) {
    const msg = (dados as { erro?: string } | null)?.erro;
    throw new Error(msg ?? "Algo deu errado. Tente de novo.");
  }
  return dados as T;
}

export function dataBonita(iso: string): string {
  const [a, m, d] = iso.split("-");
  return `${d}/${m}/${a}`;
}

/* tempo gasto por pergunta (só neste navegador) e preferência do relógio de ar */
const CHAVE_TEMPO = "abisso:tempo";

export const OPCOES_AR = [25, 15, 40, 0] as const; // 0 = sem relógio

export function lerAr(): number {
  try {
    const v = Number(localStorage.getItem(CHAVE_TEMPO));
    return (OPCOES_AR as readonly number[]).includes(v) && localStorage.getItem(CHAVE_TEMPO) !== null ? v : 25;
  } catch {
    return 25;
  }
}
export function salvarAr(s: number) {
  try {
    localStorage.setItem(CHAVE_TEMPO, String(s));
  } catch {
    /* ignora */
  }
}

export function lerTempos(numero: number): Record<string, number> {
  try {
    const bruto = localStorage.getItem(`abisso:t:${numero}`);
    return bruto ? (JSON.parse(bruto) as Record<string, number>) : {};
  } catch {
    return {};
  }
}
export function salvarTempo(numero: number, id: string, ms: number) {
  try {
    const t = lerTempos(numero);
    if (t[id] === undefined) t[id] = Math.max(0, Math.round(ms));
    localStorage.setItem(`abisso:t:${numero}`, JSON.stringify(t));
  } catch {
    /* ignora */
  }
}
