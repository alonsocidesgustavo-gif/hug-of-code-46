import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

const schema = z.object({
  imageDataUrl: z.string().min(20),
});

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
        model: "google/gemini-2.5-flash",
        messages: [
          {
            role: "system",
            content:
              "Você é um professor particular. A partir da imagem de uma página de lição de casa: 1) transcreva TUDO que está escrito, em português, mantendo a estrutura, usando seções em markdown: Cabeçalho, Enunciados, Questões (numeradas), Textos de apoio, Anotações; 2) escreva '## Texto corrido' com tudo em um texto contínuo; 3) escreva '## Respostas' resolvendo cada questão numerada, com a resposta final clara e uma explicação curta e simples do raciocínio (mostre as contas quando for matemática). Não invente conteúdo que não está na página; se uma questão estiver ilegível ou incompleta, diga isso.",
          },
          {
            role: "user",
            content: [
              { type: "text", text: "Extraia todo o conteúdo desta página e responda as questões." },

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
    const text = json.choices?.[0]?.message?.content ?? "";
    if (!text) throw new Error("Não foi possível ler a imagem.");
    return { text };
  });
