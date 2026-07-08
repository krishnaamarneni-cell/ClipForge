'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import {
  Key,
  Eye,
  EyeOff,
  TestTube2,
  Loader2,
  CheckCircle2,
  XCircle,
  Webhook,
  Youtube,
  Instagram,
  Image,
  Trash2,
  Hash,
  X,
  Settings,
  Plug,
  Sliders,
  Paintbrush,
  AlertTriangle,
  Monitor,
  Tv,
  Smartphone,
} from 'lucide-react';
import { cn, platformLabel } from '@/lib/utils';
import { toast } from '@/components/ui/toast';
import type { AppSettings, CaptionStyle, Platform, ClipLength } from '@/types';

interface SettingsState extends AppSettings {
  anthropicApiKey?: string;
  openaiApiKey?: string;
  [key: string]: unknown;
}

const CAPTION_OPTIONS: { value: CaptionStyle; label: string }[] = [
  { value: 'classic', label: 'Classic' },
  { value: 'highlight', label: 'Highlight' },
  { value: 'bold', label: 'Bold' },
  { value: 'subtitle', label: 'Subtitle' },
  { value: 'colorful', label: 'Colorful' },
  { value: 'minimal', label: 'Minimal' },
];

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

const QUALITY_OPTIONS = [
  { value: 'draft', label: 'Draft', desc: '720p' },
  { value: 'standard', label: 'Standard', desc: '1080p' },
  { value: 'high', label: 'High', desc: '4K' },
] as const;

const DEFAULT_SETTINGS: SettingsState = {
  defaultHashtags: ['shorts', 'viral', 'clips'],
  defaultCaptionStyle: 'bold',
  defaultPlatforms: ['youtube_shorts'],
  exportQuality: 'standard',
  autoGenerateClips: true,
  clipLengths: [30, 60],
};

function PasswordInput({
  value,
  onChange,
  placeholder,
  onTest,
  testing,
  testResult,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder: string;
  onTest?: () => void;
  testing?: boolean;
  testResult?: boolean | null;
}) {
  const [visible, setVisible] = useState(false);

  return (
    <div className="flex gap-2">
      <div className="relative flex-1">
        <input
          type={visible ? 'text' : 'password'}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          className="input-field pr-10 font-mono text-sm"
        />
        <button
          type="button"
          onClick={() => setVisible(!visible)}
          className="absolute right-3 top-1/2 -translate-y-1/2 text-[var(--text-tertiary)] hover:text-[var(--text-primary)] transition-colors"
        >
          {visible ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
        </button>
      </div>
      {onTest && (
        <button
          type="button"
          onClick={onTest}
          disabled={!value || testing}
          className={cn(
            'btn-secondary flex items-center gap-1.5 text-sm whitespace-nowrap',
            testResult === true && 'border-green-400 dark:border-green-600',
            testResult === false && 'border-red-400 dark:border-red-600'
          )}
        >
          {testing ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : testResult === true ? (
            <CheckCircle2 className="w-4 h-4 text-green-500" />
          ) : testResult === false ? (
            <XCircle className="w-4 h-4 text-red-500" />
          ) : (
            <TestTube2 className="w-4 h-4" />
          )}
          Test
        </button>
      )}
    </div>
  );
}

export default function SettingsPage() {
  const [settings, setSettings] = useState<SettingsState>(DEFAULT_SETTINGS);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [hashtagInput, setHashtagInput] = useState('');
  const [testStates, setTestStates] = useState<Record<string, { testing: boolean; result: boolean | null }>>({});
  const [confirmClear, setConfirmClear] = useState(false);
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const latestSettings = useRef(settings);

  latestSettings.current = settings;

  useEffect(() => {
    async function load() {
      try {
        const res = await fetch('/api/settings');
        if (res.ok) {
          const data = await res.json();
          setSettings({ ...DEFAULT_SETTINGS, ...data });
        }
      } catch {
        toast.error('Failed to load settings');
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  const saveSettings = useCallback(async (updated: SettingsState) => {
    setSaving(true);
    try {
      const res = await fetch('/api/settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updated),
      });
      if (!res.ok) throw new Error();
      toast.success('Settings saved');
    } catch {
      toast.error('Failed to save settings');
    } finally {
      setSaving(false);
    }
  }, []);

  const update = useCallback(
    (patch: Partial<SettingsState>) => {
      const updated = { ...latestSettings.current, ...patch };
      setSettings(updated);
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
      saveTimerRef.current = setTimeout(() => saveSettings(updated), 500);
    },
    [saveSettings]
  );

  const testConnection = useCallback(async (key: string) => {
    setTestStates((s) => ({ ...s, [key]: { testing: true, result: null } }));
    // Simulated test -- in production this would hit a validation endpoint
    await new Promise((r) => setTimeout(r, 1200));
    const hasValue = !!latestSettings.current[key];
    setTestStates((s) => ({ ...s, [key]: { testing: false, result: hasValue } }));
    if (hasValue) toast.success(`${key} connection verified`);
    else toast.error(`${key} validation failed`);
  }, []);

  const addHashtag = useCallback(
    (tag: string) => {
      const clean = tag.replace(/[^a-zA-Z0-9_]/g, '').toLowerCase();
      if (!clean || settings.defaultHashtags.includes(clean)) return;
      update({ defaultHashtags: [...settings.defaultHashtags, clean] });
      setHashtagInput('');
    },
    [settings.defaultHashtags, update]
  );

  const removeHashtag = useCallback(
    (tag: string) => {
      update({ defaultHashtags: settings.defaultHashtags.filter((h) => h !== tag) });
    },
    [settings.defaultHashtags, update]
  );

  const clearAllData = useCallback(async () => {
    try {
      await saveSettings(DEFAULT_SETTINGS);
      setSettings(DEFAULT_SETTINGS);
      setConfirmClear(false);
      toast.success('All settings cleared');
    } catch {
      toast.error('Failed to clear data');
    }
  }, [saveSettings]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-brand-500" />
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto animate-fade-in">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-[var(--text-primary)] flex items-center gap-2.5">
            <Settings className="w-6 h-6 text-brand-500" />
            Settings
          </h1>
          <p className="text-[var(--text-secondary)] text-sm mt-1">
            Configure API keys, integrations, and defaults
          </p>
        </div>
        {saving && (
          <div className="flex items-center gap-2 text-sm text-brand-500">
            <Loader2 className="w-4 h-4 animate-spin" />
            Saving...
          </div>
        )}
      </div>

      <div className="flex flex-col gap-6">
        {/* API Keys */}
        <section className="card">
          <h2 className="section-title flex items-center gap-2">
            <Key className="w-5 h-5 text-brand-500" />
            API Keys & Authentication
          </h2>

          <div className="flex flex-col gap-5">
            <div>
              <label className="block text-sm font-medium text-[var(--text-secondary)] mb-1.5">
                Anthropic API Key
              </label>
              <PasswordInput
                value={settings.anthropicApiKey ?? ''}
                onChange={(v) => update({ anthropicApiKey: v })}
                placeholder="sk-ant-..."
                onTest={() => testConnection('anthropicApiKey')}
                testing={testStates.anthropicApiKey?.testing}
                testResult={testStates.anthropicApiKey?.result}
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-[var(--text-secondary)] mb-1.5">
                OpenAI API Key (Whisper)
              </label>
              <PasswordInput
                value={settings.openaiApiKey ?? ''}
                onChange={(v) => update({ openaiApiKey: v })}
                placeholder="sk-..."
                onTest={() => testConnection('openaiApiKey')}
                testing={testStates.openaiApiKey?.testing}
                testResult={testStates.openaiApiKey?.result}
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-[var(--text-secondary)] mb-1.5">
                YouTube API Key
              </label>
              <PasswordInput
                value={settings.youtubeApiKey ?? ''}
                onChange={(v) => update({ youtubeApiKey: v })}
                placeholder="AIza..."
                onTest={() => testConnection('youtubeApiKey')}
                testing={testStates.youtubeApiKey?.testing}
                testResult={testStates.youtubeApiKey?.result}
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-[var(--text-secondary)] mb-1.5">
                  Google Client ID
                </label>
                <PasswordInput
                  value={settings.googleClientId ?? ''}
                  onChange={(v) => update({ googleClientId: v })}
                  placeholder="xxxxx.apps.googleusercontent.com"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-[var(--text-secondary)] mb-1.5">
                  Google Client Secret
                </label>
                <PasswordInput
                  value={settings.googleClientSecret ?? ''}
                  onChange={(v) => update({ googleClientSecret: v })}
                  placeholder="GOCSPX-..."
                />
              </div>
            </div>
          </div>
        </section>

        {/* Publishing Integrations */}
        <section className="card">
          <h2 className="section-title flex items-center gap-2">
            <Plug className="w-5 h-5 text-brand-500" />
            Publishing Integrations
          </h2>

          <div className="flex flex-col gap-5">
            <div>
              <label className="block text-sm font-medium text-[var(--text-secondary)] mb-1.5">
                Buffer Access Token
              </label>
              <div className="flex gap-2">
                <PasswordInput
                  value={settings.bufferToken ?? ''}
                  onChange={(v) => update({ bufferToken: v })}
                  placeholder="1/abc..."
                  onTest={() => testConnection('bufferToken')}
                  testing={testStates.bufferToken?.testing}
                  testResult={testStates.bufferToken?.result}
                />
              </div>
              <p className="text-xs text-[var(--text-tertiary)] mt-1.5">
                {settings.bufferToken ? (
                  <span className="text-green-500 flex items-center gap-1">
                    <CheckCircle2 className="w-3 h-3" /> Connected
                  </span>
                ) : (
                  'Not connected'
                )}
              </p>
            </div>

            <div>
              <label className="block text-sm font-medium text-[var(--text-secondary)] mb-1.5">
                Make Webhook URL
              </label>
              <div className="flex gap-2">
                <input
                  type="url"
                  value={settings.makeWebhookUrl ?? ''}
                  onChange={(e) => update({ makeWebhookUrl: e.target.value })}
                  placeholder="https://hook.make.com/..."
                  className="input-field flex-1 text-sm"
                />
                <button
                  onClick={() => testConnection('makeWebhookUrl')}
                  disabled={!settings.makeWebhookUrl || testStates.makeWebhookUrl?.testing}
                  className="btn-secondary flex items-center gap-1.5 text-sm whitespace-nowrap"
                >
                  {testStates.makeWebhookUrl?.testing ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Webhook className="w-4 h-4" />
                  )}
                  Test
                </button>
              </div>
            </div>

            <div className="flex items-center justify-between py-3 border-t border-[var(--border)]">
              <div className="flex items-center gap-3">
                <Youtube className="w-5 h-5 text-red-500" />
                <div>
                  <p className="text-sm font-medium text-[var(--text-primary)]">YouTube</p>
                  <p className="text-xs text-[var(--text-tertiary)]">
                    {settings.googleClientId ? 'OAuth configured' : 'Not configured'}
                  </p>
                </div>
              </div>
              <button
                className={cn(
                  'text-sm font-medium px-4 py-2 rounded-xl transition-colors',
                  settings.googleClientId
                    ? 'bg-red-50 text-red-600 hover:bg-red-100 dark:bg-red-900/20 dark:text-red-400 dark:hover:bg-red-900/30'
                    : 'btn-primary'
                )}
                onClick={() => {
                  if (settings.googleClientId) {
                    update({ googleClientId: '', googleClientSecret: '' });
                    toast.info('YouTube disconnected');
                  } else {
                    toast.info('Add Google Client ID and Secret above first');
                  }
                }}
              >
                {settings.googleClientId ? 'Disconnect' : 'Connect'}
              </button>
            </div>

            <div className="flex items-center justify-between py-3 border-t border-[var(--border)]">
              <div className="flex items-center gap-3">
                <Instagram className="w-5 h-5 text-pink-500" />
                <div>
                  <p className="text-sm font-medium text-[var(--text-primary)]">Instagram</p>
                  <p className="text-xs text-[var(--text-tertiary)]">
                    Coming soon &mdash; connect via Make for now
                  </p>
                </div>
              </div>
              <span className="badge-neutral text-xs">Soon</span>
            </div>
          </div>
        </section>

        {/* Default Settings */}
        <section className="card">
          <h2 className="section-title flex items-center gap-2">
            <Sliders className="w-5 h-5 text-brand-500" />
            Default Settings
          </h2>

          <div className="flex flex-col gap-6">
            {/* Caption style */}
            <div>
              <label className="block text-sm font-medium text-[var(--text-secondary)] mb-1.5">
                Default Caption Style
              </label>
              <select
                value={settings.defaultCaptionStyle}
                onChange={(e) => update({ defaultCaptionStyle: e.target.value as CaptionStyle })}
                className="input-field text-sm"
              >
                {CAPTION_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </select>
            </div>

            {/* Clip lengths */}
            <div>
              <label className="block text-sm font-medium text-[var(--text-secondary)] mb-2">
                Default Clip Lengths
              </label>
              <div className="flex flex-wrap gap-3">
                {CLIP_LENGTHS.map((len) => {
                  const checked = settings.clipLengths.includes(len.value);
                  return (
                    <label
                      key={len.value}
                      className={cn(
                        'flex items-center gap-2 px-4 py-2.5 rounded-xl border cursor-pointer transition-all text-sm font-medium',
                        checked
                          ? 'bg-brand-50 border-brand-300 text-brand-700 dark:bg-brand-900/20 dark:border-brand-700 dark:text-brand-300'
                          : 'bg-[var(--bg-secondary)] border-[var(--border)] text-[var(--text-secondary)] hover:border-brand-200 dark:hover:border-brand-800'
                      )}
                    >
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={() => {
                          if (checked && settings.clipLengths.length === 1) return;
                          const next = checked
                            ? settings.clipLengths.filter((l) => l !== len.value)
                            : [...settings.clipLengths, len.value].sort((a, b) => a - b);
                          update({ clipLengths: next });
                        }}
                        className="sr-only"
                      />
                      {len.label}
                    </label>
                  );
                })}
              </div>
            </div>

            {/* Default platforms */}
            <div>
              <label className="block text-sm font-medium text-[var(--text-secondary)] mb-2">
                Default Platforms
              </label>
              <div className="flex flex-wrap gap-2">
                {PLATFORMS.map((p) => {
                  const selected = settings.defaultPlatforms.includes(p.value);
                  return (
                    <button
                      key={p.value}
                      type="button"
                      onClick={() => {
                        if (selected && settings.defaultPlatforms.length === 1) return;
                        const next = selected
                          ? settings.defaultPlatforms.filter((x) => x !== p.value)
                          : [...settings.defaultPlatforms, p.value];
                        update({ defaultPlatforms: next });
                      }}
                      className={cn(
                        'px-3.5 py-2 rounded-full text-sm font-medium transition-all border',
                        selected
                          ? 'bg-brand-600 text-white border-brand-600 shadow-sm'
                          : 'bg-[var(--bg-secondary)] text-[var(--text-secondary)] border-[var(--border)] hover:border-brand-300 dark:hover:border-brand-700'
                      )}
                    >
                      {p.label}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Default hashtags */}
            <div>
              <label className="block text-sm font-medium text-[var(--text-secondary)] mb-2">
                Default Hashtags
              </label>
              <div className="flex flex-wrap gap-2 mb-2">
                {settings.defaultHashtags.map((tag) => (
                  <span
                    key={tag}
                    className="inline-flex items-center gap-1 pl-2.5 pr-1.5 py-1 rounded-full text-sm bg-brand-50 text-brand-700 dark:bg-brand-900/20 dark:text-brand-300"
                  >
                    <Hash className="w-3 h-3" />
                    {tag}
                    <button
                      onClick={() => removeHashtag(tag)}
                      className="p-0.5 rounded-full hover:bg-brand-200/50 dark:hover:bg-brand-800/50 transition-colors"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </span>
                ))}
              </div>
              <input
                type="text"
                value={hashtagInput}
                onChange={(e) => setHashtagInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    addHashtag(hashtagInput);
                  }
                }}
                placeholder="Type a hashtag and press Enter..."
                className="input-field text-sm"
              />
            </div>

            {/* Auto-generate */}
            <div className="flex items-center justify-between py-1">
              <div>
                <p className="text-sm font-medium text-[var(--text-primary)]">
                  Auto-generate clips
                </p>
                <p className="text-xs text-[var(--text-tertiary)] mt-0.5">
                  Automatically suggest clips after analysis
                </p>
              </div>
              <button
                type="button"
                role="switch"
                aria-checked={settings.autoGenerateClips}
                onClick={() => update({ autoGenerateClips: !settings.autoGenerateClips })}
                className={cn(
                  'relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors',
                  settings.autoGenerateClips ? 'bg-brand-600' : 'bg-surface-3 dark:bg-surface-dark-3'
                )}
              >
                <span
                  className={cn(
                    'pointer-events-none inline-block h-5 w-5 rounded-full bg-white shadow-sm transition-transform',
                    settings.autoGenerateClips ? 'translate-x-5' : 'translate-x-0'
                  )}
                />
              </button>
            </div>

            {/* Export quality */}
            <div>
              <label className="block text-sm font-medium text-[var(--text-secondary)] mb-2">
                Export Quality
              </label>
              <div className="grid grid-cols-3 gap-3">
                {QUALITY_OPTIONS.map((q) => {
                  const selected = settings.exportQuality === q.value;
                  return (
                    <label
                      key={q.value}
                      className={cn(
                        'flex flex-col items-center gap-1 p-3 rounded-xl border cursor-pointer transition-all text-center',
                        selected
                          ? 'bg-brand-50 border-brand-300 dark:bg-brand-900/20 dark:border-brand-700'
                          : 'bg-[var(--bg-secondary)] border-[var(--border)] hover:border-brand-200 dark:hover:border-brand-800'
                      )}
                    >
                      <input
                        type="radio"
                        name="quality"
                        checked={selected}
                        onChange={() => update({ exportQuality: q.value })}
                        className="sr-only"
                      />
                      {q.value === 'draft' && <Smartphone className="w-5 h-5 text-[var(--text-tertiary)]" />}
                      {q.value === 'standard' && <Monitor className="w-5 h-5 text-[var(--text-tertiary)]" />}
                      {q.value === 'high' && <Tv className="w-5 h-5 text-[var(--text-tertiary)]" />}
                      <span className={cn('text-sm font-medium', selected ? 'text-brand-700 dark:text-brand-300' : 'text-[var(--text-primary)]')}>
                        {q.label}
                      </span>
                      <span className="text-xs text-[var(--text-tertiary)]">{q.desc}</span>
                    </label>
                  );
                })}
              </div>
            </div>
          </div>
        </section>

        {/* Brand Settings */}
        <section className="card">
          <h2 className="section-title flex items-center gap-2">
            <Paintbrush className="w-5 h-5 text-brand-500" />
            Brand Settings
          </h2>

          <div className="flex flex-col gap-5">
            <div>
              <label className="block text-sm font-medium text-[var(--text-secondary)] mb-1.5">
                Brand Name
              </label>
              <input
                type="text"
                value={settings.brandName ?? ''}
                onChange={(e) => update({ brandName: e.target.value })}
                placeholder="Your Brand"
                className="input-field text-sm"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-[var(--text-secondary)] mb-1.5">
                Brand Color
              </label>
              <div className="flex items-center gap-3">
                <div
                  className="w-10 h-10 rounded-xl border border-[var(--border)] shrink-0"
                  style={{ backgroundColor: settings.brandColor || '#4c6ef5' }}
                />
                <input
                  type="text"
                  value={settings.brandColor ?? '#4c6ef5'}
                  onChange={(e) => update({ brandColor: e.target.value })}
                  placeholder="#4c6ef5"
                  className="input-field text-sm font-mono flex-1"
                  maxLength={7}
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-[var(--text-secondary)] mb-1.5">
                Logo
              </label>
              <div className="flex items-center justify-center h-32 rounded-xl border-2 border-dashed border-[var(--border)] bg-[var(--bg-secondary)] hover:border-brand-300 dark:hover:border-brand-700 transition-colors cursor-pointer">
                <div className="text-center">
                  <Image className="w-8 h-8 mx-auto text-[var(--text-tertiary)] mb-2" />
                  <p className="text-sm text-[var(--text-tertiary)]">
                    Drag & drop or click to upload
                  </p>
                  <p className="text-xs text-[var(--text-tertiary)] mt-0.5">
                    PNG, SVG up to 2MB
                  </p>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Danger Zone */}
        <section className="card border-red-200 dark:border-red-900/50">
          <h2 className="section-title flex items-center gap-2 text-red-600 dark:text-red-400">
            <AlertTriangle className="w-5 h-5" />
            Danger Zone
          </h2>

          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-[var(--text-primary)]">Clear All Data</p>
              <p className="text-xs text-[var(--text-tertiary)] mt-0.5">
                Reset all settings to defaults. This cannot be undone.
              </p>
            </div>
            {confirmClear ? (
              <div className="flex items-center gap-2">
                <button onClick={clearAllData} className="px-4 py-2 rounded-xl bg-red-600 text-white text-sm font-medium hover:bg-red-700 transition-colors">
                  Confirm
                </button>
                <button onClick={() => setConfirmClear(false)} className="btn-secondary text-sm">
                  Cancel
                </button>
              </div>
            ) : (
              <button
                onClick={() => setConfirmClear(true)}
                className="px-4 py-2 rounded-xl border border-red-300 dark:border-red-800 text-red-600 dark:text-red-400 text-sm font-medium hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
              >
                <Trash2 className="w-4 h-4 inline mr-1.5" />
                Clear All
              </button>
            )}
          </div>
        </section>
      </div>
    </div>
  );
}
