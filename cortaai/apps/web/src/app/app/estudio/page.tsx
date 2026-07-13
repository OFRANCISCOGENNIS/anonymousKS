"use client";

// Estúdio de vídeo multitrilha — layout PRO estilo CapCut/Premiere.
// Desktop (lg): mídia+música à esquerda, preview no centro, PROPRIEDADES à
// direita, timeline interativa embaixo. Mobile: preview dominante + barra de
// ferramentas inferior (Mídia/Música/Texto/Ajustes) com gavetas.
// Autosave em localStorage; atalhos de teclado profissionais.

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { ArrowLeft, ChevronDown, Download, FolderOpen, Music2, Redo2, SlidersHorizontal, Type as TypeIcon, Undo2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { makeProject, validateProject } from "@/lib/video-editor/model";
import type { MediaSource } from "@/lib/video-editor/media-registry";
import { useVideoEditor } from "@/store/video-editor";
import { TimelineTracks } from "@/components/video-editor/TimelineTracks";
import { MediaBin } from "@/components/video-editor/MediaBin";
import { MusicPanel } from "@/components/video-editor/MusicPanel";
import { ClipInspector } from "@/components/video-editor/ClipInspector";
import { ExportProjectModal } from "@/components/video-editor/ExportProjectModal";
import { PreviewStage } from "@/components/video-editor/PreviewStage";

const AUTOSAVE_KEY = "cortaai-studio-autosave";

type Sheet = "bin" | "music" | "inspector" | null;

export default function EstudioPage() {
  const loadProject = useVideoEditor((s) => s.loadProject);
  const loadFromJson = useVideoEditor((s) => s.loadFromJson);
  const addSource = useVideoEditor((s) => s.addSource);
  const undo = useVideoEditor((s) => s.undo);
  const redo = useVideoEditor((s) => s.redo);
  const canUndo = useVideoEditor((s) => s.past.length > 0);
  const canRedo = useVideoEditor((s) => s.future.length > 0);
  const sourceCount = useVideoEditor((s) => Object.keys(s.sources).length);
  const selectedClipId = useVideoEditor((s) => s.selectedClipId);
  const addTextClip = useVideoEditor((s) => s.addTextClip);
  const seeded = useRef(false);
  const [sheet, setSheet] = useState<Sheet>(null);
  const [exportOpen, setExportOpen] = useState(false);

  // ------- seed / restauração do autosave -----------------------------------
  useEffect(() => {
    if (seeded.current) return;
    seeded.current = true;
    try {
      const raw = localStorage.getItem(AUTOSAVE_KEY);
      if (raw) {
        const saved = JSON.parse(raw) as { project?: unknown; sources?: MediaSource[] };
        const valid = validateProject(saved.project);
        if (valid) {
          loadFromJson(valid);
          (saved.sources ?? []).forEach((src) => {
            if (src && typeof src.id === "string" && typeof src.mediaId === "string") addSource(src);
          });
          return;
        }
      }
    } catch {
      /* autosave corrompido → projeto novo */
    }
    loadProject(makeProject("Meu vídeo", { w: 1080, h: 1920 }, 30));
  }, [loadProject, loadFromJson, addSource]);

  // ------- autosave (debounce) ------------------------------------------------
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | null = null;
    const unsub = useVideoEditor.subscribe((s, prev) => {
      if (s.project === prev.project && s.sources === prev.sources) return;
      if (timer) clearTimeout(timer);
      timer = setTimeout(() => {
        try {
          localStorage.setItem(AUTOSAVE_KEY, JSON.stringify({ project: s.project, sources: Object.values(s.sources) }));
        } catch {
          /* quota cheia — ignora silenciosamente */
        }
      }, 800);
    });
    return () => {
      if (timer) clearTimeout(timer);
      unsub();
    };
  }, []);

  // ------- atalhos de teclado -------------------------------------------------
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const t = e.target as HTMLElement | null;
      if (t && (t.tagName === "INPUT" || t.tagName === "TEXTAREA" || t.tagName === "SELECT" || t.isContentEditable)) return;
      const st = useVideoEditor.getState();
      if (e.key === " ") {
        e.preventDefault();
        window.dispatchEvent(new Event("studio-toggle-play"));
      } else if (e.key === "s" && !e.ctrlKey && !e.metaKey) {
        st.splitAtPlayhead();
      } else if ((e.key === "Delete" || e.key === "Backspace") && st.selectedClipId) {
        e.preventDefault();
        st.deleteClip(st.selectedClipId);
      } else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "z") {
        e.preventDefault();
        if (e.shiftKey) st.redo();
        else st.undo();
      } else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "y") {
        e.preventDefault();
        st.redo();
      } else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "d" && st.selectedClipId) {
        e.preventDefault();
        st.duplicateClip(st.selectedClipId);
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  // ao selecionar um clipe no mobile, abre a gaveta de ajustes? Não — só via botão.

  return (
    <div className="flex h-[100dvh] flex-col overflow-hidden bg-surface">
      {/* Topo */}
      <header className="flex shrink-0 items-center gap-2 border-b border-line bg-surface-1/60 px-3 py-2">
        <Link
          href="/app"
          title="Sair do estúdio"
          className="inline-flex items-center gap-1 rounded-lg px-2 py-1.5 text-sm text-zinc-400 transition-colors hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-400"
        >
          <ArrowLeft className="h-4 w-4" aria-hidden />
          <span className="hidden sm:inline">Sair</span>
        </Link>
        <p className="min-w-0 flex-1 truncate text-sm font-semibold text-white">Estúdio de vídeo</p>
        <div className="flex items-center gap-1">
          <button
            onClick={undo}
            disabled={!canUndo}
            aria-label="Desfazer (Ctrl+Z)"
            title="Desfazer (Ctrl+Z)"
            className="rounded-lg p-2 text-zinc-400 hover:text-white disabled:opacity-40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-400"
          >
            <Undo2 className="h-4 w-4" />
          </button>
          <button
            onClick={redo}
            disabled={!canRedo}
            aria-label="Refazer (Ctrl+Shift+Z)"
            title="Refazer (Ctrl+Shift+Z)"
            className="rounded-lg p-2 text-zinc-400 hover:text-white disabled:opacity-40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-400"
          >
            <Redo2 className="h-4 w-4" />
          </button>
          <button
            onClick={() => setExportOpen(true)}
            className="ml-1 inline-flex items-center gap-1.5 rounded-lg bg-gradient-to-r from-violet-600 to-fuchsia-600 px-3 py-1.5 text-xs font-semibold text-white shadow-glow hover:from-violet-500 hover:to-fuchsia-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-400"
          >
            <Download className="h-3.5 w-3.5" aria-hidden />
            Exportar
          </button>
        </div>
      </header>

      {/* Área principal: mídia (desktop) + preview + propriedades (desktop) */}
      <div className="flex min-h-0 flex-1 flex-col lg:flex-row">
        <aside className="hidden shrink-0 space-y-5 overflow-y-auto border-r border-line p-3 lg:block lg:w-[280px]">
          <MediaBin />
          <div>
            <p className="mb-2 flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-zinc-500">
              <Music2 className="h-3.5 w-3.5" aria-hidden /> Música
            </p>
            <MusicPanel />
          </div>
        </aside>
        <div className="min-h-0 flex-1 p-2 sm:p-3">
          <PreviewStage />
        </div>
        <aside className="hidden shrink-0 overflow-y-auto border-l border-line p-3 lg:block lg:w-[280px]">
          <div className="mb-2 flex items-center justify-between">
            <p className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-zinc-500">
              <SlidersHorizontal className="h-3.5 w-3.5" aria-hidden /> Propriedades
            </p>
            <button
              onClick={() => addTextClip("Seu texto")}
              className="inline-flex items-center gap-1 rounded-lg border border-line px-2 py-1 text-[10px] font-medium text-zinc-300 hover:border-violet-500/50 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-400"
            >
              <TypeIcon className="h-3 w-3" aria-hidden /> Texto
            </button>
          </div>
          <ClipInspector />
        </aside>
      </div>

      {/* Timeline */}
      <div className="shrink-0 px-2 pb-1 sm:px-3">
        <TimelineTracks />
      </div>

      {/* Barra inferior (mobile) */}
      <nav aria-label="Ferramentas" className="flex shrink-0 items-stretch gap-1 overflow-x-auto border-t border-line bg-surface-1/95 px-2 pt-1 pb-[calc(0.35rem+env(safe-area-inset-bottom))] lg:hidden">
        <MobileTool icon={FolderOpen} label={`Mídia${sourceCount > 0 ? ` (${sourceCount})` : ""}`} onClick={() => setSheet("bin")} />
        <MobileTool icon={Music2} label="Música" onClick={() => setSheet("music")} />
        <MobileTool icon={TypeIcon} label="Texto" onClick={() => addTextClip("Seu texto")} />
        <MobileTool
          icon={SlidersHorizontal}
          label="Ajustes"
          onClick={() => setSheet("inspector")}
          highlight={selectedClipId != null}
        />
      </nav>

      {/* Gavetas (mobile) */}
      <MobileSheet title="Mídia" open={sheet === "bin"} onClose={() => setSheet(null)}>
        <MediaBin />
      </MobileSheet>
      <MobileSheet title="Música" open={sheet === "music"} onClose={() => setSheet(null)}>
        <MusicPanel />
      </MobileSheet>
      <MobileSheet title="Ajustes do clipe" open={sheet === "inspector"} onClose={() => setSheet(null)}>
        <ClipInspector />
      </MobileSheet>

      <ExportProjectModal open={exportOpen} onClose={() => setExportOpen(false)} />
    </div>
  );
}

function MobileTool({
  icon: Icon,
  label,
  onClick,
  highlight,
}: {
  icon: typeof FolderOpen;
  label: string;
  onClick: () => void;
  highlight?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "flex min-w-[64px] flex-col items-center justify-center gap-1 rounded-lg px-3 py-1.5 text-[10px] font-medium hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-400",
        highlight ? "text-violet-300" : "text-zinc-300",
      )}
    >
      <Icon className="h-5 w-5" aria-hidden />
      {label}
    </button>
  );
}

function MobileSheet({ title, open, onClose, children }: { title: string; open: boolean; onClose: () => void; children: React.ReactNode }) {
  return (
    <>
      <div
        className={cn(
          "fixed inset-x-0 bottom-0 z-40 rounded-t-2xl border-t border-line bg-surface-2 shadow-2xl transition-transform duration-300 lg:hidden",
          open ? "translate-y-0" : "translate-y-full",
        )}
        style={{ maxHeight: "70dvh" }}
      >
        <div className="flex items-center justify-between border-b border-line px-4 py-2">
          <span className="text-sm font-semibold text-white">{title}</span>
          <button onClick={onClose} aria-label="Fechar" className="rounded-lg p-1.5 text-zinc-500 hover:text-white">
            <ChevronDown className="h-4 w-4" />
          </button>
        </div>
        <div className="max-h-[calc(70dvh-3rem)] overflow-y-auto p-3">{children}</div>
      </div>
      {open && <button aria-hidden tabIndex={-1} onClick={onClose} className="fixed inset-0 z-30 bg-black/50 lg:hidden" />}
    </>
  );
}
