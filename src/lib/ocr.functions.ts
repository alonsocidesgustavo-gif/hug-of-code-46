import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

const schema = z.object({
  imageDataUrl: z.string().min(20),
});

export type Questao = {
  numero: string;
  pergunta: string;
  resposta: string;
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
        model: "google/gemini-2.5-flash",
        response_format: { type: "json_object" },
        messages: [
          {
            role: "system",
            content:
              "Você é um professor particular. Leia a imagem da lição de casa e responda APENAS com json válido neste formato: {\"titulo\": string, \"questoes\": [{\"numero\": string, \"pergunta\": string, \"resposta\": string, \"explicacao\": string}]}. Uma entrada por questão da página, na ordem em que aparecem. 'numero' é só o número/letra da questão (ex: \"1\", \"2a\"). 'pergunta' é o enunciado transcrito. 'resposta' é curta e direta. 'explicacao' tem no máximo 2 frases simples (mostre as contas em matemática). Escreva tudo em português. Não invente questões; se algo estiver ilegível, escreva isso na resposta.",
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
      explicacao: String(q?.explicacao ?? ""),
    }));

    if (questoes.length === 0) throw new Error("Nenhuma questão encontrada nesta foto.");

    return { titulo: parsed.titulo ?? "", questoes };
  });
