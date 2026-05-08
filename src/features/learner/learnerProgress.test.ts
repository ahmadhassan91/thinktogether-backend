import { describe, expect, it } from 'vitest'
import {
  answerKnowledgeCheck,
  canCompletePath,
  completeModule,
  createCompletionRecord,
  getNextModuleId,
  type Learner,
  type LearnerModule,
  type LearnerProgress,
} from './learnerProgress'

const modules: LearnerModule[] = [
  {
    id: 'overview',
    title: 'PBIS Overview',
    sequence: 1,
    estimatedMinutes: 4,
    required: true,
    content: ['PBIS creates predictable, positive supports.'],
    action: {
      type: 'quiz',
      prompt: 'What is the purpose of PBIS?',
      choices: ['Consistent support', 'Longer paperwork'],
      correctAnswer: 'Consistent support',
      explanation: 'PBIS focuses staff on teaching and reinforcing expectations.',
    },
  },
  {
    id: 'practice',
    title: 'Restorative Practice',
    sequence: 2,
    estimatedMinutes: 6,
    required: true,
    content: ['Use restorative corrections that keep students connected.'],
    action: {
      type: 'practice',
      prompt: 'Rewrite this direction in a restorative way.',
      expectedResponse: 'Use a calm, specific redirect.',
    },
  },
  {
    id: 'bonus',
    title: 'Optional Resource',
    sequence: 3,
    estimatedMinutes: 2,
    required: false,
    content: ['Extra reading for teams.'],
  },
]

const learner: Learner = {
  id: 'learner-1',
  name: 'Avery Chen',
  email: 'avery@example.org',
  region: 'Central Valley',
  role: 'Program Leader',
  site: 'Demo Elementary',
  cohortDate: '2026-05-08',
}

describe('learner flow helpers', () => {
  it('returns the first incomplete required module in sequence order', () => {
    const progress: LearnerProgress[] = [
      { moduleId: 'practice', status: 'locked', attempts: [] },
      { moduleId: 'overview', status: 'complete', attempts: [] },
    ]

    expect(getNextModuleId(modules, progress)).toBe('practice')
  })

  it('marks a module complete without mutating existing progress', () => {
    const progress: LearnerProgress[] = [
      { moduleId: 'overview', status: 'current', attempts: [] },
      { moduleId: 'practice', status: 'locked', attempts: [] },
    ]

    const next = completeModule(progress, 'overview', '2026-05-08T10:00:00.000Z')

    expect(next).toEqual([
      {
        moduleId: 'overview',
        status: 'complete',
        attempts: [],
        completedAt: '2026-05-08T10:00:00.000Z',
      },
      { moduleId: 'practice', status: 'locked', attempts: [] },
    ])
    expect(progress[0]).toEqual({ moduleId: 'overview', status: 'current', attempts: [] })
  })

  it('scores knowledge checks and stores pass or needs-review attempts', () => {
    const progress: LearnerProgress[] = [{ moduleId: 'overview', status: 'current', attempts: [] }]

    const answered = answerKnowledgeCheck({
      progress,
      module: modules[0],
      answer: 'Longer paperwork',
      answeredAt: '2026-05-08T10:05:00.000Z',
    })

    expect(answered[0]).toMatchObject({
      moduleId: 'overview',
      status: 'needs-review',
      attempts: [
        {
          answer: 'Longer paperwork',
          correct: false,
          feedback: 'PBIS focuses staff on teaching and reinforcing expectations.',
        },
      ],
    })
  })

  it('allows path completion when all required modules are complete', () => {
    const progress: LearnerProgress[] = [
      { moduleId: 'overview', status: 'complete', attempts: [] },
      { moduleId: 'practice', status: 'complete', attempts: [] },
    ]

    expect(canCompletePath(modules, progress)).toBe(true)
  })

  it('creates a completion record with learner identity, score, and content version', () => {
    const record = createCompletionRecord({
      learner,
      pathId: 'pbis-path',
      pathTitle: 'Program Induction - PBIS',
      contentVersion: 'pbis-v1',
      modules,
      progress: [
        { moduleId: 'overview', status: 'complete', attempts: [{ correct: true, answer: 'Consistent support' }] },
        { moduleId: 'practice', status: 'complete', attempts: [{ correct: true, answer: 'Use a calm redirect.' }] },
      ],
      completedAt: '2026-05-08T11:00:00.000Z',
    })

    expect(record).toMatchObject({
      learnerId: 'learner-1',
      learnerName: 'Avery Chen',
      pathId: 'pbis-path',
      pathTitle: 'Program Induction - PBIS',
      contentVersion: 'pbis-v1',
      completedAt: '2026-05-08T11:00:00.000Z',
      score: 100,
      passFail: 'pass',
      moduleStatuses: [
        { moduleId: 'overview', status: 'complete' },
        { moduleId: 'practice', status: 'complete' },
      ],
    })
    expect(record.confirmationCode).toMatch(/^PBIS-learner-1-\d+$/)
  })
})
