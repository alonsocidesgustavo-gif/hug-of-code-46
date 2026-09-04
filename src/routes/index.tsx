import { createFileRoute } from "@tanstack/react-router";
import { useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { extractHomeworkText, generateSolvedPhoto } from "@/lib/ocr.functions";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Loader2, Upload, Copy, RefreshCw, ImageDown, Sparkles, PenLine } from "lucide-react";
import { toast } from "sonner";
import { Toaster } from "@/components/ui/sonner";

export const Route = createFileRoute("/")({
  component: Index,
  head: () => ({
    meta: [
      { title: "Lição Fácil — Resolva sua lição de casa por foto" },
      {
        name: "description",
        content:
          "Envie a foto da sua lição de casa, receba as questões organizadas por número, respostas resumidas e até uma foto da página já preenchida.",
      },
      { property: "og:title", content: "Lição Fácil — Resolva sua lição por foto" },
      {
        property: "og:description",
        content: "Foto da página em, questões numeradas, respostas resumidas e foto resolvida fora.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
});

function Index() {
  const extract = useServerFn(extractHomeworkText);
  const solvePhoto = useServerFn(generateSolvedPhoto);
  const inputRef = useRef<HTMLInputElement>(null);
  const handwritingRef = useRef<HTMLInputElement>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [handwriting, setHandwriting] = useState<string | null>(null);
  const [result, setResult] = useState<Awaited<ReturnType<typeof extract>> | null>(null);
  const [loading, setLoading] = useState(false);
  const [resumido, setResumido] = useState(true);
  const [solved, setSolved] = useState<string | null>(null);
  const [solving, setSolving] = useState(false);

  async function toDataUrl(file: File) {
    return await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  }

  async function handleHandwriting(file: File) {
    if (file.size > 8 * 1024 * 1024) {
      toast.error("Imagem muito grande (máx. 8MB).");
      return;
    }
    setHandwriting(await toDataUrl(file));
    setSolved(null);
  }

  async function handleFile(file: File) {
    if (file.size > 8 * 1024 * 1024) {
      toast.error("Imagem muito grande (máx. 8MB).");
      return;
    }
    const dataUrl = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
    setPreview(dataUrl);
    setResult(null);
    setSolved(null);
    setLoading(true);
    try {
      const res = await extract({ data: { imageDataUrl: dataUrl } });
      setResult(res);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erro ao processar a imagem.");
    } finally {
      setLoading(false);
    }
  }

  async function handleSolvedPhoto() {
    if (!preview) return;
    setSolving(true);
    try {
      const res = await solvePhoto({
        data: {
          imageDataUrl: preview,
          ...(handwriting ? { handwritingDataUrl: handwriting } : {}),
        },
      });
      setSolved(res.imageDataUrl);
      toast.success("Foto resolvida pronta!");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erro ao gerar a foto.");
    } finally {
      setSolving(false);
    }
  }

  function copiar(comRespostas: boolean) {
    if (!result) return;
    const texto = result.questoes
      .map((q) => {
        const linha = `${q.numero}) ${q.pergunta}`;
        if (!comRespostas) return linha;
        return `${linha}\nResposta: ${resumido ? q.resumo || q.resposta : q.resposta}`;
      })
      .join("\n\n");
    void navigator.clipboard.writeText(texto);
    toast.success(comRespostas ? "Questões e respostas copiadas!" : "Questões copiadas!");
  }

  return (
    <div className="min-h-screen bg-background">
      <Toaster />
      <header className="border-b border-border bg-card/60 backdrop-blur">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-6 py-5">
          <span className="text-lg font-semibold tracking-tight text-primary">Lição Fácil</span>
          <span className="text-sm text-muted-foreground">Foto → lição resolvida</span>
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-6 py-12">
        <h1 className="text-4xl font-bold tracking-tight text-foreground sm:text-5xl">
          Envie a foto da lição e receba tudo{" "}
          <span className="text-primary">organizado e respondido</span>
        </h1>
        <p className="mt-4 max-w-2xl text-muted-foreground">
          As questões vêm separadas por número, com resposta resumida ou completa, e você ainda pode
          gerar uma foto da página já preenchida à mão.
        </p>

        <div className="mt-10 grid gap-6 md:grid-cols-2">
          <div className="space-y-6">
            <Card
              className="flex min-h-72 cursor-pointer flex-col items-center justify-center gap-3 border-2 border-dashed border-primary/30 bg-primary/5 p-6 text-center transition hover:border-primary/60"
              onClick={() => inputRef.current?.click()}
              onDragOver={(e) => e.preventDefault()}
              onDrop={(e) => {
                e.preventDefault();
                const f = e.dataTransfer.files?.[0];
                if (f) void handleFile(f);
              }}
            >
              {preview ? (
                <img
                  src={preview}
                  alt="Pré-visualização da lição enviada"
                  className="max-h-64 rounded-md object-contain"
                />
              ) : (
                <>
                  <Upload className="size-8 text-primary" />
                  <p className="font-medium text-foreground">Clique ou arraste a foto aqui</p>
                  <p className="text-sm text-muted-foreground">JPG ou PNG, até 8MB</p>
                </>
              )}
              <input
                ref={inputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) void handleFile(f);
                }}
              />
            </Card>

            {preview ? (
              <Card className="space-y-3 p-6">
                <p className="font-medium text-foreground">Foto da lição resolvida</p>
                <p className="text-sm text-muted-foreground">
                  Passo 1: envie acima a página <strong>limpa</strong> (sem respostas). Passo 2:
                  envie abaixo uma foto com a <strong>sua letra</strong> para a IA imitar.
                </p>

                <div
                  className="flex cursor-pointer flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed border-primary/30 bg-primary/5 p-4 text-center"
                  onClick={() => handwritingRef.current?.click()}
                  onDragOver={(e) => e.preventDefault()}
                  onDrop={(e) => {
                    e.preventDefault();
                    const f = e.dataTransfer.files?.[0];
                    if (f) void handleHandwriting(f);
                  }}
                >
                  {handwriting ? (
                    <img
                      src={handwriting}
                      alt="Amostra da letra do aluno"
                      className="max-h-40 rounded-md object-contain"
                    />
                  ) : (
                    <>
                      <PenLine className="size-6 text-primary" />
                      <p className="text-sm font-medium text-foreground">
                        Enviar foto com a sua letra
                      </p>
                      <p className="text-xs text-muted-foreground">
                        Opcional — sem ela a IA usa letra padrão de caneta azul
                      </p>
                    </>
                  )}
                  <input
                    ref={handwritingRef}
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={(e) => {
                      const f = e.target.files?.[0];
                      if (f) void handleHandwriting(f);
                    }}
                  />
                </div>

                <Button onClick={() => void handleSolvedPhoto()} disabled={solving}>
                  {solving ? <Loader2 className="animate-spin" /> : <Sparkles />}
                  {solving ? "Gerando foto..." : "Gerar foto resolvida"}
                </Button>
                {solved ? (
                  <div className="space-y-3">
                    <img
                      src={solved}
                      alt="Foto da lição de casa com as respostas preenchidas"
                      className="w-full rounded-md border border-border object-contain"
                    />
                    <Button asChild size="sm" variant="secondary">
                      <a href={solved} download="licao-resolvida.png">
                        <ImageDown /> Baixar foto
                      </a>
                    </Button>
                  </div>
                ) : null}
              </Card>
            ) : null}
          </div>

          <Card className="min-h-72 p-6">
            {loading ? (
              <div className="flex h-full flex-col items-center justify-center gap-3 text-muted-foreground">
                <Loader2 className="size-6 animate-spin text-primary" />
                <p>Lendo a página...</p>
              </div>
            ) : result ? (
              <div className="space-y-4">
                <div className="flex flex-wrap gap-2">
                  <Button size="sm" onClick={() => copiar(true)}>
                    <Copy /> Copiar tudo
                  </Button>
                  <Button size="sm" variant="secondary" onClick={() => copiar(false)}>
                    <Copy /> Só as questões
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => inputRef.current?.click()}>
                    <RefreshCw /> Nova foto
                  </Button>
                </div>

                <div className="flex items-center gap-2 rounded-lg border border-border bg-muted/50 p-3">
                  <Switch id="resumido" checked={resumido} onCheckedChange={setResumido} />
                  <Label htmlFor="resumido" className="text-sm">
                    Resposta resumida
                  </Label>
                </div>

                {result.titulo ? (
                  <p className="text-sm font-medium text-muted-foreground">{result.titulo}</p>
                ) : null}

                <ol className="max-h-[60vh] space-y-3 overflow-auto pr-1">
                  {result.questoes.map((q, i) => (
                    <li
                      key={`${q.numero}-${i}`}
                      className="rounded-lg border border-border bg-card p-4"
                    >
                      <div className="flex gap-3">
                        <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-primary text-sm font-semibold text-primary-foreground">
                          {q.numero}
                        </span>
                        <div className="space-y-2">
                          <p className="text-sm text-muted-foreground">{q.pergunta}</p>
                          <p className="font-medium text-foreground">
                            Resposta: {resumido ? q.resumo || q.resposta : q.resposta}
                          </p>
                          {!resumido && q.explicacao ? (
                            <p className="text-sm text-muted-foreground">{q.explicacao}</p>
                          ) : null}
                        </div>
                      </div>
                    </li>
                  ))}
                </ol>
              </div>
            ) : (
              <div className="flex h-full items-center justify-center text-center text-muted-foreground">
                As questões e respostas aparecerão aqui, numeradas.
              </div>
            )}
          </Card>
        </div>
      </main>
    </div>
  );
}
