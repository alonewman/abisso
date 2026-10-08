"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { barra, caixa } from "@/lib/ascii";
import { Cena } from "./Cena";
import { MAX_PROFUNDIDADE, ZONAS, formatar, zonaDe } from "@/lib/zonas";
import {
  api,
  dataBonita,
  OPCOES_AR,
  lerAr,
  lerHistorico,
  lerLivre,
  lerTempos,
  salvarAr,
  salvarTempo,
  melhorSequencia,
  obterCid,
  salvarLivre,
  salvarRegistro,
  sequenciaAtual,
  type Historico,
} from "@/lib/cliente";
import {
  CartaoResultado,
  CriaturaDaZona,
  Histograma,
  Oxigenio,
  formatarTempo,
  textoCompartilhar,
  useContagem,
  useDigitar,
  useRelogio,
  type Resultado,
} from "./ui";

type Aba = "diario" | "livre" | "arquivo" | "stats" | "ajuda";
type Pergunta = { id: string; texto: string; letra: string | null };
type Partida = {
  numero: number;
  hoje: number;
  data: string;
  perguntas: Pergunta[];
  respondidas: Record<string, { resposta: string; profundidade: number; passou?: boolean }>;
  proximoEm: number;
  armazenamento: "redis" | "memoria";
};
type Fim = { total: number; percentil: number | null; jogadores: number; hist: number[]; faixa: number };
type RespostaApi = Resultado & { ok: true; passou?: boolean };

const NOMES_ABAS: { id: Aba; rotulo: string }[] = [
  { id: "diario", rotulo: "DIÁRIO" },
  { id: "livre", rotulo: "LIVRE" },
  { id: "arquivo", rotulo: "ARQUIVO" },
  { id: "stats", rotulo: "ESTATÍSTICAS" },
  { id: "ajuda", rotulo: "COMO JOGAR" },
];

function corDeFundo(metros: number): string {
  const t = Math.min(1, metros / MAX_PROFUNDIDADE);
  const de = [13, 74, 92];
  const ate = [1, 6, 14];
  const c = de.map((v, i) => Math.round(v + (ate[i] - v) * Math.pow(t, 0.8)));
  return `rgb(${c[0]}, ${c[1]}, ${c[2]})`;
}

function tempoTotal(numero: number, perguntas: Pergunta[]): number | undefined {
  const t = lerTempos(numero);
  if (!perguntas.every((p) => typeof t[p.id] === "number")) return undefined;
  return perguntas.reduce((a, p) => a + t[p.id], 0);
}

/* ------------------------------------------------------------------ */
/* Pergunta                                                            */
/* ------------------------------------------------------------------ */

function CartaoPergunta(props: {
  rotulo: string;
  pergunta: Pergunta;
  enviando: boolean;
  erro: string;
  segundos: number; // 0 = sem relógio
  onEnviar: (texto: string, info: { expirou: boolean; ms: number }) => void;
}) {
  const { rotulo, pergunta, enviando, erro, segundos, onEnviar } = props;
  const [texto, setTexto] = useState("");
  const [restante, setRestante] = useState(segundos);
  const campo = useRef<HTMLInputElement>(null);
  const relogio = useRef({ inicio: 0, pausado: 0, pausadoEm: 0, expirou: false });
  const textoRef = useRef("");
  textoRef.current = texto;
  const enviarRef = useRef(onEnviar);
  enviarRef.current = onEnviar;

  useEffect(() => {
    setTexto("");
    setRestante(segundos);
    relogio.current = { inicio: Date.now(), pausado: 0, pausadoEm: 0, expirou: false };
    campo.current?.focus();
  }, [pergunta.id, segundos]);

  // o relógio para enquanto o servidor confere a resposta
  useEffect(() => {
    const r = relogio.current;
    if (enviando) {
      r.pausadoEm = Date.now();
    } else if (r.pausadoEm) {
      r.pausado += Date.now() - r.pausadoEm;
      r.pausadoEm = 0;
    }
  }, [enviando]);

  const decorrido = () => {
    const r = relogio.current;
    return Date.now() - r.inicio - r.pausado - (r.pausadoEm ? Date.now() - r.pausadoEm : 0);
  };

  useEffect(() => {
    if (!segundos) return;
    const id = setInterval(() => {
      const r = relogio.current;
      if (r.pausadoEm || r.expirou || !r.inicio) return;
      const resta = segundos - decorrido() / 1000;
      setRestante(Math.max(0, resta));
      if (resta <= 0) {
        r.expirou = true;
        enviarRef.current(textoRef.current.trim(), { expirou: true, ms: segundos * 1000 });
      }
    }, 100);
    return () => clearInterval(id);
  }, [segundos, pergunta.id]);

  const enviar = () => {
    if (!enviando && texto.trim()) onEnviar(texto, { expirou: false, ms: decorrido() });
  };

  const linhas = [rotulo, "", pergunta.texto];
  if (pergunta.letra) linhas.push("", `>> comece com a letra ${pergunta.letra} <<`);
  const caixaCompleta = caixa(linhas);
  const digitada = useDigitar(caixaCompleta, 5);
  const caixaVisivel = digitada + caixaCompleta.slice(digitada.length).replace(/[^\n]/g, " ");

  return (
    <div className="bloco">
      <pre aria-label={linhas.join(" ")}>{caixaVisivel}</pre>
      {segundos > 0 && <Oxigenio restante={restante} total={segundos} />}
      <form
        className="linha-entrada"
        onSubmit={(e) => {
          e.preventDefault();
          enviar();
        }}
      >
        <label htmlFor="resposta" className="acc">
          &gt;
        </label>
        <input
          id="resposta"
          ref={campo}
          className="entrada"
          value={texto}
          onChange={(e) => setTexto(e.target.value)}
          maxLength={40}
          placeholder="sua resposta"
          autoComplete="off"
          autoCapitalize="none"
          autoCorrect="off"
          spellCheck={false}
          enterKeyHint="send"
          disabled={enviando}
        />
        <button type="submit" className="btn" disabled={enviando || !texto.trim()}>
          {enviando ? "[ ... ]" : "[ENTER]"}
        </button>
      </form>
      <div className="erro" role="alert">
        {erro}
      </div>
    </div>
  );
}

/** Tela de início: o krill espera na superfície até o jogador apertar DESCER. */
function useInicio(onSuperficie: (v: boolean) => void, pronto: boolean) {
  const [cont, setCont] = useState<number | null>(null);
  const [iniciou, setIniciou] = useState(false);
  const descendo = cont !== null || iniciou;
  useEffect(() => {
    onSuperficie(pronto && !descendo);
    return () => onSuperficie(false);
  }, [pronto, descendo, onSuperficie]);
  useEffect(() => {
    if (cont === null) return;
    if (cont <= 0) {
      setCont(null);
      setIniciou(true);
      return;
    }
    const id = setTimeout(() => setCont(cont - 1), 650);
    return () => clearTimeout(id);
  }, [cont]);
  const iniciar = () => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) setIniciou(true);
    else setCont(3);
  };
  const reiniciar = useCallback(() => {
    setCont(null);
    setIniciou(false);
  }, []);
  return { cont, iniciou, iniciar, reiniciar };
}

function TelaInicio(props: { titulo: string; linhas: string[]; cont: number | null; onDescer: () => void }) {
  const { titulo, linhas, cont, onDescer } = props;
  return (
    <div className="bloco">
      <pre className="acc">{caixa([titulo, "", ...linhas])}</pre>
      {cont === null ? (
        <button className="btn btn-descer" onClick={onDescer} autoFocus>
          [ DESCER &gt;&gt; ]
        </button>
      ) : (
        <div className="contagem" key={cont} aria-live="assertive">
          {cont > 0 ? cont : "!"}
        </div>
      )}
    </div>
  );
}

function CartaoSemAr({ resposta }: { resposta?: string }) {
  return (
    <div className="bloco" role="status">
      <pre className="bad">
        {caixa(["O AR ACABOU!", "", resposta ? `"${resposta}" não foi aceita a tempo.` : "Sem resposta a tempo.", "", "PROFUNDIDADE  +0 m"])}
      </pre>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Mergulho diário                                                     */
/* ------------------------------------------------------------------ */

function Diario(props: {
  cid: string;
  dia: number | null;
  ar: number;
  onSuperficie: (v: boolean) => void;
  onProfundidade: (m: number) => void;
  onGanho: (g: number) => void;
  onHistorico: (h: Historico) => void;
  onArmazenamento: (m: "redis" | "memoria") => void;
  onTrocarDia: (n: number | null) => void;
  onLivre: () => void;
}) {
  const { cid, dia, ar, onSuperficie, onProfundidade, onGanho, onHistorico, onArmazenamento, onTrocarDia, onLivre } = props;
  const [partida, setPartida] = useState<Partida | null>(null);
  const [mostrando, setMostrando] = useState<string | null>(null);
  const [resultados, setResultados] = useState<Record<string, Resultado>>({});
  const [fim, setFim] = useState<Fim | null>(null);
  const [erro, setErro] = useState("");
  const [enviando, setEnviando] = useState(false);
  const [falhaCarga, setFalhaCarga] = useState("");
  const [copiado, setCopiado] = useState(false);
  const travado = useRef(false);

  const carregar = useCallback(async () => {
    setFalhaCarga("");
    setPartida(null);
    setFim(null);
    setMostrando(null);
    setResultados({});
    setErro("");
    try {
      const q = new URLSearchParams({ cid });
      if (dia !== null) q.set("dia", String(dia));
      const dados = await api<Partida>(`/api/diario?${q.toString()}`);
      setPartida(dados);
      onArmazenamento(dados.armazenamento);
    } catch (e) {
      setFalhaCarga(e instanceof Error ? e.message : "Não foi possível carregar o mergulho.");
    }
  }, [cid, dia, onArmazenamento]);

  useEffect(() => {
    if (cid) void carregar();
  }, [cid, carregar]);

  const respondidas = partida?.respondidas ?? {};
  const profundidade = useMemo(
    () => Object.values(respondidas).reduce((a, r) => a + r.profundidade, 0),
    [respondidas],
  );
  useEffect(() => {
    onProfundidade(profundidade);
  }, [profundidade, onProfundidade]);

  const total = partida?.perguntas.length ?? 7;
  const feitas = partida ? partida.perguntas.filter((p) => respondidas[p.id]).length : 0;
  const proxima = partida?.perguntas.find((p) => !respondidas[p.id]) ?? null;
  const tudoRespondido = !!partida && feitas === total;
  const inicio = useInicio(onSuperficie, !!partida && feitas === 0 && !tudoRespondido);
  const { reiniciar: reiniciarInicio } = inicio;
  useEffect(() => {
    reiniciarInicio();
  }, [dia, cid, reiniciarInicio]);

  // Ao terminar as 7, avisa o servidor e busca a comparação com os outros jogadores.
  useEffect(() => {
    if (!partida || !tudoRespondido || mostrando || fim) return;
    let ativo = true;
    (async () => {
      try {
        const r = await api<Fim & { ok: true }>("/api/finalizar", { dia: partida.numero, cid });
        if (!ativo) return;
        setFim(r);
        const depths = partida.perguntas.map((p) => respondidas[p.id]?.profundidade ?? 0);
        onHistorico(
          salvarRegistro({
            numero: partida.numero,
            total: r.total,
            percentil: r.percentil,
            jogadores: r.jogadores,
            aoVivo: partida.numero === partida.hoje,
            respostas: depths,
            tempoMs: tempoTotal(partida.numero, partida.perguntas),
          }),
        );
      } catch (e) {
        if (ativo) setErro(e instanceof Error ? e.message : "Erro ao finalizar.");
      }
    })();
    return () => {
      ativo = false;
    };
  }, [partida, tudoRespondido, mostrando, fim, cid, respondidas, onHistorico]);

  const registrar = (id: string, resposta: string, profundidade: number, passou: boolean) => {
    setPartida((p) =>
      p ? { ...p, respondidas: { ...p.respondidas, [id]: { resposta, profundidade, passou } } } : p,
    );
    setMostrando(id);
    onGanho(profundidade);
  };

  const enviar = async (texto: string, info: { expirou: boolean; ms: number }) => {
    if (!partida || !proxima || travado.current) return;
    travado.current = true;
    const alvo = proxima;
    setEnviando(true);
    setErro("");
    try {
      if (!texto) throw new Error("");
      const r = await api<RespostaApi>("/api/responder", {
        escopo: "diario",
        dia: partida.numero,
        promptId: alvo.id,
        resposta: texto,
        cid,
      });
      salvarTempo(partida.numero, alvo.id, info.ms);
      setResultados((x) => ({ ...x, [alvo.id]: r }));
      registrar(alvo.id, r.resposta, r.profundidade, !!r.passou);
    } catch (e) {
      if (info.expirou) {
        // o ar acabou e a resposta não valeu: a pergunta fica com 0 m
        try {
          const r = await api<RespostaApi>("/api/responder", {
            escopo: "diario",
            dia: partida.numero,
            promptId: alvo.id,
            passou: true,
            cid,
          });
          salvarTempo(partida.numero, alvo.id, info.ms);
          setResultados((x) => ({ ...x, [alvo.id]: r }));
          registrar(alvo.id, r.resposta, r.profundidade, !!r.passou);
        } catch (e2) {
          setErro(e2 instanceof Error ? e2.message : "Erro ao enviar.");
        }
      } else {
        setErro(e instanceof Error ? e.message : "Erro ao enviar.");
      }
    } finally {
      travado.current = false;
      setEnviando(false);
    }
  };

  const relogio = useRelogio(partida?.proximoEm ?? null);

  if (falhaCarga) {
    return (
      <div className="bloco">
        <div className="bad">{falhaCarga}</div>
        <button className="btn" onClick={() => void carregar()}>
          [ TENTAR DE NOVO ]
        </button>
      </div>
    );
  }
  if (!partida) {
    return <div className="bloco dim pisca">descendo</div>;
  }

  const ehHoje = partida.numero === partida.hoje;
  const cabecalho = (
    <div className="dim">
      MERGULHO #{partida.numero} · {dataBonita(partida.data)}
      {ehHoje ? "" : " · arquivo"}
    </div>
  );

  // 1) mostrando o resultado de uma resposta
  if (mostrando && (resultados[mostrando] || respondidas[mostrando]?.passou)) {
    const indice = partida.perguntas.findIndex((p) => p.id === mostrando);
    const pergunta = partida.perguntas[indice];
    return (
      <div>
        {cabecalho}
        <div className="bloco">
          <span className="dim">
            {indice + 1}/{total} ·{" "}
          </span>
          {pergunta.texto}
        </div>
        {respondidas[mostrando]?.passou ? (
          <CartaoSemAr />
        ) : (
          <CartaoResultado res={resultados[mostrando]} />
        )}
        <button className="btn" onClick={() => setMostrando(null)} autoFocus>
          {feitas >= total ? "[ VER MEU MERGULHO ]" : "[ PRÓXIMA PERGUNTA ]"}
        </button>
      </div>
    );
  }

  // 2) as 7 respondidas: tela final
  if (tudoRespondido) {
    if (!fim) {
      return (
        <div>
          {cabecalho}
          {erro ? <div className="erro">{erro}</div> : <div className="bloco dim pisca">calculando seu mergulho</div>}
        </div>
      );
    }
    const zona = zonaDe(fim.total);
    const depths = partida.perguntas.map((p) => respondidas[p.id]?.profundidade ?? 0);
    const url = typeof window !== "undefined" ? window.location.origin : "";
    const tempoMs = tempoTotal(partida.numero, partida.perguntas);
    const texto = textoCompartilhar({
      numero: partida.numero,
      total: fim.total,
      respostas: depths,
      percentil: fim.jogadores > 1 ? fim.percentil : null,
      tempoMs,
      url,
    });
    const copiar = async () => {
      try {
        if (navigator.share && /Mobi|Android/i.test(navigator.userAgent)) {
          await navigator.share({ text: texto });
          return;
        }
        await navigator.clipboard.writeText(texto);
        setCopiado(true);
        setTimeout(() => setCopiado(false), 2200);
      } catch {
        /* usuário cancelou o compartilhamento */
      }
    };
    return (
      <div>
        {cabecalho}
        <CriaturaDaZona metros={fim.total} />
        <div className="bloco">
          <pre className="acc">
            {caixa([
              `MERGULHO #${partida.numero} CONCLUÍDO`,
              "",
              `PROFUNDIDADE FINAL  ${formatar(fim.total)} m`,
              `${zona.nome.toUpperCase()} (${zona.tecnico})`,
              ...(tempoMs ? [`TEMPO  ${formatarTempo(tempoMs)}`] : []),
            ])}
          </pre>
          <p>{zona.frase}</p>
        </div>

        <div className="bloco">
          <div className="dim">VOCÊ x OS OUTROS MERGULHADORES</div>
          {fim.jogadores > 1 && fim.percentil !== null ? (
            <p>
              Você foi mais fundo que <span className="acc">{fim.percentil}%</span> dos outros {fim.jogadores - 1}{" "}
              {fim.jogadores - 1 === 1 ? "jogador" : "jogadores"} neste mergulho.
            </p>
          ) : (
            <p>Você é a primeira pessoa a terminar este mergulho. Volte mais tarde para ver a comparação!</p>
          )}
          <Histograma hist={fim.hist} faixa={fim.faixa} />
          <div className="dim">v = você · {fim.jogadores} {fim.jogadores === 1 ? "mergulhador" : "mergulhadores"}</div>
        </div>

        <div className="bloco">
          <div className="dim">SUAS RESPOSTAS</div>
          <pre>
            {partida.perguntas
              .map((p, i) => {
                const r = respondidas[p.id];
                return `${i + 1}. ${(r?.passou ? "(o ar acabou)" : (r?.resposta ?? "")).slice(0, 18).padEnd(18)} ${barra(r?.profundidade ?? 0, 1000, 8)} ${String(
                  r?.profundidade ?? 0,
                ).padStart(4)}m`;
              })
              .join("\n")}
          </pre>
        </div>

        <div className="bloco">
          <button className="btn" onClick={() => void copiar()}>
            {copiado ? "[ COPIADO! ]" : "[ COMPARTILHAR ]"}
          </button>
          <button className="btn" onClick={onLivre}>
            [ MERGULHO LIVRE ]
          </button>
          {!ehHoje && (
            <button className="btn" onClick={() => onTrocarDia(null)}>
              [ IR PARA HOJE ]
            </button>
          )}
        </div>
        {ehHoje && (
          <div className="dim">
            próximo mergulho em <span className="acc">{relogio}</span>
          </div>
        )}
      </div>
    );
  }

  // 3) tela de início (nenhuma pergunta respondida ainda)
  if (feitas === 0 && !inicio.iniciou) {
    return (
      <div>
        {cabecalho}
        <TelaInicio
          titulo={`MERGULHO #${partida.numero}`}
          linhas={[
            `${total} perguntas`,
            ar > 0 ? `${ar} segundos de ar por pergunta` : "sem relógio de ar",
            "resposta rara = mergulho fundo",
          ]}
          cont={inicio.cont}
          onDescer={inicio.iniciar}
        />
      </div>
    );
  }

  // 4) pergunta atual
  return (
    <div>
      {cabecalho}
      {proxima && (
        <CartaoPergunta
          rotulo={`PERGUNTA ${feitas + 1}/${total}`}
          pergunta={proxima}
          enviando={enviando}
          erro={erro}
          segundos={ar}
          onEnviar={(t, info) => void enviar(t, info)}
        />
      )}
      <div className="dim">
        Quanto mais rara a resposta, mais fundo você desce. Respostas óbvias mal contam.
        {ar > 0 ? " Se o ar acabar, a pergunta vale 0 m." : ""}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Mergulho livre                                                      */
/* ------------------------------------------------------------------ */

function Livre(props: {
  cid: string;
  ar: number;
  onSuperficie: (v: boolean) => void;
  onProfundidade: (m: number) => void;
  onGanho: (g: number) => void;
}) {
  const { cid, ar, onSuperficie, onProfundidade, onGanho } = props;
  const [pergunta, setPergunta] = useState<Pergunta | null>(null);
  const [resultado, setResultado] = useState<Resultado | null>(null);
  const [totalSessao, setTotalSessao] = useState(0);
  const [respondidas, setRespondidas] = useState(0);
  const [erro, setErro] = useState("");
  const [enviando, setEnviando] = useState(false);
  const [falha, setFalha] = useState("");

  const proximaPergunta = useCallback(async () => {
    setFalha("");
    setResultado(null);
    setSemAr(false);
    setErro("");
    try {
      const usadas = lerLivre();
      const r = await api<{ pergunta: Pergunta; reiniciou: boolean }>(
        `/api/livre?excluir=${encodeURIComponent(usadas.join(","))}`,
      );
      if (r.reiniciou) salvarLivre([]);
      setPergunta(r.pergunta);
    } catch (e) {
      setFalha(e instanceof Error ? e.message : "Não foi possível carregar.");
    }
  }, []);

  useEffect(() => {
    void proximaPergunta();
  }, [proximaPergunta]);

  useEffect(() => {
    onProfundidade(Math.min(totalSessao, MAX_PROFUNDIDADE));
  }, [totalSessao, onProfundidade]);

  const [semAr, setSemAr] = useState(false);
  const travado = useRef(false);
  const inicio = useInicio(onSuperficie, !!pergunta && respondidas === 0);

  const enviar = async (texto: string, info: { expirou: boolean; ms: number }) => {
    if (!pergunta || travado.current) return;
    travado.current = true;
    setEnviando(true);
    setErro("");
    try {
      if (!texto) throw new Error("");
      const r = await api<RespostaApi>("/api/responder", {
        escopo: "livre",
        promptId: pergunta.id,
        resposta: texto,
        cid,
      });
      salvarLivre([...new Set([...lerLivre(), pergunta.id])]);
      setResultado(r);
      const ganho = r.repetida ? 0 : r.profundidade;
      setTotalSessao((t) => t + ganho);
      setRespondidas((n) => n + 1);
      onGanho(ganho);
    } catch (e) {
      if (info.expirou) {
        salvarLivre([...new Set([...lerLivre(), pergunta.id])]);
        setSemAr(true);
        setRespondidas((n) => n + 1);
        onGanho(0);
      } else {
        setErro(e instanceof Error ? e.message : "Erro ao enviar.");
      }
    } finally {
      travado.current = false;
      setEnviando(false);
    }
  };

  if (falha) {
    return (
      <div className="bloco">
        <div className="bad">{falha}</div>
        <button className="btn" onClick={() => void proximaPergunta()}>
          [ TENTAR DE NOVO ]
        </button>
      </div>
    );
  }
  if (!pergunta) return <div className="bloco dim pisca">descendo</div>;

  if (respondidas === 0 && !inicio.iniciou) {
    return (
      <div>
        <div className="dim">MERGULHO LIVRE</div>
        <TelaInicio
          titulo="MERGULHO LIVRE"
          linhas={["perguntas sem limite", ar > 0 ? `${ar} segundos de ar por pergunta` : "sem relógio de ar"]}
          cont={inicio.cont}
          onDescer={inicio.iniciar}
        />
      </div>
    );
  }

  return (
    <div>
      <div className="dim">
        MERGULHO LIVRE · sem limite · {respondidas} {respondidas === 1 ? "resposta" : "respostas"} ·{" "}
        {formatar(totalSessao)} m nesta sessão
      </div>
      {resultado || semAr ? (
        <>
          <div className="bloco">{pergunta.texto}</div>
          {resultado ? <CartaoResultado res={resultado} /> : <CartaoSemAr />}
          <button className="btn" onClick={() => void proximaPergunta()} autoFocus>
            [ PRÓXIMA PERGUNTA ]
          </button>
        </>
      ) : (
        <CartaoPergunta
          rotulo="PERGUNTA LIVRE"
          pergunta={pergunta}
          enviando={enviando}
          erro={erro}
          segundos={ar}
          onEnviar={(t, info) => void enviar(t, info)}
        />
      )}
      <div className="dim">As respostas do modo livre valem para o ranking geral de cada pergunta, não para o diário.</div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Arquivo                                                             */
/* ------------------------------------------------------------------ */

function Arquivo(props: { hoje: number | null; historico: Historico; onJogar: (n: number) => void }) {
  const { hoje, historico, onJogar } = props;
  if (!hoje) return <div className="bloco dim pisca">carregando</div>;
  const dias: number[] = [];
  for (let n = hoje; n >= Math.max(1, hoje - 29); n--) dias.push(n);
  return (
    <div>
      <div className="dim">ARQUIVO · os últimos 30 mergulhos</div>
      <div className="bloco lista-dias">
        {dias.map((n) => {
          const r = historico[n];
          return (
            <div key={n}>
              <button className="btn" onClick={() => onJogar(n)}>
                {r ? `[ ver ]` : `[jogar]`}
              </button>{" "}
              #{String(n).padEnd(3)} {n === hoje ? <span className="acc">hoje </span> : <span className="dim">     </span>}
              {r ? (
                <span>
                  {formatar(r.total)} m <span className="dim">{zonaDe(r.total).nome}</span>
                </span>
              ) : (
                <span className="dim">não jogado</span>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Estatísticas pessoais                                               */
/* ------------------------------------------------------------------ */

function Estatisticas(props: { historico: Historico; hoje: number | null }) {
  const { historico, hoje } = props;
  const registros = Object.values(historico).sort((a, b) => a.numero - b.numero);
  if (registros.length === 0) {
    return (
      <div>
        <div className="dim">SUAS ESTATÍSTICAS</div>
        <p>Você ainda não terminou nenhum mergulho. Faça o diário de hoje e volte aqui!</p>
      </div>
    );
  }
  const media = registros.reduce((a, r) => a + r.total, 0) / registros.length;
  const melhor = registros.reduce((a, r) => (r.total > a.total ? r : a));
  const porZona = ZONAS.map((z) => ({
    z,
    n: registros.filter((r) => zonaDe(r.total).id === z.id).length,
  }));
  const maiorZona = Math.max(...porZona.map((p) => p.n), 1);
  const ultimos = registros.slice(-14).reverse();
  const comTempo = registros.filter((r) => r.tempoMs);
  const tempoMedio = comTempo.length ? comTempo.reduce((a, r) => a + (r.tempoMs ?? 0), 0) / comTempo.length : 0;

  return (
    <div>
      <div className="dim">SUAS ESTATÍSTICAS</div>
      <pre className="acc bloco">
        {caixa([
          `mergulhos feitos     ${registros.length}`,
          `profundidade média   ${formatar(media)} m`,
          `melhor mergulho      ${formatar(melhor.total)} m (#${melhor.numero})`,
          `sequência atual      ${hoje ? sequenciaAtual(historico, hoje) : 0}`,
          `melhor sequência     ${melhorSequencia(historico)}`,
          ...(tempoMedio ? [`tempo médio          ${formatarTempo(tempoMedio)}`] : []),
        ])}
      </pre>

      <div className="bloco">
        <div className="dim">ONDE VOCÊ COSTUMA PARAR</div>
        <pre>
          {porZona
            .map(({ z, n }) => `${z.nome.slice(0, 20).padEnd(20)} ${barra(n, maiorZona, 10)} ${n}`)
            .join("\n")}
        </pre>
      </div>

      <div className="bloco">
        <div className="dim">ÚLTIMOS MERGULHOS</div>
        <pre>
          {ultimos
            .map(
              (r) =>
                `#${String(r.numero).padEnd(3)} ${barra(r.total, MAX_PROFUNDIDADE, 14)} ${formatar(r.total).padStart(5)}m` +
                (r.percentil !== null && r.jogadores > 1 ? `  top ${100 - r.percentil}%` : ""),
            )
            .join("\n")}
        </pre>
        <div className="dim">&quot;top X%&quot; compara com os outros jogadores daquele mergulho, no momento em que você terminou.</div>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Ajuda                                                               */
/* ------------------------------------------------------------------ */

function Ajuda() {
  return (
    <div>
      <div className="dim">COMO JOGAR</div>
      <div className="bloco">
        <p>
          Todo dia há <span className="acc">7 perguntas</span>, iguais para todo mundo. Responda cada uma com
          uma palavra ou expressão curta.
        </p>
        <p>
          Quanto <span className="acc">mais rara</span> for a sua resposta, mais fundo você mergulha. Respostas óbvias quase não contam; respostas que ninguém mais deu levam você até 1.000 m
          por pergunta.
        </p>
        <p>
          No fim você vê a profundidade total (até 7.000 m), a zona do oceano em que parou e como se saiu em
          comparação com todo mundo que jogou o mesmo mergulho.
        </p>
      </div>
      <div className="bloco">
        <div className="dim">O AR</div>
        <p>
          Cada pergunta tem um relógio de <span className="acc">ar</span> (25 segundos, por padrão). Se o ar acabar,
          o jogo envia o que você já digitou; se estiver vazio ou não valer, a pergunta fica com 0 m. O relógio para
          enquanto a resposta é conferida. Seu tempo total aparece no final e no texto de compartilhar.
        </p>
        <p className="dim">
          Prefere jogar sem pressa? Use o botão [AR] no topo para trocar entre 25 s, 15 s, 40 s ou sem relógio. A
          pontuação é a mesma.
        </p>
      </div>
      <div className="bloco">
        <div className="dim">ZONAS DO OCEANO</div>
        <pre>
          {ZONAS.map((z, i) => {
            const ate = ZONAS[i + 1]?.de;
            return `${(ate ? `${formatar(z.de)}-${formatar(ate)}` : `${formatar(z.de)}+`).padEnd(12)} m  ${z.nome}`;
          }).join("\n")}
        </pre>
      </div>
      <div className="bloco">
        <div className="dim">REGRAS DAS RESPOSTAS</div>
        <p>
          Acentos, maiúsculas, artigos (o, a, um) e plural não importam: &quot;a Maçã&quot; e &quot;maçãs&quot; contam
          como a mesma resposta. Quando a pergunta pede uma letra, a resposta precisa começar com ela. Palavras
          sem sentido e ofensivas não são aceitas.
        </p>
        <p>
          Palavras que não existem em português são recusadas, e a resposta precisa ser uma palavra de verdade
          mesmo quando for rara.
        </p>
        <p className="dim">
          Como a raridade é calculada: cada pergunta tem um banco de respostas ordenado da mais comum para a
          menos comum, e a posição nele diz quão óbvia a sua resposta é. Respostas fora do banco valem mais,
          principalmente se a palavra for rara no português. Conforme as pessoas jogam, as respostas reais
          vão ajustando tudo, e o peso do banco diminui.
        </p>
      </div>
      <div className="bloco">
        <div className="dim">MODOS</div>
        <p>
          <span className="acc">Diário</span>: o mergulho do dia, com comparação entre jogadores.{" "}
          <span className="acc">Livre</span>: perguntas sem fim, para treinar. <span className="acc">Arquivo</span>:
          mergulhos de dias anteriores.
        </p>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Raiz                                                                */
/* ------------------------------------------------------------------ */

function AvisoZona({ metros }: { metros: number }) {
  const zona = zonaDe(metros);
  return (
    <div className="aviso-zona" role="status" key={zona.id}>
      <pre>{caixa([`>> ${zona.nome.toUpperCase()} <<`, `${zona.tecnico} · ${formatar(zona.de)} m`])}</pre>
    </div>
  );
}

export default function Jogo() {
  const [aba, setAba] = useState<Aba>("diario");
  const [cid, setCid] = useState("");
  const [historico, setHistorico] = useState<Historico>({});
  const [dia, setDia] = useState<number | null>(null);
  const [hoje, setHoje] = useState<number | null>(null);
  const [armazenamento, setArmazenamento] = useState<"redis" | "memoria">("redis");
  const [profundidade, setProfundidade] = useState(0);
  const [local, setLocal] = useState(true);
  const [ar, setAr] = useState(25);
  const [ganho, setGanho] = useState({ valor: 0, chave: 0 });
  const [treme, setTreme] = useState(false);
  const [aviso, setAviso] = useState(false);
  const [superficie, setSuperficie] = useState(false);

  useEffect(() => {
    setCid(obterCid());
    setHistorico(lerHistorico());
    setAr(lerAr());
    setLocal(["localhost", "127.0.0.1"].includes(window.location.hostname));
    api<{ hoje: number }>("/api/diario")
      .then((d) => setHoje(d.hoje))
      .catch(() => undefined);
  }, []);

  const metros = useContagem(profundidade - (superficie ? 14 : 0));
  const fundo = corDeFundo(Math.max(0, metros));

  const trocarAr = () => {
    const i = OPCOES_AR.indexOf(ar as (typeof OPCOES_AR)[number]);
    const proximo = OPCOES_AR[(i + 1) % OPCOES_AR.length];
    setAr(proximo);
    salvarAr(proximo);
  };

  const aoGanhar = useCallback((valor: number) => {
    setGanho((g) => ({ valor, chave: g.chave + 1 }));
    if (valor >= 800) {
      setTreme(true);
      setTimeout(() => setTreme(false), 650);
    }
  }, []);

  // aviso quando o mergulho cruza para uma zona mais funda
  const zonaIdx = ZONAS.findIndex((z) => z.id === zonaDe(metros).id);
  const zonaAnterior = useRef(zonaIdx);
  useEffect(() => {
    if (zonaIdx > zonaAnterior.current) {
      setAviso(true);
      setTreme(true);
      const a = setTimeout(() => setTreme(false), 650);
      const b = setTimeout(() => setAviso(false), 2600);
      zonaAnterior.current = zonaIdx;
      return () => {
        clearTimeout(a);
        clearTimeout(b);
      };
    }
    zonaAnterior.current = zonaIdx;
  }, [zonaIdx]);

  const irPara = (nova: Aba) => {
    if (nova === "diario") {
      setDia(null);
    }
    setAba(nova);
  };

  const abrirDia = (n: number) => {
    setDia(n === hoje ? null : n);
    setAba("diario");
  };

  const p = Math.min(1, Math.max(0, metros) / MAX_PROFUNDIDADE);
  const luz = Math.max(0, 1 - metros / 1500);
  const zonaAtual = zonaDe(Math.max(0, metros));
  const [menu, setMenu] = useState(false);
  const rotuloAba = NOMES_ABAS.find((a) => a.id === aba)?.rotulo ?? "";

  return (
    <div className="app" style={{ ["--fundo" as string]: fundo, ["--p" as string]: p.toFixed(3), ["--luz" as string]: luz.toFixed(3) }}>
      <Cena metros={metros} ganho={ganho.valor} chaveGanho={ganho.chave} />
      {aviso && <AvisoZona metros={metros} />}

      <header className="barra">
        <button className="btn marca" onClick={() => irPara("diario")} aria-label="ABISSO, ir para o mergulho diário">
          ABISSO
        </button>
        <span className="hud" aria-live="off">
          <span className="acc">{formatar(Math.max(0, metros))} m</span>
          <span className="dim"> · {zonaAtual.nome}</span>
        </span>
        <span className="barra-fim">
          <button
            className="btn suave"
            onClick={trocarAr}
            title="Trocar o tempo de ar de cada pergunta"
            aria-label={ar ? `Tempo de ar: ${ar} segundos. Trocar.` : "Sem relógio de ar. Trocar."}
          >
            [AR {ar ? `${ar}s` : "sem"}]
          </button>
          <button className="btn" onClick={() => setMenu((m) => !m)} aria-expanded={menu} aria-haspopup="true">
            [{menu ? "X" : rotuloAba}]
          </button>
        </span>
        {menu && (
          <nav className="menu" aria-label="Menu">
            {NOMES_ABAS.map((a) => (
              <button
                key={a.id}
                className={"btn" + (aba === a.id ? " ativo" : "")}
                onClick={() => {
                  irPara(a.id);
                  setMenu(false);
                }}
                aria-current={aba === a.id ? "page" : undefined}
              >
                {a.rotulo}
              </button>
            ))}
          </nav>
        )}
      </header>

      <div className={"palco" + (treme ? " treme" : "")}>
        <main className="painel">
          {aba === "diario" && (
            <Diario
              cid={cid}
              dia={dia}
              ar={ar}
              onSuperficie={setSuperficie}
              onProfundidade={setProfundidade}
              onGanho={aoGanhar}
              onHistorico={setHistorico}
              onArmazenamento={setArmazenamento}
              onTrocarDia={setDia}
              onLivre={() => irPara("livre")}
            />
          )}
          {aba === "livre" && cid && (
            <Livre cid={cid} ar={ar} onSuperficie={setSuperficie} onProfundidade={setProfundidade} onGanho={aoGanhar} />
          )}
          {aba === "arquivo" && <Arquivo hoje={hoje} historico={historico} onJogar={abrirDia} />}
          {aba === "stats" && <Estatisticas historico={historico} hoje={hoje} />}
          {aba === "ajuda" && <Ajuda />}
          {armazenamento === "memoria" && !local && (
            <div className="aviso">
              Atenção (dono do site): sem Redis conectado as estatísticas não são salvas de forma permanente.
              Veja o README para ligar o Upstash Redis na Vercel.
            </div>
          )}
        </main>
      </div>

      <footer className="rodape">ABISSO · seus dados de jogo ficam só neste navegador</footer>
    </div>
  );
}
