// Armazenamento das estatísticas globais.
// - Com UPSTASH_REDIS_REST_URL/TOKEN (ou KV_REST_API_URL/TOKEN) usa Redis via REST (produção na Vercel).
// - Sem isso, usa memória do processo (ótimo para desenvolver; na Vercel NÃO persiste entre execuções).

export type Comando = (string | number)[];

type Hash = Map<string, string>;
const g = globalThis as unknown as { __abissoMem?: Map<string, Hash> };
const memoria: Map<string, Hash> = (g.__abissoMem ??= new Map());

function urlRedis(): string | null {
  const u = process.env.UPSTASH_REDIS_REST_URL ?? process.env.KV_REST_API_URL ?? "";
  return u ? u.replace(/\/+$/, "") : null;
}
function tokenRedis(): string {
  return process.env.UPSTASH_REDIS_REST_TOKEN ?? process.env.KV_REST_API_TOKEN ?? "";
}

export function modoArmazenamento(): "redis" | "memoria" {
  return urlRedis() && tokenRedis() ? "redis" : "memoria";
}

function memExec(cmd: Comando): unknown {
  const [nome, chave, a, b] = cmd as [string, string, string | number, string | number];
  const op = String(nome).toUpperCase();
  const hash = (): Hash => {
    let h = memoria.get(chave);
    if (!h) {
      h = new Map();
      memoria.set(chave, h);
    }
    return h;
  };
  switch (op) {
    case "HGET":
      return memoria.get(chave)?.get(String(a)) ?? null;
    case "HSET":
      hash().set(String(a), String(b));
      return 1;
    case "HSETNX": {
      const h = hash();
      if (h.has(String(a))) return 0;
      h.set(String(a), String(b));
      return 1;
    }
    case "HDEL":
      return memoria.get(chave)?.delete(String(a)) ? 1 : 0;
    case "HINCRBY": {
      const h = hash();
      const novo = Number(h.get(String(a)) ?? 0) + Number(b);
      h.set(String(a), String(novo));
      return novo;
    }
    case "HGETALL": {
      const h = memoria.get(chave);
      if (!h) return [];
      const saida: string[] = [];
      h.forEach((v, k) => saida.push(k, v));
      return saida;
    }
    case "EXPIRE":
      return 1;
    default:
      throw new Error(`Comando não suportado na memória: ${op}`);
  }
}

/** Executa vários comandos (em pipeline, quando Redis). Devolve os resultados na mesma ordem. */
export async function executar(cmds: Comando[]): Promise<unknown[]> {
  if (cmds.length === 0) return [];
  const url = urlRedis();
  const token = tokenRedis();
  if (!url || !token) return cmds.map(memExec);

  const resp = await fetch(`${url}/pipeline`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify(cmds),
    cache: "no-store",
  });
  if (!resp.ok) throw new Error(`Redis respondeu ${resp.status}`);
  const dados = (await resp.json()) as { result?: unknown; error?: string }[];
  return dados.map((d) => {
    if (d.error) throw new Error(`Redis: ${d.error}`);
    return d.result;
  });
}

export async function um(cmd: Comando): Promise<unknown> {
  return (await executar([cmd]))[0];
}

/** Converte a resposta plana do HGETALL ([k1, v1, k2, v2...]) em objeto. */
export function paraObjeto(plano: unknown): Record<string, string> {
  const saida: Record<string, string> = {};
  if (Array.isArray(plano)) {
    for (let i = 0; i + 1 < plano.length; i += 2) saida[String(plano[i])] = String(plano[i + 1]);
  } else if (plano && typeof plano === "object") {
    for (const [k, v] of Object.entries(plano as Record<string, unknown>)) saida[k] = String(v);
  }
  return saida;
}
