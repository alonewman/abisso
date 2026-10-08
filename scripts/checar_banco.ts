// Confere um arquivo de perguntas novas. Uso: npx tsx scripts/checar_banco.ts data/novas/a.txt [minimo]
// Formato de cada linha:  [!]texto|LETRA ou vazio|resposta1,resposta2,...   ("!" = categoria fechada)
import { readFileSync } from "node:fs";
import { normalizar, validar } from "../lib/normalizar";

const arquivo = process.argv[2];
const minimo = Number(process.argv[3] ?? 80);
let problemas = 0;
const textos = new Set<string>();
const linhas = readFileSync(arquivo, "utf8").split("\n").map((l) => l.trim()).filter(Boolean);
let total = 0;
for (const [i, linha] of linhas.entries()) {
  const partes = linha.split("|");
  if (partes.length !== 3) {
    console.log(`linha ${i + 1}: precisa de exatamente 3 campos separados por | -> ${linha.slice(0, 60)}`);
    problemas++;
    continue;
  }
  const texto = partes[0].replace(/^!/, "").trim();
  const letra = partes[1].trim() || null;
  const respostas = partes[2].split(",").map((s) => s.trim()).filter(Boolean);
  if (textos.has(texto)) {
    console.log(`linha ${i + 1}: pergunta repetida "${texto}"`);
    problemas++;
  }
  textos.add(texto);
  if (!partes[0].startsWith("!")) console.log(`linha ${i + 1}: "${texto}" sem ! no início (categoria fechada)`), problemas++;
  if (letra && !/^[A-Z]$/.test(letra)) console.log(`linha ${i + 1}: letra inválida "${letra}"`), problemas++;
  if (respostas.length < minimo) {
    console.log(`linha ${i + 1}: "${texto}" tem só ${respostas.length} respostas (mínimo ${minimo})`);
    problemas++;
  }
  total += respostas.length;
  const vistas = new Map<string, string>();
  for (const r of respostas) {
    const v = validar(r, letra);
    if (!v.ok) {
      console.log(`linha ${i + 1} "${texto}": "${r}" inválida (${v.erro})`);
      problemas++;
      continue;
    }
    const n = normalizar(r);
    if (vistas.has(n)) {
      console.log(`linha ${i + 1} "${texto}": "${r}" repete "${vistas.get(n)}"`);
      problemas++;
    }
    vistas.set(n, r);
  }
}
console.log(`${linhas.length} perguntas, ${total} respostas, ${problemas} problema(s).`);
process.exit(problemas ? 1 : 0);
