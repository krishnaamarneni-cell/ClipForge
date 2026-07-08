import Anthropic from '@anthropic-ai/sdk';
import type { TranscriptSegment, Hook, EmotionalPeak, KeyMoment, TopicSegment } from '@/types';

export interface AnalysisResult {
  mainTopic: string;
  topics: TopicSegment[];
  hooks: Hook[];
  emotionalPeaks: EmotionalPeak[];
  keyMoments: KeyMoment[];
  speakerChanges: { timestamp: number; speaker: string }[];
  summary: string;
}

function getClient() {
  if (!process.env.ANTHROPIC_API_KEY) return null;
  return new Anthropic();
}

function formatTranscriptForPrompt(transcript: TranscriptSegment[]): string {
  return transcript
    .map((seg) => {
      const speaker = seg.speaker ? `[${seg.speaker}] ` : '';
      const ts = formatTimestamp(seg.start);
      return `[${ts}] ${speaker}${seg.text}`;
    })
    .join('\n');
}

function formatTimestamp(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s.toString().padStart(2, '0')}`;
}

export async function analyzeTranscript(
  transcript: TranscriptSegment[],
  duration: number
): Promise<AnalysisResult> {
  const client = getClient();
  if (!client) {
    return getMockAnalysis(transcript, duration);
  }

  const formatted = formatTranscriptForPrompt(transcript);

  const response = await client.messages.create({
    model: 'claude-sonnet-4-20250514',
    max_tokens: 4096,
    messages: [
      {
        role: 'user',
        content: `You are an expert content strategist who specializes in short-form video. Analyze this transcript from a ${formatTimestamp(duration)} video and identify every element that could make a compelling clip.

TRANSCRIPT:
${formatted}

Analyze the transcript deeply and return a JSON object with exactly this structure:

{
  "mainTopic": "The primary subject of the content in 1-2 sentences",
  "topics": [
    {
      "name": "Topic or sub-topic name",
      "start": <start timestamp in seconds>,
      "end": <end timestamp in seconds>
    }
  ],
  "hooks": [
    {
      "timestamp": <seconds>,
      "text": "The exact text that serves as a hook",
      "type": "question" | "surprising_fact" | "bold_claim" | "story_start" | "advice" | "quotable" | "emotional",
      "score": <0.0 to 1.0, how strong this hook is for grabbing attention in the first 3 seconds of a clip>
    }
  ],
  "emotionalPeaks": [
    {
      "timestamp": <seconds>,
      "emotion": "excitement" | "humor" | "inspiration" | "surprise" | "tension" | "empathy",
      "intensity": <0.0 to 1.0>
    }
  ],
  "keyMoments": [
    {
      "start": <seconds>,
      "end": <seconds>,
      "type": "hook" | "climax" | "insight" | "story" | "advice" | "quote" | "reaction",
      "description": "Why this moment matters for a clip",
      "score": <0.0 to 1.0, engagement potential>,
      "text": "The transcript text for this moment"
    }
  ],
  "speakerChanges": [
    {
      "timestamp": <seconds>,
      "speaker": "Speaker name or label"
    }
  ],
  "summary": "A 2-3 sentence summary of the content"
}

ANALYSIS GUIDELINES:
- Hooks: Look for rhetorical questions, counterintuitive facts, controversial takes, personal story openings, direct advice, memorable phrases, and raw emotional moments. Score higher for hooks that would stop someone from scrolling.
- Emotional peaks: Identify where energy shifts -- laughter, raised voice, powerful pauses, storytelling climaxes, vulnerable admissions.
- Key moments: Find self-contained segments that could stand alone as a clip. Prioritize moments with a clear setup and payoff. A moment with score > 0.8 should be something that would genuinely go viral.
- Topics: Break the content into distinct thematic sections. Even a monologue shifts between sub-topics.
- Speaker changes: If there are multiple speakers, note every transition. If there's only one speaker, return an empty array.

Be generous with findings -- it's better to surface 20 potential hooks than miss 5 great ones. Timestamps must be accurate to the transcript.

Return ONLY the JSON object, no other text.`,
      },
    ],
  });

  const text =
    response.content[0].type === 'text' ? response.content[0].text : '';

  try {
    const parsed = JSON.parse(text);
    return {
      mainTopic: parsed.mainTopic ?? '',
      topics: (parsed.topics ?? []).map((t: TopicSegment) => ({
        name: t.name,
        start: Number(t.start),
        end: Number(t.end),
      })),
      hooks: (parsed.hooks ?? []).map((h: Hook) => ({
        timestamp: Number(h.timestamp),
        text: h.text,
        type: h.type,
        score: Number(h.score),
      })),
      emotionalPeaks: (parsed.emotionalPeaks ?? []).map((e: EmotionalPeak) => ({
        timestamp: Number(e.timestamp),
        emotion: e.emotion,
        intensity: Number(e.intensity),
      })),
      keyMoments: (parsed.keyMoments ?? [])
        .map((k: KeyMoment) => ({
          start: Number(k.start),
          end: Number(k.end),
          type: k.type,
          description: k.description,
          score: Number(k.score),
          text: k.text,
        }))
        .sort((a: KeyMoment, b: KeyMoment) => b.score - a.score),
      speakerChanges: (parsed.speakerChanges ?? []).map(
        (s: { timestamp: number; speaker: string }) => ({
          timestamp: Number(s.timestamp),
          speaker: s.speaker,
        })
      ),
      summary: parsed.summary ?? '',
    };
  } catch {
    throw new Error(
      `Failed to parse analysis response as JSON: ${text.slice(0, 200)}`
    );
  }
}

function getMockAnalysis(transcript: TranscriptSegment[], _duration: number): AnalysisResult {
  return {
    mainTopic: 'The AI landscape in 2026: autonomous agents, job market shifts, multimodal breakthroughs, and the future of content creation.',
    topics: [
      { name: 'AI Agents Revolution', start: 0, end: 42 },
      { name: 'Job Market Disruption', start: 42, end: 67 },
      { name: 'Career Advice for the AI Era', start: 67, end: 75 },
      { name: 'Multimodal AI Breakthroughs', start: 75, end: 101 },
      { name: 'Trust and Safety Challenges', start: 110, end: 136 },
      { name: 'Open Source AI & Creator Tools', start: 136, end: 170 },
      { name: 'Conclusion', start: 170, end: 180 },
    ],
    hooks: [
      { timestamp: 16, text: "Over forty percent of Fortune 500 companies now have autonomous AI agents handling some part of their customer operations.", type: 'surprising_fact', score: 0.92 },
      { timestamp: 25, text: "The real revolution isn't in enterprise. It's happening with solo creators and small teams.", type: 'bold_claim', score: 0.88 },
      { timestamp: 33, text: "I talked to a founder last week who built an entire SaaS product in a single weekend using AI coding agents.", type: 'story_start', score: 0.90 },
      { timestamp: 50, text: "Junior developer roles have contracted by about thirty percent in the last eighteen months.", type: 'surprising_fact', score: 0.85 },
      { timestamp: 67, text: "Don't learn a programming language. Learn how to think in systems.", type: 'advice', score: 0.93 },
      { timestamp: 84, text: "I gave a model a whiteboard photo and asked it to generate the entire codebase. It produced twelve files, all working, in ninety seconds.", type: 'surprising_fact', score: 0.87 },
      { timestamp: 118, text: "The AI is right ninety-eight percent of the time. But we need it to be right one hundred percent for cases where being wrong means someone dies.", type: 'quotable', score: 0.95 },
      { timestamp: 162, text: "A solo creator with the right AI toolkit will produce content indistinguishable from a full production studio.", type: 'bold_claim', score: 0.86 },
    ],
    emotionalPeaks: [
      { timestamp: 16, emotion: 'surprise', intensity: 0.8 },
      { timestamp: 33, emotion: 'excitement', intensity: 0.85 },
      { timestamp: 50, emotion: 'tension', intensity: 0.75 },
      { timestamp: 67, emotion: 'inspiration', intensity: 0.9 },
      { timestamp: 84, emotion: 'excitement', intensity: 0.88 },
      { timestamp: 118, emotion: 'tension', intensity: 0.92 },
      { timestamp: 162, emotion: 'inspiration', intensity: 0.82 },
    ],
    keyMoments: [
      { start: 16, end: 42, type: 'insight', description: 'AI agents adoption stats and solo creator revolution', score: 0.91, text: transcript.filter(s => s.start >= 16 && s.end <= 42).map(s => s.text).join(' ') },
      { start: 33, end: 42, type: 'story', description: 'Founder builds SaaS in a weekend with AI', score: 0.89, text: transcript.filter(s => s.start >= 33 && s.end <= 42).map(s => s.text).join(' ') },
      { start: 42, end: 67, type: 'insight', description: 'Job displacement data and emerging roles', score: 0.84, text: transcript.filter(s => s.start >= 42 && s.end <= 67).map(s => s.text).join(' ') },
      { start: 67, end: 75, type: 'advice', description: 'Career advice — think in systems, not languages', score: 0.93, text: transcript.filter(s => s.start >= 67 && s.end <= 75).map(s => s.text).join(' ') },
      { start: 75, end: 101, type: 'insight', description: 'Multimodal AI experiments and exponential progress', score: 0.86, text: transcript.filter(s => s.start >= 75 && s.end <= 101).map(s => s.text).join(' ') },
      { start: 110, end: 136, type: 'quote', description: 'Hospital CTO on the 98% vs 100% accuracy gap', score: 0.95, text: transcript.filter(s => s.start >= 110 && s.end <= 136).map(s => s.text).join(' ') },
      { start: 153, end: 170, type: 'insight', description: 'Creator tools revolution and the inverted playing field', score: 0.83, text: transcript.filter(s => s.start >= 153 && s.end <= 170).map(s => s.text).join(' ') },
    ],
    speakerChanges: [],
    summary: 'A comprehensive overview of the 2026 AI landscape covering autonomous agents in enterprise and creator workflows, job market shifts with 30% junior dev role contraction offset by new AI-native roles, multimodal breakthroughs enabling whiteboard-to-code in 90 seconds, and the critical trust gap between 98% and 100% accuracy in high-stakes domains.',
  };
}
