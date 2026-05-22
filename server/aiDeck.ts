import { getLearningPath, getTrainingSourceArtifact, trainingModules } from '../src/data/trainingData';
import type { SourceArtifact, SourceRef } from '../src/types';

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

export type ContentStudioDeliveryMode = 'in-person' | 'virtual' | 'hybrid';

export type ContentStudioPackageRequest = {
  provider?: AiDeckProvider;
  topic: string;
  audience: string;
  durationMinutes: number;
  deliveryMode: ContentStudioDeliveryMode;
  sourceArtifactIds?: string[];
};

export type ContentStudioDeckSection = {
  sectionTitle: string;
  objective: string;
  keyPoints: string[];
  activityPrompt: string;
  facilitatorNotes: string;
  sourceRefs: SourceRef[];
};

export type ContentStudioKnowledgeCheckQuestion = {
  question: string;
  options: string[];
  correctAnswer: string;
  rationale: string;
  sourceRefs: SourceRef[];
};

export type ContentStudioPracticeActivity = {
  title: string;
  instructions: string[];
  facilitatorPrompt: string;
  successCriteria: string[];
  sourceRefs: SourceRef[];
};

export type ContentStudioPackage = {
  provider: AiDeckProvider | 'deterministic';
  model: string;
  title: string;
  audience: string;
  durationMinutes: number;
  learningObjectives: string[];
  deckOutline: ContentStudioDeckSection[];
  knowledgeCheckQuestions: ContentStudioKnowledgeCheckQuestion[];
  practiceActivity: ContentStudioPracticeActivity;
  facilitatorGuideNotes: string[];
  learnerHandout: {
    summary: string;
    keyTakeaways: string[];
    resourceList: Array<SourceRef & { title?: string }>;
  };
  deliveryNotes: {
    inPerson: string[];
    virtual: string[];
  };
  sourceArtifacts: string[];
  generatedAt: string;
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
      label: 'OpenAI Premium',
      configured: Boolean(env.OPENAI_API_KEY),
      mode: 'sync',
      note: `Premium structured deck planner using ${getPreferredOpenAiDeckModel(env)} when available.`,
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

export async function generateContentStudioPackage(request: ContentStudioPackageRequest): Promise<ContentStudioPackage> {
  const provider = request.provider ?? 'openai';
  if (!isProviderConfigured(provider)) return buildDeterministicContentStudioPackage(request);

  const prompt = buildContentStudioPrompt(request);
  try {
    if (provider === 'gemini') {
      const packagePayload = await generateContentPackageWithGemini(prompt);
      return normalizeContentStudioPackage(packagePayload.payload, request, provider, packagePayload.model);
    }
    if (provider === 'openai') {
      const packagePayload = await generateContentPackageWithOpenAi(prompt);
      return normalizeContentStudioPackage(packagePayload.payload, request, provider, packagePayload.model);
    }
    const packagePayload = await generateContentPackageWithClaude(prompt);
    return normalizeContentStudioPackage(packagePayload.payload, request, provider, packagePayload.model);
  } catch (error) {
    if (error instanceof Error && error.message.includes('API key is not configured')) {
      return buildDeterministicContentStudioPackage(request);
    }
    throw error;
  }
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

export function buildContentStudioPrompt(request: ContentStudioPackageRequest) {
  const context = contentStudioContext(request);
  const moduleSummaries = context.modules
    .map((moduleItem) => `- ${moduleItem.title}: ${moduleItem.content.summary} Key points: ${moduleItem.content.keyPoints.join('; ')}`)
    .join('\n');

  return `Create a Think Together Content Studio v1 training package as strict JSON only.

Topic: ${request.topic}
Audience: ${request.audience}
Duration minutes: ${request.durationMinutes}
Delivery mode: ${request.deliveryMode}

Use only this source-grounded context:
${moduleSummaries}

Source artifacts and locators:
${context.sourceRefs.map((ref) => `- ${ref.artifact}: ${ref.locator}`).join('\n')}

Required JSON shape:
{
  "title": "string",
  "audience": "string",
  "durationMinutes": number,
  "learningObjectives": ["2-3 concise objectives"],
  "deckOutline": [
    {
      "sectionTitle": "string",
      "objective": "string",
      "keyPoints": ["string"],
      "activityPrompt": "string",
      "facilitatorNotes": "string",
      "sourceRefs": [{"artifact": "string", "locator": "string"}]
    }
  ],
  "knowledgeCheckQuestions": [
    {
      "question": "string",
      "options": ["string", "string", "string"],
      "correctAnswer": "string",
      "rationale": "string",
      "sourceRefs": [{"artifact": "string", "locator": "string"}]
    }
  ],
  "practiceActivity": {
    "title": "string",
    "instructions": ["string"],
    "facilitatorPrompt": "string",
    "successCriteria": ["string"],
    "sourceRefs": [{"artifact": "string", "locator": "string"}]
  },
  "facilitatorGuideNotes": ["string"],
  "learnerHandout": {
    "summary": "string",
    "keyTakeaways": ["string"],
    "resourceList": [{"artifact": "string", "locator": "string", "title": "string"}]
  },
  "deliveryNotes": {
    "inPerson": ["string"],
    "virtual": ["string"]
  }
}

Rules:
- Return exactly 2-3 learningObjectives.
- Include 4-6 deckOutline sections.
- Include exactly 3 knowledgeCheckQuestions with three options each.
- Include one application/practice activity suitable for program staff.
- Include facilitator guide notes and learner handout resources.
- Include both in-person and virtual delivery notes, even for hybrid delivery.
- Preserve human facilitation; do not imply AI replaces trainers.
- Use the 10:2 rhythm: brief content, then a practice/application prompt.
- Return JSON only, no markdown.`;
}

function isProviderConfigured(provider: AiDeckProvider, env = process.env) {
  if (provider === 'gemini') return Boolean(env.GEMINI_API_KEY);
  if (provider === 'openai') return Boolean(env.OPENAI_API_KEY);
  return Boolean(env.ANTHROPIC_API_KEY);
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

  const result = await postOpenAiResponses(apiKey, {
    model: getPreferredOpenAiDeckModel(),
    instructions: 'You are a senior learning designer, presentation strategist, and infographic art director. Return compact valid JSON only. No markdown.',
    input: prompt,
    max_output_tokens: 6144,
    text: {
      format: {
        type: 'json_object',
      },
    },
  });
  const responsePayload = asJsonRecord(result);
  const text = getOpenAiText(responsePayload);
  return normalizeDeckOutline(parseJsonObject(text), request, getString(responsePayload.model, getPreferredOpenAiDeckModel()));
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

async function postOpenAiResponses(apiKey: string, body: JsonRecord): Promise<unknown> {
  const preferredModel = getString(body.model, getPreferredOpenAiDeckModel());
  const fallbackModels = getOpenAiModelFallbacks(preferredModel);
  let lastError: Error | undefined;

  for (const model of fallbackModels) {
    try {
      return await postJson(
        'https://api.openai.com/v1/responses',
        { ...body, model },
        {
          authorization: `Bearer ${apiKey}`,
        },
        75_000,
      );
    } catch (error) {
      lastError = error instanceof Error ? error : new Error('OpenAI provider request failed.');
      if (!isRetryableOpenAiModelError(lastError)) throw lastError;
    }
  }

  throw lastError ?? new Error('OpenAI provider request failed.');
}

function getOpenAiText(responsePayload: JsonRecord) {
  return getString(responsePayload.output_text)
    || asJsonArray(responsePayload.output)
      .flatMap((item) => asJsonArray(asJsonRecord(item).content))
      .map((part) => getString(asJsonRecord(part).text))
      .join('');
}

function getPreferredOpenAiDeckModel(env = process.env) {
  return env.OPENAI_DECK_MODEL || env.OPENAI_CONTENT_STUDIO_MODEL || 'gpt-5.2';
}

function getOpenAiModelFallbacks(preferredModel: string) {
  return [...new Set([
    preferredModel,
    'gpt-5.2',
    'gpt-5.1',
    'gpt-4.1',
  ])];
}

function isRetryableOpenAiModelError(error: Error) {
  const message = error.message.toLowerCase();
  return message.includes('model')
    || message.includes('not found')
    || message.includes('does not exist')
    || message.includes('not have access')
    || message.includes('unsupported');
}

async function generateContentPackageWithGemini(prompt: string): Promise<{ payload: Partial<ContentStudioPackage>; model: string }> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error('Gemini API key is not configured.');

  const result = await postJson(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-flash-latest:generateContent?key=${encodeURIComponent(apiKey)}`,
    {
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig: {
        temperature: 0.28,
        topP: 0.9,
        maxOutputTokens: 6144,
        responseMimeType: 'application/json',
      },
    },
    {},
    45_000,
  );
  const responsePayload = asJsonRecord(result);
  const firstCandidate = asJsonRecord(asJsonArray(responsePayload.candidates)[0]);
  const content = asJsonRecord(firstCandidate.content);
  const text = asJsonArray(content.parts)
    .map((part) => getString(asJsonRecord(part).text))
    .join('');
  return {
    payload: parseJsonObject(text) as Partial<ContentStudioPackage>,
    model: getString(responsePayload.modelVersion, 'gemini-flash-latest'),
  };
}

async function generateContentPackageWithOpenAi(prompt: string): Promise<{ payload: Partial<ContentStudioPackage>; model: string }> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) throw new Error('OpenAI API key is not configured.');

  const result = await postOpenAiResponses(apiKey, {
    model: process.env.OPENAI_CONTENT_STUDIO_MODEL || process.env.OPENAI_DECK_MODEL || getPreferredOpenAiDeckModel(),
    instructions: 'You are a senior Think Together learning designer. Return compact valid JSON only. No markdown.',
    input: prompt,
    max_output_tokens: 6144,
    text: {
      format: {
        type: 'json_object',
      },
    },
  });
  const responsePayload = asJsonRecord(result);
  const text = getOpenAiText(responsePayload);
  return {
    payload: parseJsonObject(text) as Partial<ContentStudioPackage>,
    model: getString(responsePayload.model, getPreferredOpenAiDeckModel()),
  };
}

async function generateContentPackageWithClaude(prompt: string): Promise<{ payload: Partial<ContentStudioPackage>; model: string }> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) throw new Error('Anthropic API key is not configured.');

  const result = await postJson(
    'https://api.anthropic.com/v1/messages',
    {
      model: process.env.ANTHROPIC_MODEL || 'claude-sonnet-4-5',
      max_tokens: 6144,
      temperature: 0.28,
      system: 'You are a senior Think Together learning designer. Return compact valid JSON only. No markdown.',
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
  return {
    payload: parseJsonObject(text) as Partial<ContentStudioPackage>,
    model: getString(responsePayload.model, 'claude-sonnet'),
  };
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

function normalizeContentStudioPackage(
  payload: Partial<ContentStudioPackage>,
  request: ContentStudioPackageRequest,
  provider: AiDeckProvider,
  model: string,
): ContentStudioPackage {
  const fallback = buildDeterministicContentStudioPackage(request);
  const deckOutline = Array.isArray(payload.deckOutline) ? payload.deckOutline : [];
  const knowledgeCheckQuestions = Array.isArray(payload.knowledgeCheckQuestions) ? payload.knowledgeCheckQuestions : [];
  const practiceActivity = asJsonRecord(payload.practiceActivity);
  const learnerHandout = asJsonRecord(payload.learnerHandout);
  const deliveryNotes = asJsonRecord(payload.deliveryNotes);

  return {
    provider,
    model,
    title: getString(payload.title, fallback.title),
    audience: getString(payload.audience, request.audience),
    durationMinutes: Number(payload.durationMinutes || request.durationMinutes),
    learningObjectives: boundedList(stringArray(payload.learningObjectives), 2, 3, fallback.learningObjectives),
    deckOutline: (deckOutline.length ? deckOutline : fallback.deckOutline)
      .map((section, index) => normalizeContentStudioDeckSection(section, fallback.deckOutline[index] ?? fallback.deckOutline[0]))
      .slice(0, 6),
    knowledgeCheckQuestions: (knowledgeCheckQuestions.length ? knowledgeCheckQuestions : fallback.knowledgeCheckQuestions)
      .map((question, index) => normalizeKnowledgeCheckQuestion(question, fallback.knowledgeCheckQuestions[index] ?? fallback.knowledgeCheckQuestions[0]))
      .slice(0, 3),
    practiceActivity: {
      title: getString(practiceActivity.title, fallback.practiceActivity.title),
      instructions: boundedList(stringArray(practiceActivity.instructions), 2, 5, fallback.practiceActivity.instructions),
      facilitatorPrompt: getString(practiceActivity.facilitatorPrompt, fallback.practiceActivity.facilitatorPrompt),
      successCriteria: boundedList(stringArray(practiceActivity.successCriteria), 2, 4, fallback.practiceActivity.successCriteria),
      sourceRefs: normalizeSourceRefs(practiceActivity.sourceRefs).slice(0, 3),
    },
    facilitatorGuideNotes: boundedList(stringArray(payload.facilitatorGuideNotes), 3, 6, fallback.facilitatorGuideNotes),
    learnerHandout: {
      summary: getString(learnerHandout.summary, fallback.learnerHandout.summary),
      keyTakeaways: boundedList(stringArray(learnerHandout.keyTakeaways), 3, 5, fallback.learnerHandout.keyTakeaways),
      resourceList: normalizeResourceList(learnerHandout.resourceList, fallback.learnerHandout.resourceList),
    },
    deliveryNotes: {
      inPerson: boundedList(stringArray(deliveryNotes.inPerson), 2, 5, fallback.deliveryNotes.inPerson),
      virtual: boundedList(stringArray(deliveryNotes.virtual), 2, 5, fallback.deliveryNotes.virtual),
    },
    sourceArtifacts: fallback.sourceArtifacts,
    generatedAt: new Date().toISOString(),
  };
}

function buildDeterministicContentStudioPackage(request: ContentStudioPackageRequest): ContentStudioPackage {
  const context = contentStudioContext(request);
  const modules = context.modules.slice(0, 5);
  const deckSourceRefs = context.sourceRefs.length ? context.sourceRefs : getLearningPath().sourceRefs;
  const objectives = boundedList(
    modules.flatMap((moduleItem) => moduleItem.content.learningObjectives),
    2,
    3,
    [
      `Connect ${request.topic} to Think Together program routines.`,
      'Practice explicit teaching, reinforcement, and restorative correction moves.',
      'Plan how facilitators will transfer the routine to their own site context.',
    ],
  );

  const deckOutline = modules.map((moduleItem, index) => ({
    sectionTitle: moduleItem.title,
    objective: moduleItem.content.learningObjectives[0] ?? 'Apply the routine with staff.',
    keyPoints: moduleItem.content.keyPoints.slice(0, 3),
    activityPrompt: index % 2 === 0
      ? `Run a two-minute partner practice for ${moduleItem.title.toLowerCase()}.`
      : `Sort one site scenario into the right ${moduleItem.title.toLowerCase()} response.`,
    facilitatorNotes: `Use the 10:2 rhythm: keep the ${moduleItem.title.toLowerCase()} input brief, then move staff into rehearsal.`,
    sourceRefs: moduleItem.content.sourceRefs.slice(0, 3),
  }));

  const knowledgeCheckQuestions = modules.slice(0, 3).map((moduleItem) => {
    const correctAnswer = moduleItem.content.keyPoints[0] ?? moduleItem.content.summary;
    return {
      question: `Which action best supports ${moduleItem.title.toLowerCase()}?`,
      options: [
        correctAnswer,
        'Wait until behavior escalates before naming expectations.',
        'Use a different routine each day so students stay alert.',
      ],
      correctAnswer,
      rationale: moduleItem.content.summary,
      sourceRefs: moduleItem.content.sourceRefs.slice(0, 2),
    };
  });

  const resourceList = deckSourceRefs.slice(0, 6).map((ref) => {
    const artifact = getTrainingSourceArtifact(ref.artifact);
    return {
      artifact: ref.artifact,
      locator: ref.locator,
      ...(artifact?.title ? { title: artifact.title } : {}),
    };
  });

  return {
    provider: 'deterministic',
    model: 'content-studio-fallback-v1',
    title: request.topic,
    audience: request.audience,
    durationMinutes: request.durationMinutes,
    learningObjectives: objectives,
    deckOutline,
    knowledgeCheckQuestions,
    practiceActivity: {
      title: `${request.topic} practice lab`,
      instructions: [
        'Select one realistic program transition or student-support scenario.',
        'Have pairs script the adult language, model the routine, and rehearse the correction or reinforcement move.',
        'Debrief with one observable strength and one adjustment before the next round.',
      ],
      facilitatorPrompt: 'What would students see and hear if this routine was taught clearly and reinforced consistently?',
      successCriteria: [
        'Staff name the expectation in observable language.',
        'Staff model before asking learners to perform the routine.',
        'Staff use a brief check for understanding before moving on.',
      ],
      sourceRefs: deckSourceRefs.slice(0, 3),
    },
    facilitatorGuideNotes: [
      'Open by connecting the package to existing PBIS and induction source artifacts.',
      'Keep direct instruction short and move quickly into staff rehearsal.',
      'Ask facilitators to name the student evidence they would look for during transfer.',
      'Close with one commitment each participant can try during the next program session.',
    ],
    learnerHandout: {
      summary: `${request.topic} for ${request.audience}: source-grounded routines, quick checks, and practice moves for expanded learning staff.`,
      keyTakeaways: [
        'Teach expectations before correction.',
        'Use concise adult language and observable evidence.',
        'Pair each content chunk with practice, feedback, and transfer planning.',
      ],
      resourceList,
    },
    deliveryNotes: {
      inPerson: [
        'Set tables for pairs or triads so every participant can rehearse language out loud.',
        'Use chart paper or a visible matrix to capture examples, evidence, and transfer commitments.',
      ],
      virtual: [
        'Use breakout rooms for the practice lab and ask each room to return with one scripted adult move.',
        'Keep resource links and the handout visible in chat so participants can reference source artifacts during practice.',
      ],
    },
    sourceArtifacts: context.sourceArtifacts.map((artifact) => artifact.artifact),
    generatedAt: new Date().toISOString(),
  };
}

function normalizeContentStudioDeckSection(value: unknown, fallback: ContentStudioDeckSection): ContentStudioDeckSection {
  const section = asJsonRecord(value);
  return {
    sectionTitle: getString(section.sectionTitle, fallback.sectionTitle),
    objective: getString(section.objective, fallback.objective),
    keyPoints: boundedList(stringArray(section.keyPoints), 2, 4, fallback.keyPoints),
    activityPrompt: getString(section.activityPrompt, fallback.activityPrompt),
    facilitatorNotes: getString(section.facilitatorNotes, fallback.facilitatorNotes),
    sourceRefs: normalizeSourceRefs(section.sourceRefs).slice(0, 3),
  };
}

function normalizeKnowledgeCheckQuestion(value: unknown, fallback: ContentStudioKnowledgeCheckQuestion): ContentStudioKnowledgeCheckQuestion {
  const question = asJsonRecord(value);
  const options = boundedList(stringArray(question.options), 3, 4, fallback.options);
  const correctAnswer = getString(question.correctAnswer, fallback.correctAnswer);
  return {
    question: getString(question.question, fallback.question),
    options: options.includes(correctAnswer) ? options : [correctAnswer, ...options].slice(0, 4),
    correctAnswer,
    rationale: getString(question.rationale, fallback.rationale),
    sourceRefs: normalizeSourceRefs(question.sourceRefs).slice(0, 2),
  };
}

function normalizeResourceList(value: unknown, fallback: Array<SourceRef & { title?: string }>) {
  if (!Array.isArray(value)) return fallback;
  const resources = value
    .map((item) => {
      const record = asJsonRecord(item);
      const artifact = getString(record.artifact);
      const locator = getString(record.locator);
      const title = getString(record.title);
      return artifact && locator ? { artifact, locator, ...(title ? { title } : {}) } : undefined;
    })
    .filter((item): item is SourceRef & { title?: string } => Boolean(item))
    .slice(0, 8);
  return resources.length ? resources : fallback;
}

function boundedList(values: string[], min: number, max: number, fallback: string[]) {
  const cleaned = values.map((value) => compactString(value, 180)).filter(Boolean);
  const withFallback = cleaned.length >= min ? cleaned : [...cleaned, ...fallback];
  return [...new Set(withFallback)].slice(0, max);
}

function contentStudioContext(request: ContentStudioPackageRequest) {
  const requestedArtifacts = (request.sourceArtifactIds ?? [])
    .map((artifactId) => getTrainingSourceArtifact(artifactId))
    .filter((artifact): artifact is SourceArtifact => Boolean(artifact));
  const requestedArtifactNames = new Set(requestedArtifacts.map((artifact) => artifact.artifact));
  const modulesForArtifacts = requestedArtifactNames.size
    ? trainingModules.filter((moduleItem) =>
      moduleItem.content.sourceRefs.some((ref) => requestedArtifactNames.has(ref.artifact)),
    )
    : [];
  const modules = modulesForArtifacts.length ? modulesForArtifacts : trainingModules.slice(0, 6);
  const path = getLearningPath();
  const sourceRefs = uniqueSourceRefs([
    ...path.sourceRefs.filter((ref) => requestedArtifactNames.size === 0 || requestedArtifactNames.has(ref.artifact)),
    ...modules.flatMap((moduleItem) => moduleItem.content.sourceRefs),
  ]);
  const moduleArtifactNames = new Set(sourceRefs.map((ref) => ref.artifact));
  const sourceArtifacts = requestedArtifacts.length
    ? requestedArtifacts
    : [...moduleArtifactNames]
      .map((artifactName) => getTrainingSourceArtifact(artifactName))
      .filter((artifact): artifact is SourceArtifact => Boolean(artifact));

  return {
    modules: modules.slice(0, 6),
    sourceRefs,
    sourceArtifacts,
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
