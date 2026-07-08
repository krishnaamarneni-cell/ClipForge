'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import {
  ChevronLeft, Send, Download, Youtube, Instagram, Music2,
  Twitter, Linkedin, CheckCircle2, AlertCircle, Clock, ExternalLink,
  Copy, Loader2
} from 'lucide-react';
import { cn, platformLabel, formatDuration } from '@/lib/utils';
import type { Platform } from '@/types';

interface ClipData {
  id: string;
  title: string;
  description: string;
  hashtags: string[];
  duration: number;
  engagementScore: number;
  status: string;
  outputPath: string | null;
  platforms: string[];
}

interface ProjectData {
  id: string;
  title: string;
  clips: ClipData[];
}

const PLATFORM_ICONS: Record<string, typeof Youtube> = {
  youtube_shorts: Youtube,
  instagram_reels: Instagram,
  tiktok: Music2,
  x_video: Twitter,
  linkedin: Linkedin,
};

export default function PublishPage() {
  const params = useParams();
  const router = useRouter();
  const projectId = params.id as string;

  const [project, setProject] = useState<ProjectData | null>(null);
  const [selectedClips, setSelectedClips] = useState<Set<string>>(new Set());
  const [selectedPlatform, setSelectedPlatform] = useState<Platform>('youtube_shorts');
  const [publishMethod, setPublishMethod] = useState<'download' | 'youtube' | 'buffer' | 'make'>('download');
  const [publishing, setPublishing] = useState(false);
  const [results, setResults] = useState<Record<string, { success: boolean; message: string }>>({});

  useEffect(() => {
    fetch(`/api/projects/${projectId}`)
      .then(r => r.json())
      .then(data => {
        setProject(data);
        const rendered = data.clips?.filter((c: ClipData) => c.status === 'rendered') || [];
        setSelectedClips(new Set(rendered.map((c: ClipData) => c.id)));
      });
  }, [projectId]);

  const toggleClip = (clipId: string) => {
    const next = new Set(selectedClips);
    if (next.has(clipId)) next.delete(clipId);
    else next.add(clipId);
    setSelectedClips(next);
  };

  const handlePublish = async () => {
    if (selectedClips.size === 0) return;
    setPublishing(true);
    const newResults: Record<string, { success: boolean; message: string }> = {};

    for (const clipId of Array.from(selectedClips)) {
      try {
        if (publishMethod === 'download') {
          newResults[clipId] = { success: true, message: 'Ready for download' };
        } else {
          const res = await fetch(`/api/clips/${clipId}/publish`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ platform: selectedPlatform, method: publishMethod }),
          });
          const data = await res.json();
          newResults[clipId] = res.ok
            ? { success: true, message: data.message || 'Published successfully' }
            : { success: false, message: data.error || 'Failed to publish' };
        }
      } catch {
        newResults[clipId] = { success: false, message: 'Network error' };
      }
    }

    setResults(newResults);
    setPublishing(false);
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
  };

  if (!project) {
    return (
      <div className="flex items-center justify-center h-full">
        <Loader2 className="w-8 h-8 animate-spin text-brand-500" />
      </div>
    );
  }

  const renderedClips = project.clips.filter(c => c.status === 'rendered');
  const allClips = project.clips;

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      <div className="flex items-center gap-4">
        <button onClick={() => router.push(`/project/${projectId}`)} className="btn-ghost p-2">
          <ChevronLeft className="w-5 h-5" />
        </button>
        <div>
          <h1 className="text-2xl font-bold">Publish Clips</h1>
          <p className="text-[var(--text-secondary)]">{project.title}</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Clip Selection */}
        <div className="lg:col-span-2 space-y-4">
          <h2 className="section-title">Select Clips to Publish</h2>

          {allClips.length === 0 ? (
            <div className="card text-center py-12">
              <AlertCircle className="w-12 h-12 mx-auto text-[var(--text-tertiary)] mb-4" />
              <p className="text-[var(--text-secondary)]">No clips available. Generate clips first.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {allClips.map(clip => {
                const isRendered = clip.status === 'rendered';
                const isSelected = selectedClips.has(clip.id);
                const result = results[clip.id];

                return (
                  <div
                    key={clip.id}
                    onClick={() => isRendered && toggleClip(clip.id)}
                    className={cn(
                      'card flex items-center gap-4 transition-all',
                      isRendered ? 'cursor-pointer' : 'opacity-50 cursor-not-allowed',
                      isSelected && 'border-brand-500 bg-brand-50/50 dark:bg-brand-900/10'
                    )}
                  >
                    <div className={cn(
                      'w-5 h-5 rounded-full border-2 flex items-center justify-center shrink-0',
                      isSelected ? 'border-brand-500 bg-brand-500' : 'border-[var(--border)]'
                    )}>
                      {isSelected && <CheckCircle2 className="w-4 h-4 text-white" />}
                    </div>

                    <div className="flex-1 min-w-0">
                      <p className="font-medium truncate">{clip.title}</p>
                      <div className="flex items-center gap-3 text-sm text-[var(--text-secondary)]">
                        <span>{formatDuration(clip.duration)}</span>
                        <span className={cn(
                          'badge',
                          clip.engagementScore >= 70 ? 'badge-success' : 'badge-warning'
                        )}>
                          {Math.round(clip.engagementScore)}% engagement
                        </span>
                        {!isRendered && (
                          <span className="badge-neutral">Not rendered</span>
                        )}
                      </div>
                    </div>

                    {result && (
                      <div className={cn('flex items-center gap-1 text-sm', result.success ? 'text-green-500' : 'text-red-500')}>
                        {result.success ? <CheckCircle2 className="w-4 h-4" /> : <AlertCircle className="w-4 h-4" />}
                        {result.message}
                      </div>
                    )}

                    {isRendered && !result && (
                      <div className="flex gap-2">
                        <button
                          onClick={e => { e.stopPropagation(); copyToClipboard(`${clip.title}\n\n${clip.description}\n\n${clip.hashtags.join(' ')}`); }}
                          className="btn-ghost p-2"
                          title="Copy metadata"
                        >
                          <Copy className="w-4 h-4" />
                        </button>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Publish Options */}
        <div className="space-y-4">
          <h2 className="section-title">Publishing Options</h2>

          <div className="card space-y-4">
            <div>
              <label className="text-sm font-medium text-[var(--text-secondary)] mb-2 block">Platform</label>
              <div className="grid grid-cols-2 gap-2">
                {(['youtube_shorts', 'instagram_reels', 'tiktok', 'x_video', 'linkedin'] as Platform[]).map(platform => {
                  const Icon = PLATFORM_ICONS[platform] || Send;
                  return (
                    <button
                      key={platform}
                      onClick={() => setSelectedPlatform(platform)}
                      className={cn(
                        'flex items-center gap-2 p-3 rounded-xl border text-sm transition-all',
                        selectedPlatform === platform
                          ? 'border-brand-500 bg-brand-50 dark:bg-brand-900/20 text-brand-600'
                          : 'border-[var(--border)] hover:bg-surface-1 dark:hover:bg-surface-dark-2'
                      )}
                    >
                      <Icon className="w-4 h-4" />
                      <span className="truncate">{platformLabel(platform)}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            <div>
              <label className="text-sm font-medium text-[var(--text-secondary)] mb-2 block">Method</label>
              <div className="space-y-2">
                {[
                  { value: 'download', label: 'Download Files', icon: Download, desc: 'Save to local disk' },
                  { value: 'youtube', label: 'YouTube Direct', icon: Youtube, desc: 'Upload via YouTube API' },
                  { value: 'buffer', label: 'Buffer', icon: Send, desc: 'Schedule via Buffer' },
                  { value: 'make', label: 'Make Webhook', icon: ExternalLink, desc: 'Trigger Make scenario' },
                ].map(method => (
                  <button
                    key={method.value}
                    onClick={() => setPublishMethod(method.value as typeof publishMethod)}
                    className={cn(
                      'w-full flex items-center gap-3 p-3 rounded-xl border text-left transition-all',
                      publishMethod === method.value
                        ? 'border-brand-500 bg-brand-50 dark:bg-brand-900/20'
                        : 'border-[var(--border)] hover:bg-surface-1 dark:hover:bg-surface-dark-2'
                    )}
                  >
                    <method.icon className="w-5 h-5 shrink-0" />
                    <div>
                      <p className="font-medium text-sm">{method.label}</p>
                      <p className="text-xs text-[var(--text-tertiary)]">{method.desc}</p>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          </div>

          <button
            onClick={handlePublish}
            disabled={selectedClips.size === 0 || publishing}
            className="btn-primary w-full flex items-center justify-center gap-2"
          >
            {publishing ? (
              <>
                <Loader2 className="w-5 h-5 animate-spin" />
                Publishing...
              </>
            ) : (
              <>
                <Send className="w-5 h-5" />
                {publishMethod === 'download' ? 'Download' : 'Publish'} {selectedClips.size} Clip{selectedClips.size !== 1 ? 's' : ''}
              </>
            )}
          </button>

          {selectedClips.size > 0 && (
            <div className="card bg-brand-50 dark:bg-brand-900/10 border-brand-200 dark:border-brand-800">
              <h3 className="font-medium text-sm mb-2">Generated Metadata Preview</h3>
              {(() => {
                const clip = allClips.find(c => selectedClips.has(c.id));
                if (!clip) return null;
                return (
                  <div className="space-y-2 text-sm text-[var(--text-secondary)]">
                    <p><strong>Title:</strong> {clip.title}</p>
                    <p className="line-clamp-2"><strong>Description:</strong> {clip.description}</p>
                    <p><strong>Tags:</strong> {clip.hashtags?.join(', ')}</p>
                  </div>
                );
              })()}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
