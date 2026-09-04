import { createFileRoute } from "@tanstack/react-router";
import { useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { extractHomeworkText } from "@/lib/ocr.functions";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Loader2, Upload, Copy, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import { Toaster } from "@/components/ui/sonner";

export const Route = createFileRoute("/")({
  component: Index,
  head: () => ({
    meta: [
      { title: "Lição Fácil — Transcreva sua lição de casa por foto" },
      {
        name: "description",
        content:
          "Envie a foto da sua lição de casa e receba todo o conteúdo da página separado e transcrito em texto organizado.",
      },
      { property: "og:title", content: "Lição Fácil — Transcreva sua lição por foto" },
      {
        property: "og:description",
        content: "Foto da página em, texto organizado fora. Estude com o conteúdo já transcrito.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
});

function Index() {
  const extract = useServerFn(extractHomeworkText);
  const inputRef = useRef<HTMLInputElement>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [result, setResult] = useState<Awaited<ReturnType<typeof extract>> | null>(null);
  const [loading, setLoading] = useState(false);

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


  return (
    <div className="min-h-screen bg-background">
      <Toaster />
      <header className="border-b border-border">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-6 py-5">
          <span className="text-lg font-semibold tracking-tight text-foreground">Lição Fácil</span>
          <span className="text-sm text-muted-foreground">Foto → texto organizado</span>
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-6 py-12">
        <h1 className="text-4xl font-bold tracking-tight text-foreground sm:text-5xl">
          Envie a foto da lição e receba tudo transcrito e respondido
        </h1>
        <p className="mt-4 max-w-2xl text-muted-foreground">
          A página é separada por seções — enunciados, questões, anotações —, você recebe um texto
          corrido com tudo que estava escrito e as respostas das questões explicadas.
        </p>


        <div className="mt-10 grid gap-6 md:grid-cols-2">
          <Card
            className="flex min-h-72 cursor-pointer flex-col items-center justify-center gap-3 border-dashed p-6 text-center"
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
                <Upload className="size-8 text-muted-foreground" />
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

          <Card className="min-h-72 p-6">
            {loading ? (
              <div className="flex h-full flex-col items-center justify-center gap-3 text-muted-foreground">
                <Loader2 className="size-6 animate-spin" />
                <p>Lendo a página...</p>
              </div>
            ) : result ? (
              <div className="space-y-4">
                <div className="flex gap-2">
                  <Button
                    size="sm"
                    onClick={() => {
                      void navigator.clipboard.writeText(result);
                      toast.success("Texto copiado!");
                    }}
                  >
                    <Copy /> Copiar
                  </Button>
                  <Button size="sm" variant="secondary" onClick={() => inputRef.current?.click()}>
                    <RefreshCw /> Nova foto
                  </Button>
                </div>
                <pre className="max-h-[60vh] overflow-auto whitespace-pre-wrap font-sans text-sm leading-relaxed text-foreground">
                  {result}
                </pre>
              </div>
            ) : (
              <div className="flex h-full items-center justify-center text-center text-muted-foreground">
                O texto extraído aparecerá aqui.
              </div>
            )}
          </Card>
        </div>
      </main>
    </div>
  );
}
