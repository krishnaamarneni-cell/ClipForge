import { chatCompletion, hasAnyAIKey } from './client';
import type { TranscriptSegment, ClipSuggestion } from '@/types';
import type { AnalysisResult } from './analyze';

export async function generateClipSuggestions(
  analysis: AnalysisResult,
  transcript: TranscriptSegment[],
  clipLengths: number[] = [30, 60, 120, 180],
  maxClipsPerLength: number = 3
): Promise<ClipSuggestion[]> {
  if (!hasAnyAIKey()) {
    return getMockClipSuggestions(analysis, transcript);
  }

  const transcriptText = transcript
    .map((seg) => {
      const m = Math.floor(seg.start / 60);
      const s = Math.floor(seg.start % 60);
      return `[${m}:${s.toString().padStart(2, '0')}] ${seg.text}`;
    })
    .join('\n');

  const { text } = await chatCompletion({
    max_tokens: 4096,
    temperature: 0.3,
    messages: [
      {
        role: 'system',
        content: 'You are a viral short-form video editor. You always respond with valid JSON only, no other text.',
      },
      {
        role: 'user',
        content: `Given a content analysis and transcript, identify the best segments to cut into clips.

CONTENT ANALYSIS:
Main topic: ${analysis.mainTopic}
Summary: ${analysis.summary}

Topics: ${JSON.stringify(analysis.topics)}
Hooks (strongest attention-grabbers): ${JSON.stringify(analysis.hooks.filter((h) => h.score >= 0.5))}
Emotional peaks: ${JSON.stringify(analysis.emotionalPeaks.filter((e) => e.intensity >= 0.5))}
Key moments (ranked): ${JSON.stringify(analysis.keyMoments.slice(0, 15))}

FULL TRANSCRIPT:
${transcriptText}

TARGET CLIP LENGTHS: ${clipLengths.join(', ')} seconds
MAX CLIPS PER LENGTH: ${maxClipsPerLength}

For each target length, find up to ${maxClipsPerLength} clips. Return a JSON array of clip suggestions:

[
  {
    "startTime": <seconds>,
    "endTime": <seconds>,
    "duration": <seconds>,
    "title": "A punchy title for this clip",
    "hook": "The opening line or hook text",
    "description": "What this clip is about in 1-2 sentences",
    "hashtags": ["relevant", "hashtags", "5-8 total"],
    "engagementScore": <0.0 to 1.0>,
    "topicCategory": "The topic this clip covers",
    "platforms": ["youtube_shorts", "tiktok", "instagram_reels", "x_video", "linkedin"],
    "reason": "Why this segment works as a standalone clip",
    "keyMoments": [
      {
        "start": <seconds>,
        "end": <seconds>,
        "type": "hook" | "climax" | "insight" | "story" | "advice" | "quote" | "reaction",
        "description": "What happens in this moment",
        "score": <0.0 to 1.0>,
        "text": "The transcript text"
      }
    ]
  }
]

CLIP SELECTION RULES:
1. Every clip MUST start with a strong hook -- a question, bold statement, or immediate intrigue. Never start mid-sentence or with filler ("so, um, you know").
2. Each clip must be a self-contained narrative arc: setup -> payoff. The viewer should feel satisfied, not confused.
3. Trim dead air, tangents, and weak intros. The start and end timestamps should be the tightest possible cut.
4. A 30s clip needs to be punchy -- one idea, one takeaway. A 180s clip can develop a full story.
5. Clips should feel complete. Don't cut off mid-thought or mid-story.
6. Rank by likely audience retention: would someone watch this to the end and share it?
7. Avoid overlapping clips at the same length. Clips at different lengths CAN overlap if the shorter one is a tighter cut of the same moment.
8. For platforms: suggest all that fit. LinkedIn clips should be professional; TikTok clips should be high-energy or emotionally resonant.
9. Engagement score 0.9+ should be reserved for genuinely viral-worthy content.

Return ONLY the JSON array.`,
      },
    ],
  });

  try {
    const parsed = JSON.parse(text);

    if (!Array.isArray(parsed)) {
      throw new Error('Response is not an array');
    }

    return parsed.map(
      (clip: ClipSuggestion): ClipSuggestion => ({
        startTime: Number(clip.startTime),
        endTime: Number(clip.endTime),
        duration: Number(clip.endTime) - Number(clip.startTime),
        title: clip.title ?? '',
        hook: clip.hook ?? '',
        description: clip.description ?? '',
        hashtags: Array.isArray(clip.hashtags) ? clip.hashtags : [],
        engagementScore: Number(clip.engagementScore),
        topicCategory: clip.topicCategory ?? analysis.mainTopic,
        platforms: Array.isArray(clip.platforms) ? clip.platforms : ['youtube_shorts', 'tiktok'],
        reason: clip.reason ?? '',
        keyMoments: Array.isArray(clip.keyMoments)
          ? clip.keyMoments.map((km) => ({
              start: Number(km.start),
              end: Number(km.end),
              type: km.type,
              description: km.description ?? '',
              score: Number(km.score),
              text: km.text ?? '',
            }))
          : [],
      })
    );
  } catch {
    throw new Error(
      `Failed to parse clip suggestions as JSON: ${text.slice(0, 200)}`
    );
  }
}

function getMockClipSuggestions(_analysis: AnalysisResult, transcript: TranscriptSegment[]): ClipSuggestion[] {
  const getTextBetween = (start: number, end: number) =>
    transcript.filter(s => s.start >= start && s.end <= end).map(s => s.text).join(' ');

  return [
    {
      startTime: 16, endTime: 42, duration: 26,
      title: "40% of Fortune 500 Now Use AI Agents",
      hook: "Here's a stat that floored me...",
      description: "Over 40% of Fortune 500 companies now have autonomous AI agents. But the real revolution is with solo creators.",
      hashtags: ['ai', 'aiagents', 'startup', 'solopreneur', 'tech2026', 'shorts'],
      engagementScore: 0.91, topicCategory: 'AI Agents',
      platforms: ['youtube_shorts', 'tiktok', 'instagram_reels'],
      reason: 'Surprising stat hook + relatable solo creator angle',
      keyMoments: [{ start: 16, end: 25, type: 'hook', description: 'Fortune 500 AI agent stat', score: 0.92, text: getTextBetween(16, 25) }],
    },
    {
      startTime: 33, endTime: 50, duration: 17,
      title: "He Built a SaaS in One Weekend with AI",
      hook: "I talked to a founder last week...",
      description: "A founder built an entire SaaS product — database to deployment — in a single weekend using AI coding agents.",
      hashtags: ['saas', 'aitools', 'coding', 'startup', 'buildinpublic', 'shorts'],
      engagementScore: 0.89, topicCategory: 'AI Development',
      platforms: ['youtube_shorts', 'tiktok', 'instagram_reels', 'linkedin'],
      reason: 'Compelling founder story with concrete result',
      keyMoments: [{ start: 33, end: 42, type: 'story', description: 'SaaS weekend build story', score: 0.89, text: getTextBetween(33, 42) }],
    },
    {
      startTime: 67, endTime: 93, duration: 26,
      title: "Stop Learning Programming Languages",
      hook: "Don't learn a programming language...",
      description: "Controversial career advice: learn systems thinking, not coding. The AI will write the code. Plus a wild multimodal AI demo.",
      hashtags: ['careeradvice', 'programming', 'ai', 'tech', 'learntocode', 'shorts'],
      engagementScore: 0.93, topicCategory: 'Career Advice',
      platforms: ['youtube_shorts', 'tiktok', 'instagram_reels', 'linkedin'],
      reason: 'Controversial take that drives comments + impressive demo payoff',
      keyMoments: [{ start: 67, end: 75, type: 'advice', description: 'Think in systems advice', score: 0.93, text: getTextBetween(67, 75) }],
    },
    {
      startTime: 42, endTime: 67, duration: 25,
      title: "Junior Dev Jobs Down 30% — But Here's the Truth",
      hook: "The job displacement conversation has gotten very real...",
      description: "Junior dev roles contracted 30% in 18 months. But new AI-native roles are emerging just as fast. Total tech jobs are up.",
      hashtags: ['techjobs', 'ai', 'jobmarket', 'developers', 'career', 'shorts'],
      engagementScore: 0.84, topicCategory: 'Job Market',
      platforms: ['youtube_shorts', 'linkedin', 'x_video'],
      reason: 'Fear-to-hope arc with real data',
      keyMoments: [{ start: 50, end: 58, type: 'insight', description: '30% contraction stat', score: 0.85, text: getTextBetween(50, 58) }],
    },
    {
      startTime: 110, endTime: 136, duration: 26,
      title: "The 2% That Could Kill Someone",
      hook: "The AI is right 98% of the time. But...",
      description: "A hospital CTO's powerful insight: AI's 98% accuracy isn't enough when the 2% error means someone dies. The core tension of our era.",
      hashtags: ['ai', 'healthcare', 'aisafety', 'technology', 'ethics', 'shorts'],
      engagementScore: 0.95, topicCategory: 'AI Safety',
      platforms: ['youtube_shorts', 'tiktok', 'instagram_reels', 'linkedin', 'x_video'],
      reason: 'Emotionally powerful quote with universal stakes',
      keyMoments: [{ start: 118, end: 127, type: 'quote', description: 'Hospital CTO quote', score: 0.95, text: getTextBetween(118, 127) }],
    },
    {
      startTime: 153, endTime: 180, duration: 27,
      title: "Solo Creators Will Beat Production Studios",
      hook: "The tools available now are insane...",
      description: "AI-generated B-roll, auto-captioning, music generation. A solo creator will produce studio-quality content by year-end.",
      hashtags: ['contentcreator', 'aitools', 'youtube', 'tiktok', 'creator', 'shorts'],
      engagementScore: 0.86, topicCategory: 'Creator Economy',
      platforms: ['youtube_shorts', 'tiktok', 'instagram_reels'],
      reason: 'Empowering message for creator audience with bold prediction',
      keyMoments: [{ start: 162, end: 170, type: 'insight', description: 'Creator tools prediction', score: 0.86, text: getTextBetween(162, 170) }],
    },
    {
      startTime: 75, endTime: 101, duration: 26,
      title: "Whiteboard to Working Code in 90 Seconds",
      hook: "Let's talk about multimodal AI...",
      description: "I gave an AI model a whiteboard photo and it generated 12 working files in 90 seconds. The rate of improvement is exponential.",
      hashtags: ['multimodal', 'ai', 'coding', 'tech', 'innovation', 'shorts'],
      engagementScore: 0.87, topicCategory: 'Multimodal AI',
      platforms: ['youtube_shorts', 'tiktok', 'linkedin'],
      reason: 'Concrete demo result that feels like magic',
      keyMoments: [{ start: 84, end: 93, type: 'insight', description: 'Whiteboard-to-code demo', score: 0.87, text: getTextBetween(84, 93) }],
    },
    {
      startTime: 136, endTime: 162, duration: 26,
      title: "Open Source AI Just Caught Up",
      hook: "The gap between open and closed models has vanished...",
      description: "Open-weight models on consumer hardware now match commercial APIs. Companies can run AI entirely on-premises.",
      hashtags: ['opensource', 'ai', 'privacy', 'selfhosted', 'llm', 'shorts'],
      engagementScore: 0.81, topicCategory: 'Open Source AI',
      platforms: ['youtube_shorts', 'linkedin', 'x_video'],
      reason: 'Important trend for tech-savvy audience',
      keyMoments: [{ start: 136, end: 145, type: 'insight', description: 'Open vs closed model parity', score: 0.81, text: getTextBetween(136, 145) }],
    },
  ];
}
