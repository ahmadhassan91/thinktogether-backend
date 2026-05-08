export type Learner = {
  id: string
  name: string
  email?: string
  phone?: string
  employeeId?: string
  region?: string
  role?: string
  site?: string
  cohortDate?: string
}

export type LearnerModuleAction =
  | {
      type: 'quiz'
      prompt: string
      choices: string[]
      correctAnswer: string
      explanation: string
    }
  | {
      type: 'practice'
      prompt: string
      expectedResponse?: string
    }

export type LearnerModule = {
  id: string
  title: string
  sequence: number
  estimatedMinutes: number
  required: boolean
  content: string[]
  action?: LearnerModuleAction
}

export type LearnerModuleStatus = 'locked' | 'current' | 'complete' | 'needs-review'

export type LearnerAttempt = {
  answer: string
  correct: boolean
  feedback?: string
  answeredAt?: string
}

export type LearnerProgress = {
  moduleId: string
  status: LearnerModuleStatus
  attempts: LearnerAttempt[]
  startedAt?: string
  completedAt?: string
}

export type CompletionRecord = {
  learnerId: string
  learnerName: string
  pathId: string
  pathTitle: string
  contentVersion: string
  completedAt: string
  score: number
  passFail: 'pass' | 'needs-review'
  confirmationCode: string
  moduleStatuses: Array<{
    moduleId: string
    title: string
    status: LearnerModuleStatus
    completedAt?: string
  }>
}

export function sortModules(modules: LearnerModule[]) {
  return [...modules].sort((first, second) => first.sequence - second.sequence)
}

export function getNextModuleId(modules: LearnerModule[], progress: LearnerProgress[]) {
  const progressByModule = new Map(progress.map((item) => [item.moduleId, item]))
  const nextModule = sortModules(modules).find((module) => {
    if (!module.required) {
      return false
    }

    return progressByModule.get(module.id)?.status !== 'complete'
  })

  return nextModule?.id ?? null
}

export function completeModule(
  progress: LearnerProgress[],
  moduleId: string,
  completedAt = new Date().toISOString(),
) {
  return progress.map((item) =>
    item.moduleId === moduleId
      ? {
          ...item,
          status: 'complete' as const,
          completedAt,
        }
      : { ...item, attempts: [...item.attempts] },
  )
}

export function answerKnowledgeCheck({
  progress,
  module,
  answer,
  answeredAt = new Date().toISOString(),
}: {
  progress: LearnerProgress[]
  module: LearnerModule
  answer: string
  answeredAt?: string
}) {
  const correct = module.action?.type === 'quiz' && answer === module.action.correctAnswer
  const feedback =
    module.action?.type === 'quiz'
      ? module.action.explanation
      : correct
        ? 'Practice submitted.'
        : 'Review the prompt and try again.'

  return progress.map((item) =>
    item.moduleId === module.id
      ? {
          ...item,
          status: correct ? ('complete' as const) : ('needs-review' as const),
          completedAt: correct ? answeredAt : item.completedAt,
          attempts: [
            ...item.attempts,
            {
              answer,
              correct,
              feedback,
              answeredAt,
            },
          ],
        }
      : { ...item, attempts: [...item.attempts] },
  )
}

export function canCompletePath(modules: LearnerModule[], progress: LearnerProgress[]) {
  const progressByModule = new Map(progress.map((item) => [item.moduleId, item]))

  return modules
    .filter((module) => module.required)
    .every((module) => progressByModule.get(module.id)?.status === 'complete')
}

export function createCompletionRecord({
  learner,
  pathId,
  pathTitle,
  contentVersion,
  modules,
  progress,
  completedAt = new Date().toISOString(),
  passingScore = 80,
}: {
  learner: Learner
  pathId: string
  pathTitle: string
  contentVersion: string
  modules: LearnerModule[]
  progress: LearnerProgress[]
  completedAt?: string
  passingScore?: number
}): CompletionRecord {
  const requiredModules = modules.filter((module) => module.required)
  const progressByModule = new Map(progress.map((item) => [item.moduleId, item]))
  const completedRequired = requiredModules.filter(
    (module) => progressByModule.get(module.id)?.status === 'complete',
  )
  const score =
    requiredModules.length === 0
      ? 100
      : Math.round((completedRequired.length / requiredModules.length) * 100)

  return {
    learnerId: learner.id,
    learnerName: learner.name,
    pathId,
    pathTitle,
    contentVersion,
    completedAt,
    score,
    passFail: score >= passingScore ? 'pass' : 'needs-review',
    confirmationCode: `PBIS-${learner.id}-${Date.parse(completedAt)}`,
    moduleStatuses: sortModules(requiredModules).map((module) => {
      const moduleProgress = progressByModule.get(module.id)

      return {
        moduleId: module.id,
        title: module.title,
        status: moduleProgress?.status ?? 'locked',
        completedAt: moduleProgress?.completedAt,
      }
    }),
  }
}

export function createInitialProgress(modules: LearnerModule[]): LearnerProgress[] {
  const orderedModules = sortModules(modules)
  const firstRequiredId = orderedModules.find((module) => module.required)?.id

  return orderedModules.map((module) => ({
    moduleId: module.id,
    status: module.id === firstRequiredId ? 'current' : 'locked',
    attempts: [],
  }))
}
