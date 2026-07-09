import Groq from 'groq-sdk';

export type AIProvider = 'groq' | 'perplexity';

interface ChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

interface ChatOptions {
  messages: ChatMessage[];
  max_tokens?: number;
  temperature?: number;
}

interface ChatResult {
  text: string;
  provider: AIProvider;
}

export function getGroqClient(): Groq | null {
  if (!process.env.GROQ_API_KEY) return null;
  return new Groq({ apiKey: process.env.GROQ_API_KEY });
}

async function callPerplexity(options: ChatOptions): Promise<string> {
  const res = await fetch('https://api.perplexity.ai/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${process.env.PERPLEXITY_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: 'sonar-pro',
      messages: options.messages,
      max_tokens: options.max_tokens ?? 4096,
      temperature: options.temperature ?? 0.3,
    }),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Perplexity API error: ${err}`);
  }

  const data = await res.json();
  return data.choices?.[0]?.message?.content ?? '';
}

export async function chatCompletion(options: ChatOptions): Promise<ChatResult> {
  const groq = getGroqClient();

  if (groq) {
    try {
      const response = await groq.chat.completions.create({
        model: 'llama-3.3-70b-versatile',
        max_tokens: options.max_tokens ?? 4096,
        temperature: options.temperature ?? 0.3,
        messages: options.messages,
      });
      return {
        text: response.choices[0]?.message?.content ?? '',
        provider: 'groq',
      };
    } catch (err) {
      console.warn('Groq failed, trying Perplexity fallback:', err);
    }
  }

  if (process.env.PERPLEXITY_API_KEY) {
    const text = await callPerplexity(options);
    return { text, provider: 'perplexity' };
  }

  return { text: '', provider: 'groq' };
}

export function hasAnyAIKey(): boolean {
  return !!(process.env.GROQ_API_KEY || process.env.PERPLEXITY_API_KEY);
}
