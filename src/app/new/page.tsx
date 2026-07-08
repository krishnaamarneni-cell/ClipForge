'use client';

import { useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useDropzone } from 'react-dropzone';
import {
  ArrowLeft,
  Youtube,
  Upload,
  CloudUpload,
  FileVideo,
  FileAudio,
  Check,
  Loader2,
  Sparkles,
  MonitorPlay,
} from 'lucide-react';
import { cn, extractYouTubeId, platformLabel } from '@/lib/utils';
import type { CaptionStyle, Platform, ClipLength } from '@/types';
import { CAPTION_STYLES } from '@/types';

type InputMode = 'youtube' | 'upload';

const CLIP_LENGTHS: { value: ClipLength; label: string }[] = [
  { value: 30, label: '30s' },
  { value: 60, label: '60s' },
  { value: 120, label: '2min' },
  { value: 180, label: '3min' },
];

const PLATFORMS: { value: Platform; label: string }[] = [
  { value: 'youtube_shorts', label: 'YouTube Shorts' },
  { value: 'instagram_reels', label: 'Instagram Reels' },
  { value: 'tiktok', label: 'TikTok' },
  { value: 'x_video', label: 'X Video' },
  { value: 'linkedin', label: 'LinkedIn' },
];

const CAPTION_STYLE_PREVIEWS: { style: CaptionStyle; label: string; preview: string }[] = [
  { style: 'classic', label: 'Classic', preview: 'Clean subtitles at the bottom' },
  { style: 'highlight', label: 'Highlight', preview: 'Key words pop in gold' },
  { style: 'bold', label: 'Bold', preview: 'BIG TEXT with stroke' },
  { style: 'subtitle', label: 'Subtitle', preview: 'Traditional movie subtitles' },
  { style: 'colorful', label: 'Colorful', preview: 'Vibrant multi-color text' },
  { style: 'minimal', label: 'Minimal', preview: 'Small, understated text' },
];

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1048576) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1048576).toFixed(1)} MB`;
}

export default function NewProjectPage() {
  const router = useRouter();

  const [mode, setMode] = useState<InputMode>('youtube');
  const [youtubeUrl, setYoutubeUrl] = useState('');
  const [uploadedFile, setUploadedFile] = useState<File | null>(null);
  const [clipLengths, setClipLengths] = useState<ClipLength[]>([30, 60]);
  const [numClips, setNumClips] = useState(8);
  const [captionStyle, setCaptionStyle] = useState<CaptionStyle>('bold');
  const [platforms, setPlatforms] = useState<Platform[]>(['youtube_shorts', 'tiktok']);
  const [submitting, setSubmitting] = useState(false);

  const videoId = extractYouTubeId(youtubeUrl);

  const onDrop = useCallback((accepted: File[]) => {
    if (accepted.length > 0) setUploadedFile(accepted[0]);
  }, []);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'video/mp4': ['.mp4'],
      'video/webm': ['.webm'],
      'audio/mpeg': ['.mp3'],
      'audio/wav': ['.wav'],
    },
    maxFiles: 1,
  });

  function toggleClipLength(len: ClipLength) {
    setClipLengths((prev) =>
      prev.includes(len) ? prev.filter((l) => l !== len) : [...prev, len],
    );
  }

  function togglePlatform(p: Platform) {
    setPlatforms((prev) =>
      prev.includes(p) ? prev.filter((x) => x !== p) : [...prev, p],
    );
  }

  const canSubmit =
    (mode === 'youtube' ? !!videoId : !!uploadedFile) &&
    clipLengths.length > 0 &&
    platforms.length > 0;

  async function handleSubmit() {
    if (!canSubmit || submitting) return;
    setSubmitting(true);

    try {
      const body: Record<string, unknown> = {
        sourceType: mode,
        clipLengths,
        numClips,
        captionStyle,
        platforms,
      };

      if (mode === 'youtube') {
        body.sourceUrl = youtubeUrl;
      }

      // For upload mode, use FormData
      let res: Response;
      if (mode === 'upload' && uploadedFile) {
        const formData = new FormData();
        formData.append('file', uploadedFile);
        formData.append('config', JSON.stringify(body));
        res = await fetch('/api/projects', { method: 'POST', body: formData });
      } else {
        res = await fetch('/api/projects', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        });
      }

      if (!res.ok) throw new Error('Failed to create project');
      const data = await res.json();
      router.push(`/project/${data.id}`);
    } catch {
      setSubmitting(false);
    }
  }

  return (
    <div className="min-h-screen p-6 md:p-8 max-w-3xl mx-auto animate-fade-in">
      {/* Header */}
      <button onClick={() => router.push('/')} className="btn-ghost flex items-center gap-2 mb-6 -ml-4">
        <ArrowLeft className="w-4 h-4" />
        Back
      </button>

      <h1 className="text-2xl font-bold text-[var(--text-primary)] mb-8">Create New Project</h1>

      {/* Input Mode Tabs */}
      <div className="flex gap-2 mb-6">
        {[
          { key: 'youtube' as InputMode, label: 'YouTube URL', icon: Youtube },
          { key: 'upload' as InputMode, label: 'Upload File', icon: Upload },
        ].map((tab) => {
          const Icon = tab.icon;
          return (
            <button
              key={tab.key}
              onClick={() => setMode(tab.key)}
              className={cn(
                'flex items-center gap-2 px-5 py-3 rounded-xl font-medium transition-all duration-200',
                mode === tab.key
                  ? 'bg-brand-600 text-white shadow-md'
                  : 'bg-surface-2 dark:bg-surface-dark-2 text-[var(--text-secondary)] hover:bg-surface-3 dark:hover:bg-surface-dark-3',
              )}
            >
              <Icon className="w-4 h-4" />
              {tab.label}
            </button>
          );
        })}
      </div>

      {/* YouTube Input */}
      {mode === 'youtube' && (
        <div className="card mb-8">
          <label className="block text-sm font-medium text-[var(--text-secondary)] mb-2">
            YouTube Video URL
          </label>
          <div className="relative">
            <Youtube className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-red-500" />
            <input
              type="url"
              value={youtubeUrl}
              onChange={(e) => setYoutubeUrl(e.target.value)}
              placeholder="https://youtube.com/watch?v=..."
              className="input-field pl-12"
            />
          </div>

          {videoId && (
            <div className="mt-4 rounded-xl overflow-hidden border border-[var(--border)]">
              <img
                src={`https://img.youtube.com/vi/${videoId}/maxresdefault.jpg`}
                alt="Video thumbnail"
                className="w-full aspect-video object-cover"
                onError={(e) => {
                  (e.target as HTMLImageElement).src = `https://img.youtube.com/vi/${videoId}/hqdefault.jpg`;
                }}
              />
              <div className="p-3 bg-surface-1 dark:bg-surface-dark-1 flex items-center gap-2 text-sm text-[var(--text-secondary)]">
                <MonitorPlay className="w-4 h-4 text-red-500" />
                Video detected: {videoId}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Upload Input */}
      {mode === 'upload' && (
        <div className="card mb-8">
          {!uploadedFile ? (
            <div
              {...getRootProps()}
              className={cn(
                'border-2 border-dashed rounded-xl p-12 text-center cursor-pointer transition-all duration-200',
                isDragActive
                  ? 'border-brand-500 bg-brand-50/50 dark:bg-brand-900/10'
                  : 'border-[var(--border)] hover:border-brand-300 dark:hover:border-brand-700',
              )}
            >
              <input {...getInputProps()} />
              <CloudUpload className="w-12 h-12 text-[var(--text-tertiary)] mx-auto mb-4" />
              <p className="text-[var(--text-primary)] font-medium mb-1">
                {isDragActive ? 'Drop your file here' : 'Drag & drop your video or audio'}
              </p>
              <p className="text-sm text-[var(--text-tertiary)]">
                MP4, WebM, MP3, or WAV
              </p>
            </div>
          ) : (
            <div className="flex items-center gap-4 p-4 rounded-xl bg-surface-1 dark:bg-surface-dark-1">
              {uploadedFile.type.startsWith('video/') ? (
                <FileVideo className="w-10 h-10 text-brand-500 shrink-0" />
              ) : (
                <FileAudio className="w-10 h-10 text-brand-500 shrink-0" />
              )}
              <div className="min-w-0 flex-1">
                <p className="font-medium text-[var(--text-primary)] truncate">{uploadedFile.name}</p>
                <p className="text-sm text-[var(--text-tertiary)]">
                  {formatBytes(uploadedFile.size)} &middot; {uploadedFile.type.split('/')[1].toUpperCase()}
                </p>
              </div>
              <button
                onClick={() => setUploadedFile(null)}
                className="text-sm text-[var(--text-tertiary)] hover:text-[var(--text-primary)] transition-colors"
              >
                Remove
              </button>
            </div>
          )}
        </div>
      )}

      {/* Clip Settings */}
      <div className="card mb-8">
        <h2 className="section-title">Clip Settings</h2>

        {/* Clip Lengths */}
        <div className="mb-6">
          <label className="block text-sm font-medium text-[var(--text-secondary)] mb-3">
            Clip Lengths
          </label>
          <div className="flex flex-wrap gap-2">
            {CLIP_LENGTHS.map((len) => (
              <button
                key={len.value}
                onClick={() => toggleClipLength(len.value)}
                className={cn(
                  'px-4 py-2 rounded-xl text-sm font-medium transition-all duration-200 border',
                  clipLengths.includes(len.value)
                    ? 'bg-brand-600 text-white border-brand-600'
                    : 'bg-surface-1 dark:bg-surface-dark-2 text-[var(--text-secondary)] border-[var(--border)] hover:border-brand-300',
                )}
              >
                {clipLengths.includes(len.value) && <Check className="w-3.5 h-3.5 inline mr-1.5 -mt-0.5" />}
                {len.label}
              </button>
            ))}
          </div>
        </div>

        {/* Number of Clips */}
        <div className="mb-6">
          <label className="block text-sm font-medium text-[var(--text-secondary)] mb-3">
            Number of clips: <span className="text-brand-500 font-bold">{numClips}</span>
          </label>
          <input
            type="range"
            min={3}
            max={20}
            value={numClips}
            onChange={(e) => setNumClips(Number(e.target.value))}
            className="w-full accent-brand-600"
          />
          <div className="flex justify-between text-xs text-[var(--text-tertiary)] mt-1">
            <span>3</span>
            <span>20</span>
          </div>
        </div>

        {/* Caption Style */}
        <div className="mb-6">
          <label className="block text-sm font-medium text-[var(--text-secondary)] mb-3">
            Caption Style
          </label>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            {CAPTION_STYLE_PREVIEWS.map((cs) => {
              const config = CAPTION_STYLES[cs.style];
              return (
                <button
                  key={cs.style}
                  onClick={() => setCaptionStyle(cs.style)}
                  className={cn(
                    'relative p-4 rounded-xl border text-left transition-all duration-200',
                    captionStyle === cs.style
                      ? 'border-brand-500 bg-brand-50 dark:bg-brand-900/15 ring-1 ring-brand-500'
                      : 'border-[var(--border)] bg-surface-1 dark:bg-surface-dark-2 hover:border-brand-300',
                  )}
                >
                  {captionStyle === cs.style && (
                    <div className="absolute top-2 right-2 w-5 h-5 rounded-full bg-brand-600 flex items-center justify-center">
                      <Check className="w-3 h-3 text-white" />
                    </div>
                  )}
                  <p className="font-semibold text-sm text-[var(--text-primary)] mb-1">{cs.label}</p>
                  <p
                    className="text-xs leading-relaxed"
                    style={{
                      color: config.fontColor,
                      textShadow: config.strokeColor ? `1px 1px 2px ${config.strokeColor}` : undefined,
                      backgroundColor: config.bgColor ?? 'transparent',
                      borderRadius: '4px',
                      padding: config.bgColor ? '2px 4px' : undefined,
                    }}
                  >
                    {cs.preview}
                  </p>
                </button>
              );
            })}
          </div>
        </div>

        {/* Target Platforms */}
        <div>
          <label className="block text-sm font-medium text-[var(--text-secondary)] mb-3">
            Target Platforms
          </label>
          <div className="flex flex-wrap gap-2">
            {PLATFORMS.map((p) => (
              <button
                key={p.value}
                onClick={() => togglePlatform(p.value)}
                className={cn(
                  'px-4 py-2 rounded-full text-sm font-medium transition-all duration-200 border',
                  platforms.includes(p.value)
                    ? 'bg-brand-600 text-white border-brand-600'
                    : 'bg-surface-1 dark:bg-surface-dark-2 text-[var(--text-secondary)] border-[var(--border)] hover:border-brand-300',
                )}
              >
                {platforms.includes(p.value) && <Check className="w-3.5 h-3.5 inline mr-1.5 -mt-0.5" />}
                {p.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Submit */}
      <button
        onClick={handleSubmit}
        disabled={!canSubmit || submitting}
        className="btn-primary w-full py-4 text-base flex items-center justify-center gap-2"
      >
        {submitting ? (
          <>
            <Loader2 className="w-5 h-5 animate-spin" />
            Analyzing...
          </>
        ) : (
          <>
            <Sparkles className="w-5 h-5" />
            Analyze & Generate Clips
          </>
        )}
      </button>
    </div>
  );
}
