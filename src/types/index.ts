export type ProjectStatus = 'pending' | 'downloading' | 'transcribing' | 'analyzing' | 'ready' | 'error';
export type SourceType = 'youtube' | 'upload' | 'podcast';
export type ClipStatus = 'suggested' | 'approved' | 'rendering' | 'rendered' | 'published';
export type RenderStatus = 'queued' | 'processing' | 'completed' | 'failed';
export type PublicationStatus = 'draft' | 'scheduled' | 'published' | 'failed';

export type CaptionStyle = 'classic' | 'highlight' | 'bold' | 'subtitle' | 'colorful' | 'minimal';

export type Platform = 'youtube_shorts' | 'instagram_reels' | 'tiktok' | 'x_video' | 'linkedin';

export type ClipLength = 30 | 60 | 120 | 180;

export interface TranscriptSegment {
  start: number;
  end: number;
  text: string;
  speaker?: string;
  confidence?: number;
}

export interface TopicSegment {
  name: string;
  start: number;
  end: number;
}

export interface Hook {
  timestamp: number;
  text: string;
  type: 'question' | 'surprising_fact' | 'bold_claim' | 'story_start' | 'advice' | 'quotable' | 'emotional';
  score: number;
}

export interface EmotionalPeak {
  timestamp: number;
  emotion: 'excitement' | 'humor' | 'inspiration' | 'surprise' | 'tension' | 'empathy';
  intensity: number;
}

export interface KeyMoment {
  start: number;
  end: number;
  type: 'hook' | 'climax' | 'insight' | 'story' | 'advice' | 'quote' | 'reaction';
  description: string;
  score: number;
  text: string;
}

export interface ClipSuggestion {
  startTime: number;
  endTime: number;
  duration: number;
  title: string;
  hook: string;
  description: string;
  hashtags: string[];
  engagementScore: number;
  topicCategory: string;
  platforms: Platform[];
  reason: string;
  keyMoments: KeyMoment[];
}

export interface CaptionConfig {
  style: CaptionStyle;
  fontFamily: string;
  fontSize: number;
  fontColor: string;
  highlightColor?: string;
  bgColor?: string;
  strokeColor?: string;
  strokeWidth?: number;
  position: 'top' | 'center' | 'bottom';
  animation: 'fade' | 'pop' | 'typewriter' | 'slide' | 'none';
  wordsPerLine: number;
  showEmoji: boolean;
  boldKeywords: boolean;
}

export interface PlatformPreset {
  platform: Platform;
  titleTone: 'casual' | 'professional' | 'hype' | 'educational';
  descriptionStyle: 'short' | 'detailed' | 'hashtag_heavy';
  captionDensity: 'sparse' | 'normal' | 'dense';
  ctaStyle: 'none' | 'subscribe' | 'follow' | 'link' | 'comment';
  safeZone: { top: number; bottom: number; left: number; right: number };
}

export interface AppSettings {
  bufferToken?: string;
  makeWebhookUrl?: string;
  youtubeApiKey?: string;
  googleClientId?: string;
  googleClientSecret?: string;
  defaultHashtags: string[];
  defaultCaptionStyle: CaptionStyle;
  defaultPlatforms: Platform[];
  brandName?: string;
  brandColor?: string;
  exportQuality: 'draft' | 'standard' | 'high';
  autoGenerateClips: boolean;
  clipLengths: ClipLength[];
}

export const CAPTION_STYLES: Record<CaptionStyle, CaptionConfig> = {
  classic: {
    style: 'classic',
    fontFamily: 'Inter',
    fontSize: 42,
    fontColor: '#FFFFFF',
    bgColor: 'rgba(0,0,0,0.7)',
    position: 'bottom',
    animation: 'fade',
    wordsPerLine: 8,
    showEmoji: false,
    boldKeywords: false,
  },
  highlight: {
    style: 'highlight',
    fontFamily: 'Inter',
    fontSize: 52,
    fontColor: '#FFFFFF',
    highlightColor: '#FFD700',
    position: 'center',
    animation: 'pop',
    wordsPerLine: 3,
    showEmoji: false,
    boldKeywords: true,
  },
  bold: {
    style: 'bold',
    fontFamily: 'Inter',
    fontSize: 58,
    fontColor: '#FFFFFF',
    strokeColor: '#000000',
    strokeWidth: 4,
    position: 'center',
    animation: 'pop',
    wordsPerLine: 4,
    showEmoji: true,
    boldKeywords: true,
  },
  subtitle: {
    style: 'subtitle',
    fontFamily: 'Inter',
    fontSize: 36,
    fontColor: '#FFFFFF',
    bgColor: 'rgba(0,0,0,0.85)',
    position: 'bottom',
    animation: 'slide',
    wordsPerLine: 10,
    showEmoji: false,
    boldKeywords: false,
  },
  colorful: {
    style: 'colorful',
    fontFamily: 'Inter',
    fontSize: 48,
    fontColor: '#FF6B6B',
    highlightColor: '#4ECDC4',
    strokeColor: '#000000',
    strokeWidth: 3,
    position: 'center',
    animation: 'pop',
    wordsPerLine: 3,
    showEmoji: true,
    boldKeywords: true,
  },
  minimal: {
    style: 'minimal',
    fontFamily: 'Inter',
    fontSize: 32,
    fontColor: '#E0E0E0',
    position: 'bottom',
    animation: 'fade',
    wordsPerLine: 12,
    showEmoji: false,
    boldKeywords: false,
  },
};

export const PLATFORM_PRESETS: Record<Platform, PlatformPreset> = {
  youtube_shorts: {
    platform: 'youtube_shorts',
    titleTone: 'hype',
    descriptionStyle: 'detailed',
    captionDensity: 'normal',
    ctaStyle: 'subscribe',
    safeZone: { top: 120, bottom: 200, left: 40, right: 40 },
  },
  instagram_reels: {
    platform: 'instagram_reels',
    titleTone: 'casual',
    descriptionStyle: 'hashtag_heavy',
    captionDensity: 'dense',
    ctaStyle: 'follow',
    safeZone: { top: 100, bottom: 280, left: 40, right: 40 },
  },
  tiktok: {
    platform: 'tiktok',
    titleTone: 'casual',
    descriptionStyle: 'short',
    captionDensity: 'dense',
    ctaStyle: 'follow',
    safeZone: { top: 100, bottom: 300, left: 40, right: 100 },
  },
  x_video: {
    platform: 'x_video',
    titleTone: 'professional',
    descriptionStyle: 'short',
    captionDensity: 'sparse',
    ctaStyle: 'none',
    safeZone: { top: 60, bottom: 100, left: 40, right: 40 },
  },
  linkedin: {
    platform: 'linkedin',
    titleTone: 'professional',
    descriptionStyle: 'detailed',
    captionDensity: 'normal',
    ctaStyle: 'link',
    safeZone: { top: 60, bottom: 120, left: 40, right: 40 },
  },
};
