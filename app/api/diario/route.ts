import { um, paraObjeto, modoArmazenamento } from "@/lib/armazenamento";
import { dataDoNumero, numeroHoje, proximoMergulhoEm } from "@/lib/dias";
import { perguntasDoDia, publica } from "@/lib/prompts";
import { cidValido, erro, numeroValido } from "@/lib/api";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const url = new URL(req.url);
  const numero = numeroValido(url.searchParams.get("dia"));
  if (numero === null) return erro("Dia inválido.");
  const cid = url.searchParams.get("cid");

  const respondidas: Record<string, { resposta: string; profundidade: number }> = {};
  if (cidValido(cid)) {
    const salvas = paraObjeto(await um(["HGETALL", `r:d:${numero}:${cid}`]));
    for (const [id, bruto] of Object.entries(salvas)) {
      if (bruto.startsWith("p:")) continue;
      try {
        const r = JSON.parse(bruto) as { a: string; d: number };
        respondidas[id] = { resposta: r.a, profundidade: r.d };
      } catch {
        /* ignora registros ilegíveis */
      }
    }
  }

  return Response.json({
    numero,
    hoje: numeroHoje(),
    data: dataDoNumero(numero),
    perguntas: perguntasDoDia(numero).map(publica),
    respondidas,
    proximoEm: proximoMergulhoEm(),
    armazenamento: modoArmazenamento(),
  });
}
