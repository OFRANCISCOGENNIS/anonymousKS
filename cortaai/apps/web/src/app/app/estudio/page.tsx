"use client";

// Editor de vídeo multitrilha (em construção). Rota nova e aditiva; o editor
// atual (/app/editor) segue intacto.
// Fatia B: importar mídia + preview de 1 trilha + timeline.

import { useEffect, useRef } from "react";
import { Info } from "lucide-react";
import { makeProject } from "@/lib/video-editor/model";
import { useVideoEditor } from "@/store/video-editor";
import { TimelineTracks } from "@/components/video-editor/TimelineTracks";
import { MediaBin } from "@/components/video-editor/MediaBin";
import { PreviewStage } from "@/components/video-editor/PreviewStage";

export default function EstudioPage() {
  const loadProject = useVideoEditor((s) => s.loadProject);
  const seeded = useRef(false);

  // Começa com um projeto vazio (trilhas Vídeo/Áudio). O usuário importa mídia.
  useEffect(() => {
    if (seeded.current) return;
    seeded.current = true;
    loadProject(makeProject("Meu vídeo", { w: 1080, h: 1920 }, 30));
  }, [loadProject]);

  return (
    <div className="mx-auto max-w-6xl space-y-4">
      <div>
        <h1 className="text-2xl font-bold text-white">Estúdio de vídeo</h1>
        <p className="mt-1 text-sm text-zinc-500">Novo editor multitrilha — em construção.</p>
      </div>

      <p className="flex items-start gap-2 rounded-xl bg-sky-500/10 p-3 text-xs leading-relaxed text-sky-200">
        <Info className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
        Prévia técnica (Fatia B): importe uma mídia (botão ou arraste) e ela entra na timeline e toca no preview.
        Arrastar/cortar clipes, compor várias trilhas e exportar entram nas próximas etapas.
      </p>

      <div className="grid gap-4 lg:grid-cols-[300px_1fr]">
        <div className="space-y-4">
          <MediaBin />
        </div>
        <PreviewStage />
      </div>

      <TimelineTracks />
    </div>
  );
}
