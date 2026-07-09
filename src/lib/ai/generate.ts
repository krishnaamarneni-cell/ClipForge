import { chatCompletion, hasAnyAIKey } from './client';
import type { Platform } from '@/types';
import { PLATFORM_PRESETS } from '@/types';

interface ClipMetadata {
  title: string;
  hook: string;
  description: string;
  hashtags: string[];
  thumbnailSuggestion: string;
}

const TONE_GUIDES: Record<string, string> = {
  casual:
    'Conversational, relatable, uses slang and emoji where appropriate. Think "talking to a friend."',
  professional:
    'Authoritative but approachable. No slang. Clear value proposition. Think "conference keynote."',
  hype:
    'High energy, CAPS for emphasis, exclamation marks, power words (INSANE, GAME-CHANGER, MIND-BLOWING). Think "reaction video."',
  educational:
    'Clear, structured, benefit-driven. Uses numbers and lists. Think "here are 3 things you need to know."',
};

const PLATFORM_CONTEXT: Record<Platform, string> = {
  youtube_shorts:
    'YouTube Shorts: title appears below video, description is expandable. Hashtags in description boost discovery. Titles should be curiosity-driven.',
  instagram_reels:
    'Instagram Reels: caption appears over the video. Keep it short. Heavy hashtag usage (up to 30). First line is the hook.',
  tiktok:
    'TikTok: caption is limited to 2200 chars. Hashtags are critical for FYP. Casual, trendy tone. Reference trending sounds or formats if relevant.',
  x_video:
    'X/Twitter Video: tweet text accompanies the video. Keep under 280 chars. No hashtag spam -- 2-3 max. Provocative or quotable text performs best.',
  linkedin:
    'LinkedIn Video: professional audience. Lead with a bold insight or data point. Use line breaks for readability. 3-5 relevant hashtags.',
};

export async function generateClipMetadata(
  clipText: string,
  topicCategory: string,
  platform: Platform,
  brandName?: string
): Promise<ClipMetadata> {
  if (!hasAnyAIKey()) {
    return {
      title: '',
      hook: '',
      description: '',
      hashtags: [],
      thumbnailSuggestion: '',
    };
  }

  const preset = PLATFORM_PRESETS[platform];
  const toneGuide = TONE_GUIDES[preset.titleTone] ?? TONE_GUIDES.casual;
  const platformContext = PLATFORM_CONTEXT[platform];

  const brandInstruction = brandName
    ? `Brand: "${brandName}". Subtly reference the brand where natural -- don't force it.`
    : 'No specific brand to mention.';

  const { text } = await chatCompletion({
    max_tokens: 1024,
    temperature: 0.4,
    messages: [
      {
        role: 'system',
        content: 'You are a social media copywriter who creates scroll-stopping metadata for short-form video clips. You always respond with valid JSON only, no other text.',
      },
      {
        role: 'user',
        content: `CLIP TRANSCRIPT:
${clipText}

TOPIC: ${topicCategory}
PLATFORM: ${platformContext}
TONE: ${toneGuide}
DESCRIPTION STYLE: ${preset.descriptionStyle}
CTA STYLE: ${preset.ctaStyle}
${brandInstruction}

Generate metadata for this clip optimized for ${platform}. Return a JSON object:

{
  "title": "A title that makes people NEED to watch. ${preset.titleTone === 'hype' ? 'Use power words and urgency.' : preset.titleTone === 'professional' ? 'Lead with the key insight.' : 'Be relatable and curiosity-driven.'}",
  "hook": "The first line viewers see -- must stop the scroll in under 2 seconds. This is the text overlay or opening caption.",
  "description": "${preset.descriptionStyle === 'short' ? '1-2 punchy sentences.' : preset.descriptionStyle === 'detailed' ? '3-4 sentences with context and value proposition.' : 'Brief text followed by a wall of relevant hashtags.'}",
  "hashtags": [${preset.descriptionStyle === 'hashtag_heavy' ? '"15-25 hashtags mixing broad and niche"' : '"5-8 relevant hashtags"'}],
  "thumbnailSuggestion": "Describe the ideal thumbnail: text overlay, expression, colors, composition. Be specific enough for a designer to execute."
}

RULES:
- Title: ${platform === 'x_video' ? 'Under 100 chars.' : 'Under 60 chars.'} No clickbait that doesn't deliver.
- Hook: Must be a complete thought that creates immediate curiosity or value.
- Hashtags: Mix high-volume discovery tags with niche topic tags. No spaces in hashtags.${preset.ctaStyle !== 'none' ? `\n- Include a ${preset.ctaStyle} CTA naturally in the description.` : ''}
- Thumbnail: Should be eye-catching at small sizes. Suggest high-contrast text and an expressive moment.

Return ONLY the JSON object.`,
      },
    ],
  });

  try {
    const parsed = JSON.parse(text);
    return {
      title: parsed.title ?? '',
      hook: parsed.hook ?? '',
      description: parsed.description ?? '',
      hashtags: Array.isArray(parsed.hashtags) ? parsed.hashtags : [],
      thumbnailSuggestion: parsed.thumbnailSuggestion ?? '',
    };
  } catch {
    throw new Error(
      `Failed to parse metadata response as JSON: ${text.slice(0, 200)}`
    );
  }
}
