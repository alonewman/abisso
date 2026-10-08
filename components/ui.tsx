"use client";

import { useEffect, useRef, useState } from "react";
import { CRIATURAS, KRILL, barra, caixa, densidade } from "@/lib/ascii";
import { LINHAS, METROS_POR_LINHA, ZONAS, formatar, raridade, zonaDe } from "@/lib/zonas";

/* ---------- hooks ---------- */

function movimentoReduzido(): boolean {
  return typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

type OpcoesContagem = { base?: number; porUnidade?: number; max?: number; inicial?: number };

/** Anima um número até o alvo. A duração cresce com a distância percorrida. */
export function useContagem(alvo: number, opc: OpcoesContagem = {}): number {
  const { base = 900, porUnidade = 1.2, max = 3200, inicial } = opc;
  const [valor, setValor] = useState(inicial ?? alvo);
  const atual = useRef(inicial ?? alvo);
  useEffect(() => {
    const inicio = atual.current;
    if (inicio === alvo) return;
    if (movimentoReduzido()) {
      atual.current = alvo;
      setValor(alvo);
      return;
    }
    const ms = Math.min(max, base + Math.abs(alvo - inicio) * porUnidade);
    const t0 = performance.now();
    let raf = 0;
    const passo = (t: number) => {
      const k = Math.min(1, (t - t0) / ms);
      const suave = 1 - Math.pow(1 - k, 3);
      const v = inicio + (alvo - inicio) * suave;
      atual.current = v;
      setValor(v);
      if (k < 1) raf = requestAnimationFrame(passo);
    };
    raf = requestAnimationFrame(passo);
    return () => cancelAnimationFrame(raf);
  }, [alvo, base, porUnidade, max]);
  return valor;
}

/** Revela um texto letra por letra. */
export function useDigitar(texto: string, ms = 22): string {
  const [n, setN] = useState(0);
  useEffect(() => {
    if (movimentoReduzido()) {
      setN(texto.length);
      return;
    }
    setN(0);
    let i = 0;
    const id = setInterval(() => {
      i++;
      setN(i);
      if (i >= texto.length) clearInterval(id);
    }, ms);
    return () => clearInterval(id);
  }, [texto, ms]);
  return texto.slice(0, n);
}

/** Conta quantos itens já podem aparecer (um a cada `passo` ms, depois de `atraso`). */
export function useRevelar(total: number, passo = 60, atraso = 0): number {
  const [n, setN] = useState(0);
  useEffect(() => {
    if (movimentoReduzido()) {
      setN(total);
      return;
    }
    setN(0);
    let i = 0;
    let id: ReturnType<typeof setInterval> | undefined;
    const inicio = setTimeout(() => {
      id = setInterval(() => {
        i++;
        setN(i);
        if (i >= total && id) clearInterval(id);
      }, passo);
    }, atraso);
    return () => {
      clearTimeout(inicio);
      if (id) clearInterval(id);
    };
  }, [total, passo, atraso]);
  return n;
}

export function useRelogio(destino: number | null): string {
  const [texto, setTexto] = useState("--:--:--");
  useEffect(() => {
    if (!destino) return;
    const calcular = () => {
      const resta = Math.max(0, destino - Date.now());
      const s = Math.floor(resta / 1000);
      const p = (n: number) => String(n).padStart(2, "0");
      setTexto(`${p(Math.floor(s / 3600))}:${p(Math.floor((s % 3600) / 60))}:${p(s % 60)}`);
    };
    calcular();
    const id = setInterval(calcular, 1000);
    return () => clearInterval(id);
  }, [destino]);
  return texto;
}

export function formatarTempo(ms: number): string {
  const s = Math.round(ms / 1000);
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}

/* ---------- cenário ---------- */

const BOLHAS = Array.from({ length: 14 }, (_, i) => ({
  esquerda: (i * 73 + 11) % 100,
  duracao: 14 + ((i * 7) % 10),
  atraso: -((i * 5) % 14),
  c: i % 3 === 0 ? "o" : i % 3 === 1 ? "°" : ".",
}));

export function Bolhas() {
  return (
    <div className="bolhas" aria-hidden="true">
      {BOLHAS.map((b, i) => (
        <span
          key={i}
          className="bolha"
          style={{ left: `${b.esquerda}%`, animationDuration: `${b.duracao}s`, animationDelay: `${b.atraso}s` }}
        >
          {b.c}
        </span>
      ))}
    </div>
  );
}

const CURTOS: Record<string, string> = {
  epi: "LUZ",
  meso: "CREPÚSCULO",
  bati: "MEIA-NOITE",
  abis: "ABISMO",
  hadal: "HADAL",
};
const ENFEITES = ["    .         ", "         o    ", "  °      .    ", "       .      ", "   o          "];

export function Coluna({ metros }: { metros: number }) {
  const atual = Math.min(LINHAS - 1, Math.floor(metros / METROS_POR_LINHA));
  const limites = new Map(ZONAS.slice(1).map((z) => [z.de / METROS_POR_LINHA, z]));
  const linhas: { texto: string; classe?: string }[] = [];
  for (let i = 0; i < LINHAS; i++) {
    const m = i * METROS_POR_LINHA;
    const zona = limites.get(i);
    const rotulo = zona || i === 0 || m % 1000 === 0 ? `${formatar(m)}m`.padStart(7) : "       ";
    if (i === atual) {
      linhas.push({ texto: `${rotulo}|  ${KRILL}  < ${formatar(metros)}m`, classe: "destaque" });
    } else if (i === 0) {
      linhas.push({ texto: `${rotulo}|~~~~~~~~~~~~~~~~~~`, classe: "acc" });
    } else if (zona) {
      linhas.push({ texto: `${rotulo}+-- ${CURTOS[zona.id]}`, classe: "dim" });
    } else {
      linhas.push({ texto: `${rotulo}|${ENFEITES[i % ENFEITES.length]}`, classe: i < atual ? "dim" : undefined });
    }
  }
  return (
    <pre aria-hidden="true">
      {linhas.map((l, i) => (
        <span key={i} className={l.classe}>
          {l.texto + "\n"}
        </span>
      ))}
    </pre>
  );
}

/* ---------- relógio de ar ---------- */

export function Oxigenio({ restante, total }: { restante: number; total: number }) {
  const segundos = Math.ceil(restante);
  const critico = restante <= 8;
  return (
    <div className={"oxigenio" + (critico ? " critico" : "")} role="timer" aria-live="off" aria-label={`${segundos} segundos de ar`}>
      <pre>{`AR [${barra(restante, total, 24)}] ${String(segundos).padStart(2)}s`}</pre>
    </div>
  );
}

/* ---------- resultado de uma resposta ---------- */

export type LinhaTop = { resposta: string; porcento: number; voce: boolean };
export type Resultado = {
  resposta: string;
  porcento: number;
  profundidade: number;
  jogadoresReais: number;
  estimativa: boolean;
  pesoModelo?: number;
  posicao: number;
  top: LinhaTop[];
  minha: LinhaTop;
  repetida?: boolean;
};

const virgula = (n: number) => (n < 0.1 ? "<0,1" : String(n).replace(".", ","));

export function CartaoResultado({ res }: { res: Resultado }) {
  const rar = raridade(res.porcento / 100);
  const d = Math.round(useContagem(res.profundidade, { base: 700, porUnidade: 0.9, max: 1600, inicial: 0 }));

  const linhasCaixa = caixa([
    "SUA RESPOSTA",
    res.resposta,
    "",
    res.porcento < 0.1
      ? "menos de 0,1% das pessoas dariam a mesma resposta"
      : `${virgula(res.porcento)}% das pessoas dariam a mesma resposta`,
    `raridade: ${rar.nome}`,
    "",
    `PROFUNDIDADE  +${formatar(d)} m`,
    barra(d, 1000, 30),
  ]).split("\n");
  const visCaixa = useRevelar(linhasCaixa.length, 55, 250);

  const maximo = Math.max(...res.top.map((t) => t.porcento), res.porcento, 1);
  const noTop = res.top.some((t) => t.voce);
  const linhasTop = res.top.map((t, i) => ({
    voce: t.voce,
    texto: `${String(i + 1).padStart(2)}. ${t.resposta.slice(0, 13).padEnd(13)} ${barra(t.porcento, maximo, 9)} ${virgula(t.porcento).padStart(4)}%`,
  }));
  if (!noTop) {
    linhasTop.push({ voce: false, texto: "    ..." });
    linhasTop.push({
      voce: true,
      texto: `${String(res.posicao).padStart(2)}. ${res.resposta.slice(0, 13).padEnd(13)} ${barra(res.porcento, maximo, 9)} ${virgula(res.porcento).padStart(4)}%`,
    });
  }
  const visTop = useRevelar(linhasTop.length, 120, 250 + linhasCaixa.length * 55 + 200);

  const faisca =
    res.profundidade >= 800 ? "* . + RESPOSTA QUASE ÚNICA! + . *" : res.profundidade >= 600 ? "+ . RESPOSTA RARA! . +" : "";

  return (
    <div className="bloco" role="status" aria-live="polite">
      {faisca && (
        <div className="faiscas warn" aria-hidden="true">
          {faisca}
        </div>
      )}
      <pre className="acc">
        {linhasCaixa.map((l, i) => (
          <span key={i} style={{ opacity: i < visCaixa ? 1 : 0 }}>
            {l + (i < linhasCaixa.length - 1 ? "\n" : "")}
          </span>
        ))}
      </pre>
      <div className="bloco">
        <div className="dim">O QUE O OCEANO RESPONDEU</div>
        <pre>
          {linhasTop.map((l, i) => (
            <span key={i} className={l.voce ? "destaque" : undefined} style={{ opacity: i < visTop ? 1 : 0 }}>
              {l.texto + (l.voce ? "  <" : "") + "\n"}
            </span>
          ))}
        </pre>
        <div className="dim">
          {res.jogadoresReais} {res.jogadoresReais === 1 ? "jogador" : "jogadores"} nesta pergunta
          {typeof res.pesoModelo === "number" ? ` · banco de respostas pesa ${res.pesoModelo}%` : ""}
        </div>
      </div>
    </div>
  );
}

/* ---------- fim do mergulho ---------- */

export function Histograma({ hist, faixa }: { hist: number[]; faixa: number }) {
  // junta as 28 faixas de 250 m em 14 de 500 m
  const grupos = Array.from({ length: 14 }, (_, i) => (hist[i * 2] ?? 0) + (hist[i * 2 + 1] ?? 0));
  const meu = Math.min(13, Math.floor(faixa / 2));
  const maior = Math.max(...grupos, 1);
  const ALTURA = 7;
  const alturas = grupos.map((c) => (c === 0 ? 0 : Math.max(1, Math.round((c / maior) * ALTURA))));
  const linhas: string[] = [];
  linhas.push(grupos.map((_, i) => (i === meu ? "v " : "  ")).join(""));
  for (let r = ALTURA; r >= 1; r--) linhas.push(alturas.map((h) => (h >= r ? "# " : "  ")).join(""));
  linhas.push("-".repeat(28));
  linhas.push(Array.from({ length: 7 }, (_, i) => `${i}k`.padEnd(4)).join(""));
  const vis = useRevelar(linhas.length, 70, 300);
  return (
    <pre aria-label="Distribuição das profundidades de hoje">
      {linhas.map((l, i) => (
        <span
          key={i}
          className={i === 0 ? "acc" : i >= linhas.length - 2 ? "dim" : undefined}
          style={{ opacity: i < vis ? 1 : 0 }}
        >
          {l + "\n"}
        </span>
      ))}
    </pre>
  );
}

export function textoCompartilhar(opts: {
  numero: number;
  total: number;
  respostas: number[];
  percentil: number | null;
  tempoMs?: number;
  url: string;
}): string {
  const zona = zonaDe(opts.total);
  const trilha = opts.respostas.map(densidade).join("");
  const linhas = [`ABISSO #${opts.numero} - ${formatar(opts.total)} m`, zona.nome, `[${trilha}]`];
  if (opts.tempoMs && opts.tempoMs > 0) linhas.push(`Tempo: ${formatarTempo(opts.tempoMs)}`);
  if (opts.percentil !== null) linhas.push(`Mais fundo que ${opts.percentil}% dos mergulhadores`);
  linhas.push(opts.url);
  return linhas.join("\n");
}

export function CriaturaDaZona({ metros }: { metros: number }) {
  const zona = zonaDe(metros);
  return <pre className="acc criatura">{CRIATURAS[zona.id]}</pre>;
}
