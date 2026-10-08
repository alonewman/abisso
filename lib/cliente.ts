// Utilidades do navegador: identificador anônimo, histórico local e chamadas à API.

export type Registro = {
  numero: number;
  total: number;
  percentil: number | null;
  jogadores: number;
  aoVivo: boolean; // jogado no próprio dia
  respostas: number[]; // profundidade de cada uma das 7 respostas
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
