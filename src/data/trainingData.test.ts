import { describe, expect, it } from 'vitest'
import {
  CONTENT_VERSION,
  getKnowledgeCheckItems,
  getLearnerProgressSummary,
  getLearningPath,
  getModuleById,
  getScenarioById,
} from './trainingData'
import type { CompletionRecord, PracticeSubmission } from '../types'

describe('PBIS MVP training data', () => {
  it('seeds the Program Induction PBIS path with the required module order', () => {
    const path = getLearningPath()

    expect(path.id).toBe('program-induction-pbis')
    expect(path.title).toBe('Program Induction - PBIS')
    expect(path.moduleIds).toEqual([
      'pbis-overview',
      'tier-1-support',
      'restorative-correction',
      'behavior-matrix',
      'active-explicit-teaching',
      'minor-vs-major',
      'pre-corrective-phrases',
      'positive-acknowledgment',
      'final-check',
      'commitment',
    ])
    expect(path.modules.map((module) => module.id)).toEqual(path.moduleIds)
    expect(path.modules.every((module) => module.content.contentVersion === CONTENT_VERSION)).toBe(true)
    expect(getModuleById('behavior-matrix')?.title).toBe('Behavior Matrix')
  })

  it('includes PBIS deck scenario seeds with source references', () => {
    const scenarioIds = [
      'light-horseplay-line',
      'physical-fight-transition',
      'jacob-pencil-pouch-bullying',
      'vague-line-up-phrase-rewrite',
      'running-hiding-under-table',
    ]

    const scenarios = scenarioIds.map((id) => getScenarioById(id))

    expect(scenarios).toHaveLength(5)
    expect(scenarios.every(Boolean)).toBe(true)
    expect(scenarios.every((scenario) => scenario?.sourceRefs.length)).toBe(true)
    expect(getScenarioById('jacob-pencil-pouch-bullying')?.prompt).toContain('Jacob')
    expect(getScenarioById('vague-line-up-phrase-rewrite')?.skillFocus).toContain('explicit direction')
  })

  it('provides versioned knowledge check items with source references', () => {
    const allItems = getKnowledgeCheckItems()
    const tierOneItems = getKnowledgeCheckItems('tier-1-support')

    expect(allItems.length).toBeGreaterThanOrEqual(10)
    expect(allItems.every((item) => item.contentVersion === CONTENT_VERSION)).toBe(true)
    expect(allItems.every((item) => item.sourceRefs.length > 0)).toBe(true)
    expect(tierOneItems).toEqual(expect.arrayContaining([
      expect.objectContaining({
        moduleId: 'tier-1-support',
        correctAnswer: 'Use predictable routines, active supervision, and positive acknowledgment before behavior escalates.',
      }),
    ]))
  })

  it('summarizes learner progress from completion and practice records', () => {
    const completions: CompletionRecord[] = [
      {
        id: 'completion-1',
        learnerId: 'learner-1',
        pathId: 'program-induction-pbis',
        moduleId: 'pbis-overview',
        status: 'completed',
        score: 1,
        completedAt: '2026-05-08T10:00:00.000Z',
        contentVersion: CONTENT_VERSION,
      },
      {
        id: 'completion-2',
        learnerId: 'learner-1',
        pathId: 'program-induction-pbis',
        moduleId: 'tier-1-support',
        status: 'completed',
        score: 0.9,
        completedAt: '2026-05-08T10:10:00.000Z',
        contentVersion: CONTENT_VERSION,
      },
      {
        id: 'completion-3',
        learnerId: 'learner-1',
        pathId: 'program-induction-pbis',
        moduleId: 'restorative-correction',
        status: 'in_progress',
        contentVersion: CONTENT_VERSION,
      },
      {
        id: 'completion-4',
        learnerId: 'learner-2',
        pathId: 'program-induction-pbis',
        moduleId: 'pbis-overview',
        status: 'completed',
        score: 1,
        completedAt: '2026-05-08T11:00:00.000Z',
        contentVersion: CONTENT_VERSION,
      },
    ]
    const submissions: PracticeSubmission[] = [
      {
        id: 'submission-1',
        learnerId: 'learner-1',
        scenarioId: 'light-horseplay-line',
        response: 'I would restate the line expectation and reinforce students who are ready.',
        status: 'accepted',
        submittedAt: '2026-05-08T10:05:00.000Z',
        contentVersion: CONTENT_VERSION,
      },
      {
        id: 'submission-2',
        learnerId: 'learner-1',
        scenarioId: 'jacob-pencil-pouch-bullying',
        response: 'I need help distinguishing conflict from bullying.',
        status: 'needs_review',
        submittedAt: '2026-05-08T10:15:00.000Z',
        contentVersion: CONTENT_VERSION,
      },
    ]

    expect(getLearnerProgressSummary('learner-1', completions, submissions)).toEqual({
      learnerId: 'learner-1',
      pathId: 'program-induction-pbis',
      totalModules: 10,
      completedModules: 2,
      inProgressModules: 1,
      completionPercent: 20,
      lastCompletedModuleId: 'tier-1-support',
      finalCheckStatus: 'not_started',
      practiceSubmitted: 2,
      needsReviewCount: 1,
      contentVersion: CONTENT_VERSION,
    })
  })
})
