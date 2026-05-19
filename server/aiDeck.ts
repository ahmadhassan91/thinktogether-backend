import { getLearningPath, trainingModules } from '../src/data/trainingData';
import type { SourceRef } from '../src/types';

export type AiDeckProvider = 'gemini' | 'openai' | 'claude';

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
  layout: 'process' | 'matrix' | 'scenario' | 'commitment' | 'loop' | 'pyramid' | 'timeline' | 'scorecard';
  talkingPoints: string[];
  activityPrompt: string;
  facilitatorNotes: string;
  sourceRefs: SourceRef[];
  visualSpec: DeckVisualSpec;
};

export type DeckVisualSpec = {
  type: 'flow' | 'loop' | 'matrix' | 'scenario-ladder' | 'commitment-map' | 'pyramid' | 'timeline' | 'scorecard';
  headline: string;
  stages: Array<{
    label: string;
    detail?: string;
  }>;
  callout?: string;
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
  mode: 'sync' | 'source-workspace';
  note: string;
};

type JsonRecord = Record<string, unknown>;

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
      id: 'openai',
      label: 'OpenAI GPT-5.5',
      configured: Boolean(env.OPENAI_API_KEY),
      mode: 'sync',
      note: 'Premium structured deck planner for professional infographic PPTX exports.',
    },
    {
      id: 'claude',
      label: 'Claude Sonnet',
      configured: Boolean(env.ANTHROPIC_API_KEY),
      mode: 'sync',
      note: 'Premium narrative planner for polished facilitator decks. Requires Anthropic credits.',
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
  if (request.provider === 'openai') return generateWithOpenAi(prompt, request);
  return generateWithClaude(prompt, request);
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
      "layout": "process | matrix | scenario | commitment | loop | pyramid | timeline | scorecard",
      "talkingPoints": ["string", "string", "string"],
      "visualSpec": {
        "type": "flow | loop | matrix | scenario-ladder | commitment-map | pyramid | timeline | scorecard",
        "headline": "short visual claim",
        "stages": [{"label": "2-5 words", "detail": "optional proof or instruction under 14 words"}],
        "callout": "optional high-emphasis metric or facilitation cue"
      },
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
- Choose varied slide layouts: process for routines, matrix for comparisons, scenario for situational practice, commitment for transfer/next steps.
- At least half the slides must include an infographic-friendly visualSpec: loop for 10:2 rhythm, pyramid for PBIS tiers, timeline for training sequence, scorecard for readiness or checks.
- Treat visualSpec as an art-direction storyboard, not a content summary. It should describe the infographic object the renderer will build.
- Avoid basic text-only slide plans. Every slide needs one dominant visual object: cycle, ladder, timeline, tier stack, readiness scorecard, decision matrix, or transfer map.
- visualSpec.headline must be a short visual claim, not a restatement of the slide title.
- visualSpec.stages must be concise enough for editable PowerPoint shapes, not paragraphs, and each stage should pair a staff action with observable evidence.
- visualSpec.callout should be a metric, facilitation cue, or review checkpoint that deserves a designed badge.
- Talking points should be short labels or evidence statements that can become infographic cards.
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
  const responsePayload = asJsonRecord(result);
  const firstCandidate = asJsonRecord(asJsonArray(responsePayload.candidates)[0]);
  const content = asJsonRecord(firstCandidate.content);
  const text = asJsonArray(content.parts)
    .map((part) => getString(asJsonRecord(part).text))
    .join('');
  return normalizeDeckOutline(parseJsonObject(text), request, getString(responsePayload.modelVersion, 'gemini-flash-latest'));
}

async function generateWithOpenAi(prompt: string, request: DeckOutlineRequest): Promise<DeckOutline> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) throw new Error('OpenAI API key is not configured.');

  const result = await postJson(
    'https://api.openai.com/v1/responses',
    {
      model: process.env.OPENAI_DECK_MODEL || 'gpt-5.5',
      instructions: 'You are a senior learning designer, presentation strategist, and infographic art director. Return compact valid JSON only. No markdown.',
      input: prompt,
      max_output_tokens: 6144,
      text: {
        format: {
          type: 'json_object',
        },
      },
    },
    {
      authorization: `Bearer ${apiKey}`,
    },
    75_000,
  );
  const responsePayload = asJsonRecord(result);
  const text = getString(responsePayload.output_text)
    || asJsonArray(responsePayload.output)
      .flatMap((item) => asJsonArray(asJsonRecord(item).content))
      .map((part) => getString(asJsonRecord(part).text))
      .join('');
  return normalizeDeckOutline(parseJsonObject(text), request, getString(responsePayload.model, 'gpt-5.5'));
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
  const responsePayload = asJsonRecord(result);
  const text = asJsonArray(responsePayload.content)
    .map((part) => getString(asJsonRecord(part).text))
    .join('');
  return normalizeDeckOutline(parseJsonObject(text), request, getString(responsePayload.model, 'claude-sonnet'));
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
      const errorPayload = asJsonRecord(payload);
      const error = asJsonRecord(errorPayload.error);
      const message = getString(error.message)
        || getString(errorPayload.error)
        || `Provider request failed with ${response.status}`;
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
      layout: normalizeLayout(slide?.layout, index),
      talkingPoints: stringArray(slide?.talkingPoints).slice(0, 4),
      activityPrompt: String(slide?.activityPrompt || 'Pause for a short pair practice.'),
      facilitatorNotes: String(slide?.facilitatorNotes || 'Keep the activity grounded in site realities.'),
      sourceRefs: normalizeSourceRefs(slide?.sourceRefs),
      visualSpec: normalizeVisualSpec(slide?.visualSpec, slide, index),
    })),
    handoffNotes: stringArray(payload.handoffNotes).slice(0, 5),
    sourceArtifacts,
    generatedAt: new Date().toISOString(),
  };
}

function normalizeLayout(value: unknown, index: number): DeckSlide['layout'] {
  if (
    value === 'process'
    || value === 'matrix'
    || value === 'scenario'
    || value === 'commitment'
    || value === 'loop'
    || value === 'pyramid'
    || value === 'timeline'
    || value === 'scorecard'
  ) return value;
  const layouts: DeckSlide['layout'][] = ['loop', 'matrix', 'scenario', 'pyramid', 'timeline', 'commitment', 'scorecard', 'process'];
  return layouts[index % layouts.length];
}

function normalizeVisualSpec(value: unknown, slide: unknown, index: number): DeckVisualSpec {
  const source = asJsonRecord(value);
  const slideRecord = asJsonRecord(slide);
  const layout = normalizeLayout(slideRecord.layout, index);
  const title = getString(slideRecord.title, `Slide ${index + 1}`);
  const points = stringArray(slideRecord.talkingPoints).slice(0, 5);
  const fallbackType = visualTypeForLayout(layout, title, index);
  const rawType = source.type;
  const type = isVisualType(rawType) ? rawType : fallbackType;
  const rawStages = Array.isArray(source.stages) ? source.stages : [];
  const stages = rawStages
    .map((stage) => {
      const record = asJsonRecord(stage);
      return {
        label: compactString(getString(record.label), 34),
        detail: compactString(getString(record.detail), 92),
      };
    })
    .filter((stage) => stage.label);
  const fallbackStages = points.length ? points : ['Teach it', 'Model it', 'Practice it', 'Check it'];

  return {
    type,
    headline: compactString(getString(source.headline, title), 78),
    stages: (stages.length ? stages : fallbackStages.map((point) => ({ label: compactString(point, 34) }))).slice(0, 5),
    callout: compactString(getString(source.callout), 120) || undefined,
  };
}

function isVisualType(value: unknown): value is DeckVisualSpec['type'] {
  return value === 'flow'
    || value === 'loop'
    || value === 'matrix'
    || value === 'scenario-ladder'
    || value === 'commitment-map'
    || value === 'pyramid'
    || value === 'timeline'
    || value === 'scorecard';
}

function visualTypeForLayout(layout: DeckSlide['layout'], title: string, index: number): DeckVisualSpec['type'] {
  const normalized = title.toLowerCase();
  if (layout === 'loop' || normalized.includes('10:2') || normalized.includes('rhythm')) return 'loop';
  if (layout === 'pyramid' || normalized.includes('tier')) return 'pyramid';
  if (layout === 'timeline' || normalized.includes('sequence')) return 'timeline';
  if (layout === 'scorecard' || normalized.includes('check') || normalized.includes('readiness')) return 'scorecard';
  if (layout === 'matrix') return 'matrix';
  if (layout === 'scenario') return 'scenario-ladder';
  if (layout === 'commitment') return 'commitment-map';
  return index % 4 === 0 ? 'loop' : 'flow';
}

function compactString(value: string, maxLength = 80) {
  const normalized = value.replace(/\s+/g, ' ').trim();
  if (normalized.length <= maxLength) return normalized;
  const sliced = normalized.slice(0, Math.max(0, maxLength - 1));
  const breakAt = Math.max(sliced.lastIndexOf('.'), sliced.lastIndexOf(';'), sliced.lastIndexOf(','));
  const base = breakAt > maxLength * 0.45 ? sliced.slice(0, breakAt) : sliced;
  return `${base.trim()}...`;
}

function parseJsonObject(text: string): Partial<DeckOutline> {
  const trimmed = text.trim().replace(/^```json\s*/i, '').replace(/^```\s*/i, '').replace(/```$/i, '').trim();
  const start = trimmed.indexOf('{');
  const end = trimmed.lastIndexOf('}');
  if (start === -1 || end === -1) throw new Error('Provider did not return a JSON object.');
  return JSON.parse(trimmed.slice(start, end + 1)) as Partial<DeckOutline>;
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

function asJsonRecord(value: unknown): JsonRecord {
  return value && typeof value === 'object' && !Array.isArray(value) ? value as JsonRecord : {};
}

function asJsonArray(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}

function getString(value: unknown, fallback = ''): string {
  return typeof value === 'string' ? value : fallback;
}
