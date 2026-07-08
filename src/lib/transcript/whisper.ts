import fs from 'fs';
import type { TranscriptSegment } from '@/types';

export async function transcribeAudio(audioPath: string): Promise<TranscriptSegment[]> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    console.log('No OpenAI API key configured, using mock transcript');
    return getMockTranscript();
  }

  const formData = new FormData();
  const audioBuffer = fs.readFileSync(audioPath);
  const audioBlob = new Blob([audioBuffer], { type: 'audio/wav' });
  formData.append('file', audioBlob, 'audio.wav');
  formData.append('model', 'whisper-1');
  formData.append('response_format', 'verbose_json');
  formData.append('timestamp_granularities[]', 'segment');

  const response = await fetch('https://api.openai.com/v1/audio/transcriptions', {
    method: 'POST',
    headers: { Authorization: `Bearer ${apiKey}` },
    body: formData,
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Whisper API error: ${error}`);
  }

  const result = await response.json();

  return (result.segments || []).map((seg: { start: number; end: number; text: string }) => ({
    start: seg.start,
    end: seg.end,
    text: seg.text.trim(),
  }));
}

export function getMockTranscript(): TranscriptSegment[] {
  return [
    { start: 0, end: 4.5, text: "What's up everyone, welcome back to the channel. Today we're diving into something that's completely changing the game." },
    { start: 4.5, end: 9.2, text: "I'm talking about AI agents. Not chatbots, not assistants — fully autonomous AI agents that can actually do work for you." },
    { start: 9.2, end: 14.8, text: "And here's the crazy part — by the end of 2026, every serious company will have an AI agent strategy or they'll be left behind." },
    { start: 14.8, end: 20.1, text: "Let me break down exactly what's happening and why this matters more than most people realize." },
    { start: 20.1, end: 26.5, text: "So first, let's talk about what changed. A year ago, AI was basically a fancy autocomplete. You'd type a prompt, get a response, done." },
    { start: 26.5, end: 33.0, text: "But now we have models that can use tools, browse the web, write and execute code, manage files, and chain multiple steps together without human intervention." },
    { start: 33.0, end: 39.5, text: "The breakthrough wasn't just better models — it was giving AI the ability to take actions in the real world. That's the fundamental shift." },
    { start: 39.5, end: 46.0, text: "Let me give you a concrete example. One of my friends runs a marketing agency. They had a team of five people doing social media management." },
    { start: 46.0, end: 53.2, text: "They built an AI agent crew — one agent monitors trends, another generates content ideas, a third one actually creates the posts, and a fourth handles scheduling and analytics." },
    { start: 53.2, end: 59.8, text: "Within three months, their output went up four X while their costs dropped by sixty percent. That's not a hypothetical — that's real numbers." },
    { start: 59.8, end: 66.0, text: "Now, I know what some of you are thinking. 'But the quality can't be as good as human-created content.' And honestly? You're partially right." },
    { start: 66.0, end: 72.5, text: "The AI-generated content isn't always as creative or nuanced. But here's the thing — it doesn't need to be. For eighty percent of social media content, consistency and volume beat perfection." },
    { start: 72.5, end: 78.3, text: "The real winners are the people who use AI agents for the repetitive stuff and focus their human creativity on the twenty percent that actually matters." },
    { start: 78.3, end: 85.0, text: "Here's my hot take that might be controversial — within two years, if you're a content creator and you're NOT using AI agents, you'll be producing at half the rate of your competitors." },
    { start: 85.0, end: 91.5, text: "Not because the AI is better than you. Because it never sleeps, never gets burned out, and can handle ten tasks simultaneously." },
    { start: 91.5, end: 98.0, text: "Now let me share the three biggest mistakes I see people making with AI agents, because these are costing people thousands of dollars." },
    { start: 98.0, end: 105.0, text: "Mistake number one: trying to build the perfect agent on day one. Don't. Start with one simple task, get it working reliably, then expand." },
    { start: 105.0, end: 112.0, text: "Mistake number two: not setting up proper guardrails. AI agents can and will make mistakes. You need monitoring, approval workflows, and kill switches." },
    { start: 112.0, end: 119.5, text: "Mistake number three: ignoring the cost. Every API call costs money. I've seen people rack up thousand-dollar bills because they didn't set usage limits." },
    { start: 119.5, end: 126.0, text: "The good news? Once you avoid these mistakes, the ROI is absolutely insane. We're talking ten to fifty X return on investment for most use cases." },
    { start: 126.0, end: 133.0, text: "If you want to learn how to build your own AI agent crew, I've put together a complete guide. Link in the description below." },
    { start: 133.0, end: 139.5, text: "Drop a comment telling me what task you'd automate first with an AI agent. I read every single comment and I'd love to hear your ideas." },
    { start: 139.5, end: 145.0, text: "If this video helped you, smash that like button, subscribe if you haven't already, and I'll see you in the next one. Peace." },
  ];
}
