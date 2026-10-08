// Motor da cena ASCII da descida, no estilo "pixel art de texto", em tela cheia.
// É uma função pura de (profundidade, tempo, velocidade, tamanho): o cenário sobe conforme você desce
// (parallax), com céu e barco na superfície, paredes de rocha, água em degradê por zona (com dithering),
// neve marinha, criaturas por zona, baleia, lula-gigante, lanterna do krill, bolhas, riscos de velocidade
// e o leito do oceano no fim.

import { zonaDe } from "./zonas";

export const ESCALA = 0.07; // linhas de tela por metro
const LIMITES = [500, 1500, 3500, 5500];
const FUNDO_DO_MAR = 7060;

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
    ["  ,-.", "=(o_ )>", "  `-'"],
  ],
  meso: [
    [" .-''-.", "(  oo  )", " `|||||'", "  ' ' ' "],
    ["   /\\", "  (oo)", "  /||\\", " / || \\"],
    [" ,---.", "<(O ))))=", " `---'"],
    ["  .--.", " ( oo )", "  `||'", "  /||\\"],
  ],
  bati: [
    ["    *", "    \\", "  /^^^\\__", "<(o)vvv_>", "   ''''"],
    ["  .-.", " (o o)", " /|||\\", " d| |b"],
    [" _.-._", "(  @  )", " `-.-'", "   ||"],
    ["  ,-~-.", " ( o o )", "  \\===/", "  /| |\\"],
  ],
  abis: [
    ["~~~~~~=<o", "  ~~~~~~"],
    ["  ___", "<(o_VVV>", "  ```"],
    [" .----.", "(  oo  )", " \\VVVV/"],
    ["   *", "  /", " (oo)==<", "  \\"],
  ],
  hadal: [
    ["  |", " \\|/", "  |", "  |"],
    ["  _", " (o)", " /|\\", "  ."],
    [" .  .", "(o..o)>", " ' ' '"],
    ["  ()", " /||\\", "  ||", " ' ' "],
  ],
};

const BALEIA = [
  "          .-'''''-.__",
  "   __.--'`    o      `~-.__",
  "  <___________.-~~'`-.___.>",
  "                 `~---'",
];
const LULA = [
  "     ,-.",
  "    ( oo )",
  "   /|\\||/|\\",
  "  / | || | \\",
  "    ~ ~~ ~",
];

export const KRILL_PEQUENO = [
  ["  ,_.-. ", "~(o ))__>", "  ' ' ' "],
  ["  ,_.-. ", "-(o ))__>", "  . . . "],
];
export const KRILL_GRANDE = [
  ["     _,-.__", "  ,-'  `  ` \\", "~=(o  ))))__)>~", "  `-.__,-'_-'", "     ' ' ' '"],
  ["     _,-.__", "  ,-'  `  ` \\", "-=(o  ))))__)>-", "  `-.__,-'_-'", "     . . . ."],
];

type Quadro = { w: number; h: number; car: string[][]; cl: string[][]; bg: string[][] };

function novoQuadro(w: number, h: number): Quadro {
  const grade = (v: string) => Array.from({ length: h }, () => Array<string>(w).fill(v));
  return { w, h, car: grade(" "), cl: grade(""), bg: grade("") };
}

function poe(q: Quadro, x: number, y: number, s: string, cls: string) {
  const yi = Math.round(y);
  if (yi < 0 || yi >= q.h) return;
  for (let i = 0; i < s.length; i++) {
    const xi = Math.round(x) + i;
    if (xi < 0 || xi >= q.w || s[i] === " ") continue;
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

/** Posição do krill na tela (para o resto da interface se alinhar a ele). */
export function posicaoKrill(w: number, h: number) {
  return { linha: Math.floor(h * 0.4), coluna: Math.max(5, Math.floor(w * 0.16)), grande: h >= 26 };
}

/** velocidade: 0 (parado) a 1 (descendo muito rápido). */
export function quadroDaCena(metros: number, t: number, velocidade: number, w: number, h: number): Trecho[][] {
  const q = novoQuadro(w, h);
  const { linha: LK, coluna: CK, grande } = posicaoKrill(w, h);
  const area = (w * h) / (44 * 18);
  const ySup = LK - metros * ESCALA;
  const ySupI = Math.round(ySup);
  const base = Math.round(metros * ESCALA);

  // água, céu e paredes de rocha
  const larguraParede = Math.max(3, Math.min(7, Math.round(w / 22)));
  for (let y = 0; y < h; y++) {
    const depth = metros + (y - LK) / ESCALA;
    const wy = base + (y - LK);
    for (let x = 0; x < w; x++) q.bg[y][x] = y < ySupI ? "ceu" : fundoDaProfundidade(depth, x, wy);
    if (y < ySupI) continue;
    const onda = (k: number) =>
      1 + Math.round((larguraParede - 1) * (0.5 + 0.5 * Math.sin(wy * 0.23 + k + ruido(Math.floor(wy / 6) + k) * 6)));
    const esq = onda(0);
    const dir = onda(3);
    const gl = ["█", "▓", "▒", "░"];
    for (let i = 0; i < esq; i++) {
      q.car[y][i] = gl[Math.min(3, esq - 1 - i)];
      q.cl[y][i] = "rocha";
    }
    for (let i = 0; i < dir; i++) {
      q.car[y][w - 1 - i] = gl[Math.min(3, dir - 1 - i)];
      q.cl[y][w - 1 - i] = "rocha";
    }
    // plantas junto às paredes perto da superfície
    if (depth < 380 && depth > 20 && ruido(wy * 1.7) < 0.35) {
      poe(q, esq, y, ruido(wy) < 0.5 ? ")" : "}", "alga");
      poe(q, w - 1 - dir, y, ruido(wy + 9) < 0.5 ? "(" : "{", "alga");
    }
  }

  // céu: sol, nuvens e barco
  if (ySupI > 0) {
    poeSprite(q, Math.floor(w * 0.82), ySupI - 9, [" \\ | /", " -(O)-", " / | \\"], "sol");
    for (let i = 0; i < Math.max(2, Math.round(w / 20)); i++) {
      poe(q, mod(i * 31 + t * (0.5 + (i % 3) * 0.3), w + 8) - 4, ySupI - 3 - ((i * 2) % 7), "~~~~~", "nuvem");
    }
    poeSprite(q, Math.floor(w * 0.5), ySupI - 4, ["    |>", "    |", " ___|___", " \\_____/"], "barco");
  }

  // linha d'água
  if (ySupI >= 0 && ySupI < h) {
    const desloc = Math.floor(t * 3);
    let onda = "";
    for (let x = 0; x < w; x++) onda += (x + desloc) % 6 === 3 ? "-" : "~";
    poe(q, 0, ySupI, onda, "sup");
  }

  // raios de luz
  if (metros < 1100) {
    const forca = Math.pow(1 - Math.max(0, metros) / 1100, 1.6);
    for (let y = Math.max(0, ySupI + 1); y < Math.min(h, ySupI + 14); y++) {
      for (let x = 4; x < w - 4; x++) {
        if ((x + 2 * y + Math.floor(t * 1.5)) % 11 === 0 && ruido(x * 3 + y * 7) < forca) poe(q, x, y, "/", "raio");
      }
    }
  }

  // neve marinha em 3 camadas (parallax)
  const letras = [".", ",", "'"];
  for (let camada = 0; camada < 3; camada++) {
    const fator = ESCALA * (0.5 + 0.55 * camada);
    const n = Math.round((12 + camada * 5) * area);
    for (let i = 0; i < n; i++) {
      const x0 = ruido(i * 7.3 + camada * 91) * w;
      const y0 = ruido(i * 3.1 + camada * 57 + 5) * h * 3;
      const y = mod(y0 - metros * fator, h);
      const x = mod(x0 + Math.sin(t * 0.7 + i + camada) * 1.5, w);
      if (y > ySup + 0.5) poe(q, x, y, letras[camada], "neve");
    }
  }

  // criaturas por zona, em faixas de largura para a tela cheia
  const faixas = Math.max(1, Math.round(w / 46));
  const passo = 120;
  for (let f = 0; f < faixas; f++) {
    const x0 = CK + 16 + (f * (w - CK - 24)) / faixas;
    const largFaixa = (w - CK - 24) / faixas;
    const j0 = Math.floor((metros - (LK + 6) / ESCALA) / passo);
    const j1 = Math.ceil((metros + (h - LK + 6) / ESCALA) / passo);
    for (let j = j0; j <= j1; j++) {
      if (j < 2) continue;
      const semente = j * 17 + f * 101;
      if (ruido(semente + 0.3) < 0.25) continue; // nem todo espaço tem bicho
      const dy = j * passo + ruido(semente * 5.7) * 80;
      if (dy > FUNDO_DO_MAR - 150) continue;
      const bob = Math.sin(t * 0.8 + semente) * 0.7;
      const y = LK + (dy - metros) * ESCALA + bob;
      const variantes = CRIATURAS[zonaDe(dy).id];
      const sprite = variantes[Math.floor(ruido(semente * 9.1) * variantes.length)];
      const largura = Math.max(...sprite.map((l) => l.length));
      const x = x0 + ruido(semente * 2.3) * Math.max(0, largFaixa - largura) + Math.sin(t * 0.5 + semente) * 2;
      poeSprite(q, x, y - (sprite.length - 1) / 2, sprite, "cri");
    }
  }

  // visitantes grandes: baleia e lula-gigante
  const baleiaY = LK + (1150 - metros) * ESCALA;
  if (baleiaY > -8 && baleiaY < h + 4) {
    poeSprite(q, mod(-t * 1.6 + 70, w + 60) - 30, baleiaY, BALEIA, "baleia");
  }
  const lulaY = LK + (3900 - metros) * ESCALA;
  if (lulaY > -8 && lulaY < h + 4) {
    poeSprite(q, w * 0.62 + Math.sin(t * 0.4) * 4, lulaY + Math.sin(t * 0.9) * 1.2, LULA, "cri");
  }

  // marcas de profundidade na parede esquerda
  const primeiro = Math.floor((metros - (LK + 1) / ESCALA) / 100) * 100;
  const ultimo = metros + (h - LK) / ESCALA;
  for (let m = Math.max(100, primeiro); m <= ultimo; m += 100) {
    const y = LK + (m - metros) * ESCALA;
    poe(q, larguraParede + 1, y, m % 500 === 0 ? `${m}m` : "-", "regua");
  }

  // leito do oceano
  const yFundo = LK + (FUNDO_DO_MAR - metros) * ESCALA;
  if (yFundo < h) {
    for (let y = Math.max(0, Math.floor(yFundo)); y < h; y++) {
      for (let x = 0; x < w; x++) {
        const r = ruido(x * 1.3 + y * 7.1);
        q.car[y][x] = y === Math.floor(yFundo) ? (r < 0.5 ? "▒" : "░") : r < 0.5 ? "▓" : r < 0.8 ? "▒" : "█";
        q.cl[y][x] = "rocha";
        q.bg[y][x] = "a4";
      }
    }
    for (let x = 6; x < w - 8; x += 9 + Math.floor(ruido(x) * 8)) {
      poeSprite(q, x, yFundo - 4, ["  |", " \\|/", "  |", "  |"], "cri");
    }
    poe(q, w * 0.35, yFundo - 1, "( )", "brilho");
  }

  // bolhas saindo do krill
  for (let k = 0; k < 7; k++) {
    const ciclo = mod(t * 2.2 + k * 1.3, 9);
    const bx = CK + (grande ? 3 : 1) + Math.sin(ciclo * 1.3 + k) * 1.3;
    const by = LK - (grande ? 3 : 2) - ciclo;
    if (by <= ySup) continue; // estoura na superfície
    poe(q, bx, by, ciclo < 2 ? "." : ciclo < 4 ? "o" : "O", "bolha");
  }

  // riscos de velocidade
  const riscos = Math.round(velocidade * 16 * area);
  for (let i = 0; i < riscos; i++) {
    const x = 6 + ruido(i * 6.1 + 2) * (w - 12);
    const y = mod(ruido(i * 2.9 + 1) * h - metros * ESCALA * 4, h);
    poe(q, x, y, "|", "vel");
    poe(q, x, y + 1, "|", "vel");
  }

  // lanterna do krill no escuro
  const alcance = grande ? 16 : 11;
  if (metros > 1200) {
    const forca = Math.min(1, (metros - 1200) / 1500);
    for (let d = 0; d < alcance; d++) {
      const abre = Math.floor(d / 3);
      for (let r = -1 - abre; r <= 1 + abre; r++) {
        if (ruido(d * 7 + r * 3 + Math.floor(t * 3)) < forca * (1 - d / (alcance + 2))) {
          poe(q, CK + (grande ? 16 : 9) + d, LK + r, d < alcance / 3 ? "░" : "·", "lanterna");
        }
      }
    }
  }

  // o krill (por cima de tudo)
  const quadros = grande ? KRILL_GRANDE : KRILL_PEQUENO;
  const quadro = quadros[Math.floor(t * 4) % 2];
  const kx = CK + Math.sin(t * 0.9) * 1.5;
  const ky = LK - Math.floor(quadro.length / 2) + Math.round(Math.sin(t * 1.7) * 0.6);
  quadro.forEach((linha, k) => {
    for (let i = 0; i < linha.length; i++) {
      const xi = Math.round(kx) + i;
      const yi = ky + k;
      if (linha[i] === " " || xi < 0 || xi >= w || yi < 0 || yi >= h) continue;
      q.car[yi][xi] = linha[i];
      q.cl[yi][xi] = linha[i] === "o" ? "olho" : "krill";
    }
  });

  // junta caracteres vizinhos de mesma classe
  return q.car.map((linha, y) => {
    const trechos: Trecho[] = [];
    for (let x = 0; x < w; x++) {
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

const ESC: Record<string, string> = { "&": "&amp;", "<": "&lt;", ">": "&gt;" };
/** HTML pronto para o <pre> da tela cheia (mais barato do que renderizar centenas de spans no React). */
export function quadroComoHtml(q: Trecho[][]): string {
  return q
    .map((linha) =>
      linha
        .map((t) => {
          const classe = (t.cls ? "c-" + t.cls + " " : "") + (t.bg ? "f-" + t.bg : "");
          return `<span class="${classe.trim()}">${t.texto.replace(/[&<>]/g, (c) => ESC[c])}</span>`;
        })
        .join(""),
    )
    .join("\n");
}
