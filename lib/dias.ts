// Contagem de dias no fuso de Brasília (UTC-3, sem horário de verão desde 2019).

function lancamento(): number {
  const bruto = process.env.ABISSO_LANCAMENTO ?? "2026-10-08";
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(bruto);
  if (!m) return Date.UTC(2026, 9, 8);
  return Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
}

function agoraBrasilia(): Date {
  return new Date(Date.now() - 3 * 3600e3);
}

/** Número do mergulho de hoje (1 = dia do lançamento). */
export function numeroHoje(): number {
  const d = agoraBrasilia();
  const hoje = Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate());
  return Math.max(1, Math.floor((hoje - lancamento()) / 864e5) + 1);
}

export function dataDoNumero(n: number): string {
  return new Date(lancamento() + (n - 1) * 864e5).toISOString().slice(0, 10);
}

/** Instante (epoch ms) da próxima meia-noite de Brasília. */
export function proximoMergulhoEm(): number {
  const d = agoraBrasilia();
  return Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate() + 1, 3, 0, 0);
}
