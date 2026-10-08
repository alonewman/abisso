"use client";

import { useEffect, useRef, useState } from "react";
import { posicaoKrill, quadroComoHtml, quadroDaCena } from "@/lib/cena";
import { formatar } from "@/lib/zonas";

/** Cena ASCII em tela cheia, atrás de toda a interface. O krill nada no lugar e o oceano passa por ele. */
export function Cena({ metros, ganho, chaveGanho }: { metros: number; ganho: number; chaveGanho: number }) {
  const pre = useRef<HTMLPreElement>(null);
  const medida = useRef<HTMLSpanElement>(null);
  const [tam, setTam] = useState({ w: 80, h: 30, cw: 8, lh: 16 });
  const estado = useRef({ metros, t: 0, v: 0, ult: 0, m: metros, reduz: false });
  estado.current.metros = metros;

  // mede o caractere e calcula quantas colunas/linhas cabem na tela
  useEffect(() => {
    const medir = () => {
      const el = medida.current;
      if (!el) return;
      const r = el.getBoundingClientRect();
      const cw = r.width / 10 || 8;
      const lh = r.height || 16;
      setTam({
        w: Math.min(220, Math.ceil(window.innerWidth / cw) + 1),
        h: Math.min(90, Math.ceil(window.innerHeight / lh) + 1),
        cw,
        lh,
      });
    };
    medir();
    window.addEventListener("resize", medir);
    return () => window.removeEventListener("resize", medir);
  }, []);

  useEffect(() => {
    const s = estado.current;
    s.reduz = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const inicio = performance.now();
    const desenhar = () => {
      const agora = (performance.now() - inicio) / 1000;
      const dt = agora - s.ult;
      if (dt > 0.03) {
        const inst = (s.metros - s.m) / dt;
        s.v = s.v * 0.4 + inst * 0.6;
        s.m = s.metros;
        s.ult = agora;
      }
      const vel = s.reduz ? 0 : Math.min(1, Math.max(0, s.v / 450));
      const quadro = quadroDaCena(s.metros, s.reduz ? 0 : agora, vel, tam.w, tam.h);
      if (pre.current) pre.current.innerHTML = quadroComoHtml(quadro);
    };
    desenhar();
    if (s.reduz) {
      const id = setInterval(desenhar, 400); // quadro parado, só acompanha a profundidade
      return () => clearInterval(id);
    }
    const id = setInterval(desenhar, 90);
    return () => clearInterval(id);
  }, [tam]);

  const k = posicaoKrill(tam.w, tam.h);
  return (
    <>
      <div className="cena-tela" aria-hidden="true">
      <span ref={medida} className="cena-medida">
        MMMMMMMMMM
      </span>
      <pre ref={pre} style={{ lineHeight: `${tam.lh}px` }} />
      </div>
      {ganho > 0 && (
        <div
          key={chaveGanho}
          className="ganho"
          style={{ left: (k.coluna + 18) * tam.cw, top: (k.linha - 4) * tam.lh }}
        >
          +{formatar(ganho)} m
        </div>
      )}
    </>
  );
}
