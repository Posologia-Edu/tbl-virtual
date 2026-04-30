import { useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import remarkMath from "remark-math";
import rehypeKatex from "rehype-katex";
import "katex/dist/katex.min.css";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card } from "@/components/ui/card";
import {
  ImagePlus, Video, Music, Trash2, Loader2, ExternalLink, GripVertical, ArrowUp, ArrowDown,
} from "lucide-react";
import { toast } from "sonner";

// ─── Types ─────────────────────────────────────────────────────────────────
export type MediaBlock =
  | { type: "image"; url: string; caption?: string; alt?: string }
  | { type: "video"; url: string; caption?: string }
  | { type: "audio"; url: string; caption?: string };

export type QuestionMediaArray = MediaBlock[];

/** Safely parse media field coming from DB (jsonb -> any). */
export function parseMedia(raw: any): MediaBlock[] {
  if (!raw) return [];
  if (Array.isArray(raw)) return raw.filter((m) => m && typeof m === "object" && m.url);
  return [];
}

// ─── Renderer ──────────────────────────────────────────────────────────────

/** Convert YouTube/Vimeo URL to embed URL. Returns null if not embeddable. */
function toEmbedUrl(url: string): string | null {
  try {
    const u = new URL(url);
    // YouTube
    if (u.hostname.includes("youtube.com")) {
      const id = u.searchParams.get("v");
      if (id) return `https://www.youtube.com/embed/${id}`;
    }
    if (u.hostname === "youtu.be") {
      return `https://www.youtube.com/embed/${u.pathname.slice(1)}`;
    }
    // Vimeo
    if (u.hostname.includes("vimeo.com")) {
      const id = u.pathname.split("/").filter(Boolean)[0];
      if (id && /^\d+$/.test(id)) return `https://player.vimeo.com/video/${id}`;
    }
  } catch {
    return null;
  }
  return null;
}

interface RendererProps {
  text: string;
  media?: any;
  className?: string;
  compact?: boolean;
}

/** Renders question text (Markdown + GFM tables + LaTeX) followed by media blocks. */
export function QuestionRichRenderer({ text, media, className, compact }: RendererProps) {
  const blocks = parseMedia(media);
  return (
    <div className={className}>
      <div
        className={`prose prose-sm dark:prose-invert max-w-none ${
          compact ? "text-sm" : "text-base"
        } leading-relaxed prose-p:my-1 prose-table:my-2 prose-img:my-1`}
      >
        <ReactMarkdown
          remarkPlugins={[remarkGfm, remarkMath]}
          rehypePlugins={[rehypeKatex]}
        >
          {text || ""}
        </ReactMarkdown>
      </div>

      {blocks.length > 0 && (
        <div className="mt-3 space-y-3">
          {blocks.map((b, i) => (
            <MediaBlockView key={i} block={b} />
          ))}
        </div>
      )}
    </div>
  );
}

function MediaBlockView({ block }: { block: MediaBlock }) {
  if (block.type === "image") {
    return (
      <figure className="rounded-lg overflow-hidden border border-border bg-muted/30">
        <img
          src={block.url}
          alt={block.alt || block.caption || "Imagem da questão"}
          className="w-full max-h-[480px] object-contain bg-background"
          loading="lazy"
        />
        {block.caption && (
          <figcaption className="px-3 py-2 text-xs text-muted-foreground">
            {block.caption}
          </figcaption>
        )}
      </figure>
    );
  }
  if (block.type === "video") {
    const embed = toEmbedUrl(block.url);
    return (
      <figure className="rounded-lg overflow-hidden border border-border bg-muted/30">
        {embed ? (
          <div className="aspect-video bg-black">
            <iframe
              src={embed}
              className="w-full h-full"
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
              allowFullScreen
              title={block.caption || "Vídeo da questão"}
            />
          </div>
        ) : (
          <video src={block.url} controls className="w-full max-h-[480px]" />
        )}
        {block.caption && (
          <figcaption className="px-3 py-2 text-xs text-muted-foreground">
            {block.caption}
          </figcaption>
        )}
      </figure>
    );
  }
  if (block.type === "audio") {
    return (
      <figure className="rounded-lg border border-border bg-muted/30 p-3">
        <audio src={block.url} controls className="w-full" />
        {block.caption && (
          <figcaption className="mt-2 text-xs text-muted-foreground">
            {block.caption}
          </figcaption>
        )}
      </figure>
    );
  }
  return null;
}

// ─── Editor ────────────────────────────────────────────────────────────────

interface EditorProps {
  value: MediaBlock[];
  onChange: (next: MediaBlock[]) => void;
  /** Used as folder name in storage (must equal auth.uid() per RLS). */
  ownerId: string | null | undefined;
}

export function QuestionMediaEditor({ value, onChange, ownerId }: EditorProps) {
  const [uploading, setUploading] = useState<"image" | "audio" | null>(null);
  const [videoUrl, setVideoUrl] = useState("");

  const addBlock = (b: MediaBlock) => onChange([...(value || []), b]);
  const updateBlock = (i: number, patch: Partial<MediaBlock>) => {
    const next = [...value];
    next[i] = { ...next[i], ...patch } as MediaBlock;
    onChange(next);
  };
  const removeBlock = (i: number) => onChange(value.filter((_, idx) => idx !== i));
  const move = (i: number, dir: -1 | 1) => {
    const j = i + dir;
    if (j < 0 || j >= value.length) return;
    const next = [...value];
    [next[i], next[j]] = [next[j], next[i]];
    onChange(next);
  };

  async function uploadFile(file: File, kind: "image" | "audio") {
    if (!ownerId) {
      toast.error("Sessão inválida. Faça login novamente.");
      return;
    }
    const maxMB = kind === "image" ? 5 : 15;
    if (file.size > maxMB * 1024 * 1024) {
      toast.error(`Arquivo grande demais (máx. ${maxMB}MB).`);
      return;
    }
    setUploading(kind);
    try {
      const ext = file.name.split(".").pop() || (kind === "image" ? "png" : "mp3");
      const path = `${ownerId}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
      const { error } = await supabase.storage
        .from("question-media")
        .upload(path, file, { contentType: file.type, upsert: false });
      if (error) throw error;
      const { data } = supabase.storage.from("question-media").getPublicUrl(path);
      addBlock({ type: kind, url: data.publicUrl });
      toast.success("Mídia adicionada");
    } catch (e: any) {
      toast.error(e.message || "Falha no upload");
    } finally {
      setUploading(null);
    }
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-2">
        <label>
          <input
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) uploadFile(f, "image");
              e.target.value = "";
            }}
          />
          <Button type="button" variant="outline" size="sm" disabled={uploading === "image"} asChild>
            <span className="cursor-pointer">
              {uploading === "image" ? (
                <Loader2 className="w-4 h-4 mr-1 animate-spin" />
              ) : (
                <ImagePlus className="w-4 h-4 mr-1" />
              )}
              Imagem
            </span>
          </Button>
        </label>

        <label>
          <input
            type="file"
            accept="audio/*"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) uploadFile(f, "audio");
              e.target.value = "";
            }}
          />
          <Button type="button" variant="outline" size="sm" disabled={uploading === "audio"} asChild>
            <span className="cursor-pointer">
              {uploading === "audio" ? (
                <Loader2 className="w-4 h-4 mr-1 animate-spin" />
              ) : (
                <Music className="w-4 h-4 mr-1" />
              )}
              Áudio
            </span>
          </Button>
        </label>

        <div className="flex items-center gap-1">
          <Input
            placeholder="URL do vídeo (YouTube/Vimeo/MP4)"
            value={videoUrl}
            onChange={(e) => setVideoUrl(e.target.value)}
            className="h-9 w-56"
          />
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => {
              if (!videoUrl.trim()) return;
              addBlock({ type: "video", url: videoUrl.trim() });
              setVideoUrl("");
            }}
          >
            <Video className="w-4 h-4 mr-1" />
            Vídeo
          </Button>
        </div>
      </div>

      {value.length > 0 && (
        <div className="space-y-2">
          {value.map((b, i) => (
            <Card key={i} className="p-3 space-y-2">
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2 text-xs font-semibold uppercase text-muted-foreground">
                  <GripVertical className="w-4 h-4" />
                  {b.type === "image" ? "Imagem" : b.type === "video" ? "Vídeo" : "Áudio"}
                  <a href={b.url} target="_blank" rel="noreferrer" className="text-primary hover:underline inline-flex items-center gap-1">
                    abrir <ExternalLink className="w-3 h-3" />
                  </a>
                </div>
                <div className="flex gap-1">
                  <Button type="button" variant="ghost" size="icon" className="h-7 w-7" onClick={() => move(i, -1)} disabled={i === 0}>
                    <ArrowUp className="w-3.5 h-3.5" />
                  </Button>
                  <Button type="button" variant="ghost" size="icon" className="h-7 w-7" onClick={() => move(i, 1)} disabled={i === value.length - 1}>
                    <ArrowDown className="w-3.5 h-3.5" />
                  </Button>
                  <Button type="button" variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => removeBlock(i)}>
                    <Trash2 className="w-3.5 h-3.5" />
                  </Button>
                </div>
              </div>
              <MediaBlockView block={b} />
              <div className="grid gap-1">
                <Label className="text-xs">Legenda (opcional)</Label>
                <Input
                  value={b.caption || ""}
                  onChange={(e) => updateBlock(i, { caption: e.target.value })}
                  placeholder="Ex.: Radiografia de tórax PA"
                  className="h-8"
                />
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Helper textarea hint for teachers ─────────────────────────────────────

export function RichTextHelp() {
  return (
    <p className="text-[11px] text-muted-foreground leading-snug">
      Suporta Markdown (negrito **, listas, tabelas |) e LaTeX entre $…$ ou $$…$$. Ex.: $K_a = 1{,}8 \times 10^{-5}$.
    </p>
  );
}
