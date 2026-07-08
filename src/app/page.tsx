'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  Plus,
  FolderOpen,
  Film,
  Video,
  Share2,
  Youtube,
  Upload,
  Podcast,
  Clock,
  Scissors,
  Loader2,
} from 'lucide-react';
import { cn, formatDuration, formatTimeAgo } from '@/lib/utils';
import type { ProjectStatus, SourceType } from '@/types';

interface ProjectSummary {
  id: string;
  title: string;
  sourceType: SourceType;
  sourceUrl: string | null;
  thumbnail: string | null;
  duration: number | null;
  status: ProjectStatus;
  createdAt: string;
  _count: { clips: number; renderJobs: number };
}

interface DashboardStats {
  totalProjects: number;
  clipsGenerated: number;
  videosRendered: number;
  published: number;
}

const STATUS_CONFIG: Record<ProjectStatus, { label: string; class: string }> = {
  pending: { label: 'Pending', class: 'badge-neutral' },
  downloading: { label: 'Downloading', class: 'badge-info' },
  transcribing: { label: 'Transcribing', class: 'badge-warning' },
  analyzing: { label: 'Analyzing', class: 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400' },
  ready: { label: 'Ready', class: 'badge-success' },
  error: { label: 'Error', class: 'badge-danger' },
};

const SOURCE_ICON: Record<SourceType, typeof Youtube> = {
  youtube: Youtube,
  upload: Upload,
  podcast: Podcast,
};

const SOURCE_LABEL: Record<SourceType, string> = {
  youtube: 'YouTube',
  upload: 'Upload',
  podcast: 'Podcast',
};

const GRADIENT_PLACEHOLDERS = [
  'from-brand-500 to-indigo-600',
  'from-pink-500 to-rose-600',
  'from-emerald-500 to-teal-600',
  'from-amber-500 to-orange-600',
  'from-violet-500 to-purple-600',
  'from-cyan-500 to-blue-600',
];

export default function DashboardPage() {
  const router = useRouter();
  const [projects, setProjects] = useState<ProjectSummary[]>([]);
  const [stats, setStats] = useState<DashboardStats>({
    totalProjects: 0,
    clipsGenerated: 0,
    videosRendered: 0,
    published: 0,
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchDashboard() {
      try {
        const res = await fetch('/api/projects');
        if (!res.ok) throw new Error('Failed to fetch');
        const data = await res.json();
        setProjects(data.projects ?? []);
        setStats(data.stats ?? stats);
      } catch {
        // API not ready yet -- show empty state
      } finally {
        setLoading(false);
      }
    }
    fetchDashboard();
  }, []);

  const statCards = [
    { label: 'Total Projects', value: stats.totalProjects, icon: FolderOpen, color: 'text-brand-500' },
    { label: 'Clips Generated', value: stats.clipsGenerated, icon: Scissors, color: 'text-emerald-500' },
    { label: 'Videos Rendered', value: stats.videosRendered, icon: Film, color: 'text-amber-500' },
    { label: 'Published', value: stats.published, icon: Share2, color: 'text-violet-500' },
  ];

  return (
    <div className="min-h-screen p-6 md:p-8 max-w-7xl mx-auto animate-fade-in">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold text-[var(--text-primary)]">ClipForge</h1>
          <p className="text-[var(--text-secondary)] mt-1">AI-powered short-form video creation</p>
        </div>
        <button onClick={() => router.push('/new')} className="btn-primary flex items-center gap-2">
          <Plus className="w-4 h-4" />
          New Project
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        {statCards.map((s) => {
          const Icon = s.icon;
          return (
            <div key={s.label} className="card flex items-center gap-4">
              <div className={cn('p-3 rounded-xl bg-surface-2 dark:bg-surface-dark-2', s.color)}>
                <Icon className="w-5 h-5" />
              </div>
              <div>
                <p className="text-2xl font-bold text-[var(--text-primary)]">{s.value}</p>
                <p className="text-xs text-[var(--text-tertiary)]">{s.label}</p>
              </div>
            </div>
          );
        })}
      </div>

      {/* Loading */}
      {loading && (
        <div className="flex items-center justify-center py-24">
          <Loader2 className="w-8 h-8 animate-spin text-brand-500" />
        </div>
      )}

      {/* Empty State */}
      {!loading && projects.length === 0 && (
        <div className="card flex flex-col items-center justify-center py-20 text-center">
          <div className="w-24 h-24 rounded-full bg-brand-50 dark:bg-brand-900/20 flex items-center justify-center mb-6">
            <Video className="w-10 h-10 text-brand-500" />
          </div>
          <h2 className="text-xl font-semibold text-[var(--text-primary)] mb-2">No projects yet</h2>
          <p className="text-[var(--text-secondary)] mb-6 max-w-md">
            Paste a YouTube URL or upload a video and ClipForge will automatically find the best moments for short-form clips.
          </p>
          <button onClick={() => router.push('/new')} className="btn-primary flex items-center gap-2">
            <Plus className="w-4 h-4" />
            Create your first project
          </button>
        </div>
      )}

      {/* Projects Grid */}
      {!loading && projects.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
          {projects.map((project, i) => {
            const SourceIcon = SOURCE_ICON[project.sourceType] ?? Upload;
            const statusConfig = STATUS_CONFIG[project.status];
            const gradient = GRADIENT_PLACEHOLDERS[i % GRADIENT_PLACEHOLDERS.length];

            return (
              <div
                key={project.id}
                onClick={() => router.push(`/project/${project.id}`)}
                className="card-hover group overflow-hidden"
              >
                {/* Thumbnail */}
                <div className="relative -mx-6 -mt-6 mb-4 h-40 overflow-hidden">
                  {project.thumbnail ? (
                    <img
                      src={project.thumbnail}
                      alt={project.title}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                    />
                  ) : (
                    <div className={cn('w-full h-full bg-gradient-to-br', gradient, 'flex items-center justify-center')}>
                      <Video className="w-10 h-10 text-white/60" />
                    </div>
                  )}
                  <div className="absolute top-3 right-3">
                    <span className={cn('badge', statusConfig.class)}>{statusConfig.label}</span>
                  </div>
                </div>

                {/* Info */}
                <h3 className="font-semibold text-[var(--text-primary)] mb-2 line-clamp-1 group-hover:text-brand-500 transition-colors">
                  {project.title}
                </h3>

                <div className="flex items-center gap-3 text-xs text-[var(--text-tertiary)] mb-3">
                  <span className="inline-flex items-center gap-1">
                    <SourceIcon className="w-3.5 h-3.5" />
                    {SOURCE_LABEL[project.sourceType]}
                  </span>
                  {project.duration != null && (
                    <span className="inline-flex items-center gap-1">
                      <Clock className="w-3.5 h-3.5" />
                      {formatDuration(project.duration)}
                    </span>
                  )}
                </div>

                <div className="flex items-center justify-between text-xs text-[var(--text-tertiary)]">
                  <span className="inline-flex items-center gap-1">
                    <Scissors className="w-3.5 h-3.5" />
                    {project._count.clips} clip{project._count.clips !== 1 ? 's' : ''}
                  </span>
                  <span>{formatTimeAgo(project.createdAt)}</span>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
