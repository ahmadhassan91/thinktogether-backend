import { describe, expect, it } from 'vitest'
import {
  CONTENT_VERSION,
  SITE_LEAD_ONBOARDING_CONTENT_VERSION,
  getKnowledgeCheckItems,
  getLearnerProgressSummary,
  getLearningPath,
  getModuleById,
  getScenarioById,
  getTrainingSourceArtifact,
  sharedSourceArtifactNames,
  trainingLearningPaths,
  trainingSourceLibrary,
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

  it('maps the shared client artifacts into the MVP source library', () => {
    const allRefs = [
      ...trainingLearningPaths.flatMap((path) => path.sourceRefs),
      ...trainingLearningPaths.flatMap((path) => path.modules.flatMap((module) => module.content.sourceRefs)),
      ...trainingLearningPaths.flatMap((path) => path.modules.flatMap((module) => module.scenarioIds.flatMap((id) => getScenarioById(id)?.sourceRefs ?? []))),
      ...getKnowledgeCheckItems().flatMap((item) => item.sourceRefs),
    ]

    expect(trainingSourceLibrary).toHaveLength(6)
    expect(trainingSourceLibrary.every((source) => source.filePath.startsWith('/Users/clustox1/Documents/Think/'))).toBe(true)
    expect(trainingSourceLibrary.every((source) => source.contentVersion && source.extractedAt)).toBe(true)
    expect(sharedSourceArtifactNames).toEqual([
      'SOP_Program Induction.pdf',
      'SOP_Site Lead Onboarding.pdf',
      'KNOWLEDGE CHECK_Back to School 2025.pdf',
      'PBIS PPT Master.pptx',
      'FINAL - PBIS EC2 - updated 11.4.25.pptx',
      'PBIS part 3 PPT Template.pptx',
    ])
    expect(allRefs.map((ref) => ref.artifact)).toEqual(expect.arrayContaining(sharedSourceArtifactNames))
    expect(getTrainingSourceArtifact('sop-site-lead-onboarding')).toEqual(expect.objectContaining({
      artifact: 'SOP_Site Lead Onboarding.pdf',
      title: 'Site Lead Onboarding Program',
      documentType: 'sop',
      effectiveDate: 'February 2026',
    }))
  })

  it('adds a minimal Site Lead Onboarding v0 path sourced to the Site Lead SOP', () => {
    const path = getLearningPath('site-lead-onboarding-v0')

    expect(path.id).toBe('site-lead-onboarding-v0')
    expect(path.title).toBe('Site Lead Onboarding v0')
    expect(path.contentVersion).toBe(SITE_LEAD_ONBOARDING_CONTENT_VERSION)
    expect(path.moduleIds).toEqual([
      'slo-purpose-and-role',
      'slo-stakeholder-responsibilities',
      'slo-cycle-and-makeup',
      'slo-attendance-reporting-clearance',
    ])
    expect(path.modules.map((module) => module.id)).toEqual(path.moduleIds)
    expect(path.modules.every((module) => module.content.contentVersion === SITE_LEAD_ONBOARDING_CONTENT_VERSION)).toBe(true)
    expect(path.modules.every((module) => module.content.sourceRefs.every((ref) => ref.artifact === 'SOP_Site Lead Onboarding.pdf'))).toBe(true)
    expect(path.modules.map((module) => module.content.summary).join(' ')).toContain('four-week cycle')
    expect(path.modules.map((module) => module.content.summary).join(' ')).toContain('clearance email')
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
