import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

const schema = z.object({
  imageDataUrl: z.string().min(20),
});

export type Questao = {
  numero: string;
  pergunta: string;
  resposta: string;
  resumo: string;
  explicacao: string;
};

export const extractHomeworkText = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => schema.parse(data))
  .handler(async ({ data }) => {
    const apiKey = process.env["LOVABLE_API_KEY"];
    if (!apiKey) throw new Error("Chave de IA não configurada.");

    const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-3.7-flash",
        response_format: { type: "json_object" },
        messages: [
          {
            role: "system",
            content:
              'Você é um professor particular. Leia a imagem da lição de casa e responda APENAS com json válido neste formato: {"titulo": string, "questoes": [{"numero": string, "pergunta": string, "resposta": string, "resumo": string, "explicacao": string}]}. Uma entrada por questão da página, na ordem em que aparecem. "numero" é só o número/letra da questão (ex: "1", "2a"). "pergunta" é o enunciado transcrito. "resposta" é a resposta completa. "resumo" é a mesma resposta em no máximo 8 palavras; se a resposta já for curta e não der para resumir, repita a resposta em "resumo". "explicacao" tem no máximo 2 frases simples (mostre as contas em matemática). Escreva tudo em português. Não invente questões; se algo estiver ilegível, escreva isso na resposta.',
          },
          {
            role: "user",
            content: [
              { type: "text", text: "Leia esta página e responda as questões." },
              { type: "image_url", image_url: { url: data.imageDataUrl } },
            ],
          },
        ],
      }),
    });

    if (res.status === 429) throw new Error("Muitas requisições. Tente novamente em instantes.");
    if (res.status === 402) throw new Error("Créditos de IA esgotados. Adicione créditos no Lovable AI.");
    if (!res.ok) throw new Error("Falha ao processar a imagem.");

    const json = (await res.json()) as {
      choices?: Array<{ message?: { content?: string } }>;
    };
    const raw = json.choices?.[0]?.message?.content ?? "";
    if (!raw) throw new Error("Não foi possível ler a imagem.");

    const cleaned = raw.replace(/^```json\s*/i, "").replace(/```$/, "").trim();
    let parsed: { titulo?: string; questoes?: Questao[] };
    try {
      parsed = JSON.parse(cleaned);
    } catch {
      throw new Error("Não foi possível organizar as questões. Tente outra foto.");
    }

    const questoes = (parsed.questoes ?? []).map((q, i) => ({
      numero: String(q?.numero ?? i + 1),
      pergunta: String(q?.pergunta ?? ""),
      resposta: String(q?.resposta ?? ""),
      resumo: String(q?.resumo ?? q?.resposta ?? ""),
      explicacao: String(q?.explicacao ?? ""),
    }));

    if (questoes.length === 0) throw new Error("Nenhuma questão encontrada nesta foto.");

    return { titulo: parsed.titulo ?? "", questoes };
  });

const solvedSchema = z.object({
  imageDataUrl: z.string().min(20),
  handwritingDataUrl: z.string().min(20).optional(),
  respostas: z
    .array(z.object({ numero: z.string(), resposta: z.string() }))
    .optional(),
});

export const generateSolvedPhoto = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => solvedSchema.parse(data))
  .handler(async ({ data }) => {
    const apiKey = process.env["LOVABLE_API_KEY"];
    if (!apiKey) throw new Error("Chave de IA não configurada.");

    const regras =
      " REGRAS OBRIGATÓRIAS DE PREENCHIMENTO: 1) Varra a página inteira de cima até embaixo, da esquerda para a direita, e localize TODAS as questões, itens, subitens (a, b, c), linhas pontilhadas, espaços em branco, tabelas e alternativas. 2) Responda CADA questão individualmente, escrevendo a resposta exatamente no espaço em branco daquela questão (na linha/lacuna correspondente). 3) NUNCA agrupe respostas de várias questões em um mesmo lugar e NUNCA escreva um bloco de texto solto na margem. 4) NÃO pule nenhuma questão: se houver 10 questões, devem existir 10 respostas manuscritas, cada uma no seu lugar. 5) Em alternativas de múltipla escolha, marque apenas UMA alternativa por questão (um X ou círculo na letra correta) e não marque nenhuma outra. 6) Não escreva nada em áreas que não sejam espaços de resposta.";

    const listaRespostas =
      data.respostas && data.respostas.length > 0
        ? " Use exatamente estas respostas, cada uma na sua questão: " +
          data.respostas
            .map((r) => `questão ${r.numero}: ${r.resposta}`)
            .join(" | ") +
          "."
        : "";

    const texto =
      (data.handwritingDataUrl
        ? "A PRIMEIRA imagem é a página limpa da lição de casa. A SEGUNDA imagem é uma amostra da letra manuscrita do aluno. Gere novamente a PRIMEIRA página, idêntica no papel, na iluminação e no enquadramento, mas agora com todas as questões respondidas corretamente à mão, imitando a letra da SEGUNDA imagem. A escrita deve ser feita a LÁPIS (grafite), com traço bem fraco, claro e acinzentado, com variação de pressão e alguns pontos quase apagados. A letra deve ser visivelmente TORTA e irregular: linhas de base onduladas, inclinação inconsistente, tamanho variando, espaçamento desigual e pequenos borrões/apagões de borracha. Não copie o conteúdo escrito na segunda imagem, apenas o estilo da letra. Não mude o texto impresso, não adicione marcas d'água nem texto extra."
        : "Esta é a foto de uma lição de casa. Gere a MESMA página, idêntica no papel, na iluminação e no enquadramento, mas agora com todas as questões respondidas corretamente à mão, escritas a LÁPIS (grafite) com traço bem fraco, claro e acinzentado. A letra deve ser de estudante, visivelmente TORTA e irregular: linhas de base onduladas, inclinação inconsistente, tamanho variando, espaçamento desigual, variação de pressão e alguns trechos quase apagados, com pequenas marcas de borracha. Não mude o texto impresso, não adicione marcas d'água nem texto extra.") +
      regras +
      listaRespostas;



    const res = await fetch("https://ai.gateway.lovable.dev/v1/images/generations", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-3.1-flash-image",
        messages: [
          {
            role: "user",
            content: [
              { type: "text", text: texto },
              { type: "image_url", image_url: { url: data.imageDataUrl } },
              ...(data.handwritingDataUrl
                ? [{ type: "image_url", image_url: { url: data.handwritingDataUrl } }]
                : []),
            ],
          },
        ],
        modalities: ["image", "text"],
      }),
    });

    if (res.status === 429) throw new Error("Muitas requisições. Tente novamente em instantes.");
    if (res.status === 402) throw new Error("Créditos de IA esgotados. Adicione créditos no Lovable AI.");
    if (!res.ok) throw new Error("Não foi possível gerar a foto resolvida.");

    const json = (await res.json()) as { data?: Array<{ b64_json?: string }> };
    const b64 = json.data?.[0]?.b64_json;
    if (!b64) throw new Error("A IA não retornou a foto resolvida.");

    return { imageDataUrl: `data:image/png;base64,${b64}` };
  });
