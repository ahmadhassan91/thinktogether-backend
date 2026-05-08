import { useMemo, useState } from 'react'
import {
  answerKnowledgeCheck,
  canCompletePath,
  completeModule,
  createCompletionRecord,
  createInitialProgress,
  getNextModuleId,
  sortModules,
  type CompletionRecord,
  type Learner,
  type LearnerModule,
  type LearnerProgress,
} from './learnerProgress'

const demoLearner: Learner = {
  id: 'demo-learner',
  name: 'Demo Learner',
  email: 'demo@example.org',
  region: 'Central Valley',
  role: 'Program Leader',
  site: 'Think Together Demo Site',
  cohortDate: '2026-05-08',
}

const demoModules: LearnerModule[] = [
  {
    id: 'pbis-overview',
    title: 'PBIS Overview',
    sequence: 1,
    estimatedMinutes: 4,
    required: true,
    content: ['PBIS teaches clear expectations and reinforces positive behavior before correction.'],
    action: {
      type: 'quiz',
      prompt: 'What is the main purpose of PBIS?',
      choices: ['Consistent support', 'Surprise consequences'],
      correctAnswer: 'Consistent support',
      explanation: 'PBIS works when expectations are taught, practiced, and acknowledged.',
    },
  },
  {
    id: 'pre-corrective-phrases',
    title: 'Pre-Corrective Phrases',
    sequence: 2,
    estimatedMinutes: 5,
    required: true,
    content: ['A strong pre-correction names the expected behavior before students begin a routine.'],
    action: {
      type: 'practice',
      prompt: 'Write a clear direction for moving to the next activity.',
      expectedResponse: 'Use walking feet and keep hands to yourself.',
    },
  },
]

type LearnerFlowProps = {
  learner?: Learner
  modules?: LearnerModule[]
  pathId?: string
  pathTitle?: string
  contentVersion?: string
  initialCompletedModuleIds?: string[]
  onCompleteModule?: (moduleId: string) => Promise<void>
  onAnswerKnowledgeCheck?: (moduleId: string, answer: string) => Promise<void>
}

export function LearnerFlow({
  learner = demoLearner,
  modules = demoModules,
  pathId = 'program-induction-pbis',
  pathTitle = 'Program Induction - PBIS',
  contentVersion = 'pbis-mvp-v1',
  initialCompletedModuleIds = [],
  onCompleteModule,
  onAnswerKnowledgeCheck,
}: LearnerFlowProps) {
  const orderedModules = useMemo(() => sortModules(modules), [modules])
  const [verified, setVerified] = useState(false)
  const [progress, setProgress] = useState<LearnerProgress[]>(() =>
    hydrateInitialProgress(orderedModules, initialCompletedModuleIds),
  )
  const [selectedAnswer, setSelectedAnswer] = useState('')
  const [practiceResponse, setPracticeResponse] = useState('')
  const [receipt, setReceipt] = useState<CompletionRecord | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')

  const requiredCount = orderedModules.filter((module) => module.required).length
  const requiredModuleIds = new Set(orderedModules.filter((module) => module.required).map((module) => module.id))
  const completeCount = progress.filter(
    (item) => requiredModuleIds.has(item.moduleId) && item.status === 'complete',
  ).length
  const nextModuleId = getNextModuleId(orderedModules, progress)
  const currentModule =
    orderedModules.find((module) => module.id === nextModuleId) ??
    orderedModules.find((module) => module.required)

  const advanceAfterCompletion = (nextProgress: LearnerProgress[]) => {
    const nextId = getNextModuleId(orderedModules, nextProgress)
    const unlockedProgress = nextProgress.map((item) =>
      item.moduleId === nextId && item.status === 'locked' ? { ...item, status: 'current' as const } : item,
    )

    if (canCompletePath(orderedModules, unlockedProgress)) {
      setReceipt(
        createCompletionRecord({
          learner,
          pathId,
          pathTitle,
          contentVersion,
          modules: orderedModules,
          progress: unlockedProgress,
        }),
      )
    }

    setProgress(unlockedProgress)
    setSelectedAnswer('')
    setPracticeResponse('')
  }

  const submitQuiz = async () => {
    if (!currentModule || !selectedAnswer) {
      return
    }

    const persistsRemotely = Boolean(onAnswerKnowledgeCheck || onCompleteModule)
    setSubmitting(persistsRemotely)
    setError('')
    try {
      await onAnswerKnowledgeCheck?.(currentModule.id, selectedAnswer)
      const nextProgress = answerKnowledgeCheck({
        progress,
        module: currentModule,
        answer: selectedAnswer,
      })
      const moduleProgress = nextProgress.find((item) => item.moduleId === currentModule.id)
      if (moduleProgress?.status === 'complete') {
        await onCompleteModule?.(currentModule.id)
      }
      advanceAfterCompletion(nextProgress)
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Unable to save progress.')
    } finally {
      setSubmitting(false)
    }
  }

  const submitPractice = async () => {
    if (!currentModule || !practiceResponse.trim()) {
      return
    }

    const persistsRemotely = Boolean(onCompleteModule)
    setSubmitting(persistsRemotely)
    setError('')
    try {
      const withAttempt = progress.map((item) =>
        item.moduleId === currentModule.id
          ? {
              ...item,
              attempts: [
                ...item.attempts,
                {
                  answer: practiceResponse.trim(),
                  correct: true,
                  feedback: 'Practice submitted.',
                  answeredAt: new Date().toISOString(),
                },
              ],
            }
          : item,
      )

      await onCompleteModule?.(currentModule.id)
      advanceAfterCompletion(completeModule(withAttempt, currentModule.id))
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Unable to save progress.')
    } finally {
      setSubmitting(false)
    }
  }

  if (receipt) {
    return (
      <main aria-labelledby="receipt-title">
        <h1 id="receipt-title">Completion Receipt</h1>
        <p>{pathTitle}</p>
        <p>Score: {receipt.score}%</p>
        <p>Status: {receipt.passFail === 'pass' ? 'Complete' : 'Needs review'}</p>
        <p>Confirmation: {receipt.confirmationCode}</p>
      </main>
    )
  }

  if (!verified) {
    return (
      <main aria-labelledby="welcome-title">
        <h1 id="welcome-title">Welcome, {learner.name}</h1>
        <p>{pathTitle}</p>
        <dl>
          <div>
            <dt>Role</dt>
            <dd>{learner.role ?? 'Learner'}</dd>
          </div>
          <div>
            <dt>Region</dt>
            <dd>{learner.region ?? 'Assigned region'}</dd>
          </div>
          <div>
            <dt>Site</dt>
            <dd>{learner.site ?? 'Assigned site'}</dd>
          </div>
        </dl>
        <button type="button" onClick={() => setVerified(true)}>
          Verify and start
        </button>
      </main>
    )
  }

  return (
    <main aria-labelledby="path-title">
      <header>
        <h1 id="path-title">{pathTitle}</h1>
        <p>
          Progress: {completeCount} of {requiredCount} required modules complete
        </p>
      </header>

      <section aria-label="Learning path">
        <ol>
          {orderedModules.map((module) => {
            const moduleProgress = progress.find((item) => item.moduleId === module.id)
            const state = moduleProgress?.status ?? 'locked'

            return (
              <li key={module.id}>
                <span>{module.title}</span>
                <span>{stateLabel(state)}</span>
              </li>
            )
          })}
        </ol>
      </section>

      {currentModule ? (
        <section aria-labelledby="module-title">
          <h2 id="module-title">{currentModule.title}</h2>
          <p>{currentModule.estimatedMinutes} min</p>
          {currentModule.content.map((item) => (
            <p key={item}>{item}</p>
          ))}

          {currentModule.action?.type === 'quiz' ? (
            <fieldset>
              <legend>{currentModule.action.prompt}</legend>
              {currentModule.action.choices.map((choice) => (
                <label key={choice}>
                  <input
                    checked={selectedAnswer === choice}
                    name="knowledge-check"
                    onChange={() => setSelectedAnswer(choice)}
                    type="radio"
                  />
                  {choice}
                </label>
              ))}
              <button disabled={!selectedAnswer || submitting} onClick={submitQuiz} type="button">
                {submitting ? 'Saving' : 'Submit answer'}
              </button>
            </fieldset>
          ) : (
            <div>
              <label>
                Practice response
                <textarea
                  aria-label="Practice response"
                  onChange={(event) => setPracticeResponse(event.target.value)}
                  value={practiceResponse}
                />
              </label>
              <p>{currentModule.action?.prompt}</p>
              <button disabled={!practiceResponse.trim() || submitting} onClick={submitPractice} type="button">
                {submitting ? 'Saving' : 'Submit practice'}
              </button>
            </div>
          )}
          {error ? <p role="alert">{error}</p> : null}
        </section>
      ) : null}
    </main>
  )
}

function hydrateInitialProgress(modules: LearnerModule[], completedModuleIds: string[]): LearnerProgress[] {
  const completed = new Set(completedModuleIds)
  const base = createInitialProgress(modules).map((item) =>
    completed.has(item.moduleId) ? { ...item, status: 'complete' as const } : item,
  )
  const nextId = getNextModuleId(modules, base)
  return base.map((item) =>
    item.moduleId === nextId && item.status === 'locked' ? { ...item, status: 'current' as const } : item,
  )
}

function stateLabel(status: LearnerProgress['status']) {
  const labels: Record<LearnerProgress['status'], string> = {
    current: 'Current',
    complete: 'Complete',
    locked: 'Locked',
    'needs-review': 'Needs review',
  }

  return labels[status]
}

export default LearnerFlow
