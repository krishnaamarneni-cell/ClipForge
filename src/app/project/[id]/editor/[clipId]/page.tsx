'use client';

import { useState, useCallback, useEffect, useRef } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  Play, Pause, Save, Film, ChevronLeft, Monitor, Smartphone,
  Hash, Sparkles, Type, AlignCenter, X, Plus, Loader2, Zap,
} from 'lucide-react';
import { cn, formatDuration, scoreToColor, scoreToLabel, platformLabel } from '@/lib/utils';
import { useClipForgeStore } from '@/store';
import type { CaptionStyle, Platform, KeyMoment } from '@/types';
import { CAPTION_STYLES } from '@/types';
import CaptionPreview from '@/components/editor/CaptionPreview';
import TimelineBar from '@/components/editor/TimelineBar';

const STYLE_NAMES: Record<CaptionStyle, string> = {
  classic: 'Classic',
  highlight: 'Highlight',
  bold: 'Bold',
  subtitle: 'Subtitle',
  colorful: 'Colorful',
  minimal: 'Minimal',
};

const ALL_STYLES: CaptionStyle[] = ['classic', 'highlight', 'bold', 'subtitle', 'colorful', 'minimal'];

const ANIMATIONS = [
  { value: 'fade', label: 'Fade' },
  { value: 'pop', label: 'Pop' },
  { value: 'typewriter', label: 'Typewriter' },
  { value: 'slide', label: 'Slide' },
];

const ALL_PLATFORMS: { value: Platform; label: string; icon: typeof Monitor }[] = [
  { value: 'youtube_shorts', label: 'YouTube Shorts', icon: Monitor },
  { value: 'instagram_reels', label: 'Instagram Reels', icon: Smartphone },
  { value: 'tiktok', label: 'TikTok', icon: Smartphone },
  { value: 'x_video', label: 'X Video', icon: Monitor },
  { value: 'linkedin', label: 'LinkedIn', icon: Monitor },
];

interface ClipData {
  id: string;
  title: string;
  hook: string;
  description: string;
  hashtags: string[];
  engagementScore: number;
  topicCategory: string;
  startTime: number;
  endTime: number;
  duration: number;
  platforms: Platform[];
  captionStyle: CaptionStyle;
  captionPosition: 'top' | 'center' | 'bottom';
  captionAnimation: string;
  keyMoments: KeyMoment[];
  projectDuration: number;
}

function EngagementGauge({ score }: { score: number }) {
  const circumference = 2 * Math.PI * 36;
  const filled = (score / 100) * circumference;
  const color = score >= 80 ? '#40c057' : score >= 60 ? '#fab005' : score >= 40 ? '#fd7e14' : '#fa5252';

  return (
    <div className="relative inline-flex items-center justify-center">
      <svg width="88" height="88" viewBox="0 0 88 88" className="-rotate-90">
        <circle cx="44" cy="44" r="36" fill="none"
          className="stroke-surface-2 dark:stroke-surface-dark-3" strokeWidth="6" />
        <circle cx="44" cy="44" r="36" fill="none" stroke={color} strokeWidth="6"
          strokeDasharray={circumference} strokeDashoffset={circumference - filled}
          strokeLinecap="round" className="transition-all duration-700" />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className={cn('text-xl font-bold', scoreToColor(score))}>{score}</span>
        <span className="text-[10px] text-[var(--text-tertiary)]">{scoreToLabel(score)}</span>
      </div>
    </div>
  );
}

export default function ClipEditorPage() {
  const params = useParams();
  const router = useRouter();
  const projectId = params.id as string;
  const clipId = params.clipId as string;

  const { captionStyle, setCaptionStyle, isPlaying, setIsPlaying, previewTime, setPreviewTime } =
    useClipForgeStore();

  const [clip, setClip] = useState<ClipData>({
    id: clipId,
    title: 'The Secret to 10x Productivity',
    hook: 'What if everything you knew about productivity was wrong?',
    description: 'Discover the surprising truth behind peak performance and why most advice fails.',
    hashtags: ['productivity', 'mindset', 'growth'],
    engagementScore: 82,
    topicCategory: 'Self Improvement',
    startTime: 45,
    endTime: 105,
    duration: 60,
    platforms: ['youtube_shorts', 'tiktok'],
    captionStyle: captionStyle,
    captionPosition: CAPTION_STYLES[captionStyle].position,
    captionAnimation: CAPTION_STYLES[captionStyle].animation,
    keyMoments: [
      { start: 48, end: 52, type: 'hook', description: 'Opening hook', score: 92, text: 'What if everything you knew was wrong?' },
      { start: 65, end: 72, type: 'insight', description: 'Core insight', score: 85, text: 'The real key is deliberate rest' },
      { start: 88, end: 95, type: 'quote', description: 'Memorable quote', score: 78, text: 'Work less, achieve more' },
    ],
    projectDuration: 600,
  });

  const [hashtagInput, setHashtagInput] = useState('');
  const [saving, setSaving] = useState(false);
  const [rendering, setRendering] = useState(false);
  const [loading, setLoading] = useState(true);
  const [previewPlatform, setPreviewPlatform] = useState<Platform | null>(null);

  useEffect(() => {
    fetch(`/api/clips/${clipId}`)
      .then(res => res.ok ? res.json() : null)
      .then(data => {
        if (data) {
          setClip(prev => ({
            ...prev,
            title: data.title ?? prev.title,
            hook: data.hook ?? prev.hook,
            description: data.description ?? prev.description,
            hashtags: Array.isArray(data.hashtags) ? data.hashtags : prev.hashtags,
            engagementScore: data.engagementScore > 1
              ? Math.round(data.engagementScore)
              : Math.round(data.engagementScore * 100),
            topicCategory: data.topicCategory ?? prev.topicCategory,
            startTime: data.startTime ?? prev.startTime,
            endTime: data.endTime ?? prev.endTime,
            duration: data.duration ?? prev.duration,
            platforms: Array.isArray(data.platforms) ? data.platforms : prev.platforms,
            captionStyle: data.captionStyle ?? prev.captionStyle,
            keyMoments: Array.isArray(data.captionData?.keyMoments) ? data.captionData.keyMoments : prev.keyMoments,
          }));
          if (data.captionStyle) {
            setCaptionStyle(data.captionStyle);
          }
        }
      })
      .finally(() => setLoading(false));
  }, [clipId, setCaptionStyle]);

  useEffect(() => {
    setPreviewTime(clip.startTime);
  }, [clip.startTime, setPreviewTime]);

  const timeRef = useRef(previewTime);
  timeRef.current = previewTime;

  useEffect(() => {
    if (!isPlaying) return;
    const interval = setInterval(() => {
      const next = timeRef.current + 0.1;
      if (next >= clip.endTime) {
        setIsPlaying(false);
        setPreviewTime(clip.startTime);
      } else {
        setPreviewTime(next);
      }
    }, 100);
    return () => clearInterval(interval);
  }, [isPlaying, clip.endTime, clip.startTime, setPreviewTime, setIsPlaying]);

  const updateClip = useCallback((updates: Partial<ClipData>) => {
    setClip(prev => ({ ...prev, ...updates }));
  }, []);

  const addHashtag = useCallback(() => {
    const tag = hashtagInput.trim().replace(/^#/, '').toLowerCase();
    if (tag && !clip.hashtags.includes(tag)) {
      updateClip({ hashtags: [...clip.hashtags, tag] });
    }
    setHashtagInput('');
  }, [hashtagInput, clip.hashtags, updateClip]);

  const removeHashtag = useCallback((tag: string) => {
    updateClip({ hashtags: clip.hashtags.filter(t => t !== tag) });
  }, [clip.hashtags, updateClip]);

  const handleStyleChange = useCallback((style: CaptionStyle) => {
    const config = CAPTION_STYLES[style];
    setCaptionStyle(style);
    updateClip({
      captionStyle: style,
      captionPosition: config.position,
      captionAnimation: config.animation,
    });
  }, [setCaptionStyle, updateClip]);

  const togglePlatform = useCallback((platform: Platform) => {
    const current = clip.platforms;
    if (current.includes(platform)) {
      if (current.length > 1) updateClip({ platforms: current.filter(p => p !== platform) });
    } else {
      updateClip({ platforms: [...current, platform] });
    }
  }, [clip.platforms, updateClip]);

  const handleSave = useCallback(async () => {
    setSaving(true);
    try {
      await fetch(`/api/clips/${clipId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(clip),
      });
    } finally {
      setSaving(false);
    }
  }, [clipId, clip]);

  const handleRender = useCallback(async () => {
    setRendering(true);
    try {
      await fetch(`/api/clips/${clipId}/render`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          captionStyle: clip.captionStyle,
          captionPosition: clip.captionPosition,
          captionAnimation: clip.captionAnimation,
          platforms: clip.platforms,
        }),
      });
    } finally {
      setRendering(false);
    }
  }, [clipId, clip.captionStyle, clip.captionPosition, clip.captionAnimation, clip.platforms]);

  return (
    <div className="min-h-screen bg-[var(--bg-primary)]">
      {/* Header */}
      <header className="sticky top-0 z-30 border-b border-[var(--border)] bg-[var(--bg-primary)]/80 backdrop-blur-xl">
        <div className="flex items-center justify-between px-4 sm:px-6 h-14">
          <div className="flex items-center gap-3">
            <Link
              href={`/project/${projectId}`}
              className="btn-ghost flex items-center gap-1.5 text-sm"
            >
              <ChevronLeft className="w-4 h-4" />
              <span className="hidden sm:inline">Back to Clips</span>
            </Link>
            <div className="w-px h-6 bg-[var(--border)]" />
            <div className="flex items-center gap-2">
              <Film className="w-4 h-4 text-brand-500" />
              <span className="text-sm font-medium text-[var(--text-primary)] truncate max-w-[200px]">
                {clip.title}
              </span>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={handleSave} disabled={saving} className="btn-secondary flex items-center gap-2 text-sm">
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
              <span className="hidden sm:inline">Save</span>
            </button>
            <button onClick={handleRender} disabled={rendering} className="btn-primary flex items-center gap-2 text-sm">
              {rendering ? <Loader2 className="w-4 h-4 animate-spin" /> : <Zap className="w-4 h-4" />}
              Render
            </button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <div className="flex flex-col lg:flex-row gap-0 lg:gap-0">
        {/* Left Panel -- Preview */}
        <div className="w-full lg:w-[60%] border-r-0 lg:border-r border-[var(--border)]">
          <div className="p-4 sm:p-6 lg:p-8 flex flex-col items-center">
            {/* Phone Frame */}
            <div className="relative w-full max-w-[340px] mx-auto">
              <div className="relative rounded-[2rem] border-[3px] border-surface-dark-3 dark:border-surface-dark-4
                              bg-black overflow-hidden shadow-2xl"
                   style={{ aspectRatio: '9/16' }}>
                {/* Status bar mockup */}
                <div className="absolute top-0 inset-x-0 z-20 flex items-center justify-between px-6 pt-3 text-white/60">
                  <span className="text-[10px] font-medium">9:41</span>
                  <div className="w-20 h-5 bg-black rounded-full" />
                  <div className="flex gap-1">
                    <div className="w-3.5 h-2 border border-white/40 rounded-sm">
                      <div className="w-2 h-full bg-white/40 rounded-sm" />
                    </div>
                  </div>
                </div>

                {/* Video area */}
                <div className="absolute inset-0 bg-gradient-to-b from-gray-900 via-gray-800 to-gray-900
                                flex items-center justify-center">
                  <div className="text-center space-y-2 opacity-40">
                    <Film className="w-10 h-10 text-white/40 mx-auto" />
                    <p className="text-xs text-white/40 font-mono">
                      {formatDuration(clip.startTime)} - {formatDuration(clip.endTime)}
                    </p>
                  </div>
                </div>

                {/* Safe zone indicators */}
                <div className="absolute inset-0 pointer-events-none z-10">
                  <div className="absolute top-[14%] left-[8%] right-[8%] bottom-[22%]
                                  border border-dashed border-white/10 rounded-lg" />
                </div>

                {/* Title overlay (first 1-3 seconds area) */}
                <div className="absolute top-[16%] inset-x-0 z-10 px-5">
                  <div className={cn(
                    'transition-opacity duration-500',
                    previewTime - clip.startTime < 3 ? 'opacity-100' : 'opacity-0',
                  )}>
                    <p className="text-white text-sm font-bold text-center leading-snug
                                  drop-shadow-[0_2px_4px_rgba(0,0,0,0.8)]">
                      {clip.title}
                    </p>
                  </div>
                </div>

                {/* Live caption preview */}
                <CaptionPreview
                  text={clip.hook || 'Your caption here'}
                  style={clip.captionStyle}
                  position={clip.captionPosition}
                  animation={clip.captionAnimation}
                />

                {/* Platform UI mockup -- bottom bar */}
                <div className="absolute bottom-0 inset-x-0 z-10 p-4 bg-gradient-to-t from-black/60 to-transparent">
                  <div className="flex items-end justify-between">
                    <div className="space-y-1 flex-1 mr-3">
                      <p className="text-white text-[10px] font-semibold truncate">@creator</p>
                      <p className="text-white/70 text-[9px] leading-tight line-clamp-2">{clip.description}</p>
                    </div>
                    <div className="flex flex-col items-center gap-3">
                      {['heart', 'comment', 'share'].map(a => (
                        <div key={a} className="w-6 h-6 rounded-full bg-white/20" />
                      ))}
                    </div>
                  </div>
                </div>
              </div>

              {/* Notch accent */}
              <div className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-28 h-1 bg-surface-dark-4 rounded-full" />
            </div>

            {/* Playback controls */}
            <div className="w-full max-w-[420px] mt-6 space-y-3">
              <div className="flex items-center gap-3">
                <button
                  onClick={() => setIsPlaying(!isPlaying)}
                  className="w-10 h-10 flex items-center justify-center rounded-full
                             bg-brand-600 hover:bg-brand-700 text-white transition-all
                             active:scale-95 shadow-lg shadow-brand-600/30"
                >
                  {isPlaying ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4 ml-0.5" />}
                </button>
                <div className="flex-1">
                  <TimelineBar
                    duration={clip.projectDuration}
                    clipStart={clip.startTime}
                    clipEnd={clip.endTime}
                    keyMoments={clip.keyMoments}
                    currentTime={previewTime}
                    onSeek={setPreviewTime}
                  />
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Right Panel -- Controls */}
        <div className="w-full lg:w-[40%] overflow-y-auto lg:h-[calc(100vh-3.5rem)]">
          <div className="p-4 sm:p-6 space-y-6">

            {/* Clip Info */}
            <section>
              <h3 className="section-title flex items-center gap-2">
                <Type className="w-4 h-4 text-brand-500" />
                Clip Info
              </h3>
              <div className="space-y-4">
                <div>
                  <label className="text-xs font-medium text-[var(--text-secondary)] mb-1.5 block">Title</label>
                  <input
                    type="text"
                    value={clip.title}
                    onChange={e => updateClip({ title: e.target.value })}
                    className="input-field text-sm"
                    placeholder="Clip title..."
                  />
                </div>
                <div>
                  <label className="text-xs font-medium text-[var(--text-secondary)] mb-1.5 block">Hook</label>
                  <input
                    type="text"
                    value={clip.hook}
                    onChange={e => updateClip({ hook: e.target.value })}
                    className="input-field text-sm"
                    placeholder="Opening hook text..."
                  />
                </div>
                <div>
                  <label className="text-xs font-medium text-[var(--text-secondary)] mb-1.5 block">Description</label>
                  <textarea
                    value={clip.description}
                    onChange={e => updateClip({ description: e.target.value })}
                    rows={3}
                    className="input-field text-sm resize-none"
                    placeholder="Clip description..."
                  />
                </div>

                {/* Hashtags */}
                <div>
                  <label className="text-xs font-medium text-[var(--text-secondary)] mb-1.5 block">
                    <Hash className="w-3 h-3 inline mr-1" />
                    Hashtags
                  </label>
                  <div className="flex flex-wrap gap-1.5 mb-2">
                    {clip.hashtags.map(tag => (
                      <span key={tag} className="badge-info flex items-center gap-1 pr-1">
                        #{tag}
                        <button onClick={() => removeHashtag(tag)}
                                className="hover:text-red-400 transition-colors">
                          <X className="w-3 h-3" />
                        </button>
                      </span>
                    ))}
                  </div>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={hashtagInput}
                      onChange={e => setHashtagInput(e.target.value)}
                      onKeyDown={e => e.key === 'Enter' && (e.preventDefault(), addHashtag())}
                      className="input-field text-sm flex-1"
                      placeholder="Add hashtag..."
                    />
                    <button onClick={addHashtag} className="btn-secondary px-3">
                      <Plus className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                {/* Engagement + Category row */}
                <div className="flex items-center gap-4">
                  <EngagementGauge score={clip.engagementScore} />
                  <div className="space-y-2">
                    <div>
                      <span className="text-[10px] uppercase tracking-wider text-[var(--text-tertiary)]">Category</span>
                      <div className="mt-0.5">
                        <span className="badge-neutral">
                          <Sparkles className="w-3 h-3 mr-1" />
                          {clip.topicCategory}
                        </span>
                      </div>
                    </div>
                    <div>
                      <span className="text-[10px] uppercase tracking-wider text-[var(--text-tertiary)]">Duration</span>
                      <p className="text-sm font-mono font-medium text-[var(--text-primary)]">
                        {formatDuration(clip.duration)}
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </section>

            <hr className="border-[var(--border)]" />

            {/* Caption Style */}
            <section>
              <h3 className="section-title flex items-center gap-2">
                <AlignCenter className="w-4 h-4 text-brand-500" />
                Caption Style
              </h3>

              {/* Style grid */}
              <div className="grid grid-cols-2 gap-2.5 mb-5">
                {ALL_STYLES.map(style => (
                  <button
                    key={style}
                    onClick={() => handleStyleChange(style)}
                    className={cn(
                      'relative rounded-xl overflow-hidden transition-all duration-200',
                      'border-2 group',
                      clip.captionStyle === style
                        ? 'border-brand-500 shadow-md shadow-brand-500/20 ring-1 ring-brand-500/30'
                        : 'border-[var(--border)] hover:border-brand-300 dark:hover:border-brand-700',
                    )}
                  >
                    {/* Mini preview container */}
                    <div className="relative bg-gray-900 h-20 flex items-center justify-center overflow-hidden">
                      <CaptionPreview
                        text="Amazing"
                        style={style}
                        position={CAPTION_STYLES[style].position}
                        animation="none"
                        isCompact
                      />
                    </div>
                    {/* Label */}
                    <div className={cn(
                      'px-2.5 py-1.5 text-xs font-medium text-center transition-colors',
                      clip.captionStyle === style
                        ? 'bg-brand-50 dark:bg-brand-900/30 text-brand-600 dark:text-brand-400'
                        : 'bg-[var(--bg-card)] text-[var(--text-secondary)]',
                    )}>
                      {STYLE_NAMES[style]}
                    </div>
                    {clip.captionStyle === style && (
                      <div className="absolute top-1.5 right-1.5 w-4 h-4 bg-brand-500 rounded-full
                                      flex items-center justify-center">
                        <svg className="w-2.5 h-2.5 text-white" viewBox="0 0 12 12" fill="none"
                             stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                          <path d="M2 6l3 3 5-5" />
                        </svg>
                      </div>
                    )}
                  </button>
                ))}
              </div>

              {/* Position selector */}
              <div className="space-y-3">
                <div>
                  <label className="text-xs font-medium text-[var(--text-secondary)] mb-1.5 block">Position</label>
                  <div className="flex gap-1.5">
                    {(['top', 'center', 'bottom'] as const).map(pos => (
                      <button
                        key={pos}
                        onClick={() => updateClip({ captionPosition: pos })}
                        className={cn(
                          'flex-1 py-2 text-xs font-medium rounded-lg transition-all',
                          clip.captionPosition === pos
                            ? 'bg-brand-600 text-white shadow-sm'
                            : 'bg-surface-1 dark:bg-surface-dark-2 text-[var(--text-secondary)] hover:bg-surface-2 dark:hover:bg-surface-dark-3',
                        )}
                      >
                        {pos.charAt(0).toUpperCase() + pos.slice(1)}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Animation selector */}
                <div>
                  <label className="text-xs font-medium text-[var(--text-secondary)] mb-1.5 block">Animation</label>
                  <div className="flex gap-1.5">
                    {ANIMATIONS.map(anim => (
                      <button
                        key={anim.value}
                        onClick={() => updateClip({ captionAnimation: anim.value })}
                        className={cn(
                          'flex-1 py-2 text-xs font-medium rounded-lg transition-all',
                          clip.captionAnimation === anim.value
                            ? 'bg-brand-600 text-white shadow-sm'
                            : 'bg-surface-1 dark:bg-surface-dark-2 text-[var(--text-secondary)] hover:bg-surface-2 dark:hover:bg-surface-dark-3',
                        )}
                      >
                        {anim.label}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </section>

            <hr className="border-[var(--border)]" />

            {/* Platform */}
            <section>
              <h3 className="section-title flex items-center gap-2">
                <Monitor className="w-4 h-4 text-brand-500" />
                Platforms
              </h3>
              <div className="space-y-2">
                {ALL_PLATFORMS.map(p => {
                  const Icon = p.icon;
                  const checked = clip.platforms.includes(p.value);
                  return (
                    <label
                      key={p.value}
                      className={cn(
                        'flex items-center gap-3 px-3 py-2.5 rounded-xl cursor-pointer transition-all',
                        'border',
                        checked
                          ? 'border-brand-500/40 bg-brand-50/50 dark:bg-brand-900/20'
                          : 'border-transparent hover:bg-surface-1 dark:hover:bg-surface-dark-2',
                      )}
                    >
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={() => togglePlatform(p.value)}
                        className="sr-only"
                      />
                      <div className={cn(
                        'w-5 h-5 rounded-md border-2 flex items-center justify-center transition-all',
                        checked
                          ? 'bg-brand-500 border-brand-500'
                          : 'border-[var(--border)]',
                      )}>
                        {checked && (
                          <svg className="w-3 h-3 text-white" viewBox="0 0 12 12" fill="none"
                               stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                            <path d="M2 6l3 3 5-5" />
                          </svg>
                        )}
                      </div>
                      <Icon className="w-4 h-4 text-[var(--text-tertiary)]" />
                      <span className="text-sm text-[var(--text-primary)]">{p.label}</span>
                    </label>
                  );
                })}
              </div>

              {/* Platform preview toggle */}
              {clip.platforms.length > 0 && (
                <div className="mt-3 flex gap-1.5">
                  <button
                    onClick={() => setPreviewPlatform(null)}
                    className={cn(
                      'px-3 py-1.5 text-xs rounded-lg transition-all',
                      !previewPlatform
                        ? 'bg-brand-600 text-white'
                        : 'bg-surface-1 dark:bg-surface-dark-2 text-[var(--text-secondary)]',
                    )}
                  >
                    Default
                  </button>
                  {clip.platforms.map(p => (
                    <button
                      key={p}
                      onClick={() => setPreviewPlatform(p)}
                      className={cn(
                        'px-3 py-1.5 text-xs rounded-lg transition-all',
                        previewPlatform === p
                          ? 'bg-brand-600 text-white'
                          : 'bg-surface-1 dark:bg-surface-dark-2 text-[var(--text-secondary)]',
                      )}
                    >
                      {platformLabel(p).split(' ')[0]}
                    </button>
                  ))}
                </div>
              )}
            </section>

            <hr className="border-[var(--border)]" />

            {/* Actions */}
            <section className="space-y-2.5 pb-8">
              <button
                onClick={handleSave}
                disabled={saving}
                className="btn-secondary w-full flex items-center justify-center gap-2"
              >
                {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                Save Changes
              </button>
              <button
                onClick={handleRender}
                disabled={rendering}
                className="btn-primary w-full flex items-center justify-center gap-2"
              >
                {rendering ? <Loader2 className="w-4 h-4 animate-spin" /> : <Zap className="w-4 h-4" />}
                Render Clip
              </button>
              <Link
                href={`/project/${projectId}`}
                className="btn-ghost w-full flex items-center justify-center gap-2 text-sm"
              >
                <ChevronLeft className="w-4 h-4" />
                Back to Clips
              </Link>
            </section>
          </div>
        </div>
      </div>
    </div>
  );
}
