// Confere o banco de perguntas e a lógica principal. Rode com: npm run verificar
import { PERGUNTAS, perguntasDoDia } from "../lib/prompts";
import { normalizar, validar } from "../lib/normalizar";
import { analisar } from "../lib/dicionario";
import { calcular, modeloDe } from "../lib/estatisticas";
import { profundidadeDoShare, zonaDe } from "../lib/zonas";

let falhas = 0;
const falha = (msg: string) => {
  falhas++;
  console.error("FALHA:", msg);
};

// 1) banco: listas válidas, sem duplicatas, respeitando a letra
const ids = new Set<string>();
const textos = new Set<string>();
let totalItens = 0;
for (const p of PERGUNTAS) {
  if (ids.has(p.id)) falha(`id repetido ${p.id}`);
  ids.add(p.id);
  if (textos.has(p.texto)) falha(`pergunta repetida: ${p.texto}`);
  textos.add(p.texto);
  if (p.comuns.length < 10) falha(`${p.id} "${p.texto}" tem só ${p.comuns.length} respostas (mínimo 10)`);
  totalItens += p.comuns.length;
  const vistas = new Map<string, string>();
  for (const c of p.comuns) {
    const v = validar(c, p.letra);
    if (!v.ok) falha(`${p.id} "${p.texto}": resposta "${c}" inválida (${v.erro})`);
    const n = normalizar(c);
    if (vistas.has(n)) falha(`${p.id} "${p.texto}": "${c}" repete "${vistas.get(n)}"`);
    vistas.set(n, c);
  }
}
console.log(
  `${PERGUNTAS.length} perguntas, ${totalItens} respostas no banco (média ${Math.round(totalItens / PERGUNTAS.length)} por pergunta).`,
);

// 2) dias: 7 perguntas distintas e ciclo sem repetição
const ciclo = Math.floor(PERGUNTAS.length / 7);
const vistasNoCiclo = new Set<string>();
for (let n = 1; n <= ciclo; n++) {
  const dia = perguntasDoDia(n);
  if (dia.length !== 7) falha(`dia ${n} não tem 7 perguntas`);
  if (new Set(dia.map((p) => p.id)).size !== 7) falha(`dia ${n} tem perguntas repetidas`);
  dia.forEach((p) => {
    if (vistasNoCiclo.has(p.id)) falha(`pergunta ${p.id} repetida dentro do ciclo (dia ${n})`);
    vistasNoCiclo.add(p.id);
  });
}
if (JSON.stringify(perguntasDoDia(5)) !== JSON.stringify(perguntasDoDia(5))) falha("sorteio do dia não é determinístico");

// 3) normalização
const iguais: [string, string][] = [
  ["Maçã", "maca"],
  ["as maçãs", "maçã"],
  ["Pão de queijo", "pao queijo"],
  ["limões", "limão"],
  ["ônibus", "Onibus"],
  ["arroz e feijão", "arroz com feijão"],
];
for (const [a, b] of iguais) if (normalizar(a) !== normalizar(b)) falha(`"${a}" deveria ser igual a "${b}"`);

// 4) validação de formato
const invalidas = ["", "a", "asdfgh", "aaaaaa", "xkcdtrwqpz", "https://x.com", "😀😀", "porra"];
for (const t of invalidas) if (validar(t).ok) falha(`"${t}" deveria ser inválida`);
const validas = ["tv", "pc", "pão de queijo", "guarda-sol", "são paulo", "arroz com feijão"];
for (const t of validas) if (!validar(t).ok) falha(`"${t}" deveria ser válida`);
if (validar("gato", "C").ok) falha("letra obrigatória não está sendo verificada");
if (!validar("o gato", "G").ok) falha("artigo deveria ser ignorado na checagem da letra");

// 5) dicionário: palavras reais (inclusive raras) passam, besteiras não
const reais = ["pitomba", "jabuticabeira", "tilápia", "sarapatel", "cuscuz", "geladeira", "limões", "papéis", "flores", "tv", "pão de queijo", "guarda-chuva"];
for (const t of reais) if (!analisar(t).conhecida) falha(`dicionário deveria conhecer "${t}"`);
const falsas = ["klorbax", "fadfsd", "blorptz", "qwxzv", "bloprtzu", "pitombaxyz"];
for (const t of falsas) if (analisar(t).conhecida) falha(`dicionário não deveria conhecer "${t}"`);
if (!(analisar("casa").zipf > analisar("pitomba").zipf)) falha("palavra comum deveria ter zipf maior que palavra rara");

// 6) pontuação base
const casos: [number, number, number][] = [
  [0.25, 150, 250],
  [0.05, 400, 450],
  [0.001, 990, 1000],
];
for (const [share, min, max] of casos) {
  const d = profundidadeDoShare(share);
  if (d < min || d > max) falha(`share ${share} deu ${d} m (esperado ${min}-${max})`);
}
if (zonaDe(0).id !== "epi" || zonaDe(7000).id !== "hadal") falha("zonas erradas");

// 7) raridade SEM nenhum jogador: o modelo sozinho já ordena as respostas
const fruta = PERGUNTAS[0]; // "Uma fruta"
const semJogadores = (resposta: string, zipf: number) => {
  const n = normalizar(resposta);
  // simula o primeiro jogador do mundo (só ele respondeu)
  return calcular(fruta, { [n]: "1", __t: "1" }, { [n]: resposta }, n, zipf);
};
const topo = semJogadores("banana", 5);
const meio = semJogadores(fruta.comuns[19], 5);
const fim = semJogadores(fruta.comuns[fruta.comuns.length - 1], 5);
const foraComum = semJogadores("cadeira", analisar("cadeira").zipf);
const foraRara = semJogadores("pitomba", analisar("pitomba").zipf);
console.log(
  `Uma fruta, sem jogadores: banana ${topo.profundidade} m (${topo.porcento}%), 20ª ${meio.profundidade} m, ` +
    `última da lista ${fim.profundidade} m, fora da lista comum ${foraComum.profundidade} m, fora da lista rara ${foraRara.profundidade} m`,
);
if (!(topo.profundidade < meio.profundidade)) falha("1ª da lista deveria ficar mais rasa que a 20ª");
if (!(meio.profundidade < fim.profundidade)) falha("20ª deveria ficar mais rasa que a última da lista");
if (!(fim.profundidade <= foraComum.profundidade)) falha("fora da lista deveria valer no mínimo o que a última da lista vale");
if (!(foraComum.profundidade <= foraRara.profundidade)) falha("palavra mais rara deveria valer mais");
if (!(topo.profundidade < 350)) falha(`resposta mais comum deu ${topo.profundidade} m (esperado < 350)`);
if (!(foraRara.profundidade > 900)) falha(`resposta rara deu ${foraRara.profundidade} m (esperado > 900)`);

// 8) todas as perguntas: a 1ª resposta é rasa e uma resposta fora da lista é funda
for (const p of PERGUNTAS) {
  const m = modeloDe(p);
  const [primeira] = [...m.itens.keys()];
  const a = calcular(p, { [primeira]: "1", __t: "1" }, {}, primeira, 5);
  if (a.profundidade > 450) falha(`${p.id} "${p.texto}": a resposta mais comum deu ${a.profundidade} m`);
  const rara = "palavraqualquer";
  const b = calcular(p, { [rara]: "1", __t: "1" }, { [rara]: rara }, rara, 3);
  if (b.profundidade < 800) falha(`${p.id} "${p.texto}": resposta fora da lista deu só ${b.profundidade} m`);
}

// 9) com muitos jogadores reais, os dados reais dominam o modelo
const muitos = calcular(fruta, { banana: "3000", maca: "500", __t: "10000" }, {}, "banana", 5);
if (muitos.estimativa) falha("com 10000 jogadores a estimativa deveria ter acabado");
if (Math.abs(muitos.compartilhamento - 0.3) > 0.02) falha(`share com muitos jogadores esperado ~0.3, veio ${muitos.compartilhamento}`);

console.log(falhas === 0 ? "Tudo certo." : `${falhas} problema(s) encontrado(s).`);
process.exit(falhas === 0 ? 0 : 1);
