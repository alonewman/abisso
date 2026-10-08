import { executar, paraObjeto } from "@/lib/armazenamento";
import { perguntasDoDia } from "@/lib/prompts";
import { LINHAS, METROS_POR_LINHA } from "@/lib/zonas";
import { TTL_DIARIO, cidValido, erro, numeroValido } from "@/lib/api";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  let corpo: Record<string, unknown>;
  try {
    corpo = await req.json();
  } catch {
    return erro("Requisição inválida.");
  }
  const { dia, cid } = corpo;
  if (!cidValido(cid)) return erro("Identificador inválido.");
  const numero = numeroValido(dia);
  if (numero === null || dia === undefined) return erro("Dia inválido.");

  const [bruto] = await executar([["HGETALL", `r:d:${numero}:${cid}`]]);
  const respostas = paraObjeto(bruto);

  // O total é sempre calculado aqui, a partir do que o servidor guardou.
  let total = 0;
  for (const p of perguntasDoDia(numero)) {
    try {
      const r = JSON.parse(respostas[p.id] ?? "") as { d: number };
      if (typeof r.d !== "number") throw new Error();
      total += r.d;
    } catch {
      return erro("Responda as 7 perguntas antes de finalizar.");
    }
  }

  const chF = `f:d:${numero}`;
  const chH = `h:d:${numero}`;
  const faixa = Math.min(LINHAS - 1, Math.floor(total / METROS_POR_LINHA));

  const [novo] = await executar([["HSETNX", chF, cid, total]]);
  if (Number(novo) === 1) {
    await executar([
      ["HINCRBY", chH, String(faixa), 1],
      ["HINCRBY", chH, "__t", 1],
      ["EXPIRE", chF, TTL_DIARIO],
      ["EXPIRE", chH, TTL_DIARIO],
    ]);
  }

  const [h] = await executar([["HGETALL", chH]]);
  const dist = paraObjeto(h);
  const contagens = Array.from({ length: LINHAS }, (_, i) => Number(dist[String(i)] ?? 0));
  const jogadores = contagens.reduce((a, b) => a + b, 0);
  const abaixo = contagens.slice(0, faixa).reduce((a, b) => a + b, 0);
  const iguais = Math.max(0, contagens[faixa] - 1);
  const outros = Math.max(0, jogadores - 1);
  const percentil = outros > 0 ? Math.round(((abaixo + iguais / 2) / outros) * 100) : null;

  return Response.json({ ok: true, total, percentil, jogadores, hist: contagens, faixa });
}
