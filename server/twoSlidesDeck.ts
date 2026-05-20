import { getLearningPath, trainingModules } from '../src/data/trainingData';
import type { DeckOutlineRequest } from './aiDeck';

type TwoSlidesResponse = {
  success?: boolean;
  data?: {
    jobId?: string;
    status?: string;
    message?: string;
    downloadUrl?: string;
    jobUrl?: string;
    slidePageCount?: number;
  };
  error?: unknown;
};

export type TwoSlidesDeckExport = {
  buffer: Buffer;
  filename: string;
  contentType: 'application/pdf';
  model: string;
};

const TWO_SLIDES_API_BASE = 'https://2slides.com/api/v1';

export async function createTwoSlidesDeck(request: DeckOutlineRequest): Promise<TwoSlidesDeckExport> {
  const apiKey = process.env.SLIDES_2SLIDES_API_KEY;
  if (!apiKey) throw new Error('2slides API key is not configured.');

  const page = Math.max(1, Math.min(14, request.slideCount));
  const userInput = buildTwoSlidesPrompt(request);
  const referenceImageUrl = process.env.TWOSLIDES_REFERENCE_IMAGE_URL;
  const body = referenceImageUrl
    ? {
        userInput,
        referenceImageUrl,
        responseLanguage: 'English',
        aspectRatio: '16:9',
        resolution: process.env.TWOSLIDES_RESOLUTION || '2K',
        page,
        contentDetail: 'standard',
      }
    : {
        userInput,
        responseLanguage: 'English',
        aspectRatio: '16:9',
        resolution: process.env.TWOSLIDES_RESOLUTION || '2K',
        page,
        contentDetail: 'standard',
        designSpec: [
          'premium executive training deck',
          'cinematic but readable',
          'large typography',
          'dominant infographics',
          'dark teal, warm cream, Think Together orange, mint accents',
          'minimal text per slide',
          'source-grounded facilitator prompts',
          'avoid dense dashboards and tiny labels',
        ].join(', '),
      };

  const endpoint = referenceImageUrl ? '/slides/create-like-this' : '/slides/create-pdf-slides';
  const payload = await postTwoSlides(endpoint, body, apiKey, Math.max(120_000, page * 45_000));
  const data = payload.data;
  if (!payload.success || !data?.downloadUrl) {
    throw new Error(twoSlidesErrorMessage(payload));
  }

  const response = await fetch(data.downloadUrl);
  if (!response.ok) throw new Error(`2slides download failed with ${response.status}`);
  const arrayBuffer = await response.arrayBuffer();

  return {
    buffer: Buffer.from(arrayBuffer),
    filename: `${slugify(request.topic)}-2slides-premium.pdf`,
    contentType: 'application/pdf',
    model: referenceImageUrl ? '2slides-create-like-this' : '2slides-create-pdf-slides',
  };
}

async function postTwoSlides(endpoint: string, body: unknown, apiKey: string, timeoutMs: number): Promise<TwoSlidesResponse> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(`${TWO_SLIDES_API_BASE}${endpoint}`, {
      method: 'POST',
      headers: {
        authorization: `Bearer ${apiKey}`,
        'content-type': 'application/json',
      },
      body: JSON.stringify(body),
      signal: controller.signal,
    });
    const payload = await response.json().catch(() => undefined) as TwoSlidesResponse | undefined;
    if (!response.ok) {
      throw new Error(twoSlidesErrorMessage(payload) || `2slides request failed with ${response.status}`);
    }
    return payload ?? {};
  } finally {
    clearTimeout(timeout);
  }
}

function buildTwoSlidesPrompt(request: DeckOutlineRequest) {
  const path = getLearningPath();
  const moduleContext = trainingModules
    .slice(0, 8)
    .map((moduleItem) => `- ${moduleItem.title}: ${moduleItem.content.summary}`)
    .join('\n');

  return `Create a premium Think Together facilitator training deck.

Topic: ${request.topic}
Audience: ${request.audience}
Duration: ${request.durationMinutes} minutes
Slide count: ${request.slideCount}

Use these source artifacts and keep claims grounded:
${path.sourceRefs.map((ref) => `- ${ref.artifact}: ${ref.locator}`).join('\n')}

PBIS source context:
${moduleContext}

Creative direction:
- Premium readable deck, not a worksheet.
- Every slide must have one dominant infographic or visual metaphor.
- Use short slide titles, large type, and restrained text.
- Include facilitator practice moments, not long paragraphs.
- Use Think Together colors: orange, teal/mint, warm cream, dark blue-teal.
- Add source/review cues quietly, not as clutter.
- Emphasize 10:2 teaching rhythm, PBIS Tier 1 routines, pre-correction, restorative response, knowledge checks, attendance/completion evidence, and facilitator handoff.
- Avoid tiny body text, crowded cards, generic bullet slides, and ungrounded claims.`;
}

function twoSlidesErrorMessage(payload: TwoSlidesResponse | undefined) {
  if (!payload) return '2slides returned an empty response.';
  if (typeof payload.error === 'string') return payload.error;
  if (payload.error && typeof payload.error === 'object' && 'message' in payload.error) {
    return String((payload.error as { message?: unknown }).message ?? '2slides request failed.');
  }
  return payload.data?.message || '2slides request failed.';
}

function slugify(value: string) {
  const slug = value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 72);
  return slug || 'think-together-training-deck';
}
