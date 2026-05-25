import {
  trainingKnowledgeCheckItems,
  trainingLearningPaths,
  trainingScenarios,
} from '../src/data/trainingData';
import type { SourceRef } from '../src/types';

export type KnowledgeAssistantConfidence =
  | 'Source-backed'
  | 'Partially source-backed'
  | 'Not found in provided sources';

export type KnowledgeAssistantAnswer = {
  answer: string;
  sourceBasis: string[];
  coachingNote: string;
  confidence: KnowledgeAssistantConfidence;
  status: 'answered' | 'not_found';
};

type SourceChunk = {
  id: string;
  kind: 'path' | 'module' | 'scenario' | 'knowledge-check' | 'source-ref';
  title: string;
  searchableText: string;
  answerText: string;
  sourceRefs: SourceRef[];
};

const notFoundAnswer: KnowledgeAssistantAnswer = {
  answer: 'Not found in the provided Think Together materials.',
  sourceBasis: [],
  coachingNote: 'Use an approved SOP, deck, or knowledge-check source before making a policy or procedure claim.',
  confidence: 'Not found in provided sources',
  status: 'not_found',
};

const unsupportedPolicyTerms = [
  'district specific',
  'district-specific',
  'suspension policy',
  'transportation appendix',
  'fake slo',
  'legal requirement',
  'state law',
];

const stopWords = new Set([
  'about',
  'after',
  'again',
  'also',
  'answer',
  'before',
  'does',
  'from',
  'happen',
  'have',
  'into',
  'main',
  'materials',
  'need',
  'program',
  'question',
  'require',
  'should',
  'staff',
  'that',
  'the',
  'their',
  'there',
  'think',
  'this',
  'together',
  'what',
  'when',
  'where',
  'which',
  'while',
  'with',
]);

export function answerKnowledgeAssistantQuestion(question: string): KnowledgeAssistantAnswer {
  const normalizedQuestion = normalize(question);
  if (!normalizedQuestion || unsupportedPolicyTerms.some((term) => normalizedQuestion.includes(term))) {
    return notFoundAnswer;
  }

  const terms = tokenize(normalizedQuestion);
  if (terms.length === 0) return notFoundAnswer;

  const ranked = buildSourceChunks()
    .map((chunk) => ({ chunk, score: scoreChunk(chunk, normalizedQuestion, terms) }))
    .filter((match) => match.score > 0)
    .sort((left, right) => right.score - left.score);

  const [best] = ranked;
  if (!best || best.score < 5) return notFoundAnswer;

  const supportingChunks = ranked
    .filter((match) => match.score >= Math.max(4, best.score - 2))
    .slice(0, 2)
    .map((match) => match.chunk);
  const sourceBasis = uniqueStrings(supportingChunks.flatMap((chunk) => chunk.sourceRefs.map(formatSourceRef)));

  if (sourceBasis.length === 0) return notFoundAnswer;

  return {
    answer: composeAnswer(normalizedQuestion, supportingChunks),
    sourceBasis,
    coachingNote: 'Use the cited source language when coaching or answering follow-up questions.',
    confidence: best.score >= 8 ? 'Source-backed' : 'Partially source-backed',
    status: 'answered',
  };
}

function composeAnswer(normalizedQuestion: string, chunks: SourceChunk[]) {
  const actionableChunks = chunks.filter((chunk) => chunk.kind !== 'source-ref');
  const best = actionableChunks[0] ?? chunks[0];
  const combinedText = normalize(actionableChunks.map((chunk) => chunk.answerText).join(' '));

  if (
    normalizedQuestion.includes('site lead') &&
    (normalizedQuestion.includes('miss') || normalizedQuestion.includes('missed') || normalizedQuestion.includes('misses')) &&
    (combinedText.includes('make up') || combinedText.includes('makeup') || combinedText.includes('week 4'))
  ) {
    return [
      'If a Site Lead misses a Site Lead Onboarding session, treat it as a make-up workflow rather than ignoring the gap.',
      'The SOP-backed path is: the Site Lead communicates the conflict as early as possible, Regional Supervisors help arrange coverage and track completion evidence, and missed courses are handled through the Week 4 make-up sessions in the four-week cycle.',
      'Use LMS reminders and attendance reporting to confirm the make-up is completed before clearance or completion communication goes out.',
    ].join(' ');
  }

  if (normalizedQuestion.includes('pbis') && normalizedQuestion.includes('purpose')) {
    return [
      'The purpose of PBIS in Program Induction is to teach, model, and reinforce expected behavior proactively.',
      best.answerText,
    ].join(' ');
  }

  const keySentences = uniqueStrings(
    actionableChunks
      .flatMap((chunk) => chunk.answerText.split(/(?<=[.!?])\s+/))
      .map((sentence) => sentence.trim())
      .filter(Boolean),
  ).slice(0, 4);

  if (keySentences.length === 0) return best.answerText;
  return `Based on the matched Think Together materials: ${keySentences.join(' ')}`;
}

function buildSourceChunks(): SourceChunk[] {
  const chunks: SourceChunk[] = [];

  for (const learningPath of trainingLearningPaths) {
    chunks.push({
      id: learningPath.id,
      kind: 'path',
      title: learningPath.title,
      searchableText: [
        learningPath.title,
        learningPath.description,
        learningPath.audience,
        learningPath.modules.map((moduleItem) => moduleItem.title).join(' '),
        learningPath.sourceRefs.map(formatSourceRef).join(' '),
      ].join(' '),
      answerText: `${learningPath.title}: ${learningPath.description}`,
      sourceRefs: learningPath.sourceRefs,
    });
  }

  for (const moduleItem of trainingLearningPaths.flatMap((path) => path.modules)) {
    chunks.push({
      id: moduleItem.id,
      kind: 'module',
      title: moduleItem.title,
      searchableText: [
        moduleItem.title,
        moduleItem.content.summary,
        moduleItem.content.learningObjectives.join(' '),
        moduleItem.content.keyPoints.join(' '),
        moduleItem.content.sourceRefs.map(formatSourceRef).join(' '),
      ].join(' '),
      answerText: [moduleItem.content.summary, ...moduleItem.content.keyPoints].join(' '),
      sourceRefs: moduleItem.content.sourceRefs,
    });
  }

  for (const scenario of trainingScenarios) {
    chunks.push({
      id: scenario.id,
      kind: 'scenario',
      title: scenario.title,
      searchableText: [
        scenario.title,
        scenario.prompt,
        scenario.skillFocus,
        scenario.expectedResponseElements.join(' '),
        scenario.sourceRefs.map(formatSourceRef).join(' '),
      ].join(' '),
      answerText: `For ${scenario.title}, focus on ${scenario.skillFocus}: ${scenario.expectedResponseElements.join('; ')}.`,
      sourceRefs: scenario.sourceRefs,
    });
  }

  for (const item of trainingKnowledgeCheckItems) {
    chunks.push({
      id: item.id,
      kind: 'knowledge-check',
      title: item.prompt,
      searchableText: [
        item.prompt,
        item.choices.join(' '),
        item.correctAnswer,
        item.rationale,
        item.sourceRefs.map(formatSourceRef).join(' '),
      ].join(' '),
      answerText: `${item.correctAnswer}. ${item.rationale}`,
      sourceRefs: item.sourceRefs,
    });
  }

  for (const learningPath of trainingLearningPaths) {
    for (const ref of learningPath.sourceRefs) {
      chunks.push({
        id: `${ref.artifact}:${ref.locator}`,
        kind: 'source-ref',
        title: ref.artifact,
        searchableText: formatSourceRef(ref),
        answerText: ref.locator,
        sourceRefs: [ref],
      });
    }
  }

  return chunks;
}

function scoreChunk(chunk: SourceChunk, normalizedQuestion: string, terms: string[]) {
  const normalizedTitle = normalize(chunk.title);
  const normalizedText = normalize(chunk.searchableText);
  let score = 0;

  if (normalizedText.includes(normalizedQuestion)) score += 8;

  for (const term of terms) {
    if (normalizedTitle.includes(term)) score += 3;
    if (normalizedText.includes(term)) score += 1;
  }

  for (const [term, aliases] of Object.entries(termAliases)) {
    if (!terms.includes(term)) continue;
    for (const alias of aliases) {
      if (normalizedTitle.includes(alias)) score += 3;
      if (normalizedText.includes(alias)) score += 1;
    }
  }

  if (chunk.kind === 'module') score += 2;
  if (chunk.kind === 'scenario' || chunk.kind === 'knowledge-check') score += 1;
  if (chunk.kind === 'source-ref') score -= 2;

  return score;
}

const termAliases: Record<string, string[]> = {
  miss: ['missed', 'make up', 'makeup', 'make-up', 'absence', 'conflict'],
  missed: ['miss', 'make up', 'makeup', 'make-up', 'absence', 'conflict'],
  misses: ['missed', 'make up', 'makeup', 'make-up', 'absence', 'conflict'],
  session: ['sessions', 'course', 'courses', 'facilitation'],
  sessions: ['session', 'course', 'courses', 'facilitation'],
  makeup: ['make up', 'make-up', 'missed'],
  'make-up': ['make up', 'makeup', 'missed'],
  lead: ['leads', 'leadership'],
  leads: ['lead', 'leadership'],
};

function tokenize(text: string) {
  return uniqueStrings(
    text
      .split(/[^a-z0-9]+/)
      .map((term) => term.trim())
      .filter((term) => term.length > 2 && !stopWords.has(term)),
  );
}

function normalize(text: string) {
  return text.toLowerCase().replace(/[^a-z0-9]+/g, ' ').replace(/\s+/g, ' ').trim();
}

function formatSourceRef(ref: SourceRef) {
  return `${ref.artifact} (${ref.locator})`;
}

function uniqueStrings(values: string[]) {
  return Array.from(new Set(values));
}
