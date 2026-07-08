'use client';

import { useRef, useCallback } from 'react';
import { cn, formatDuration } from '@/lib/utils';

interface TimelineBarProps {
  duration: number;
  clipStart: number;
  clipEnd: number;
  keyMoments?: Array<{ start: number; type: string; score: number }>;
  currentTime: number;
  onSeek: (time: number) => void;
}

const MOMENT_COLORS: Record<string, string> = {
  hook: 'bg-yellow-400',
  climax: 'bg-red-400',
  insight: 'bg-blue-400',
  story: 'bg-purple-400',
  advice: 'bg-green-400',
  quote: 'bg-teal-400',
  reaction: 'bg-pink-400',
  emotional: 'bg-pink-400',
};

export default function TimelineBar({
  duration,
  clipStart,
  clipEnd,
  keyMoments = [],
  currentTime,
  onSeek,
}: TimelineBarProps) {
  const trackRef = useRef<HTMLDivElement>(null);

  const handleClick = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      const track = trackRef.current;
      if (!track || duration <= 0) return;
      const rect = track.getBoundingClientRect();
      const ratio = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
      onSeek(ratio * duration);
    },
    [duration, onSeek],
  );

  const pct = (t: number) => duration > 0 ? (t / duration) * 100 : 0;

  return (
    <div className="w-full space-y-1.5">
      <div
        ref={trackRef}
        onClick={handleClick}
        className="timeline-track group"
        role="slider"
        aria-valuemin={0}
        aria-valuemax={duration}
        aria-valuenow={currentTime}
        tabIndex={0}
      >
        {/* Full track background gradient */}
        <div className="absolute inset-0 bg-gradient-to-r from-surface-2 to-surface-3
                        dark:from-surface-dark-2 dark:to-surface-dark-3" />

        {/* Clip region highlight */}
        <div
          className="absolute top-0 bottom-0 bg-brand-500/20 dark:bg-brand-400/15
                     border-l-2 border-r-2 border-brand-500/50"
          style={{
            left: `${pct(clipStart)}%`,
            width: `${pct(clipEnd - clipStart)}%`,
          }}
        >
          <div className="absolute inset-0 bg-gradient-to-b from-brand-500/10 to-brand-500/5" />
        </div>

        {/* Key moment markers */}
        {keyMoments.map((m, i) => (
          <div
            key={i}
            className="absolute top-1/2 -translate-y-1/2 z-10"
            style={{ left: `${pct(m.start)}%` }}
            title={`${m.type} (${m.score})`}
          >
            <div
              className={cn(
                'w-2.5 h-2.5 rounded-full ring-2 ring-white/30 dark:ring-black/40 shadow-sm',
                'transition-transform group-hover:scale-125',
                MOMENT_COLORS[m.type] || 'bg-gray-400',
              )}
              style={{ opacity: 0.5 + m.score * 0.005 }}
            />
          </div>
        ))}

        {/* Playhead */}
        <div
          className="absolute top-0 bottom-0 z-20 transition-[left] duration-75"
          style={{ left: `${pct(currentTime)}%` }}
        >
          <div className="absolute -top-1 left-1/2 -translate-x-1/2 w-3 h-3
                         bg-white rounded-full shadow-md border-2 border-brand-500" />
          <div className="absolute top-2 bottom-0 left-1/2 -translate-x-1/2
                         w-0.5 bg-white/80 shadow-sm" />
        </div>

        {/* Hover tooltip area */}
        <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity">
          <div className="absolute inset-x-0 bottom-0 h-1 bg-gradient-to-t from-brand-500/30 to-transparent" />
        </div>
      </div>

      {/* Time labels */}
      <div className="flex items-center justify-between text-[11px] font-mono text-[var(--text-tertiary)]">
        <span>{formatDuration(clipStart)}</span>
        <span className="text-[var(--text-secondary)] font-medium">
          {formatDuration(currentTime)}
        </span>
        <span>{formatDuration(clipEnd)}</span>
      </div>
    </div>
  );
}
