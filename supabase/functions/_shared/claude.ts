const ANTHROPIC_API_URL = 'https://api.anthropic.com/v1/messages';
const MODEL = 'claude-sonnet-4-5';

interface ContentBlock {
  type: 'text' | 'image';
  text?: string;
  source?: {
    type: 'base64';
    media_type: string;
    data: string;
  };
}

interface Message {
  role: 'user' | 'assistant';
  content: string | ContentBlock[];
}

interface ClaudeResponse {
  content: { type: string; text: string }[];
}

export async function callClaude(
  systemPrompt: string,
  messages: Message[],
  imageBase64?: string,
  maxTokens = 1024,
): Promise<string> {
  const apiKey = Deno.env.get('ANTHROPIC_API_KEY');
  if (!apiKey) {
    throw new Error('ANTHROPIC_API_KEY not configured');
  }

  // If there's an image, append it to the last user message
  if (imageBase64) {
    const lastMsg = messages[messages.length - 1];
    if (lastMsg && lastMsg.role === 'user') {
      const textContent = typeof lastMsg.content === 'string' ? lastMsg.content : '';
      lastMsg.content = [
        {
          type: 'image',
          source: {
            type: 'base64',
            media_type: 'image/jpeg',
            data: imageBase64,
          },
        },
        { type: 'text', text: textContent || 'Analyze this image.' },
      ];
    }
  }

  const response = await fetch(ANTHROPIC_API_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: MODEL,
      max_tokens: maxTokens,
      system: systemPrompt,
      messages,
    }),
  });

  if (!response.ok) {
    const errorBody = await response.text();
    throw new Error(`Claude API error ${response.status}: ${errorBody}`);
  }

  const data: ClaudeResponse = await response.json();
  const textBlock = data.content.find((b) => b.type === 'text');
  return textBlock?.text ?? '';
}

/**
 * Call Claude and parse the response as JSON.
 * Strips markdown code fences if present before parsing.
 */
export async function callClaudeJSON<T>(
  systemPrompt: string,
  messages: Message[],
  imageBase64?: string,
  maxTokens = 1024,
): Promise<T> {
  const raw = await callClaude(systemPrompt, messages, imageBase64, maxTokens);

  // Strip markdown fences (```json ... ```)
  let cleaned = raw.trim();
  if (cleaned.startsWith('```')) {
    cleaned = cleaned.replace(/^```(?:json)?\s*\n?/, '').replace(/\n?```\s*$/, '');
  }

  // Try to extract JSON object if response has text before/after it
  if (!cleaned.startsWith('{')) {
    const jsonMatch = cleaned.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      cleaned = jsonMatch[0];
    }
  }

  try {
    return JSON.parse(cleaned) as T;
  } catch {
    // Fallback: wrap plain text as a message response
    console.error('JSON parse failed, wrapping plain text. Raw:', cleaned.substring(0, 200));
    return { message: raw.trim(), actionsTaken: [] } as unknown as T;
  }
}
