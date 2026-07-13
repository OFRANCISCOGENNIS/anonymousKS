"use client";

// Exportação do PROJETO multitrilha — renderização REAL no navegador
// (WebCodecs): todas as trilhas visíveis + áudio mixado (som dos vídeos e
// música). O arquivo baixa na hora. Sem WebCodecs, aviso honesto.

import { useRef, useState } from "react";
import { Download, Info, XCircle } from "lucide-react";
import { cn } from "@/lib/utils";
import { isExportSupported, renderProjectToBlob } from "@/lib/video-editor/export-project";
import { projectDurationMs } from "@/lib/video-editor/timeline-math";
import { useVideoEditor } from "@/store/video-editor";
import { toast } from "@/store/toast";
import { Button } from "@/components/ui/button";
import { Modal } from "@/components/ui/modal";
import { Progress } from "@/components/ui/progress";

const RESOLUTIONS = [
  { id: "1080p", label: "Full HD", shortSide: 1080, hint: "recomendado" },
  { id: "720p", label: "HD", shortSide: 720, hint: "mais rápido" },
] as const;

const FPS_OPTIONS = [24, 30, 60] as const;

export function ExportProjectModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const project = useVideoEditor((s) => s.project);
  const sources = useVideoEditor((s) => s.sources);

  const [resolution, setResolution] = useState<(typeof RESOLUTIONS)[number]["id"]>("1080p");
  const [fps, setFps] = useState<(typeof FPS_OPTIONS)[number]>(30);
  const [exporting, setExporting] = useState(false);
  const [progress, setProgress] = useState<{ pct: number; message: string } | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  const supported = isExportSupported();
  const durationMs = projectDurationMs(project.tracks);

  async function startExport() {
    setExporting(true);
    setProgress({ pct: 0, message: "Preparando…" });
    const controller = new AbortController();
    abortRef.current = controller;
    try {
      const shortSide = RESOLUTIONS.find((r) => r.id === resolution)?.shortSide ?? 1080;
      const result = await renderProjectToBlob(project, sources, {
        shortSide,
        fps,
        signal: controller.signal,
        onProgress: (p) => setProgress(p),
      });
      const url = URL.createObjectURL(result.blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = result.fileName;
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 30_000);
      toast("Vídeo exportado", { description: `${result.fileName} — com áudio mixado` });
      onClose();
    } catch (err) {
      if ((err as DOMException)?.name === "AbortError") {
        toast("Exportação cancelada");
      } else {
        toast("Falha ao exportar", { description: err instanceof Error ? err.message : "Erro inesperado", variant: "error" });
      }
    } finally {
      setExporting(false);
      setProgress(null);
      abortRef.current = null;
    }
  }

  return (
    <Modal open={open} onClose={exporting ? () => undefined : onClose} title="Exportar vídeo">
      <div className="space-y-4">
        {!supported && (
          <p className="flex items-start gap-2 rounded-xl border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-xs text-amber-200">
            <Info className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
            Este navegador não suporta renderização local (WebCodecs). Use Chrome/Edge no computador ou Android.
          </p>
        )}

        <div>
          <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-wide text-zinc-500">Resolução</p>
          <div className="grid grid-cols-2 gap-2">
            {RESOLUTIONS.map((r) => (
              <button
                key={r.id}
                onClick={() => setResolution(r.id)}
                disabled={exporting}
                aria-pressed={resolution === r.id}
                className={cn(
                  "rounded-xl border px-3 py-2 text-left text-sm transition-colors",
                  resolution === r.id ? "border-violet-400 bg-violet-500/20 text-white" : "border-line bg-surface-1 text-zinc-400 hover:text-white",
                )}
              >
                <span className="block font-semibold">{r.label}</span>
                <span className="text-[10px] text-zinc-500">{r.hint}</span>
              </button>
            ))}
          </div>
        </div>

        <div>
          <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-wide text-zinc-500">Quadros por segundo</p>
          <div className="grid grid-cols-3 gap-2">
            {FPS_OPTIONS.map((f) => (
              <button
                key={f}
                onClick={() => setFps(f)}
                disabled={exporting}
                aria-pressed={fps === f}
                className={cn(
                  "rounded-xl border px-3 py-2 text-sm font-semibold transition-colors",
                  fps === f ? "border-violet-400 bg-violet-500/20 text-white" : "border-line bg-surface-1 text-zinc-400 hover:text-white",
                )}
              >
                {f}
              </button>
            ))}
          </div>
        </div>

        <p className="text-[11px] text-zinc-500">
          Duração do projeto: {(durationMs / 1000).toFixed(1)}s · MP4 (H.264) quando o navegador suportar, senão WebM. O áudio dos
          vídeos e as músicas são mixados no arquivo final.
        </p>

        {progress && (
          <div>
            <Progress value={progress.pct} />
            <p className="mt-1.5 text-xs text-zinc-400">{progress.message}</p>
          </div>
        )}

        <div className="flex items-center justify-end gap-2">
          {exporting ? (
            <Button variant="outline" onClick={() => abortRef.current?.abort()}>
              <XCircle className="mr-1.5 h-4 w-4" aria-hidden /> Cancelar
            </Button>
          ) : (
            <Button onClick={startExport} disabled={!supported || durationMs < 200}>
              <Download className="mr-1.5 h-4 w-4" aria-hidden /> Exportar agora
            </Button>
          )}
        </div>
      </div>
    </Modal>
  );
}
