import { describe, expect, it } from 'vitest';
import {
  computeSourceQaFlags,
  searchSourceIntelligence,
  summarizeSourceUsage,
  type SourceIntelligenceDataset,
} from './sourceIntelligence';
import type { KnowledgeCheckItem, LearningPath, Scenario, SourceArtifact } from '../src/types';

const artifacts: SourceArtifact[] = [
  {
    id: 'artifact-pbis',
    artifact: 'PBIS Deck.pptx',
    title: 'PBIS Training Deck',
    filePath: '/tmp/PBIS Deck.pptx',
    documentType: 'presentation',
    department: 'Program Pros',
    contentVersion: 'test-content',
    extractedAt: '2026-05-13T00:00:00.000Z',
  },
  {
    id: 'artifact-sop',
    artifact: 'Program SOP.pdf',
    title: 'Program Induction SOP',
    filePath: '/tmp/Program SOP.pdf',
    documentType: 'sop',
    department: 'Program Pros',
    contentVersion: 'test-content',
    extractedAt: '2026-05-13T00:00:00.000Z',
  },
  {
    id: 'artifact-unused',
    artifact: 'Unused.pdf',
    title: 'Unused Artifact',
    filePath: '/tmp/Unused.pdf',
    documentType: 'sop',
    department: 'Program Pros',
    contentVersion: 'test-content',
    extractedAt: '2026-05-13T00:00:00.000Z',
  },
];

const learningPaths: LearningPath[] = [
  {
    id: 'path-pbis',
    title: 'PBIS Path',
    description: 'A path for proactive behavior support.',
    audience: 'Program staff',
    contentVersion: 'test-content',
    moduleIds: ['module-tier-1', 'module-empty'],
    modules: [
      {
        id: 'module-tier-1',
        title: 'Tier 1 Support',
        order: 1,
        estimatedMinutes: 7,
        content: {
          moduleId: 'module-tier-1',
          contentVersion: 'test-content',
          summary: 'Use active supervision and positive acknowledgment before escalation.',
          learningObjectives: ['Use proactive Tier 1 practices'],
          keyPoints: ['Reinforce expected behavior'],
          sourceRefs: [
            {
              artifact: 'PBIS Deck.pptx',
              locator: 'Slide 10: Tier 1 support',
            },
          ],
        },
        scenarioIds: ['scenario-line'],
        knowledgeCheckItemIds: ['kc-tier-1'],
        requiredForCompletion: true,
      },
      {
        id: 'module-empty',
        title: 'No Sources Yet',
        order: 2,
        estimatedMinutes: 3,
        content: {
          moduleId: 'module-empty',
          contentVersion: 'test-content',
          summary: 'Draft content.',
          learningObjectives: [],
          keyPoints: [],
          sourceRefs: [],
        },
        scenarioIds: [],
        knowledgeCheckItemIds: [],
        requiredForCompletion: false,
      },
    ],
    sourceRefs: [
      {
        artifact: 'Program SOP.pdf',
        locator: 'Pages 1-2: induction purpose',
      },
    ],
  },
  {
    id: 'path-empty',
    title: 'Empty Path',
    description: 'No modules yet.',
    audience: 'Program staff',
    contentVersion: 'test-content',
    moduleIds: [],
    modules: [],
    sourceRefs: [],
  },
];

const scenarios: Scenario[] = [
  {
    id: 'scenario-line',
    moduleId: 'module-tier-1',
    title: 'Line Transition',
    prompt: 'Students begin light horseplay during a line transition.',
    skillFocus: 'active supervision',
    expectedResponseElements: ['Move closer', 'Restate expectations'],
    sourceRefs: [
      {
        artifact: 'PBIS Deck.pptx',
        locator: 'Slide 47: line transition scenario',
      },
    ],
    contentVersion: 'test-content',
  },
];

const knowledgeCheckItems: KnowledgeCheckItem[] = [
  {
    id: 'kc-tier-1',
    moduleId: 'module-tier-1',
    prompt: 'Which response reflects Tier 1 support?',
    choices: ['Active supervision', 'Wait for escalation'],
    correctAnswer: 'Active supervision',
    rationale: 'Tier 1 is proactive.',
    sourceRefs: [
      {
        artifact: 'Missing.pdf',
        locator: 'Page 2: missing library source',
      },
    ],
    contentVersion: 'test-content',
  },
];

const dataset: SourceIntelligenceDataset = {
  artifacts,
  learningPaths,
  scenarios,
  knowledgeCheckItems,
};

describe('source intelligence helper', () => {
  it('summarizes source usage by artifact, path, module, and source ref', () => {
    const summary = summarizeSourceUsage(dataset);

    expect(summary.totals).toMatchObject({
      artifacts: 3,
      referencedArtifacts: 2,
      paths: 2,
      modules: 2,
    });
    expect(summary.artifacts.find((artifact) => artifact.artifact.artifact === 'PBIS Deck.pptx')).toMatchObject({
      totalReferences: 2,
      moduleReferenceCount: 1,
      scenarioReferenceCount: 1,
      referencedByModuleIds: ['module-tier-1'],
    });
    expect(summary.paths.find((path) => path.pathId === 'path-pbis')).toMatchObject({
      sourceRefCount: 1,
      moduleCount: 2,
      artifacts: ['Program SOP.pdf'],
    });
    expect(summary.modules.find((moduleItem) => moduleItem.moduleId === 'module-tier-1')).toMatchObject({
      sourceRefCount: 1,
      scenarioSourceRefCount: 1,
      knowledgeCheckSourceRefCount: 1,
    });
    expect(summary.sourceRefs.some((sourceRef) => sourceRef.locator === 'Slide 10: Tier 1 support')).toBe(true);
  });

  it('returns source-backed search results with artifact and learning context', () => {
    const results = searchSourceIntelligence('active supervision tier 1', dataset);

    expect(results[0]).toMatchObject({
      type: 'module',
      id: 'module-tier-1',
      title: 'Tier 1 Support',
      artifact: {
        artifact: 'PBIS Deck.pptx',
      },
      locator: 'Slide 10: Tier 1 support',
      path: {
        id: 'path-pbis',
      },
      module: {
        id: 'module-tier-1',
      },
    });
    expect(results[0].relevanceScore).toBeGreaterThan(0);
  });

  it('computes content QA flags without database dependencies', () => {
    const flags = computeSourceQaFlags(dataset);

    expect(flags.artifactsNotReferencedByModules.map((artifact) => artifact.artifact)).toEqual(['Program SOP.pdf', 'Unused.pdf']);
    expect(flags.modulesWithNoSourceRefs).toEqual([
      {
        moduleId: 'module-empty',
        moduleTitle: 'No Sources Yet',
        pathId: 'path-pbis',
        pathTitle: 'PBIS Path',
      },
    ]);
    expect(flags.pathsWithNoModules).toEqual([
      {
        pathId: 'path-empty',
        pathTitle: 'Empty Path',
      },
    ]);
    expect(flags.sourceRefsWithoutLibraryArtifact).toEqual([
      {
        sourceRef: {
          artifact: 'Missing.pdf',
          locator: 'Page 2: missing library source',
        },
        contexts: [
          {
            type: 'knowledge-check',
            id: 'kc-tier-1',
            title: 'Which response reflects Tier 1 support?',
            pathId: 'path-pbis',
            pathTitle: 'PBIS Path',
            moduleId: 'module-tier-1',
            moduleTitle: 'Tier 1 Support',
          },
        ],
      },
    ]);
  });
});
