# ABISSO · o mergulho diário

Jogo de palavras diário em ASCII, em português. Todo dia há **7 perguntas**, iguais para todo mundo.
Quanto **mais rara** for a sua resposta entre os outros jogadores, **mais fundo** você mergulha no oceano
(até 1.000 m por pergunta, 7.000 m no total). Respostas óbvias quase não contam.

Ao terminar, você vê a profundidade final, a zona do oceano onde parou e **como se saiu em comparação com
todo mundo que jogou aquele mesmo mergulho** (percentil + histograma), com texto para compartilhar, estilo Termo.

## O que tem

- **Diário**: 7 perguntas por dia (muda à meia-noite de Brasília), com comparação entre jogadores.
- **Livre**: perguntas sem limite, para treinar. As respostas contam para o ranking geral de cada pergunta.
- **Arquivo**: os últimos 30 mergulhos, para quem perdeu um dia.
- **Estatísticas**: mergulhos feitos, profundidade média, melhor mergulho, sequência, onde você costuma parar.
- **98 perguntas** no banco (14 dias sem repetir), algumas com letra obrigatória, cada uma com dezenas de respostas ranqueadas.
- Visual todo em ASCII: coluna de profundidade com o krill descendo, bolhas, criatura da zona, histograma.

## Rodar localmente

```bash
npm install
npm run dev        # http://localhost:3000
npm run verificar  # confere o banco de perguntas e a lógica
```

Sem Redis configurado, as estatísticas ficam na memória do processo (ótimo para testar, some ao reiniciar).

## Publicar na Vercel

1. Suba esta pasta para um repositório no GitHub.
2. Na Vercel: **Add New → Project** e importe o repositório (nenhuma configuração extra é necessária).
3. **Importante:** conecte um Redis para as estatísticas ficarem salvas. Na página do projeto:
   **Storage → Marketplace → Upstash Redis → Connect Project**. A Vercel preenche sozinha as variáveis
   `KV_REST_API_URL` e `KV_REST_API_TOKEN` (também funcionam `UPSTASH_REDIS_REST_URL` e `UPSTASH_REDIS_REST_TOKEN`).
4. Faça um **Redeploy**. Pronto.

> Sem o passo 3 o site funciona, mas as estatísticas globais não persistem (cada execução serverless
> começa do zero) e o jogo mostra um aviso no rodapé.

Dica: escolha a região do Redis próxima da região das funções da Vercel para as respostas ficarem rápidas.

### Variáveis de ambiente

| Variável | Para quê |
| --- | --- |
| `KV_REST_API_URL` / `KV_REST_API_TOKEN` (ou `UPSTASH_REDIS_REST_*`) | Redis das estatísticas |
| `ABISSO_LANCAMENTO` | Data do mergulho nº 1, `AAAA-MM-DD`. Padrão: `2026-10-08` |

## Como a pontuação funciona

- A resposta é **normalizada**: sem acento, sem maiúsculas, sem artigos e ligações (o, a, um, de, com, e…),
  com plural simplificado. "As Maçãs" e "maçã" são a mesma resposta.
- `share` = fração dos jogadores que deu a mesma resposta naquela pergunta.
- Profundidade da resposta = `100 × log2(1 / share)`, limitada a 0–1.000 m.
- Zonas pelo total do dia: Luz (0–500 m), Crepúsculo (500–1.500), Meia-Noite (1.500–3.500),
  Abismo (3.500–5.500) e Fossa Hadal (5.500+).
- O total e o percentil são sempre calculados **no servidor**, a partir das respostas que ele guardou.

### Raridade sem jogadores (e com eles)

A raridade **não depende de ter jogadores**. Ela vem de três camadas (`lib/estatisticas.ts`):

1. **Banco de respostas por pergunta** (`lib/prompts.ts`): cada pergunta traz uma lista ranqueada, da resposta
   mais comum para a menos comum (média de 41 respostas por pergunta, 4.000+ no total). A posição na lista vira
   uma probabilidade (lei de potência) e cerca de 22% da probabilidade fica reservada para respostas fora da lista.
2. **Dicionário de frequência do português** (`data/frequencia-pt.json`, ~150 mil palavras): uma resposta fora da
   lista vale mais quanto mais rara for a palavra. Palavras que não existem em português são recusadas
   ("Não reconheci essa palavra"), o que também barra textos sem sentido.
3. **Jogadores reais** entram por cima, como média ponderada: o banco pesa como 200 jogadores virtuais. Com 200
   respostas reais, banco e realidade têm o mesmo peso; depois disso a realidade domina. A própria resposta nunca
   conta contra si mesma.

Exemplo, sem nenhum jogador, em "Uma fruta": banana ≈ 270 m, a 20ª da lista ≈ 680 m, a última ≈ 810 m, uma palavra
comum fora da lista ≈ 970 m e uma palavra rara fora da lista = 1.000 m.

Só a **comparação final** ("mais fundo que X% dos outros") precisa de jogadores de verdade.

Os dados de frequência vêm do projeto [wordfreq](https://github.com/rspeer/wordfreq) (CC BY-SA 4.0), e
`data/frequencia-pt.json` é derivado deles (para regenerar: `pip install wordfreq` e
`python3 scripts/gerar_frequencia.py data/frequencia-pt.json`).

## Adicionar perguntas

Edite `lib/prompts.ts`. Cada linha é `pergunta | letra obrigatória (ou vazio) | respostas, da mais comum para a menos comum`.
Escreva pelo menos 30 a 50 respostas por pergunta: quanto melhor a lista, mais justa a raridade.
Acrescente **sempre no fim e em grupos de 7**, para não embaralhar os dias já jogados. Depois rode `npm run verificar`:
ele checa se as respostas são válidas, sem duplicatas, se respeitam a letra, se nenhum dia repete pergunta e se a
pontuação continua fazendo sentido (a 1ª da lista rasa, respostas fora da lista fundas).

## Antiabuso (o que existe e o que não existe)

- Cada identificador anônimo responde uma única vez por pergunta (guardado no servidor).
- Limite de 90 respostas por minuto por IP; respostas sem sentido (sem vogais, teclado aleatório, repetição)
  e palavrões são recusados.
- Não há contas: quem limpa os dados do navegador vira um novo jogador e pode jogar de novo, o que é
  esperado num jogo casual. Se o jogo crescer, o próximo passo é adicionar login e um filtro de dicionário.

## Estrutura

```
app/                 páginas e rotas de API (diario, responder, finalizar, livre)
components/          interface (Jogo.tsx) e peças ASCII (ui.tsx)
lib/prompts.ts       banco de perguntas e sorteio diário
lib/normalizar.ts    normalização e validação das respostas
lib/estatisticas.ts  raridade e ranking das respostas (modelo + dicionário + jogadores)
lib/dicionario.ts    dicionário de frequência do português (só servidor)
data/                frequencia-pt.json (palavras + frequência)
lib/armazenamento.ts Redis (Upstash REST) com fallback em memória
scripts/verificar.ts testes do banco e da lógica
```
