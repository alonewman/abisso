import { executar } from "./armazenamento";
import { numeroHoje } from "./dias";

export const TTL_DIARIO = 60 * 60 * 24 * 120; // 120 dias

export function erro(mensagem: string, status = 400): Response {
  return Response.json({ erro: mensagem }, { status });
}

export function cidValido(cid: unknown): cid is string {
  return typeof cid === "string" && /^[A-Za-z0-9-]{16,64}$/.test(cid);
}

/** Número do dia pedido: inteiro entre 1 e hoje. Sem valor => hoje. */
export function numeroValido(bruto: unknown): number | null {
  const hoje = numeroHoje();
  if (bruto === undefined || bruto === null || bruto === "") return hoje;
  const n = Number(bruto);
  if (!Number.isInteger(n) || n < 1 || n > hoje) return null;
  return n;
}

/** Limite simples por IP: até 90 respostas por minuto. */
export async function dentroDoLimite(req: Request): Promise<boolean> {
  const ip =
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    req.headers.get("x-real-ip") ||
    "local";
  const chave = `rl:${Math.floor(Date.now() / 60000)}`;
  const [usos] = await executar([["HINCRBY", chave, ip, 1], ["EXPIRE", chave, 180]]);
  return Number(usos) <= 90;
}
