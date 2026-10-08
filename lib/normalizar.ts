// Normalização e validação das respostas.
// Duas respostas "iguais" para o jogo são as que dão a mesma chave normalizada:
// sem acento, sem maiúsculas, sem artigos, plural simplificado.

export const ARTIGOS_E_LIGACOES = new Set([
  "o", "a", "os", "as", "um", "uma", "uns", "umas",
  "de", "do", "da", "dos", "das", "e", "com", "para", "em", "no", "na",
]);

const PROIBIDAS = new Set([
  "porra", "caralho", "buceta", "puta", "putas", "fdp", "viado", "viada",
  "bosta", "cuzao", "cuzona", "arrombado", "arrombada", "vagabunda",
  "vagabundo", "nazista", "hitler", "estupro", "estuprador",
]);

export function semAcento(s: string): string {
  return s.normalize("NFD").replace(/[̀-ͯ]/g, "");
}

function singular(p: string): string {
  if (p.length <= 3) return p;
  if (p.endsWith("oes") || p.endsWith("aes")) return p.slice(0, -3) + "ao";
  if (p.endsWith("ns")) return p.slice(0, -2) + "m";
  if (p.endsWith("ss")) return p;
  if (p.endsWith("s")) return p.slice(0, -1);
  return p;
}

export function normalizar(entrada: string): string {
  const base = semAcento(entrada.toLowerCase()).replace(/[^a-z0-9]+/g, " ").trim();
  const todas = base.split(" ").filter(Boolean);
  const uteis = todas.filter((p) => !ARTIGOS_E_LIGACOES.has(p));
  const palavras = (uteis.length > 0 ? uteis : todas).map(singular);
  return palavras.join(" ");
}

export type Validacao =
  | { ok: true; norm: string; exibir: string }
  | { ok: false; erro: string };

export function validar(entrada: unknown, letra?: string | null): Validacao {
  if (typeof entrada !== "string") return { ok: false, erro: "Digite uma resposta." };
  const exibir = entrada.trim().replace(/\s+/g, " ").toLowerCase().slice(0, 40);
  if (exibir.length < 2) return { ok: false, erro: "Resposta curta demais." };
  if (entrada.trim().length > 40) return { ok: false, erro: "Resposta longa demais (máx. 40 letras)." };
  if (!/^[\p{L}\p{N}\s'\-.,!?]+$/u.test(exibir) || /https?:|www\.|@|\.com/.test(exibir)) {
    return { ok: false, erro: "Use só letras e números." };
  }
  const norm = normalizar(exibir);
  if (!/[a-z]/.test(norm) || norm.length < 2) return { ok: false, erro: "Isso não parece uma palavra." };
  if (/(.)\1{3,}/.test(norm)) return { ok: false, erro: "Isso não parece uma palavra." };
  if (/[bcdfghjklmnpqrstvwxyz]{6,}/.test(norm)) return { ok: false, erro: "Isso não parece uma palavra." };
  if (/(asdf|qwer|zxcv|hjkl|ghjk|dfgh|sdfg|wert|erty|poiu|lkjh|mnbv|qaz|wsx)/.test(norm)) {
    return { ok: false, erro: "Isso não parece uma palavra." };
  }
  const palavras = norm.split(" ");
  if (palavras.some((p) => p.length >= 4 && !/[aeiou]/.test(p))) {
    return { ok: false, erro: "Isso não parece uma palavra." };
  }
  if (palavras.length > 6) return { ok: false, erro: "Resposta longa demais." };
  if (palavras.some((p) => PROIBIDAS.has(p))) {
    return { ok: false, erro: "Essa resposta não pode ser usada." };
  }
  if (letra) {
    // a letra vale para a primeira palavra "de verdade" (depois de artigos)
    if (norm[0].toUpperCase() !== letra.toUpperCase()) {
      return { ok: false, erro: `A resposta precisa começar com ${letra.toUpperCase()}.` };
    }
  }
  return { ok: true, norm, exibir };
}

export function ehProibida(norm: string): boolean {
  return norm.split(" ").some((p) => PROIBIDAS.has(p));
}
