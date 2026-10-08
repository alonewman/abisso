// Motor da cena ASCII da descida, no estilo "pixel art de texto". É uma função pura de
// (profundidade, tempo, velocidade): o cenário sobe conforme você desce (parallax), com céu e barco na
// superfície, paredes de rocha, água em degradê por zona (com dithering), neve marinha, criaturas por
// zona, lanterna do krill no escuro, bolhas e riscos de velocidade.

import { zonaDe } from "./zonas";

export const LARGURA = 44;
export const ALTURA = 18;
export const LINHA_KRILL = 8; // linha central do krill
export const COLUNA_KRILL = 13;
const ESCALA = 0.06; // linhas de tela por metro
const LIMITES = [500, 1500, 3500, 5500];

export type Trecho = { texto: string; cls: string; bg: string };

function ruido(n: number): number {
  const x = Math.sin(n * 127.1 + 311.7) * 43758.5453;
  return x - Math.floor(x);
}
const mod = (a: number, b: number) => ((a % b) + b) % b;

const CRIATURAS: Record<string, string[][]> = {
  epi: [
    [" ,--.", "<(o  >=", " `--'"],
    ["  /|", "><((o>", "  \\|"],
    ["   _", " ><(_o>", "   '"],
  ],
  meso: [
    [" .-''-.", "(  oo  )", " `|||||'", "  ' ' ' "],
    ["   /\\", "  (oo)", "  /||\\", " / || \\"],
    [" ,---.", "<(O ))))=", " `---'"],
  ],
  bati: [
    ["    *", "    \\", "  /^^^\\__", "<(o)vvv_>", "   ''''"],
    ["  .-.", " (o o)", " /|||\\", " d| |b"],
    [" _.-._", "(  @  )", " `-.-'", "   ||"],
  ],
  abis: [
    ["~~~~~~=<o", "  ~~~~~~"],
    ["  ___", "<(o_VVV>", "  ```"],
    [" .----.", "(  oo  )", " \\VVVV/"],
  ],
  hadal: [
    ["  |", " \\|/", "  |", "  |"],
    ["  _", " (o)", " /|\\", "  ."],
    [" .  .", "(o..o)>", " ' ' '"],
  ],
};

export const KRILL_QUADROS = [
  ["  ,_.-. ", "~(o ))__>", "  ' ' ' "],
  ["  ,_.-. ", "-(o ))__>", "  . . . "],
];

type Quadro = { car: string[][]; cl: string[][]; bg: string[][] };

function novoQuadro(): Quadro {
  const grade = (v: string) => Array.from({ length: ALTURA }, () => Array<string>(LARGURA).fill(v));
  return { car: grade(" "), cl: grade(""), bg: grade("") };
}

function poe(q: Quadro, x: number, y: number, s: string, cls: string) {
  const yi = Math.round(y);
  if (yi < 0 || yi >= ALTURA) return;
  for (let i = 0; i < s.length; i++) {
    const xi = Math.round(x) + i;
    if (xi < 0 || xi >= LARGURA || s[i] === " ") continue;
    q.car[yi][xi] = s[i];
    q.cl[yi][xi] = s[i] === "*" || s[i] === "@" ? "brilho" : cls;
  }
}
const poeSprite = (q: Quadro, x: number, y: number, sprite: string[], cls: string) =>
  sprite.forEach((linha, k) => poe(q, x, y + k, linha, cls));

function fundoDaProfundidade(depth: number, x: number, wy: number): string {
  if (depth < 0) return "ceu";
  let idx = LIMITES.filter((b) => depth >= b).length;
  for (let i = 0; i < LIMITES.length; i++) {
    const d = depth - LIMITES[i];
    if (Math.abs(d) < 110) {
      const p = (d + 110) / 220; // chance de já ser a zona de baixo
      idx = ruido(x * 3.7 + wy * 11.3 + i * 17) < p ? i + 1 : i;
      break;
    }
  }
  return "a" + idx;
}

/** velocidade: 0 (parado) a 1 (descendo muito rápido). */
export function quadroDaCena(metros: number, t: number, velocidade = 0): Trecho[][] {
  const q = novoQuadro();
  const ySup = LINHA_KRILL - metros * ESCALA; // linha da superfície (pode ser fracionária)
  const ySupI = Math.round(ySup);
  const base = Math.round(metros * ESCALA);

  // água, céu e paredes de rocha
  for (let y = 0; y < ALTURA; y++) {
    const depth = metros + (y - LINHA_KRILL) / ESCALA;
    const wy = base + (y - LINHA_KRILL);
    for (let x = 0; x < LARGURA; x++) q.bg[y][x] = y < ySupI ? "ceu" : fundoDaProfundidade(depth, x, wy);
    if (y < ySupI) continue;
    const onda = (k: number) => 1 + Math.round(1.5 * (0.5 + 0.5 * Math.sin(wy * 0.23 + k + ruido(Math.floor(wy / 6) + k) * 6)));
    const esq = onda(0);
    const dir = onda(3);
    const gl = ["█", "▓", "▒"];
    for (let i = 0; i < esq; i++) {
      q.car[y][i] = gl[Math.min(2, esq - 1 - i)];
      q.cl[y][i] = "rocha";
    }
    for (let i = 0; i < dir; i++) {
      q.car[y][LARGURA - 1 - i] = gl[Math.min(2, dir - 1 - i)];
      q.cl[y][LARGURA - 1 - i] = "rocha";
    }
  }

  // céu: sol, nuvens e barco
  if (ySupI > 0) {
    poeSprite(q, 34, ySupI - 8, [" \\ | /", " -(O)-", " / | \\"], "sol");
    poe(q, 4 + mod(t * 0.8, 20), ySupI - 6, "~~~~", "nuvem");
    poe(q, 24 + mod(-t * 0.5, 14), ySupI - 4, "~~~~~~", "nuvem");
    poeSprite(q, 21, ySupI - 4 + (Math.floor(t * 1.2) % 2 === 0 ? 0 : 0), ["    |>", "    |", " ___|___", " \\_____/"], "barco");
  }

  // linha d'água
  if (ySupI >= 0 && ySupI < ALTURA) {
    const desloc = Math.floor(t * 3);
    let onda = "";
    for (let x = 0; x < LARGURA; x++) onda += (x + desloc) % 6 < 3 ? "~" : (x + desloc) % 6 === 3 ? "-" : "~";
    poe(q, 0, ySupI, onda, "sup");
  }

  // raios de luz
  if (metros < 1100) {
    const forca = Math.pow(1 - Math.max(0, metros) / 1100, 1.6);
    for (let y = Math.max(0, ySupI + 1); y < Math.min(ALTURA, ySupI + 10); y++) {
      for (let x = 3; x < LARGURA - 3; x++) {
        if ((x + 2 * y + Math.floor(t * 1.5)) % 11 === 0 && ruido(x * 3 + y * 7) < forca) poe(q, x, y, "/", "raio");
      }
    }
  }

  // neve marinha em 3 camadas (parallax)
  const letras = [".", ",", "'"];
  for (let camada = 0; camada < 3; camada++) {
    const fator = ESCALA * (0.5 + 0.55 * camada);
    for (let i = 0; i < 12 + camada * 5; i++) {
      const x0 = ruido(i * 7.3 + camada * 91) * LARGURA;
      const y0 = ruido(i * 3.1 + camada * 57 + 5) * ALTURA * 3;
      const y = mod(y0 - metros * fator, ALTURA);
      const x = mod(x0 + Math.sin(t * 0.7 + i + camada) * 1.5, LARGURA);
      if (y > ySup + 0.5) poe(q, x, y, letras[camada], "neve");
    }
  }

  // criaturas, conforme a zona de cada profundidade
  const passo = 110;
  const j0 = Math.floor((metros - 320) / passo);
  const j1 = Math.ceil((metros + 360) / passo);
  for (let j = j0; j <= j1; j++) {
    if (j < 2) continue;
    const dy = j * passo + ruido(j * 5.7) * 70;
    const y = LINHA_KRILL + (dy - metros) * ESCALA;
    const variantes = CRIATURAS[zonaDe(dy).id];
    const sprite = variantes[Math.floor(ruido(j * 9.1) * variantes.length)];
    const largura = Math.max(...sprite.map((l) => l.length));
    const x = 24 + ruido(j * 2.3) * (LARGURA - 24 - largura - 3) + Math.sin(t * 0.5 + j) * 1.8;
    poeSprite(q, x, y - (sprite.length - 1) / 2, sprite, "cri");
  }

  // marcas de profundidade na parede esquerda
  const primeiro = Math.floor((metros - (LINHA_KRILL + 1) / ESCALA) / 100) * 100;
  const ultimo = metros + (ALTURA - LINHA_KRILL) / ESCALA;
  for (let m = Math.max(100, primeiro); m <= ultimo; m += 100) {
    const y = LINHA_KRILL + (m - metros) * ESCALA;
    poe(q, 3, y, m % 500 === 0 ? `${m}m` : "-", "regua");
  }

  // bolhas saindo do krill
  for (let k = 0; k < 6; k++) {
    const ciclo = mod(t * 2.2 + k * 1.3, 8);
    const bx = COLUNA_KRILL + 1 + Math.sin(ciclo * 1.3 + k) * 1.3;
    const by = LINHA_KRILL - 1 - ciclo;
    if (by <= ySup) continue; // estoura na superfície
    poe(q, bx, by, ciclo < 2 ? "." : ciclo < 4 ? "o" : "O", "bolha");
  }

  // riscos de velocidade
  const riscos = Math.round(velocidade * 16);
  for (let i = 0; i < riscos; i++) {
    const x = 4 + ruido(i * 6.1 + 2) * (LARGURA - 8);
    const y = mod(ruido(i * 2.9 + 1) * ALTURA - metros * ESCALA * 4, ALTURA);
    poe(q, x, y, "|", "vel");
    poe(q, x, y + 1, "|", "vel");
  }

  // lanterna do krill no escuro
  if (metros > 1200) {
    const forca = Math.min(1, (metros - 1200) / 1500);
    for (let d = 0; d < 7; d++) {
      const abre = Math.floor(d / 2);
      for (let r = -1 - abre; r <= 1 + abre; r++) {
        if (ruido(d * 7 + r * 3 + Math.floor(t * 3)) < forca * (1 - d / 8)) {
          poe(q, COLUNA_KRILL + 9 + d, LINHA_KRILL + r, d < 3 ? "░" : "·", "lanterna");
        }
      }
    }
  }

  // o krill (por cima de tudo)
  const quadro = KRILL_QUADROS[Math.floor(t * 4) % 2];
  const kx = COLUNA_KRILL + Math.sin(t * 0.9) * 1.5;
  const ky = LINHA_KRILL - 1 + Math.round(Math.sin(t * 1.7) * 0.6);
  quadro.forEach((linha, k) => {
    for (let i = 0; i < linha.length; i++) {
      const xi = Math.round(kx) + i;
      const yi = ky + k;
      if (linha[i] === " " || xi < 0 || xi >= LARGURA || yi < 0 || yi >= ALTURA) continue;
      q.car[yi][xi] = linha[i];
      q.cl[yi][xi] = linha[i] === "o" ? "olho" : "krill";
    }
  });

  // junta caracteres vizinhos de mesma classe
  return q.car.map((linha, y) => {
    const trechos: Trecho[] = [];
    for (let x = 0; x < LARGURA; x++) {
      const cls = q.cl[y][x];
      const bg = q.bg[y][x];
      const ultimo = trechos[trechos.length - 1];
      if (ultimo && ultimo.cls === cls && ultimo.bg === bg) ultimo.texto += linha[x];
      else trechos.push({ texto: linha[x], cls, bg });
    }
    return trechos;
  });
}

export function quadroComoTexto(q: Trecho[][]): string[] {
  return q.map((l) => l.map((t) => t.texto).join(""));
}
