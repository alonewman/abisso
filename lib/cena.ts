// Motor da cena ASCII da descida. É uma função pura de (profundidade, tempo, velocidade):
// o cenário "sobe" conforme você desce (parallax), com neve marinha, criaturas por zona,
// régua de profundidade, bolhas saindo do krill e riscos de velocidade quando o mergulho é rápido.

import { zonaDe } from "./zonas";

export const LARGURA = 36;
export const ALTURA = 13;
export const LINHA_KRILL = 5;
export const COLUNA_KRILL = 10;
const ESCALA = 0.045; // linhas de tela por metro

export type Trecho = { texto: string; cls: string };

function ruido(n: number): number {
  const x = Math.sin(n * 127.1 + 311.7) * 43758.5453;
  return x - Math.floor(x);
}
const mod = (a: number, b: number) => ((a % b) + b) % b;

const CRIATURAS: Record<string, string[][]> = {
  epi: [["><>"], ["<><"], ["><(((o>"], [" __", "<__>"]],
  meso: [[" .-.", "(oo)", "/||\\"], ["<o)))"], [" _", "(_)>"]],
  bati: [["    *", "<(o>"], ["   ,", "<(O)>"], ["  ___", "<(o_o)"]],
  abis: [["~~~=<o"], ["(\\o/)", " / \\"], ["<=====o"]],
  hadal: [["(o.o)", " ~~~"], ["( o )", " /|\\"], ["  .", "(  )>", "  '"]],
};

export const KRILL_QUADROS = [
  ["~(o)>=", " ' ' "],
  ["-(o)>~", " . . "],
];

type Quadro = { car: string[][]; cl: string[][] };

function novoQuadro(): Quadro {
  return {
    car: Array.from({ length: ALTURA }, () => Array(LARGURA).fill(" ")),
    cl: Array.from({ length: ALTURA }, () => Array(LARGURA).fill("")),
  };
}

function poe(q: Quadro, x: number, y: number, s: string, cls: string) {
  const yi = Math.round(y);
  if (yi < 0 || yi >= ALTURA) return;
  for (let i = 0; i < s.length; i++) {
    const xi = Math.round(x) + i;
    if (xi < 0 || xi >= LARGURA || s[i] === " ") continue;
    q.car[yi][xi] = s[i];
    q.cl[yi][xi] = cls;
  }
}

/** velocidade: 0 (parado) a 1 (descendo muito rápido). */
export function quadroDaCena(metros: number, t: number, velocidade = 0): Trecho[][] {
  const q = novoQuadro();

  // superfície e raios de luz
  const ySup = Math.round(LINHA_KRILL - metros * ESCALA);
  if (ySup >= 0 && ySup < ALTURA) {
    const desloc = Math.floor(t * 3);
    let onda = "";
    for (let x = 0; x < LARGURA; x++) onda += (x + desloc) % 4 < 2 ? "~" : "-";
    poe(q, 0, ySup, onda, "sup");
  }
  if (metros < 1100) {
    const forca = Math.pow(1 - metros / 1100, 1.6);
    for (let y = Math.max(0, ySup + 1); y < Math.min(ALTURA, ySup + 9); y++) {
      for (let x = 0; x < LARGURA; x++) {
        if ((x + 2 * y + Math.floor(t * 1.5)) % 13 === 0 && ruido(x * 3 + y * 7) < forca) poe(q, x, y, "/", "raio");
      }
    }
  }

  // neve marinha em 3 camadas (parallax)
  const letras = [".", ",", "'"];
  for (let camada = 0; camada < 3; camada++) {
    const fator = ESCALA * (0.5 + 0.55 * camada);
    for (let i = 0; i < 9 + camada * 4; i++) {
      const x0 = ruido(i * 7.3 + camada * 91) * LARGURA;
      const y0 = ruido(i * 3.1 + camada * 57 + 5) * ALTURA * 3;
      const y = mod(y0 - metros * fator, ALTURA);
      const x = mod(x0 + Math.sin(t * 0.7 + i + camada) * 1.5, LARGURA);
      if (y > ySup + 0.5 || ySup < 0 || ySup >= ALTURA) poe(q, x, y, letras[camada], "neve");
    }
  }

  // régua de profundidade na borda esquerda
  const primeiro = Math.floor((metros - (LINHA_KRILL + 1) / ESCALA) / 100) * 100;
  const ultimo = metros + (ALTURA - LINHA_KRILL) / ESCALA;
  for (let m = Math.max(0, primeiro); m <= ultimo; m += 100) {
    const y = LINHA_KRILL + (m - metros) * ESCALA;
    poe(q, 0, y, m % 500 === 0 ? `+${m}m` : "+-", "regua");
  }

  // criaturas, conforme a zona de cada profundidade
  const j0 = Math.floor((metros - 320) / 130);
  const j1 = Math.ceil((metros + 320) / 130);
  for (let j = j0; j <= j1; j++) {
    if (j < 1) continue;
    const dy = j * 130 + ruido(j * 5.7) * 90;
    const y = LINHA_KRILL + (dy - metros) * ESCALA;
    const variantes = CRIATURAS[zonaDe(dy).id];
    const sprite = variantes[Math.floor(ruido(j * 9.1) * variantes.length)];
    const x = 18 + ruido(j * 2.3) * (LARGURA - 18 - 8) + Math.sin(t * 0.5 + j) * 2;
    sprite.forEach((linha, k) => poe(q, x, y + k - (sprite.length - 1), linha, "cri"));
  }

  // bolhas saindo do krill
  for (let k = 0; k < 5; k++) {
    const ciclo = mod(t * 2.2 + k * 1.4, 7);
    const bx = COLUNA_KRILL + 1 + Math.sin(ciclo * 1.3 + k) * 1.2;
    const by = LINHA_KRILL - 1 - ciclo;
    if (ySup >= 0 && ySup < ALTURA && by <= ySup) continue; // bolha estoura na superfície
    poe(q, bx, by, ciclo < 2 ? "." : ciclo < 4 ? "o" : "O", "bolha");
  }

  // riscos de velocidade
  const riscos = Math.round(velocidade * 14);
  for (let i = 0; i < riscos; i++) {
    const x = ruido(i * 6.1 + 2) * LARGURA;
    const y = mod(ruido(i * 2.9 + 1) * ALTURA - metros * ESCALA * 4, ALTURA);
    poe(q, x, y, "|", "vel");
    poe(q, x, y + 1, "|", "vel");
  }

  // o krill
  const quadro = KRILL_QUADROS[Math.floor(t * 4) % 2];
  const kx = COLUNA_KRILL + Math.sin(t * 0.9) * 1.5;
  const ky = LINHA_KRILL + Math.round(Math.sin(t * 1.7) * 0.6);
  quadro.forEach((linha, k) => poe(q, kx, ky + k, linha, "krill"));

  // junta caracteres vizinhos de mesma classe
  return q.car.map((linha, y) => {
    const trechos: Trecho[] = [];
    for (let x = 0; x < LARGURA; x++) {
      const cls = q.cl[y][x];
      const ultimo = trechos[trechos.length - 1];
      if (ultimo && ultimo.cls === cls) ultimo.texto += linha[x];
      else trechos.push({ texto: linha[x], cls });
    }
    return trechos;
  });
}

export function quadroComoTexto(q: Trecho[][]): string[] {
  return q.map((l) => l.map((t) => t.texto).join(""));
}
