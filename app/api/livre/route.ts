import { PERGUNTAS, publica } from "@/lib/prompts";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const url = new URL(req.url);
  const excluidas = new Set(
    (url.searchParams.get("excluir") ?? "")
      .split(",")
      .filter((id) => /^p\d{3}$/.test(id)),
  );
  let candidatas = PERGUNTAS.filter((p) => !excluidas.has(p.id));
  const reiniciou = candidatas.length === 0;
  if (reiniciou) candidatas = PERGUNTAS;
  const escolhida = candidatas[Math.floor(Math.random() * candidatas.length)];
  return Response.json({
    pergunta: publica(escolhida),
    restantes: candidatas.length - 1,
    total: PERGUNTAS.length,
    reiniciou,
  });
}
