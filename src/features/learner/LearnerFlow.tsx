import { useMemo, useState, type ReactNode } from 'react'
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
  surveyPanel?: ReactNode
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
  surveyPanel,
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
  const progressPercent = requiredCount === 0 ? 100 : Math.round((completeCount / requiredCount) * 100)
  const nextModuleId = getNextModuleId(orderedModules, progress)
  const currentModule =
    orderedModules.find((module) => module.id === nextModuleId) ??
    orderedModules.find((module) => module.required)
  const currentModuleIndex = currentModule
    ? orderedModules.findIndex((module) => module.id === currentModule.id)
    : -1
  const currentModuleSequence = currentModule?.sequence ?? Number.POSITIVE_INFINITY
  const nextRequiredPosition =
    currentModuleIndex >= 0
      ? orderedModules.filter((module) => module.required && module.sequence <= currentModuleSequence).length
      : requiredCount

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
      <main aria-labelledby="receipt-title" className="learner-receipt">
        <header className="learner-receipt__header">
          <p className="learner-receipt__eyebrow">Training saved</p>
          <h1 id="receipt-title">Completion Receipt</h1>
          <p>{pathTitle}</p>
        </header>

        <section aria-label="Completion confirmation" className="learner-receipt__confirmation">
          <p>Your PBIS training completion has been recorded for {learner.name}.</p>
          <dl className="learner-receipt__details">
            <div>
              <dt>Score</dt>
              <dd>Score: {receipt.score}%</dd>
            </div>
            <div>
              <dt>Status</dt>
              <dd>Status: {receipt.passFail === 'pass' ? 'Complete' : 'Needs review'}</dd>
            </div>
            <div>
              <dt>Confirmation</dt>
              <dd>Confirmation: {receipt.confirmationCode}</dd>
            </div>
            <div>
              <dt>Content version</dt>
              <dd>Version: {receipt.contentVersion}</dd>
            </div>
          </dl>
        </section>

        <section aria-label="Next step" className="learner-receipt__next-step">
          <h2>Next step</h2>
          <p>
            A Program Pro will review completion evidence and any survey response before closing the induction step.
          </p>
          {surveyPanel ? <div className="learner-receipt__survey">{surveyPanel}</div> : null}
        </section>
      </main>
    )
  }

  if (!verified) {
    return (
      <main aria-labelledby="welcome-title" className="learner-home">
        <section className="learner-home__primary">
          <p className="learner-flow__eyebrow">Mobile training</p>
          <h1 id="welcome-title">Welcome, {learner.name}</h1>
          <p>{pathTitle}</p>
          <div className="learner-home__actions">
            <button type="button" onClick={() => setVerified(true)}>
              Verify and start
            </button>
            <span>{requiredCount} required modules</span>
          </div>
        </section>
        <section aria-label="Learner profile" className="learner-home__profile">
          <strong>Learner profile</strong>
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
        </section>
      </main>
    )
  }

  return (
    <main aria-labelledby="path-title" className="learner-workspace">
      <header className="learner-workspace__header">
        <div>
          <p className="learner-flow__eyebrow">Assigned path</p>
          <h1 id="path-title">{pathTitle}</h1>
        </div>
        <p>Progress: {completeCount} of {requiredCount} required modules complete</p>
      </header>

      <section aria-label="Learning path progress" className="learner-progress">
        <div className="learner-progress__summary" role="list">
          <div role="listitem">
            <span>{completeCount}/{requiredCount}</span>
            <strong>Required complete</strong>
          </div>
          <div role="listitem">
            <span>{progressPercent}%</span>
            <strong>Progress</strong>
          </div>
          <div role="listitem">
            <span>
              {requiredCount === 0 ? 'Done' : `${Math.min(nextRequiredPosition, requiredCount)}/${requiredCount}`}
            </span>
            <strong>Next module</strong>
          </div>
        </div>
        <div
          aria-label={`${progressPercent}% complete`}
          aria-valuemax={100}
          aria-valuemin={0}
          aria-valuenow={progressPercent}
          className="learner-progress__bar"
          role="progressbar"
        >
          <span style={{ inlineSize: `${progressPercent}%` }} />
        </div>
      </section>

      <section aria-label="Module status list" className="module-rail">
        <ol className="module-rail__list">
          {orderedModules.map((module) => {
            const moduleProgress = progress.find((item) => item.moduleId === module.id)
            const state = moduleProgress?.status ?? 'locked'

            return (
              <li className="module-rail__item" data-state={state} key={module.id}>
                <span className="module-rail__title">{module.title}</span>
                <span className="module-rail__status">{stateLabel(state)}</span>
              </li>
            )
          })}
        </ol>
      </section>

      {currentModule ? (
        <section aria-labelledby="module-title" className="module-card" data-state="current">
          <header className="module-card__header">
            <div>
              <p className="learner-flow__eyebrow">Active module</p>
              <h2 id="module-title">{currentModule.title}</h2>
            </div>
            <p className="module-card__meta">
              Module {Math.max(currentModuleIndex + 1, 1)} of {orderedModules.length} | {currentModule.estimatedMinutes}{' '}
              min
            </p>
          </header>
          <div className="module-card__content">
            {currentModule.content.map((item) => (
              <p key={item}>{item}</p>
            ))}
          </div>

          {currentModule.action?.type === 'quiz' ? (
            <fieldset className="knowledge-check">
              <legend>{currentModule.action.prompt}</legend>
              {currentModule.action.choices.map((choice) => (
                <label data-selected={selectedAnswer === choice} key={choice}>
                  <input
                    checked={selectedAnswer === choice}
                    name="knowledge-check"
                    onChange={() => setSelectedAnswer(choice)}
                    type="radio"
                  />
                  {choice}
                </label>
              ))}
              <button
                className="module-card__action"
                disabled={!selectedAnswer || submitting}
                onClick={submitQuiz}
                type="button"
              >
                {submitting ? 'Saving' : 'Submit answer'}
              </button>
            </fieldset>
          ) : (
            <div className="practice-card">
              <p>{currentModule.action?.prompt}</p>
              <label>
                Practice response
                <textarea
                  aria-label="Practice response"
                  onChange={(event) => setPracticeResponse(event.target.value)}
                  value={practiceResponse}
                />
              </label>
              <button
                className="module-card__action"
                disabled={!practiceResponse.trim() || submitting}
                onClick={submitPractice}
                type="button"
              >
                {submitting ? 'Saving' : 'Submit practice'}
              </button>
            </div>
          )}
          {error ? (
            <p className="learner-flow__error" role="alert">
              {error}
            </p>
          ) : null}
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
