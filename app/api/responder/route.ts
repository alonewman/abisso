import { executar, um, paraObjeto } from "@/lib/armazenamento";
import { perguntaPorId, perguntasDoDia, type Pergunta } from "@/lib/prompts";
import { validar } from "@/lib/normalizar";
import { calcular, modeloDe } from "@/lib/estatisticas";
import { analisar } from "@/lib/dicionario";
import { TTL_DIARIO, cidValido, dentroDoLimite, erro, numeroValido } from "@/lib/api";

export const dynamic = "force-dynamic";

function zipfDaResposta(exibida: string): number {
  const a = analisar(exibida);
  return a.conhecida ? a.zipf : 2.5;
}

async function lerTudo(escopo: string, pergunta: Pergunta) {
  const [reais, exib] = await executar([
    ["HGETALL", `c:${escopo}:${pergunta.id}`],
    ["HGETALL", `x:${escopo}:${pergunta.id}`],
  ]);
  return { reais: paraObjeto(reais), exib: paraObjeto(exib) };
}

export async function POST(req: Request) {
  let corpo: Record<string, unknown>;
  try {
    corpo = await req.json();
  } catch {
    return erro("Requisição inválida.");
  }
  const { escopo, dia, promptId, resposta, cid } = corpo;

  if (!cidValido(cid)) return erro("Identificador inválido.");
  if (typeof promptId !== "string") return erro("Pergunta inválida.");
  const pergunta = perguntaPorId(promptId);
  if (!pergunta) return erro("Pergunta inválida.");

  let escopoChave: string;
  if (escopo === "diario") {
    const numero = numeroValido(dia);
    if (numero === null || dia === undefined) return erro("Dia inválido.");
    if (!perguntasDoDia(numero).some((p) => p.id === pergunta.id)) return erro("Pergunta fora do dia.");
    escopoChave = `d:${numero}`;
  } else if (escopo === "livre") {
    escopoChave = "livre";
  } else {
    return erro("Modo inválido.");
  }
  const temTTL = escopoChave !== "livre";

  if (!(await dentroDoLimite(req))) return erro("Calma! Muitas respostas em pouco tempo.", 429);

  const chaveResp = `r:${escopoChave}:${cid}`;

  // Já respondeu? Devolve o resultado salvo com as estatísticas atualizadas.
  const existente = await um(["HGET", chaveResp, pergunta.id]);
  if (typeof existente === "string" && !existente.startsWith("p:")) {
    try {
      const reg = JSON.parse(existente) as { n: string; a: string; d: number };
      const { reais, exib } = await lerTudo(escopoChave, pergunta);
      const stats = calcular(pergunta, reais, exib, reg.n, zipfDaResposta(reg.a));
      return Response.json({
        ok: true,
        repetida: true,
        ...stats,
        resposta: reg.a,
        profundidade: reg.d,
        minha: { ...stats.minha, resposta: reg.a },
      });
    } catch {
      /* registro corrompido: segue como resposta nova */
    }
  }

  const v = validar(resposta, pergunta.letra);
  if (!v.ok) return erro(v.erro);

  // Palavra fora da lista da pergunta: precisa existir em português (ou já ter sido usada por outros jogadores).
  let zipf = 5;
  if (!modeloDe(pergunta).itens.has(v.norm)) {
    const analise = analisar(v.exibir);
    if (analise.conhecida) {
      zipf = analise.zipf;
    } else {
      const vezes = Number(await um(["HGET", `c:${escopoChave}:${pergunta.id}`, v.norm])) || 0;
      if (vezes < 2) return erro("Não reconheci essa palavra. Confira a escrita.");
      zipf = 2.5;
    }
  }

  // Reserva a vaga (evita contar duas vezes se o botão for clicado em dobro).
  const marca = `p:${Date.now()}`;
  const reservou = Number(await um(["HSETNX", chaveResp, pergunta.id, marca]));
  if (reservou === 0) {
    const atual = await um(["HGET", chaveResp, pergunta.id]);
    const velha = typeof atual === "string" && atual.startsWith("p:") && Date.now() - Number(atual.slice(2)) > 20000;
    if (!velha) return erro("Sua resposta já está sendo processada.", 409);
    await um(["HSET", chaveResp, pergunta.id, marca]);
  }

  try {
    const chC = `c:${escopoChave}:${pergunta.id}`;
    const chX = `x:${escopoChave}:${pergunta.id}`;
    const cmds: Parameters<typeof executar>[0] = [
      ["HINCRBY", chC, v.norm, 1],
      ["HINCRBY", chC, "__t", 1],
      ["HSETNX", chX, v.norm, v.exibir],
    ];
    if (temTTL) cmds.push(["EXPIRE", chC, TTL_DIARIO], ["EXPIRE", chX, TTL_DIARIO], ["EXPIRE", chaveResp, TTL_DIARIO]);
    await executar(cmds);

    const { reais, exib } = await lerTudo(escopoChave, pergunta);
    const stats = calcular(pergunta, reais, exib, v.norm, zipf);
    await um(["HSET", chaveResp, pergunta.id, JSON.stringify({ n: v.norm, a: v.exibir, d: stats.profundidade })]);

    return Response.json({
      ok: true,
      repetida: false,
      ...stats,
      resposta: v.exibir,
      profundidade: stats.profundidade,
      minha: { ...stats.minha, resposta: v.exibir },
    });
  } catch (e) {
    await um(["HDEL", chaveResp, pergunta.id]).catch(() => undefined);
    console.error("Falha ao registrar resposta", e);
    return erro("Não foi possível registrar agora. Tente de novo.", 500);
  }
}
