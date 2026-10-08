// Junta data/novas/*.txt em lib/banco-novo.ts (perguntas fechadas do mergulho diário).
// Uso: npx tsx scripts/montar_banco.ts
import { readFileSync, readdirSync, writeFileSync } from "node:fs";
import { normalizar } from "../lib/normalizar";

const REMOVER = new Set(["Um time de futebol europeu@d", "Um legume ou verdura@c", "Um instrumento musical@d"]);
// vão para o fim (ficam fora do ciclo diário quando o total não é múltiplo de 7)
const FIM = ["Um Pokémon que começa com M", "Um humorista brasileiro", "Uma cantora que começa com M", "Um filme de terror"];

const linhas: { texto: string; bruto: string }[] = [];
for (const arq of readdirSync("data/novas").filter((f) => f.endsWith(".txt")).sort()) {
  const tag = arq.replace(".txt", "");
  for (const l of readFileSync(`data/novas/${arq}`, "utf8").split("\n").map((s) => s.trim()).filter(Boolean)) {
    const texto = l.split("|")[0].replace(/^!/, "").trim();
    if (REMOVER.has(`${texto}@${tag}`)) continue;
    linhas.push({ texto, bruto: l });
  }
}
// intercala os arquivos para o ciclo não agrupar temas
const porTema = new Map<string, typeof linhas>();
const vistos = new Set<string>();
for (const l of linhas) {
  if (vistos.has(l.texto)) continue;
  vistos.add(l.texto);
}
const principais = linhas.filter((l) => !FIM.includes(l.texto));
const final = linhas.filter((l) => FIM.includes(l.texto));
void porTema;
const todas = [...principais, ...final];
// limpa respostas repetidas por normalização, mantendo a primeira
const saida = todas.map(({ bruto }) => {
  const [t, letra, resp] = bruto.split("|");
  const vistas = new Set<string>();
  const itens = resp.split(",").map((s) => s.trim()).filter((s) => {
    const n = normalizar(s);
    if (!n || vistas.has(n)) return false;
    vistas.add(n);
    return true;
  });
  const renomes: Record<string, string> = {
    "!Um animal que começa com C": "!Um bicho que começa com C",
    "!Um animal que começa com P": "!Um bicho que começa com P",
    "!Uma profissão que começa com P": "!Uma ocupação que começa com P",
  };
  return `${renomes[t] ?? t}|${letra}|${itens.join(",")}`;
});
writeFileSync(
  "lib/banco-novo.ts",
  `// GERADO por scripts/montar_banco.ts a partir de data/novas/*.txt. Não edite à mão.\nexport const BANCO_NOVO: string = ${JSON.stringify(saida.join("\n"))};\n`,
);
console.log(`${saida.length} perguntas fechadas (${Math.floor(saida.length / 7)} dias sem repetir, ${saida.length % 7} fora do ciclo).`);
