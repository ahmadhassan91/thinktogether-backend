import { getLearningPath, trainingModules } from '../src/data/trainingData';
import type { SourceRef } from '../src/types';

export type AiDeckProvider = 'gemini' | 'claude' | 'kimi';

export type DeckOutlineRequest = {
  provider: AiDeckProvider;
  topic: string;
  audience: string;
  durationMinutes: number;
  slideCount: number;
};

export type DeckSlide = {
  title: string;
  objective: string;
  talkingPoints: string[];
  activityPrompt: string;
  facilitatorNotes: string;
  sourceRefs: SourceRef[];
};

export type DeckOutline = {
  provider: AiDeckProvider;
  model: string;
  title: string;
  audience: string;
  durationMinutes: number;
  learningObjectives: string[];
  slides: DeckSlide[];
  handoffNotes: string[];
  sourceArtifacts: string[];
  generatedAt: string;
};

export type ProviderStatus = {
  id: AiDeckProvider | 'notebooklm_enterprise';
  label: string;
  configured: boolean;
  mode: 'sync' | 'async-required' | 'source-workspace';
  note: string;
};

type AnyJson = Record<string, any>;

export function getAiProviderStatuses(env = process.env): ProviderStatus[] {
  return [
    {
      id: 'gemini',
      label: 'Gemini Flash',
      configured: Boolean(env.GEMINI_API_KEY),
      mode: 'sync',
      note: 'Fast default for structured slide JSON.',
    },
    {
      id: 'claude',
      label: 'Claude Sonnet',
      configured: Boolean(env.ANTHROPIC_API_KEY),
      mode: 'sync',
      note: 'Premium narrative planner for polished facilitator decks. Requires Anthropic credits.',
    },
    {
      id: 'kimi',
      label: 'Kimi K2.6 via NVIDIA',
      configured: Boolean(env.NVIDIA_API_KEY),
      mode: 'async-required',
      note: 'Configured, but too slow for live requests. Use only after background job queue is added.',
    },
    {
      id: 'notebooklm_enterprise',
      label: 'NotebookLM Enterprise',
      configured: Boolean(env.NOTEBOOKLM_PROJECT_ID),
      mode: 'source-workspace',
      note: 'Best used to ground notebooks and sources before deck generation.',
    },
  ];
}

export async function generateDeckOutline(request: DeckOutlineRequest): Promise<DeckOutline> {
  const prompt = buildDeckPrompt(request);
  if (request.provider === 'gemini') return generateWithGemini(prompt, request);
  if (request.provider === 'claude') return generateWithClaude(prompt, request);
  return generateWithKimi(prompt, request);
}

export function buildDeckPrompt(request: DeckOutlineRequest) {
  const path = getLearningPath();
  const sourceRefs = uniqueSourceRefs([
    ...path.sourceRefs,
    ...trainingModules.flatMap((moduleItem) => moduleItem.content.sourceRefs),
  ]);
  const moduleSummaries = trainingModules
    .slice(0, 10)
    .map((moduleItem) => `- ${moduleItem.title}: ${moduleItem.content.summary} Key points: ${moduleItem.content.keyPoints.join('; ')}`)
    .join('\n');

  return `Create a Think Together in-person training deck outline as strict JSON only.

Topic: ${request.topic}
Audience: ${request.audience}
Duration minutes: ${request.durationMinutes}
Slide count: ${request.slideCount}

Use this Think Together source context:
Learning path: ${path.title}
Program audience: ${path.audience}
Source artifacts and locators:
${sourceRefs.map((ref) => `- ${ref.artifact}: ${ref.locator}`).join('\n')}

PBIS module context:
${moduleSummaries}

Required JSON shape:
{
  "title": "string",
  "audience": "string",
  "durationMinutes": number,
  "learningObjectives": ["string"],
  "slides": [
    {
      "title": "string",
      "objective": "string",
      "talkingPoints": ["string", "string", "string"],
      "activityPrompt": "string",
      "facilitatorNotes": "string",
      "sourceRefs": [{"artifact": "string", "locator": "string"}]
    }
  ],
  "handoffNotes": ["string"]
}

Rules:
- Use the 10:2 rhythm: brief content, then a practice/application prompt.
- Preserve human facilitation; do not imply AI replaces trainers.
- Use only the provided source artifacts for claims.
- Keep every slide practical for expanded learning / after-school program staff.
- Write as a professional facilitator deck, not a classroom handout.
- Avoid generic training filler; each slide needs a clear claim, a proof point, and a concrete activity.
- Return exactly ${request.slideCount} slides.
- Return JSON only, no markdown.`;
}

async function generateWithGemini(prompt: string, request: DeckOutlineRequest): Promise<DeckOutline> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error('Gemini API key is not configured.');

  const body = {
    contents: [{ parts: [{ text: prompt }] }],
    generationConfig: {
      temperature: 0.35,
      topP: 0.9,
      maxOutputTokens: 4096,
      responseMimeType: 'application/json',
    },
  };
  const result = await postJson(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-flash-latest:generateContent?key=${encodeURIComponent(apiKey)}`,
    body,
    {},
    45_000,
  );
  const responsePayload = result as AnyJson;
  const text = responsePayload.candidates?.[0]?.content?.parts?.map((part: { text?: string }) => part.text ?? '').join('') ?? '';
  return normalizeDeckOutline(parseJsonObject(text), request, responsePayload.modelVersion ?? 'gemini-flash-latest');
}

async function generateWithClaude(prompt: string, request: DeckOutlineRequest): Promise<DeckOutline> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) throw new Error('Anthropic API key is not configured.');

  const result = await postJson(
    'https://api.anthropic.com/v1/messages',
    {
      model: process.env.ANTHROPIC_MODEL || 'claude-sonnet-4-5',
      max_tokens: 4096,
      temperature: 0.35,
      system: 'You are a senior learning designer. Return compact valid JSON only. No markdown.',
      messages: [{ role: 'user', content: prompt }],
    },
    {
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
    },
    60_000,
  );
  const responsePayload = result as AnyJson;
  const text = responsePayload.content?.map((part: { text?: string }) => part.text ?? '').join('') ?? '';
  return normalizeDeckOutline(parseJsonObject(text), request, responsePayload.model ?? 'claude-sonnet');
}

async function generateWithKimi(_prompt: string, _request: DeckOutlineRequest): Promise<DeckOutline> {
  throw new Error('Kimi is configured for async jobs only. Use Gemini now, or add a background queue before enabling Kimi generation.');
}

async function postJson(url: string, body: unknown, headers: Record<string, string>, timeoutMs: number): Promise<unknown> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'content-type': 'application/json', ...headers },
      body: JSON.stringify(body),
      signal: controller.signal,
    });
    const payload = await response.json().catch(() => undefined);
    if (!response.ok) {
      const errorPayload = payload as AnyJson | undefined;
      const message = errorPayload?.error?.message ?? errorPayload?.error ?? `Provider request failed with ${response.status}`;
      throw new Error(String(message));
    }
    return payload;
  } finally {
    clearTimeout(timeout);
  }
}

function normalizeDeckOutline(payload: Partial<DeckOutline>, request: DeckOutlineRequest, model: string): DeckOutline {
  const sourceArtifacts = [...new Set(uniqueSourceRefs(getLearningPath().sourceRefs).map((ref) => ref.artifact))];
  const slides = Array.isArray(payload.slides) ? payload.slides.slice(0, request.slideCount) : [];

  return {
    provider: request.provider,
    model,
    title: String(payload.title || request.topic),
    audience: String(payload.audience || request.audience),
    durationMinutes: Number(payload.durationMinutes || request.durationMinutes),
    learningObjectives: stringArray(payload.learningObjectives).slice(0, 5),
    slides: slides.map((slide, index) => ({
      title: String(slide?.title || `Slide ${index + 1}`),
      objective: String(slide?.objective || 'Support facilitator-led practice.'),
      talkingPoints: stringArray(slide?.talkingPoints).slice(0, 4),
      activityPrompt: String(slide?.activityPrompt || 'Pause for a short pair practice.'),
      facilitatorNotes: String(slide?.facilitatorNotes || 'Keep the activity grounded in site realities.'),
      sourceRefs: normalizeSourceRefs(slide?.sourceRefs),
    })),
    handoffNotes: stringArray(payload.handoffNotes).slice(0, 5),
    sourceArtifacts,
    generatedAt: new Date().toISOString(),
  };
}

function parseJsonObject(text: string) {
  const trimmed = text.trim().replace(/^```json\s*/i, '').replace(/^```\s*/i, '').replace(/```$/i, '').trim();
  const start = trimmed.indexOf('{');
  const end = trimmed.lastIndexOf('}');
  if (start === -1 || end === -1) throw new Error('Provider did not return a JSON object.');
  return JSON.parse(trimmed.slice(start, end + 1));
}

function uniqueSourceRefs(refs: SourceRef[]) {
  const seen = new Set<string>();
  return refs.filter((ref) => {
    const key = `${ref.artifact}:${ref.locator}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function normalizeSourceRefs(value: unknown): SourceRef[] {
  if (!Array.isArray(value)) return getLearningPath().sourceRefs.slice(0, 2);
  return value
    .filter((ref): ref is SourceRef => Boolean(ref?.artifact && ref?.locator))
    .map((ref) => ({ artifact: String(ref.artifact), locator: String(ref.locator) }))
    .slice(0, 3);
}

function stringArray(value: unknown): string[] {
  return Array.isArray(value) ? value.map((item) => String(item)).filter(Boolean) : [];
}
