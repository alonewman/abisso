"use client";

import { useEffect, useRef, useState } from "react";
import { LARGURA, quadroDaCena } from "@/lib/cena";
import { formatar, zonaDe } from "@/lib/zonas";

/** Janela ASCII para o oceano: o krill nada no lugar e o cenário passa por ele conforme a profundidade muda. */
export function Cena({ metros, ganho, chaveGanho }: { metros: number; ganho: number; chaveGanho: number }) {
  const [t, setT] = useState(0);
  const [reduz, setReduz] = useState(false);
  const mem = useRef({ m: metros, t: 0, v: 0 });

  useEffect(() => {
    const r = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    setReduz(r);
    if (r) return;
    const inicio = performance.now();
    const id = setInterval(() => setT((performance.now() - inicio) / 1000), 66);
    return () => clearInterval(id);
  }, []);

  // velocidade de descida (m/s), suavizada, para os riscos de movimento
  const dt = t - mem.current.t;
  if (dt > 0.03) {
    const instantanea = (metros - mem.current.m) / dt;
    mem.current.v = mem.current.v * 0.4 + instantanea * 0.6;
    mem.current.m = metros;
    mem.current.t = t;
  }
  const velocidade = reduz ? 0 : Math.min(1, Math.max(0, mem.current.v / 450));

  const quadro = quadroDaCena(metros, t, velocidade);
  const zona = zonaDe(metros);
  const borda = "+" + "-".repeat(LARGURA) + "+";

  return (
    <div className="cena" role="img" aria-label={`Mergulho a ${formatar(metros)} metros: ${zona.nome}`}>
      <pre aria-hidden="true">
        <span className="c-borda">{borda + "\n"}</span>
        {quadro.map((linha, y) => (
          <span key={y}>
            <span className="c-borda">|</span>
            {linha.map((trecho, i) => (
              <span key={i} className={trecho.cls ? "c-" + trecho.cls : undefined}>
                {trecho.texto}
              </span>
            ))}
            <span className="c-borda">{"|\n"}</span>
          </span>
        ))}
        <span className="c-borda">{borda}</span>
      </pre>
      <div className="cena-hud">
        <span className="acc">{formatar(metros)} m</span> <span className="dim">· {zona.nome}</span>
      </div>
      {ganho > 0 && (
        <div key={chaveGanho} className="ganho" aria-hidden="true">
          +{formatar(ganho)} m
        </div>
      )}
    </div>
  );
}
