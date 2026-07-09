'use client';

import { useEffect, useState, useRef } from 'react';
import { useParams, useRouter } from 'next/navigation';
import {
  ArrowLeft,
  CheckCircle2,
  Circle,
  Loader2,
  Clock,
  Scissors,
  Play,
  Pencil,
  Film,
  Share2,
  Download,
  Sparkles,
  MessageSquareQuote,
  BarChart3,
  AlertCircle,
  ChevronRight,
} from 'lucide-react';
import { cn, formatDuration, formatTimeAgo, scoreToColor, scoreToLabel, platformLabel } from '@/lib/utils';
import type {
  ProjectStatus,
  SourceType,
  ClipSuggestion,
  TranscriptSegment,
  TopicSegment,
  Hook,
  EmotionalPeak,
  KeyMoment,
  Platform,
} from '@/types';

interface ProjectDetail {
  id: string;
  title: string;
  sourceType: SourceType;
  sourceUrl: string | null;
  thumbnail: string | null;
  duration: number | null;
  status: ProjectStatus;
  error: string | null;
  createdAt: string;
  transcript: {
    fullText: string;
    segments: TranscriptSegment[];
  } | null;
  analysis: {
    mainTopic: string;
    topics: TopicSegment[];
    hooks: Hook[];
    emotionalPeaks: EmotionalPeak[];
    keyMoments: KeyMoment[];
    summary: string;
  } | null;
  clips: ClipDetail[];
}

interface ClipDetail {
  id: string;
  title: string;
  description: string;
  startTime: number;
  endTime: number;
  duration: number;
  engagementScore: number;
  topicCategory: string;
  platforms: Platform[];
  status: string;
}

type Tab = 'clips' | 'transcript' | 'analysis';

const PIPELINE_STEPS: { key: ProjectStatus; label: string }[] = [
  { key: 'downloading', label: 'Download' },
  { key: 'transcribing', label: 'Transcribe' },
  { key: 'analyzing', label: 'Analyze' },
  { key: 'ready', label: 'Generate Clips' },
];

const STEP_ORDER: ProjectStatus[] = ['pending', 'downloading', 'transcribing', 'analyzing', 'ready'];

function getStepState(step: ProjectStatus, current: ProjectStatus): 'completed' | 'active' | 'upcoming' {
  const stepIdx = STEP_ORDER.indexOf(step);
  const currentIdx = STEP_ORDER.indexOf(current);
  if (currentIdx > stepIdx) return 'completed';
  if (currentIdx === stepIdx) return 'active';
  return 'upcoming';
}

const EMOTION_COLORS: Record<string, string> = {
  excitement: 'bg-orange-500',
  humor: 'bg-yellow-500',
  inspiration: 'bg-blue-500',
  surprise: 'bg-purple-500',
  tension: 'bg-red-500',
  empathy: 'bg-pink-500',
};

export default function ProjectPage() {
  const params = useParams();
  const router = useRouter();
  const id = params.id as string;

  const [project, setProject] = useState<ProjectDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<Tab>('clips');
  const [selectedClips, setSelectedClips] = useState<Set<string>>(new Set());
  const [renderingClips, setRenderingClips] = useState<Set<string>>(new Set());
  const [exportClip, setExportClip] = useState<ClipDetail | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    fetchProject();
    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, [id]);

  async function fetchProject() {
    try {
      const res = await fetch(`/api/projects/${id}`);
      if (!res.ok) throw new Error('Not found');
      const data = await res.json();
      setProject(data);

      // Start polling if still processing
      const isProcessing = ['pending', 'downloading', 'transcribing', 'analyzing'].includes(data.status);
      if (isProcessing && !pollRef.current) {
        pollRef.current = setInterval(async () => {
          try {
            const r = await fetch(`/api/projects/${id}`);
            if (!r.ok) return;
            const updated = await r.json();
            setProject(updated);
            if (updated.status === 'ready' || updated.status === 'error') {
              if (pollRef.current) clearInterval(pollRef.current);
              pollRef.current = null;
            }
          } catch {}
        }, 3000);
      }
    } catch {
      // Project not found
    } finally {
      setLoading(false);
    }
  }

  function toggleClipSelection(clipId: string) {
    setSelectedClips((prev) => {
      const next = new Set(prev);
      if (next.has(clipId)) next.delete(clipId);
      else next.add(clipId);
      return next;
    });
  }

  async function handleRender(clip: ClipDetail) {
    setRenderingClips((prev) => new Set(prev).add(clip.id));
    try {
      const res = await fetch(`/api/clips/${clip.id}/render`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ platform: 'youtube_shorts', resolution: '1080x1920' }),
      });
      if (!res.ok) throw new Error('Render failed');
      setExportClip(clip);
    } catch {
      showToast('Failed to queue render');
    } finally {
      setRenderingClips((prev) => {
        const next = new Set(prev);
        next.delete(clip.id);
        return next;
      });
    }
  }

  async function handleRenderBatch() {
    const clipIds = selectedClips.size > 0
      ? project!.clips.filter((c) => selectedClips.has(c.id))
      : project!.clips;
    for (const clip of clipIds) {
      await handleRender(clip);
    }
    if (clipIds.length > 1) {
      showToast(`${clipIds.length} clips queued`);
    }
  }

  function showToast(message: string) {
    setToast(message);
    setTimeout(() => setToast(null), 3000);
  }

  function getYouTubeClipUrl(clip: ClipDetail): string | null {
    if (project?.sourceType !== 'youtube' || !project.sourceUrl) return null;
    const match = project.sourceUrl.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/shorts\/)([a-zA-Z0-9_-]{11})/);
    if (!match) return null;
    const startSec = Math.floor(clip.startTime);
    return `https://youtube.com/watch?v=${match[1]}&t=${startSec}`;
  }

  function copyClipContent(clip: ClipDetail) {
    const lines = [
      clip.title,
      '',
      clip.description,
      '',
      (clip.platforms || []).map((p) => platformLabel(p)).join(' | '),
      '',
      `Timestamps: ${formatDuration(clip.startTime)} - ${formatDuration(clip.endTime)} (${formatDuration(clip.duration)})`,
    ];
    const url = getYouTubeClipUrl(clip);
    if (url) lines.push(`Source: ${url}`);
    navigator.clipboard.writeText(lines.join('\n'));
    showToast('Clip details copied!');
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="w-8 h-8 animate-spin text-brand-500" />
      </div>
    );
  }

  if (!project) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen">
        <AlertCircle className="w-12 h-12 text-[var(--text-tertiary)] mb-4" />
        <p className="text-[var(--text-secondary)]">Project not found</p>
        <button onClick={() => router.push('/')} className="btn-primary mt-4">
          Back to Dashboard
        </button>
      </div>
    );
  }

  const isProcessing = ['pending', 'downloading', 'transcribing', 'analyzing'].includes(project.status);

  return (
    <div className="min-h-screen pb-24 animate-fade-in">
      <div className="max-w-5xl mx-auto p-6 md:p-8">
        {/* Back + Header */}
        <button onClick={() => router.push('/')} className="btn-ghost flex items-center gap-2 mb-6 -ml-4">
          <ArrowLeft className="w-4 h-4" />
          Dashboard
        </button>

        <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4 mb-8">
          <div>
            <h1 className="text-2xl font-bold text-[var(--text-primary)] mb-2">{project.title}</h1>
            <div className="flex flex-wrap items-center gap-3 text-sm text-[var(--text-tertiary)]">
              <span className="capitalize">{project.sourceType}</span>
              {project.duration != null && (
                <>
                  <span>&middot;</span>
                  <span className="inline-flex items-center gap-1">
                    <Clock className="w-3.5 h-3.5" />
                    {formatDuration(project.duration)}
                  </span>
                </>
              )}
              <span>&middot;</span>
              <span>{formatTimeAgo(project.createdAt)}</span>
            </div>
          </div>
          <StatusBadge status={project.status} />
        </div>

        {/* Error State */}
        {project.status === 'error' && project.error && (
          <div className="card border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-900/10 mb-8">
            <div className="flex items-start gap-3">
              <AlertCircle className="w-5 h-5 text-red-500 shrink-0 mt-0.5" />
              <div>
                <p className="font-medium text-red-700 dark:text-red-400">Processing failed</p>
                <p className="text-sm text-red-600 dark:text-red-300 mt-1">{project.error}</p>
              </div>
            </div>
          </div>
        )}

        {/* Processing Pipeline */}
        {isProcessing && (
          <div className="card mb-8">
            <h2 className="section-title">Processing Pipeline</h2>
            <div className="flex items-center gap-2">
              {PIPELINE_STEPS.map((step, i) => {
                const state = getStepState(step.key, project.status);
                return (
                  <div key={step.key} className="flex items-center flex-1">
                    <div className="flex flex-col items-center flex-1">
                      <div
                        className={cn(
                          'w-10 h-10 rounded-full flex items-center justify-center mb-2 transition-all',
                          state === 'completed' && 'bg-green-100 dark:bg-green-900/30',
                          state === 'active' && 'bg-brand-100 dark:bg-brand-900/30 ring-2 ring-brand-500 ring-offset-2 ring-offset-[var(--bg-card)]',
                          state === 'upcoming' && 'bg-surface-2 dark:bg-surface-dark-3',
                        )}
                      >
                        {state === 'completed' ? (
                          <CheckCircle2 className="w-5 h-5 text-green-500" />
                        ) : state === 'active' ? (
                          <Loader2 className="w-5 h-5 text-brand-500 animate-spin" />
                        ) : (
                          <Circle className="w-5 h-5 text-[var(--text-tertiary)]" />
                        )}
                      </div>
                      <span
                        className={cn(
                          'text-xs font-medium text-center',
                          state === 'active' ? 'text-brand-500' : 'text-[var(--text-tertiary)]',
                        )}
                      >
                        {step.label}
                      </span>
                    </div>
                    {i < PIPELINE_STEPS.length - 1 && (
                      <ChevronRight className="w-4 h-4 text-[var(--text-tertiary)] shrink-0 mb-6" />
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Ready Content */}
        {project.status === 'ready' && (
          <>
            {/* Tabs */}
            <div className="flex gap-1 mb-6 bg-surface-1 dark:bg-surface-dark-1 rounded-xl p-1 w-fit">
              {([
                { key: 'clips' as Tab, label: 'Clips', icon: Scissors, count: project.clips.length },
                { key: 'transcript' as Tab, label: 'Transcript', icon: MessageSquareQuote },
                { key: 'analysis' as Tab, label: 'Analysis', icon: BarChart3 },
              ]).map((tab) => {
                const Icon = tab.icon;
                return (
                  <button
                    key={tab.key}
                    onClick={() => setActiveTab(tab.key)}
                    className={cn(
                      'flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all duration-200',
                      activeTab === tab.key
                        ? 'bg-white dark:bg-surface-dark-2 text-[var(--text-primary)] shadow-sm'
                        : 'text-[var(--text-tertiary)] hover:text-[var(--text-secondary)]',
                    )}
                  >
                    <Icon className="w-4 h-4" />
                    {tab.label}
                    {tab.count != null && (
                      <span className="ml-1 px-1.5 py-0.5 rounded-md bg-brand-100 dark:bg-brand-900/30 text-brand-600 dark:text-brand-400 text-xs">
                        {tab.count}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>

            {/* Clips Tab */}
            {activeTab === 'clips' && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {project.clips.map((clip) => (
                  <div
                    key={clip.id}
                    className={cn(
                      'card transition-all duration-200',
                      selectedClips.has(clip.id) && 'ring-2 ring-brand-500 border-brand-500',
                    )}
                  >
                    <div className="flex items-start justify-between mb-3">
                      <div className="flex-1 min-w-0">
                        <h3 className="font-semibold text-[var(--text-primary)] line-clamp-1">{clip.title}</h3>
                        <p className="text-sm text-[var(--text-tertiary)] line-clamp-2 mt-1">{clip.description}</p>
                      </div>
                      <input
                        type="checkbox"
                        checked={selectedClips.has(clip.id)}
                        onChange={() => toggleClipSelection(clip.id)}
                        className="ml-3 mt-1 w-4 h-4 rounded accent-brand-600"
                      />
                    </div>

                    <div className="flex items-center gap-2 mb-3">
                      <span className="badge-neutral">
                        <Clock className="w-3 h-3 mr-1" />
                        {formatDuration(clip.duration)}
                      </span>
                      <span className="badge bg-surface-2 dark:bg-surface-dark-3 text-[var(--text-secondary)]">
                        {clip.topicCategory}
                      </span>
                    </div>

                    {/* Engagement Score */}
                    <div className="mb-3">
                      <div className="flex items-center justify-between text-xs mb-1">
                        <span className="text-[var(--text-tertiary)]">Engagement</span>
                        <span className={cn('font-semibold', scoreToColor(clip.engagementScore))}>
                          {clip.engagementScore}% &middot; {scoreToLabel(clip.engagementScore)}
                        </span>
                      </div>
                      <div className="h-1.5 bg-surface-2 dark:bg-surface-dark-3 rounded-full overflow-hidden">
                        <div
                          className={cn(
                            'h-full rounded-full transition-all',
                            clip.engagementScore >= 80 ? 'bg-green-500' :
                            clip.engagementScore >= 60 ? 'bg-yellow-500' :
                            clip.engagementScore >= 40 ? 'bg-orange-500' : 'bg-red-500',
                          )}
                          style={{ width: `${clip.engagementScore}%` }}
                        />
                      </div>
                    </div>

                    {/* Platforms */}
                    <div className="flex flex-wrap gap-1 mb-4">
                      {clip.platforms.map((p) => (
                        <span key={p} className="text-[10px] px-2 py-0.5 rounded-full bg-surface-2 dark:bg-surface-dark-3 text-[var(--text-tertiary)]">
                          {platformLabel(p)}
                        </span>
                      ))}
                    </div>

                    {/* Actions */}
                    <div className="flex gap-2">
                      <button
                        onClick={() => router.push(`/project/${id}/editor/${clip.id}`)}
                        className="btn-secondary flex-1 flex items-center justify-center gap-1.5 text-sm py-2"
                      >
                        <Pencil className="w-3.5 h-3.5" />
                        Edit
                      </button>
                      <button
                        onClick={() => handleRender(clip)}
                        disabled={renderingClips.has(clip.id)}
                        className="btn-primary flex-1 flex items-center justify-center gap-1.5 text-sm py-2 disabled:opacity-50"
                      >
                        {renderingClips.has(clip.id) ? (
                          <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        ) : (
                          <Film className="w-3.5 h-3.5" />
                        )}
                        {renderingClips.has(clip.id) ? 'Rendering...' : 'Render'}
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Transcript Tab */}
            {activeTab === 'transcript' && project.transcript && (
              <div className="card max-h-[600px] overflow-y-auto">
                <div className="space-y-1">
                  {project.transcript.segments.map((seg, i) => {
                    const isKeyMoment = project.analysis?.keyMoments?.some(
                      (km) => seg.start >= km.start && seg.end <= km.end,
                    );
                    return (
                      <div
                        key={i}
                        className={cn(
                          'flex gap-3 py-2 px-3 rounded-lg transition-colors',
                          isKeyMoment && 'bg-brand-50 dark:bg-brand-900/10 border-l-2 border-brand-500',
                        )}
                      >
                        <span className="text-xs text-[var(--text-tertiary)] font-mono w-14 shrink-0 pt-0.5">
                          {formatDuration(seg.start)}
                        </span>
                        <p className="text-sm text-[var(--text-primary)] leading-relaxed">
                          {seg.speaker && (
                            <span className="font-semibold text-brand-500 mr-1">{seg.speaker}:</span>
                          )}
                          {seg.text}
                        </p>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {activeTab === 'transcript' && !project.transcript && (
              <div className="card text-center py-12">
                <p className="text-[var(--text-tertiary)]">No transcript available</p>
              </div>
            )}

            {/* Analysis Tab */}
            {activeTab === 'analysis' && project.analysis && (
              <div className="space-y-6">
                {/* Summary */}
                <div className="card">
                  <h3 className="text-sm font-semibold text-[var(--text-secondary)] mb-2 uppercase tracking-wider">Summary</h3>
                  <p className="text-[var(--text-primary)] leading-relaxed">{project.analysis.summary}</p>
                </div>

                {/* Topic Breakdown */}
                <div className="card">
                  <h3 className="text-sm font-semibold text-[var(--text-secondary)] mb-4 uppercase tracking-wider">Topic Breakdown</h3>
                  <div className="space-y-3">
                    {project.analysis.topics.map((topic, i) => {
                      const topicDuration = topic.end - topic.start;
                      const pct = project.duration ? (topicDuration / project.duration) * 100 : 0;
                      return (
                        <div key={i}>
                          <div className="flex items-center justify-between text-sm mb-1">
                            <span className="text-[var(--text-primary)] font-medium">{topic.name}</span>
                            <span className="text-[var(--text-tertiary)]">
                              {formatDuration(topic.start)} - {formatDuration(topic.end)}
                            </span>
                          </div>
                          <div className="h-2 bg-surface-2 dark:bg-surface-dark-3 rounded-full overflow-hidden">
                            <div
                              className="h-full bg-brand-500 rounded-full"
                              style={{ width: `${pct}%` }}
                            />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Hooks Found */}
                <div className="card">
                  <h3 className="text-sm font-semibold text-[var(--text-secondary)] mb-4 uppercase tracking-wider">
                    Hooks Found ({project.analysis.hooks.length})
                  </h3>
                  <div className="space-y-3">
                    {project.analysis.hooks
                      .sort((a, b) => b.score - a.score)
                      .slice(0, 10)
                      .map((hook, i) => (
                        <div key={i} className="flex items-start gap-3 p-3 rounded-xl bg-surface-1 dark:bg-surface-dark-1">
                          <span className="text-xs font-mono text-[var(--text-tertiary)] w-12 shrink-0 pt-0.5">
                            {formatDuration(hook.timestamp)}
                          </span>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm text-[var(--text-primary)]">{hook.text}</p>
                            <div className="flex items-center gap-2 mt-1">
                              <span className="text-xs text-[var(--text-tertiary)] capitalize">{hook.type.replace(/_/g, ' ')}</span>
                              <span className={cn('text-xs font-semibold', scoreToColor(hook.score))}>
                                {hook.score}%
                              </span>
                            </div>
                          </div>
                        </div>
                      ))}
                  </div>
                </div>

                {/* Emotional Peaks */}
                {project.analysis.emotionalPeaks.length > 0 && (
                  <div className="card">
                    <h3 className="text-sm font-semibold text-[var(--text-secondary)] mb-4 uppercase tracking-wider">
                      Emotional Peaks
                    </h3>
                    <div className="flex items-end gap-1 h-32">
                      {project.analysis.emotionalPeaks.map((peak, i) => (
                        <div
                          key={i}
                          className="flex-1 flex flex-col items-center justify-end group relative"
                        >
                          <div
                            className={cn(
                              'w-full rounded-t-sm transition-all',
                              EMOTION_COLORS[peak.emotion] ?? 'bg-gray-500',
                              'group-hover:opacity-80',
                            )}
                            style={{ height: `${peak.intensity}%` }}
                          />
                          <div className="absolute -top-8 left-1/2 -translate-x-1/2 hidden group-hover:block bg-[var(--bg-card)] border border-[var(--border)] rounded-lg px-2 py-1 text-xs whitespace-nowrap shadow-md z-10">
                            <span className="capitalize">{peak.emotion}</span> &middot; {formatDuration(peak.timestamp)}
                          </div>
                        </div>
                      ))}
                    </div>
                    <div className="flex flex-wrap gap-3 mt-4">
                      {Object.entries(EMOTION_COLORS).map(([emotion, color]) => (
                        <div key={emotion} className="flex items-center gap-1.5 text-xs text-[var(--text-tertiary)]">
                          <div className={cn('w-2.5 h-2.5 rounded-sm', color)} />
                          <span className="capitalize">{emotion}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}

            {activeTab === 'analysis' && !project.analysis && (
              <div className="card text-center py-12">
                <p className="text-[var(--text-tertiary)]">No analysis available</p>
              </div>
            )}
          </>
        )}
      </div>

      {/* Export Modal */}
      {exportClip && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 backdrop-blur-sm animate-fade-in" onClick={() => setExportClip(null)}>
          <div className="bg-[var(--bg-card)] border border-[var(--border)] rounded-2xl shadow-2xl w-full max-w-lg mx-4 p-6" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-bold text-[var(--text-primary)]">Clip Export</h2>
              <button onClick={() => setExportClip(null)} className="text-[var(--text-tertiary)] hover:text-[var(--text-primary)] text-xl">&times;</button>
            </div>

            <div className="space-y-4">
              <div>
                <h3 className="font-semibold text-[var(--text-primary)] mb-1">{exportClip.title}</h3>
                <p className="text-sm text-[var(--text-secondary)]">{exportClip.description}</p>
              </div>

              <div className="grid grid-cols-2 gap-3 text-sm">
                <div className="p-3 rounded-xl bg-surface-1 dark:bg-surface-dark-1">
                  <span className="text-[var(--text-tertiary)]">Timestamps</span>
                  <p className="font-mono font-medium text-[var(--text-primary)]">
                    {formatDuration(exportClip.startTime)} → {formatDuration(exportClip.endTime)}
                  </p>
                </div>
                <div className="p-3 rounded-xl bg-surface-1 dark:bg-surface-dark-1">
                  <span className="text-[var(--text-tertiary)]">Duration</span>
                  <p className="font-mono font-medium text-[var(--text-primary)]">{formatDuration(exportClip.duration)}</p>
                </div>
              </div>

              <div className="p-3 rounded-xl bg-surface-1 dark:bg-surface-dark-1">
                <span className="text-xs text-[var(--text-tertiary)]">Platforms</span>
                <div className="flex flex-wrap gap-1 mt-1">
                  {exportClip.platforms.map((p) => (
                    <span key={p} className="text-xs px-2 py-0.5 rounded-full bg-brand-100 dark:bg-brand-900/30 text-brand-600 dark:text-brand-400">
                      {platformLabel(p)}
                    </span>
                  ))}
                </div>
              </div>

              {/* YouTube Preview Link */}
              {getYouTubeClipUrl(exportClip) && (
                <a
                  href={getYouTubeClipUrl(exportClip)!}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-2 p-3 rounded-xl bg-red-50 dark:bg-red-900/10 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-400 text-sm hover:bg-red-100 dark:hover:bg-red-900/20 transition-colors"
                >
                  <Play className="w-4 h-4" />
                  Preview clip on YouTube (starts at {formatDuration(exportClip.startTime)})
                </a>
              )}

              <div className="flex gap-2">
                <button
                  onClick={() => copyClipContent(exportClip)}
                  className="btn-secondary flex-1 flex items-center justify-center gap-2 text-sm"
                >
                  <Download className="w-4 h-4" />
                  Copy Details
                </button>
                <button
                  onClick={() => {
                    router.push(`/project/${id}/editor/${exportClip.id}`);
                    setExportClip(null);
                  }}
                  className="btn-primary flex-1 flex items-center justify-center gap-2 text-sm"
                >
                  <Pencil className="w-4 h-4" />
                  Edit Clip
                </button>
              </div>

              <p className="text-xs text-[var(--text-tertiary)] text-center">
                Render job queued. Video cutting requires a background worker — use timestamps above with any video editor to cut the clip.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Toast */}
      {toast && (
        <div className="fixed top-6 right-6 z-[70] bg-[var(--bg-card)] border border-[var(--border)] shadow-xl rounded-xl px-4 py-3 text-sm text-[var(--text-primary)] animate-fade-in">
          {toast}
        </div>
      )}

      {/* Floating Action Bar */}
      {project.status === 'ready' && project.clips.length > 0 && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50">
          <div className="flex items-center gap-3 px-6 py-3 rounded-2xl bg-[var(--bg-card)] border border-[var(--border)] shadow-2xl">
            {selectedClips.size > 0 && (
              <span className="text-sm text-[var(--text-secondary)]">
                {selectedClips.size} selected
              </span>
            )}
            <button onClick={handleRenderBatch} className="btn-secondary flex items-center gap-2 text-sm">
              <Film className="w-4 h-4" />
              Render {selectedClips.size > 0 ? 'Selected' : 'All'}
            </button>
            <button className="btn-primary flex items-center gap-2 text-sm">
              <Share2 className="w-4 h-4" />
              Publish {selectedClips.size > 0 ? 'Selected' : 'All'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function StatusBadge({ status }: { status: ProjectStatus }) {
  const config: Record<ProjectStatus, { label: string; class: string }> = {
    pending: { label: 'Pending', class: 'badge-neutral' },
    downloading: { label: 'Downloading', class: 'badge-info' },
    transcribing: { label: 'Transcribing', class: 'badge-warning' },
    analyzing: { label: 'Analyzing', class: 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400' },
    ready: { label: 'Ready', class: 'badge-success' },
    error: { label: 'Error', class: 'badge-danger' },
  };
  const c = config[status];
  return <span className={cn('badge', c.class)}>{c.label}</span>;
}
