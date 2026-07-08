'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import Link from 'next/link';
import {
  Film,
  Clock,
  Loader2,
  CheckCircle2,
  AlertCircle,
  Download,
  RotateCcw,
  Trash2,
  RefreshCw,
  Timer,
  MonitorPlay,
} from 'lucide-react';
import { cn, formatTimeAgo, platformLabel } from '@/lib/utils';
import type { RenderStatus, Platform } from '@/types';

interface RenderJob {
  id: string;
  platform: Platform;
  format: string;
  resolution: string;
  status: RenderStatus;
  progress: number;
  outputPath: string | null;
  error: string | null;
  startedAt: string | null;
  completedAt: string | null;
  createdAt: string;
  clip: {
    id: string;
    title: string;
    startTime: number;
    endTime: number;
    duration: number;
  };
  project: {
    id: string;
    title: string;
    sourceType: string;
  };
}

type FilterStatus = 'all' | RenderStatus;

const STATUS_CONFIG: Record<
  RenderStatus,
  { label: string; badge: string; icon: typeof Clock }
> = {
  queued: { label: 'Queued', badge: 'badge-neutral', icon: Clock },
  processing: { label: 'Processing', badge: 'badge-info', icon: Loader2 },
  completed: { label: 'Completed', badge: 'badge-success', icon: CheckCircle2 },
  failed: { label: 'Failed', badge: 'badge-danger', icon: AlertCircle },
};

const FILTER_TABS: { value: FilterStatus; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'queued', label: 'Queued' },
  { value: 'processing', label: 'Processing' },
  { value: 'completed', label: 'Completed' },
  { value: 'failed', label: 'Failed' },
];

export default function QueuePage() {
  const [jobs, setJobs] = useState<RenderJob[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<FilterStatus>('all');
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const fetchJobs = useCallback(async () => {
    try {
      const res = await fetch('/api/render/queue');
      if (res.ok) {
        const data = await res.json();
        setJobs(data);
      }
    } catch {
      // silent on poll errors
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchJobs();
  }, [fetchJobs]);

  // Poll while there are active jobs
  useEffect(() => {
    const hasActive = jobs.some((j) => j.status === 'queued' || j.status === 'processing');

    if (hasActive) {
      pollRef.current = setInterval(fetchJobs, 5000);
    }

    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, [jobs, fetchJobs]);

  const clearCompleted = useCallback(async () => {
    const completedIds = jobs.filter((j) => j.status === 'completed').map((j) => j.id);
    // In production this would be a batch DELETE endpoint
    setJobs((prev) => prev.filter((j) => j.status !== 'completed'));
  }, [jobs]);

  const retryJob = useCallback(
    async (jobId: string) => {
      // In production this would hit a retry endpoint
      setJobs((prev) =>
        prev.map((j) =>
          j.id === jobId ? { ...j, status: 'queued' as RenderStatus, progress: 0, error: null } : j
        )
      );
    },
    []
  );

  const filteredJobs = filter === 'all' ? jobs : jobs.filter((j) => j.status === filter);

  const counts: Record<RenderStatus, number> = {
    queued: jobs.filter((j) => j.status === 'queued').length,
    processing: jobs.filter((j) => j.status === 'processing').length,
    completed: jobs.filter((j) => j.status === 'completed').length,
    failed: jobs.filter((j) => j.status === 'failed').length,
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-brand-500" />
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto animate-fade-in">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-[var(--text-primary)] flex items-center gap-2.5">
            <Film className="w-6 h-6 text-brand-500" />
            Render Queue
          </h1>
          <p className="text-[var(--text-secondary)] text-sm mt-1">
            {jobs.length} total job{jobs.length !== 1 ? 's' : ''}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {counts.completed > 0 && (
            <button onClick={clearCompleted} className="btn-secondary flex items-center gap-1.5 text-sm">
              <Trash2 className="w-4 h-4" />
              <span className="hidden sm:inline">Clear Completed</span>
            </button>
          )}
          <button onClick={fetchJobs} className="btn-ghost p-2" title="Refresh">
            <RefreshCw className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
        {([
          { key: 'queued' as const, label: 'Queued', icon: Clock, color: 'text-gray-500' },
          { key: 'processing' as const, label: 'Processing', icon: Loader2, color: 'text-blue-500' },
          { key: 'completed' as const, label: 'Completed', icon: CheckCircle2, color: 'text-green-500' },
          { key: 'failed' as const, label: 'Failed', icon: AlertCircle, color: 'text-red-500' },
        ]).map((s) => {
          const Icon = s.icon;
          return (
            <div key={s.key} className="card !p-4 flex items-center gap-3">
              <div className={cn('p-2 rounded-lg bg-surface-2 dark:bg-surface-dark-2', s.color)}>
                <Icon className="w-4 h-4" />
              </div>
              <div>
                <p className="text-xl font-bold text-[var(--text-primary)]">{counts[s.key]}</p>
                <p className="text-xs text-[var(--text-tertiary)]">{s.label}</p>
              </div>
            </div>
          );
        })}
      </div>

      {/* Filter tabs */}
      <div className="flex items-center gap-1 mb-5 p-1 rounded-xl bg-surface-2 dark:bg-surface-dark-2 w-fit">
        {FILTER_TABS.map((tab) => (
          <button
            key={tab.value}
            onClick={() => setFilter(tab.value)}
            className={cn(
              'px-3.5 py-1.5 rounded-lg text-sm font-medium transition-all',
              filter === tab.value
                ? 'bg-[var(--bg-card)] text-[var(--text-primary)] shadow-sm'
                : 'text-[var(--text-tertiary)] hover:text-[var(--text-secondary)]'
            )}
          >
            {tab.label}
            {tab.value !== 'all' && counts[tab.value as RenderStatus] > 0 && (
              <span className="ml-1.5 text-xs opacity-70">
                {counts[tab.value as RenderStatus]}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Empty state */}
      {filteredJobs.length === 0 && (
        <div className="card flex flex-col items-center justify-center py-16 text-center">
          <div className="w-20 h-20 rounded-full bg-surface-2 dark:bg-surface-dark-2 flex items-center justify-center mb-4">
            <MonitorPlay className="w-8 h-8 text-[var(--text-tertiary)]" />
          </div>
          <h3 className="text-lg font-semibold text-[var(--text-primary)] mb-1">
            {filter === 'all' ? 'No render jobs yet' : `No ${filter} jobs`}
          </h3>
          <p className="text-sm text-[var(--text-tertiary)] max-w-sm">
            {filter === 'all'
              ? 'Render jobs will appear here when you export clips from your projects.'
              : 'Try a different filter to see other jobs.'}
          </p>
        </div>
      )}

      {/* Job list */}
      <div className="flex flex-col gap-3">
        {filteredJobs.map((job) => {
          const config = STATUS_CONFIG[job.status];
          const StatusIcon = config.icon;

          return (
            <div key={job.id} className="card !p-0 overflow-hidden">
              {/* Processing progress bar */}
              {job.status === 'processing' && (
                <div className="h-1 bg-surface-2 dark:bg-surface-dark-2">
                  <div
                    className="h-full bg-brand-500 transition-all duration-500 ease-out relative overflow-hidden"
                    style={{ width: `${job.progress}%` }}
                  >
                    <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/25 to-transparent animate-[shimmer_2s_infinite]" />
                  </div>
                </div>
              )}

              <div className="p-5">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    {/* Clip title */}
                    <h3 className="font-semibold text-[var(--text-primary)] truncate mb-1">
                      {job.clip.title}
                    </h3>

                    {/* Project link */}
                    <Link
                      href={`/project/${job.project.id}`}
                      className="text-sm text-brand-500 hover:text-brand-600 hover:underline transition-colors"
                    >
                      {job.project.title}
                    </Link>

                    {/* Meta row */}
                    <div className="flex flex-wrap items-center gap-2 mt-3">
                      <span className="badge-info">{platformLabel(job.platform)}</span>
                      <span className="text-xs text-[var(--text-tertiary)]">{job.resolution}</span>
                      <span className={cn(config.badge, 'inline-flex items-center gap-1')}>
                        <StatusIcon
                          className={cn(
                            'w-3 h-3',
                            job.status === 'processing' && 'animate-spin'
                          )}
                        />
                        {config.label}
                        {job.status === 'processing' && (
                          <span className="font-mono">{Math.round(job.progress)}%</span>
                        )}
                      </span>
                    </div>

                    {/* Error message */}
                    {job.status === 'failed' && job.error && (
                      <div className="mt-3 p-2.5 rounded-lg bg-red-50 dark:bg-red-900/10 border border-red-200 dark:border-red-900/30">
                        <p className="text-xs text-red-600 dark:text-red-400 font-mono">
                          {job.error}
                        </p>
                      </div>
                    )}

                    {/* Timestamps */}
                    <div className="flex flex-wrap items-center gap-3 mt-3 text-xs text-[var(--text-tertiary)]">
                      <span className="inline-flex items-center gap-1">
                        <Clock className="w-3 h-3" />
                        Created {formatTimeAgo(job.createdAt)}
                      </span>
                      {job.startedAt && (
                        <span className="inline-flex items-center gap-1">
                          <Timer className="w-3 h-3" />
                          Started {formatTimeAgo(job.startedAt)}
                        </span>
                      )}
                      {job.completedAt && (
                        <span className="inline-flex items-center gap-1">
                          <CheckCircle2 className="w-3 h-3" />
                          Finished {formatTimeAgo(job.completedAt)}
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex flex-col gap-2 shrink-0">
                    {job.status === 'completed' && job.outputPath && (
                      <a
                        href={job.outputPath}
                        download
                        className="btn-primary flex items-center gap-1.5 text-sm !px-3 !py-2"
                      >
                        <Download className="w-4 h-4" />
                        Download
                      </a>
                    )}
                    {job.status === 'failed' && (
                      <button
                        onClick={() => retryJob(job.id)}
                        className="btn-secondary flex items-center gap-1.5 text-sm"
                      >
                        <RotateCcw className="w-4 h-4" />
                        Retry
                      </button>
                    )}
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      <style jsx global>{`
        @keyframes shimmer {
          0% {
            transform: translateX(-100%);
          }
          100% {
            transform: translateX(200%);
          }
        }
      `}</style>
    </div>
  );
}
