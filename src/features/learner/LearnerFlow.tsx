import { useMemo, useState, type ReactNode } from 'react'
import {
  canCompletePath,
  completeModule,
  createCompletionRecord,
  createInitialProgress,
  getFinalKnowledgeCheckItems,
  getNextModuleId,
  scoreFinalKnowledgeCheck,
  sortModules,
  type CompletionRecord,
  type FinalKnowledgeCheckResult,
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
  const [finalAnswers, setFinalAnswers] = useState<Record<string, string>>({})
  const [assessmentResult, setAssessmentResult] = useState<FinalKnowledgeCheckResult | null>(null)
  const [practiceResponse, setPracticeResponse] = useState('')
  const [commitmentConfirmed, setCommitmentConfirmed] = useState(false)
  const [receipt, setReceipt] = useState<CompletionRecord | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')

  const finalKnowledgeItems = useMemo(() => getFinalKnowledgeCheckItems(orderedModules), [orderedModules])
  const requiredCount = orderedModules.filter((module) => module.required).length
  const requiredModuleIds = new Set(orderedModules.filter((module) => module.required).map((module) => module.id))
  const completeCount = progress.filter(
    (item) => requiredModuleIds.has(item.moduleId) && item.status === 'complete',
  ).length
  const progressPercent = requiredCount === 0 ? 100 : Math.round((completeCount / requiredCount) * 100)
  const modulesComplete = canCompletePath(orderedModules, progress)
  const nextModuleId = getNextModuleId(orderedModules, progress)
  const currentModule =
    orderedModules.find((module) => module.id === nextModuleId) ??
    (!modulesComplete ? orderedModules.find((module) => module.required) : undefined)
  const currentModuleIndex = currentModule
    ? orderedModules.findIndex((module) => module.id === currentModule.id)
    : -1
  const currentModuleSequence = currentModule?.sequence ?? Number.POSITIVE_INFINITY
  const nextRequiredPosition =
    currentModuleIndex >= 0
      ? orderedModules.filter((module) => module.required && module.sequence <= currentModuleSequence).length
      : requiredCount
  const activeStage = !modulesComplete
    ? 'Lessons & practice'
    : assessmentResult
      ? 'Survey & commitment'
      : 'Final knowledge check'
  const finalCheckReady =
    finalKnowledgeItems.length === 0 ||
    finalKnowledgeItems.every((item) => Boolean(finalAnswers[item.moduleId]))

  const advanceAfterCompletion = (nextProgress: LearnerProgress[]) => {
    const nextId = getNextModuleId(orderedModules, nextProgress)
    const unlockedProgress = nextProgress.map((item) =>
      item.moduleId === nextId && item.status === 'locked' ? { ...item, status: 'current' as const } : item,
    )

    setProgress(unlockedProgress)
    setPracticeResponse('')
  }

  const completeCurrentLesson = async () => {
    if (!currentModule) {
      return
    }

    const persistsRemotely = Boolean(onCompleteModule)
    setSubmitting(persistsRemotely)
    setError('')
    try {
      await onCompleteModule?.(currentModule.id)
      advanceAfterCompletion(completeModule(progress, currentModule.id))
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Unable to save progress.')
    } finally {
      setSubmitting(false)
    }
  }

  const submitFinalKnowledgeCheck = async () => {
    if (!finalCheckReady) {
      return
    }

    const persistsRemotely = Boolean(onAnswerKnowledgeCheck)
    setSubmitting(persistsRemotely)
    setError('')
    try {
      await Promise.all(
        finalKnowledgeItems.map((item) => onAnswerKnowledgeCheck?.(item.moduleId, finalAnswers[item.moduleId] ?? '')),
      )
      setAssessmentResult(
        scoreFinalKnowledgeCheck({
          items: finalKnowledgeItems,
          answers: finalKnowledgeItems.map((item) => ({
            moduleId: item.moduleId,
            answer: finalAnswers[item.moduleId] ?? '',
          })),
        }),
      )
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Unable to save final knowledge check.')
    } finally {
      setSubmitting(false)
    }
  }

  const confirmCompletion = () => {
    if (!assessmentResult) {
      return
    }

    setReceipt(
      createCompletionRecord({
        learner,
        pathId,
        pathTitle,
        contentVersion,
        modules: orderedModules,
        progress,
        assessmentResult,
      }),
    )
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
          <p className="learner-receipt__eyebrow">Step 4 of 4 | Completion confirmation</p>
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
            A Program Pro can now review the final knowledge-check score, survey response, and completion evidence.
          </p>
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
        <p>
          Course modules: {completeCount} of {requiredCount} complete. Final knowledge check comes after lessons and
          practice.
        </p>
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
            <strong>Module step</strong>
          </div>
          <div role="listitem">
            <span>{activeStage}</span>
            <strong>Current phase</strong>
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

      <section aria-label="Required sequence" className="module-rail">
        <ol className="module-rail__list">
          <li className="module-rail__item" data-state={modulesComplete ? 'complete' : 'current'}>
            <span className="module-rail__title">Step 1: Lessons & practice</span>
            <span className="module-rail__status">{modulesComplete ? 'Complete' : 'In progress'}</span>
          </li>
          <li
            className="module-rail__item"
            data-state={modulesComplete ? (assessmentResult ? 'complete' : 'current') : 'locked'}
          >
            <span className="module-rail__title">Step 2: Final knowledge check</span>
            <span className="module-rail__status">
              {modulesComplete ? (assessmentResult ? 'Complete' : 'Ready after modules') : 'Locked until modules complete'}
            </span>
          </li>
          <li className="module-rail__item" data-state={assessmentResult ? 'current' : 'locked'}>
            <span className="module-rail__title">Step 3: Survey & commitment</span>
            <span className="module-rail__status">{assessmentResult ? 'Ready' : 'After final check'}</span>
          </li>
          <li className="module-rail__item" data-state="locked">
            <span className="module-rail__title">Step 4: Completion confirmation</span>
            <span className="module-rail__status">Last</span>
          </li>
        </ol>
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
              <p className="learner-flow__eyebrow">Step 1 of 4 | Learn & practice</p>
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

          {currentModule.action?.type === 'practice' ? (
            <div className="practice-card">
              <p>{currentModule.action.prompt}</p>
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
          ) : (
            <div className="practice-card">
              <p>
                {currentModule.action?.type === 'quiz'
                  ? 'Knowledge check queued for later. Finish this lesson first; its question appears in the final knowledge check after every required module is complete.'
                  : 'Review this lesson before moving to the next required module.'}
              </p>
              <button
                className="module-card__action"
                disabled={submitting}
                onClick={completeCurrentLesson}
                type="button"
              >
                {submitting ? 'Saving' : 'Mark lesson complete'}
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

      {modulesComplete && !assessmentResult ? (
        <section aria-labelledby="final-check-title" className="module-card" data-state="current">
          <header className="module-card__header">
            <div>
              <p className="learner-flow__eyebrow">Step 2 of 4 | Final knowledge check</p>
              <h2 id="final-check-title">Final Knowledge Check</h2>
            </div>
            <p className="module-card__meta">
              {finalKnowledgeItems.length} question{finalKnowledgeItems.length === 1 ? '' : 's'}
            </p>
          </header>
          <div className="module-card__content">
            <p>
              All required lessons and practice are complete. Answer the final PBIS questions before the survey and
              completion confirmation.
            </p>
          </div>

          {finalKnowledgeItems.length > 0 ? (
            finalKnowledgeItems.map((item, index) => (
              <fieldset className="knowledge-check" key={item.moduleId}>
                <legend>
                  Question {index + 1}: {item.prompt}
                </legend>
                {item.choices.map((choice) => (
                  <label data-selected={finalAnswers[item.moduleId] === choice} key={choice}>
                    <input
                      checked={finalAnswers[item.moduleId] === choice}
                      name={`final-knowledge-check-${item.moduleId}`}
                      onChange={() => setFinalAnswers((answers) => ({ ...answers, [item.moduleId]: choice }))}
                      type="radio"
                    />
                    {choice}
                  </label>
                ))}
              </fieldset>
            ))
          ) : (
            <div className="practice-card">
              <p>No final knowledge-check questions are configured for this path. Continue to the survey step.</p>
            </div>
          )}
          <button
            className="module-card__action"
            disabled={!finalCheckReady || submitting}
            onClick={submitFinalKnowledgeCheck}
            type="button"
          >
            {submitting ? 'Saving' : 'Submit final knowledge check'}
          </button>
          {error ? (
            <p className="learner-flow__error" role="alert">
              {error}
            </p>
          ) : null}
        </section>
      ) : null}

      {modulesComplete && assessmentResult ? (
        <section aria-labelledby="survey-title" className="module-card" data-state="current">
          <header className="module-card__header">
            <div>
              <p className="learner-flow__eyebrow">Step 3 of 4 | Survey & commitment</p>
              <h2 id="survey-title">Survey and Commitment</h2>
            </div>
            <p className="module-card__meta">
              Final score: {assessmentResult.score}% | Status:{' '}
              {assessmentResult.passFail === 'pass' ? 'Pass' : 'Needs review'}
            </p>
          </header>
          <div className="module-card__content">
            <p>
              Final knowledge check submitted. Complete the survey, confirm your PBIS commitment, then record the
              completion confirmation.
            </p>
          </div>
          {surveyPanel ? <div className="learner-receipt__survey">{surveyPanel}</div> : null}
          <div className="practice-card">
            <label>
              <input
                checked={commitmentConfirmed}
                onChange={(event) => setCommitmentConfirmed(event.target.checked)}
                type="checkbox"
              />
              I will use the PBIS practices from this training when I am onsite.
            </label>
            <button
              className="module-card__action"
              disabled={!commitmentConfirmed}
              onClick={confirmCompletion}
              type="button"
            >
              Record completion
            </button>
          </div>
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
