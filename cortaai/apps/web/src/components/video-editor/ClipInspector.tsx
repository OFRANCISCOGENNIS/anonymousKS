"use client";

// Inspector do clipe selecionado (painel de propriedades estilo Premiere):
// transformação (escala/posição/rotação/opacidade), velocidade, volume,
// modo de mesclagem, filtros/looks, animações de entrada/saída e texto.
// Cada mudança vira uma ação no store (histórico undo/redo).

import { Copy, Trash2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { ANIM_PRESETS } from "@/lib/video-editor/animations";
import { CLIP_FILTERS } from "@/lib/video-editor/filters";
import type { BlendMode, Clip } from "@/lib/video-editor/model";
import { useVideoEditor } from "@/store/video-editor";

const BLEND_MODES: BlendMode[] = ["normal", "multiply", "screen", "overlay", "lighten", "darken", "difference"];

export function ClipInspector() {
  const project = useVideoEditor((s) => s.project);
  const selectedClipId = useVideoEditor((s) => s.selectedClipId);
  const updateClip = useVideoEditor((s) => s.updateClip);
  const setClipSpeed = useVideoEditor((s) => s.setClipSpeed);
  const deleteClip = useVideoEditor((s) => s.deleteClip);
  const duplicateClip = useVideoEditor((s) => s.duplicateClip);
  const sources = useVideoEditor((s) => s.sources);

  const found = selectedClipId
    ? project.tracks.flatMap((t) => t.clips.map((c) => ({ track: t, clip: c }))).find(({ clip }) => clip.id === selectedClipId)
    : null;

  if (!found) {
    return (
      <p className="rounded-xl border border-dashed border-line px-3 py-6 text-center text-xs text-zinc-500">
        Selecione um clipe na timeline para editar as propriedades.
      </p>
    );
  }

  const { track, clip } = found;
  const isMedia = track.type === "video" || track.type === "audio";
  const isVisual = track.type !== "audio";
  const name = clip.text?.content ?? sources[clip.sourceId]?.name ?? "Clipe";

  function patchTransform(patch: Partial<Clip["transform"]>) {
    updateClip(clip.id, { transform: { ...clip.transform, ...patch } });
  }

  return (
    <div className="space-y-4 text-sm">
      <div className="flex items-center gap-2">
        <p className="min-w-0 flex-1 truncate text-xs font-semibold text-white" title={name}>
          {name}
        </p>
        <button
          onClick={() => duplicateClip(clip.id)}
          aria-label="Duplicar clipe"
          title="Duplicar clipe"
          className="rounded-lg p-1.5 text-zinc-400 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-400"
        >
          <Copy className="h-4 w-4" />
        </button>
        <button
          onClick={() => deleteClip(clip.id)}
          aria-label="Apagar clipe"
          title="Apagar clipe"
          className="rounded-lg p-1.5 text-zinc-400 hover:text-rose-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-400"
        >
          <Trash2 className="h-4 w-4" />
        </button>
      </div>

      {/* texto */}
      {clip.text && (
        <Section title="Texto">
          <textarea
            rows={2}
            value={clip.text.content}
            onChange={(e) => updateClip(clip.id, { text: { ...clip.text!, content: e.target.value } })}
            aria-label="Conteúdo do texto"
            className="w-full rounded-lg border border-line bg-surface-1 px-2 py-1.5 text-xs text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-400"
          />
          <div className="mt-2 flex items-center gap-3">
            <label className="flex items-center gap-1.5 text-[11px] text-zinc-400">
              Cor
              <input
                type="color"
                value={clip.text.color}
                onChange={(e) => updateClip(clip.id, { text: { ...clip.text!, color: e.target.value } })}
                aria-label="Cor do texto"
                className="h-6 w-8 cursor-pointer rounded border border-line bg-transparent"
              />
            </label>
            <label className="flex items-center gap-1.5 text-[11px] text-zinc-400">
              <input
                type="checkbox"
                checked={clip.text.background != null}
                onChange={(e) => updateClip(clip.id, { text: { ...clip.text!, background: e.target.checked ? "rgba(0,0,0,0.75)" : null } })}
                className="accent-violet-500"
              />
              Caixa de fundo
            </label>
          </div>
        </Section>
      )}

      {/* transformação */}
      {isVisual && (
        <Section title="Transformação">
          <Slider label="Escala" value={clip.transform.scale} min={0.2} max={3} step={0.01} onChange={(v) => patchTransform({ scale: v })} format={(v) => `${Math.round(v * 100)}%`} />
          <Slider label="Posição X" value={clip.transform.x} min={-0.5} max={0.5} step={0.01} onChange={(v) => patchTransform({ x: v })} format={(v) => `${Math.round(v * 100)}`} />
          <Slider label="Posição Y" value={clip.transform.y} min={-0.5} max={0.5} step={0.01} onChange={(v) => patchTransform({ y: v })} format={(v) => `${Math.round(v * 100)}`} />
          <Slider label="Rotação" value={clip.transform.rotation} min={-180} max={180} step={1} onChange={(v) => patchTransform({ rotation: v })} format={(v) => `${Math.round(v)}°`} />
          <Slider label="Opacidade" value={clip.transform.opacity} min={0} max={1} step={0.01} onChange={(v) => patchTransform({ opacity: v })} format={(v) => `${Math.round(v * 100)}%`} />
        </Section>
      )}

      {/* velocidade + volume */}
      {isMedia && (
        <Section title="Velocidade e som">
          <Slider label="Velocidade" value={clip.speed} min={0.25} max={4} step={0.05} onChange={(v) => setClipSpeed(clip.id, v)} format={(v) => `${v.toFixed(2)}x`} />
          <Slider label="Volume" value={clip.volume} min={0} max={1} step={0.01} onChange={(v) => updateClip(clip.id, { volume: v })} format={(v) => `${Math.round(v * 100)}%`} />
        </Section>
      )}

      {/* filtros */}
      {isVisual && !clip.text && (
        <Section title="Filtros e looks">
          <div className="grid grid-cols-3 gap-1.5">
            {CLIP_FILTERS.map((f) => (
              <button
                key={f.id}
                onClick={() => updateClip(clip.id, { filterId: f.id === "none" ? undefined : f.id })}
                aria-pressed={(clip.filterId ?? "none") === f.id}
                className={cn(
                  "rounded-lg border px-1.5 py-1.5 text-[10px] font-medium transition-colors",
                  (clip.filterId ?? "none") === f.id
                    ? "border-violet-400 bg-violet-500/20 text-white"
                    : "border-line bg-surface-1 text-zinc-400 hover:text-white",
                )}
              >
                {f.name}
              </button>
            ))}
          </div>
        </Section>
      )}

      {/* animações de entrada/saída */}
      {isVisual && (
        <Section title="Animações">
          <AnimPicker
            label="Entrada"
            value={clip.animIn ?? null}
            onChange={(anim) => updateClip(clip.id, { animIn: anim ?? undefined })}
          />
          <AnimPicker
            label="Saída"
            value={clip.animOut ?? null}
            onChange={(anim) => updateClip(clip.id, { animOut: anim ?? undefined })}
          />
        </Section>
      )}

      {/* mesclagem */}
      {isVisual && !clip.text && (
        <Section title="Mesclagem">
          <select
            value={clip.blendMode}
            onChange={(e) => updateClip(clip.id, { blendMode: e.target.value as BlendMode })}
            aria-label="Modo de mesclagem"
            className="w-full rounded-lg border border-line bg-surface-1 px-2 py-1.5 text-xs text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-400"
          >
            {BLEND_MODES.map((m) => (
              <option key={m} value={m}>
                {m}
              </option>
            ))}
          </select>
        </Section>
      )}
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-wide text-zinc-500">{title}</p>
      {children}
    </div>
  );
}

function Slider({
  label,
  value,
  min,
  max,
  step,
  onChange,
  format,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  onChange: (v: number) => void;
  format: (v: number) => string;
}) {
  return (
    <label className="mb-1.5 block">
      <span className="flex items-center justify-between text-[11px] text-zinc-400">
        {label}
        <span className="font-mono tabular-nums text-zinc-500">{format(value)}</span>
      </span>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        aria-label={label}
        className="mt-0.5 w-full accent-violet-500"
      />
    </label>
  );
}

function AnimPicker({
  label,
  value,
  onChange,
}: {
  label: string;
  value: { id: string; durationMs: number } | null;
  onChange: (anim: { id: string; durationMs: number } | null) => void;
}) {
  return (
    <div className="mb-2">
      <span className="text-[11px] text-zinc-400">{label}</span>
      <div className="mt-1 flex items-center gap-2">
        <select
          value={value?.id ?? ""}
          onChange={(e) => onChange(e.target.value ? { id: e.target.value, durationMs: value?.durationMs ?? 500 } : null)}
          aria-label={`Animação de ${label.toLowerCase()}`}
          className="min-w-0 flex-1 rounded-lg border border-line bg-surface-1 px-2 py-1.5 text-xs text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-400"
        >
          <option value="">Nenhuma</option>
          {ANIM_PRESETS.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          ))}
        </select>
        {value && (
          <input
            type="range"
            min={100}
            max={2000}
            step={50}
            value={value.durationMs}
            onChange={(e) => onChange({ id: value.id, durationMs: Number(e.target.value) })}
            aria-label={`Duração da animação de ${label.toLowerCase()}`}
            title={`${value.durationMs}ms`}
            className="w-20 accent-violet-500"
          />
        )}
      </div>
    </div>
  );
}
