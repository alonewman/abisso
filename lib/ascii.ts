// Tudo o que é desenho ASCII e utilidades de texto em colunas fixas.

export const LOGO = String.raw`    _    ____ ___ ____ ____   ___
   / \  | __ )_ _/ ___/ ___| / _ \
  / _ \ |  _ \| |\___ \___ \| | | |
 / ___ \| |_) | | ___) |__) | |_| |
/_/   \_\____/___|____/____/ \___/`;

export const CRIATURAS: Record<string, string> = {
  epi: String.raw`     .--.
 ~~~( o  )>=-=-
     '--'
     ' '`,
  meso: String.raw`    .-""-.
   /  oo  \
   '-.__.-'
    |||||
    ||||
    |||`,
  bati: String.raw`        ,
       (*)
      /
   .-/-----.
 >( o  VvVvV )
   '-.______.-'`,
  abis: String.raw`     ____
  .-'    '-.
 <  o  /\/\/ >
  '-.____.-'
     \/ \/`,
  hadal: String.raw`     .-.
    (o o)
    | O |
    '~~~'
    /| |\
   ' ' ' '`,
};

export const KRILL = "~(o)>=";

/** Quebra um texto em linhas de no máximo `largura` caracteres. */
export function quebrar(texto: string, largura: number): string[] {
  const saida: string[] = [];
  for (const paragrafo of texto.split("\n")) {
    let linha = "";
    for (const palavra of paragrafo.split(" ")) {
      if (!linha) linha = palavra;
      else if ((linha + " " + palavra).length <= largura) linha += " " + palavra;
      else {
        saida.push(linha);
        linha = palavra;
      }
    }
    saida.push(linha);
  }
  return saida;
}

/** Desenha uma caixa ASCII com as linhas dadas (já quebra o texto longo). */
export function caixa(linhas: string[], largura = 36): string {
  const interno = largura - 4;
  const corpo = linhas.flatMap((l) => (l === "" ? [""] : quebrar(l, interno)));
  const borda = "+" + "-".repeat(largura - 2) + "+";
  return [borda, ...corpo.map((l) => "| " + l.padEnd(interno) + " |"), borda].join("\n");
}

/** Barra ASCII: ####....... */
export function barra(valor: number, maximo: number, largura: number): string {
  const cheio = Math.max(0, Math.min(largura, Math.round((valor / Math.max(maximo, 1e-9)) * largura)));
  return "#".repeat(cheio) + ".".repeat(largura - cheio);
}

/** Letra de densidade para o compartilhamento: fundo (0 m) -> '@' (1000 m). */
export function densidade(metros: number): string {
  const rampa = " .:-=+*#%@";
  const i = Math.max(0, Math.min(rampa.length - 1, Math.floor((metros / 1000) * (rampa.length - 1) + 0.5)));
  return rampa[i] === " " ? "_" : rampa[i];
}
