import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "ABISSO — o mergulho diário",
  description:
    "Sete perguntas por dia, iguais para todo mundo. Respostas raras te levam mais fundo no oceano; as óbvias mal contam. Até onde você desce?",
  openGraph: {
    title: "ABISSO — o mergulho diário",
    description: "Sete perguntas por dia. Respostas raras te levam mais fundo. Até onde você desce?",
    type: "website",
    locale: "pt_BR",
  },
};

export const viewport: Viewport = {
  themeColor: "#01040a",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR">
      <body>{children}</body>
    </html>
  );
}
