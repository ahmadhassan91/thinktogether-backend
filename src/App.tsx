import { useCallback, useEffect, useMemo, useState } from 'react'
import './App.css'
import {
  acceptInvite,
  answerKnowledgeCheck,
  clearToken,
  completeModule,
  createAiDeckOutline,
  createAdminCohort,
  createAdminLearner,
  createLearnerInvite,
  downloadAiDeckPptx,
  downloadAdminExport,
  getAdminDashboard,
  getAdminCohorts,
  getAdminLearners,
  getAiProviders,
  getLearningPath,
  getMe,
  getProgress,
  login,
  readStoredToken,
  revokeLearnerInvite,
  scoreScenario,
  type AdminCohort,
  type AdminDashboardPayload,
  type AdminLearner,
  type AiDeckOutline,
  type AiDeckProvider,
  type AiProviderStatus,
  type AuthUser,
  type LearningPathPayload,
  type LearnerProfile,
  type ProgressPayload,
} from './api/client'
import { StatusChip } from './components/StatusChip'
import { getMilestonesByPhase } from './data/mvpMilestones'
import { AdminDashboard } from './features/admin/AdminDashboard'
import { ScenarioCoach } from './features/coach/ScenarioCoach'
import type { CoachScenario } from './features/coach/coachEngine'
import { LearnerFlow } from './features/learner/LearnerFlow'
import type { Learner, LearnerModule } from './features/learner/learnerProgress'
import thinkTogetherLogo from './assets/think-together-logo.png'

type WorkspaceView = 'learner' | 'practice' | 'admin' | 'plan'

const navItems: Array<{ view: WorkspaceView; label: string }> = [
  { view: 'learner', label: 'Learn' },
  { view: 'practice', label: 'Practice' },
  { view: 'admin', label: 'Admin' },
  { view: 'plan', label: 'Plan' },
]

function App() {
  const [view, setView] = useState<WorkspaceView>('learner')
  const [user, setUser] = useState<AuthUser | null>(null)
  const [learner, setLearner] = useState<Learner | null>(null)
  const [authEmail, setAuthEmail] = useState('admin@thinktogether.local')
  const [authPassword, setAuthPassword] = useState('')
  const [authError, setAuthError] = useState('')
  const [invitePassword, setInvitePassword] = useState('')
  const [loading, setLoading] = useState(Boolean(readStoredToken()))
  const [content, setContent] = useState<LearningPathPayload | null>(null)
  const [progress, setProgress] = useState<ProgressPayload | null>(null)
  const [dashboard, setDashboard] = useState<AdminDashboardPayload | null>(null)
  const [adminLearners, setAdminLearners] = useState<AdminLearner[]>([])
  const [adminCohorts, setAdminCohorts] = useState<AdminCohort[]>([])
  const [loadError, setLoadError] = useState('')
  const inviteToken = useMemo(() => new URLSearchParams(window.location.search).get('invite'), [])

  const refreshWorkspace = useCallback(async (currentUser: AuthUser) => {
    const [pathPayload, progressPayload] = await Promise.all([getLearningPath(), getProgress()])
    setContent(pathPayload)
    setProgress(progressPayload)

    if (currentUser.role === 'admin') {
      const [dashboardPayload, learnersPayload, cohortsPayload] = await Promise.all([
        getAdminDashboard(),
        getAdminLearners(),
        getAdminCohorts(),
      ])
      setDashboard(dashboardPayload)
      setAdminLearners(learnersPayload.learners)
      setAdminCohorts(cohortsPayload.cohorts)
    } else {
      setDashboard(null)
      setAdminLearners([])
      setAdminCohorts([])
    }
  }, [])

  useEffect(() => {
    if (!readStoredToken()) {
      return
    }

    void (async () => {
      try {
        const me = await getMe()
        setUser(me.user)
        setLearner(me.user.role === 'learner' ? toLearnerIdentity(me.user, me.learner ?? undefined) : null)
        setView(me.user.role === 'admin' ? 'admin' : 'learner')
        await refreshWorkspace(me.user)
      } catch (caught) {
        setLoadError(caught instanceof Error ? caught.message : 'Unable to load workspace.')
      } finally {
        setLoading(false)
      }
    })()
  }, [refreshWorkspace])

  const learnerModules = useMemo(() => (content ? toLearnerModules(content) : []), [content])
  const coachScenario = useMemo(() => (content ? toCoachScenario(content) : null), [content])

  const visibleNavItems = user?.role === 'admin' ? navItems : navItems.filter((item) => item.view !== 'admin')
  const activeViewLabel = navItems.find((item) => item.view === view)?.label ?? 'Workspace'

  const handleLogin = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setAuthError('')
    setLoading(true)
    try {
      const auth = await login(authEmail, authPassword)
      const me = auth.user.role === 'learner' ? await getMe() : { user: auth.user }
      setUser(me.user)
      setLearner(me.user.role === 'learner' ? toLearnerIdentity(me.user, me.learner ?? undefined) : null)
      setView(me.user.role === 'admin' ? 'admin' : 'learner')
      await refreshWorkspace(me.user)
    } catch (caught) {
      setAuthError(caught instanceof Error ? caught.message : 'Unable to sign in.')
    } finally {
      setLoading(false)
    }
  }

  const handleLogout = () => {
    clearToken()
    setUser(null)
    setLearner(null)
    setContent(null)
    setProgress(null)
    setDashboard(null)
    setAdminLearners([])
    setAdminCohorts([])
  }

  const handleAcceptInvite = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!inviteToken) return

    setAuthError('')
    setLoading(true)
    try {
      const auth = await acceptInvite(inviteToken, invitePassword)
      setUser(auth.user)
      setLearner(auth.user.role === 'learner' ? toLearnerIdentity(auth.user, auth.learner) : null)
      window.history.replaceState({}, '', window.location.pathname)
      await refreshWorkspace(auth.user)
    } catch (caught) {
      setAuthError(caught instanceof Error ? caught.message : 'Unable to accept invite.')
    } finally {
      setLoading(false)
    }
  }

  if (!user) {
    if (inviteToken) {
      return (
        <div className="app-shell">
          <main className="login-panel" aria-labelledby="invite-title">
            <img className="login-panel__logo" src={thinkTogetherLogo} alt="Think Together logo" />
            <p className="app-hero__label">Think Together Training MVP</p>
            <h1 id="invite-title">Accept invite</h1>
            <p>Create your password to start Program Induction - PBIS.</p>
            <form onSubmit={handleAcceptInvite}>
              <input autoComplete="username" hidden readOnly value="invite" />
              <label>
                Password
                <input
                  autoComplete="new-password"
                  minLength={8}
                  onChange={(event) => setInvitePassword(event.target.value)}
                  type="password"
                  value={invitePassword}
                />
              </label>
              <button disabled={loading || invitePassword.length < 8} type="submit">
                {loading ? 'Accepting invite' : 'Accept invite'}
              </button>
            </form>
            {authError || loadError ? <p role="alert">{authError || loadError}</p> : null}
          </main>
        </div>
      )
    }

    return (
      <div className="app-shell">
        <main className="login-panel" aria-labelledby="login-title">
          <img className="login-panel__logo" src={thinkTogetherLogo} alt="Think Together logo" />
          <p className="app-hero__label">Think Together Training MVP</p>
          <h1 id="login-title">Sign in</h1>
          <form onSubmit={handleLogin}>
            <label>
              Email
              <input
                autoComplete="username"
                value={authEmail}
                onChange={(event) => setAuthEmail(event.target.value)}
                type="email"
              />
            </label>
            <label>
              Password
              <input
                autoComplete="current-password"
                value={authPassword}
                onChange={(event) => setAuthPassword(event.target.value)}
                type="password"
              />
            </label>
            <button disabled={loading || !authEmail || !authPassword} type="submit">
              {loading ? 'Signing in' : 'Sign in'}
            </button>
          </form>
          {authError || loadError ? <p role="alert">{authError || loadError}</p> : null}
        </main>
      </div>
    )
  }

  if (loading || !content || !progress || !coachScenario) {
    return <div className="app-shell"><main className="login-panel">Loading training workspace...</main></div>
  }

  return (
    <div className="app-shell app-shell--workspace">
      <aside className="app-sidebar" aria-label="Workspace navigation">
        <div className="app-sidebar__brand">
          <img className="app-sidebar__logo" src={thinkTogetherLogo} alt="" aria-hidden="true" />
          <div>
            <p>Think Together</p>
            <strong>Training Operations</strong>
          </div>
        </div>

        <nav className="app-sidebar__nav" aria-label="MVP workspace">
          {visibleNavItems.map((item) => (
            <button
              aria-current={view === item.view ? 'page' : undefined}
              className="app-sidebar__nav-button"
              data-active={view === item.view}
              key={item.view}
              onClick={() => setView(item.view === 'admin' && user.role !== 'admin' ? 'learner' : item.view)}
              type="button"
            >
              {item.label}
            </button>
          ))}
        </nav>

        <div className="app-sidebar__account">
          <span>{user.role === 'admin' ? 'Admin workspace' : 'Learner workspace'}</span>
          <strong>{user.name}</strong>
          <button className="logout-button" onClick={handleLogout} type="button">
            Sign out
          </button>
        </div>
      </aside>

      <main className="workspace-main">
        <header className="workspace-topbar">
          <div>
            <p className="app-hero__label">{user.role === 'admin' ? 'Operations dashboard' : 'Program Induction PBIS'}</p>
            <h1>{activeViewLabel}</h1>
          </div>
          <div className="workspace-topbar__meta" aria-label="Training scope">
            <span>{content.modules.length} modules</span>
            <span>{content.scenarios.length} scenarios</span>
          </div>
        </header>

        <div className="app-content">
          {renderView({
          view,
          learnerModules,
          coachScenario,
          progress,
          dashboard,
          adminLearners,
          adminCohorts,
          learner: learner ?? toLearnerIdentity(user),
          isAdmin: user.role === 'admin',
          contentVersion: content.path.contentVersion,
          onCompleteModule: async (moduleId) => {
            await completeModule(moduleId)
            setProgress(await getProgress())
            if (user.role === 'admin') {
              setDashboard(await getAdminDashboard())
            }
          },
          onAnswerKnowledgeCheck: async (moduleId, answer) => {
            const moduleItem = content.modules.find((item) => item.id === moduleId)
            const itemId = moduleItem?.knowledgeCheckItemIds[0]
            if (itemId) {
              await answerKnowledgeCheck(itemId, answer)
            }
          },
          onCreateLearner: async (learner) => {
            await createAdminLearner(learner)
            const [learnersPayload, dashboardPayload] = await Promise.all([getAdminLearners(), getAdminDashboard()])
            setAdminLearners(learnersPayload.learners)
            setDashboard(dashboardPayload)
          },
          onCreateCohort: async (cohort) => {
            await createAdminCohort(cohort)
            const [cohortsPayload, dashboardPayload] = await Promise.all([getAdminCohorts(), getAdminDashboard()])
            setAdminCohorts(cohortsPayload.cohorts)
            setDashboard(dashboardPayload)
          },
          onCreateLearnerInvite: async (learnerId) => {
            const invitePayload = await createLearnerInvite(learnerId)
            if (invitePayload.learner) {
              setAdminLearners((items) => items.map((item) => (item.id === learnerId ? invitePayload.learner! : item)))
            } else if (invitePayload.invite?.inviteStatus) {
              setAdminLearners((items) =>
                items.map((item) =>
                  item.id === learnerId ? { ...item, inviteStatus: invitePayload.invite.inviteStatus } : item,
                ),
              )
            }
            return invitePayload.invite
          },
          onRevokeLearnerInvite: async (learnerId) => {
            const revokePayload = await revokeLearnerInvite(learnerId)
            setAdminLearners((items) => items.map((item) => (item.id === learnerId ? revokePayload.learner : item)))
          },
          onDownloadExport: downloadAdminExport,
          })}
        </div>
      </main>
    </div>
  )
}

function renderView({
  view,
  learnerModules,
  coachScenario,
  progress,
  dashboard,
  adminLearners,
  adminCohorts,
  learner,
  isAdmin,
  contentVersion,
  onCompleteModule,
  onAnswerKnowledgeCheck,
  onCreateLearner,
  onCreateCohort,
  onCreateLearnerInvite,
  onRevokeLearnerInvite,
  onDownloadExport,
}: {
  view: WorkspaceView
  learnerModules: LearnerModule[]
  coachScenario: CoachScenario
  progress: ProgressPayload
  dashboard: AdminDashboardPayload | null
  adminLearners: AdminLearner[]
  adminCohorts: AdminCohort[]
  learner: Learner
  isAdmin: boolean
  contentVersion: string
  onCompleteModule: (moduleId: string) => Promise<void>
  onAnswerKnowledgeCheck: (moduleId: string, answer: string) => Promise<void>
  onCreateLearner: Parameters<typeof AdminDashboard>[0]['onCreateLearner']
  onCreateCohort: Parameters<typeof AdminDashboard>[0]['onCreateCohort']
  onCreateLearnerInvite: Parameters<typeof AdminDashboard>[0]['onCreateLearnerInvite']
  onRevokeLearnerInvite: Parameters<typeof AdminDashboard>[0]['onRevokeLearnerInvite']
  onDownloadExport: Parameters<typeof AdminDashboard>[0]['onDownloadExport']
}) {
  if (view === 'practice') {
    return <ScenarioCoach scenario={coachScenario} onScoreScenario={scoreScenario} />
  }

  if (view === 'admin' && isAdmin) {
    return (
      <AdminDashboard
        dashboard={dashboard ?? undefined}
        learners={adminLearners}
        managementCohorts={adminCohorts}
        onCreateLearner={onCreateLearner}
        onCreateCohort={onCreateCohort}
        onCreateLearnerInvite={onCreateLearnerInvite}
        onRevokeLearnerInvite={onRevokeLearnerInvite}
        onDownloadExport={onDownloadExport}
      />
    )
  }

  if (view === 'plan') {
    return <MilestonePlan isAdmin={isAdmin} />
  }

  return (
    <LearnerFlow
      learner={learner}
      modules={learnerModules}
      pathTitle="Program Induction - PBIS"
      contentVersion={contentVersion}
      initialCompletedModuleIds={progress.completedModuleIds}
      onCompleteModule={onCompleteModule}
      onAnswerKnowledgeCheck={onAnswerKnowledgeCheck}
    />
  )
}

function toLearnerIdentity(user: AuthUser, profile?: LearnerProfile | null): Learner {
  const firstLastName = [profile?.firstName, profile?.lastName].filter(Boolean).join(' ')

  return {
    id: profile?.id ?? user.learnerId ?? user.id,
    name: profile?.name ?? (firstLastName || user.name),
    email: profile?.email ?? user.email,
    region: profile?.region,
    role: profile?.role ?? profile?.title ?? 'Learner',
    site: profile?.site,
    cohortDate: profile?.cohortDate,
  }
}

function toLearnerModules(payload: LearningPathPayload): LearnerModule[] {
  return payload.modules.map((module) => {
    const firstQuestion = payload.knowledgeChecks.find((item) => item.moduleId === module.id)

    return {
      id: module.id,
      title: module.title,
      sequence: module.order,
      estimatedMinutes: module.estimatedMinutes,
      required: module.requiredForCompletion,
      content: [
        module.content.summary,
        ...module.content.keyPoints.slice(0, 2),
      ],
      action: firstQuestion
        ? {
            type: 'quiz' as const,
            prompt: firstQuestion.prompt,
            choices: firstQuestion.choices,
            correctAnswer: firstQuestion.correctAnswer,
            explanation: firstQuestion.rationale,
          }
        : {
            type: 'practice' as const,
            prompt: 'Name one PBIS practice you will use at site this week.',
          },
    }
  })
}

function toCoachScenario(payload: LearningPathPayload): CoachScenario {
  const scenario =
    payload.scenarios.find((item) => item.id === 'jacob-pencil-pouch-bullying') ?? payload.scenarios[0]

  return {
    id: scenario.id,
    title: scenario.title,
    brief: scenario.prompt,
    expectedAnchors: [
      'restorative language',
      'major behavior',
      'SPM ownership',
      'safety escalation',
    ],
  }
}

function MilestonePlan({ isAdmin }: { isAdmin: boolean }) {
  const mvp = getMilestonesByPhase('MVP')
  const phaseTwo = getMilestonesByPhase('Phase 2')
  const [providers, setProviders] = useState<AiProviderStatus[]>([])
  const [provider, setProvider] = useState<AiDeckProvider>('openai')
  const [topic, setTopic] = useState('Effective lesson delivery with 10:2 practice')
  const [audience, setAudience] = useState('Think Together program leaders')
  const [durationMinutes, setDurationMinutes] = useState(45)
  const [slideCount, setSlideCount] = useState(6)
  const [outline, setOutline] = useState<AiDeckOutline | null>(null)
  const [isGenerating, setIsGenerating] = useState(false)
  const [isDownloadingPptx, setIsDownloadingPptx] = useState(false)
  const [deckError, setDeckError] = useState('')

  const deckProviders = useMemo(
    () => providers.filter((item): item is AiProviderStatus & { id: AiDeckProvider } =>
      item.id === 'openai' || item.id === 'gemini' || item.id === 'claude'),
    [providers],
  )

  useEffect(() => {
    if (!isAdmin) return
    void getAiProviders()
      .then((payload) => setProviders(payload.providers))
      .catch((error) => setDeckError(error instanceof Error ? error.message : 'Unable to load AI providers.'))
  }, [isAdmin])

  useEffect(() => {
    if (deckProviders.length === 0 || deckProviders.some((item) => item.id === provider)) return
    const fallback = deckProviders.find((item) => item.id === 'openai' && item.configured)
      ?? deckProviders.find((item) => item.id === 'gemini' && item.configured)
      ?? deckProviders[0]
    setProvider(fallback.id)
  }, [deckProviders, provider])

  const selectedProvider = deckProviders.find((item) => item.id === provider)

  const handleGenerateDeck = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setDeckError('')
    setIsGenerating(true)
    try {
      const payload = await createAiDeckOutline({ provider, topic, audience, durationMinutes, slideCount })
      setOutline(payload.outline)
    } catch (error) {
      setDeckError(error instanceof Error ? error.message : 'Unable to generate deck outline.')
    } finally {
      setIsGenerating(false)
    }
  }

  const handleDownloadPptx = async () => {
    setDeckError('')
    setIsDownloadingPptx(true)
    try {
      await downloadAiDeckPptx({ provider, topic, audience, durationMinutes, slideCount })
    } catch (error) {
      setDeckError(error instanceof Error ? error.message : 'Unable to generate PowerPoint.')
    } finally {
      setIsDownloadingPptx(false)
    }
  }

  return (
    <main className="plan-view" aria-labelledby="plan-title">
      <header>
        <p className="app-hero__label">Delivery plan</p>
        <h1 id="plan-title">MVP and Phase 2 Milestones</h1>
        <p>
          The full CSV lives at <code>Think_Together_MVP_Phase_Plan.csv</code>. This
          view keeps the implementation team aligned inside the demo.
        </p>
      </header>

      <section className="plan-columns">
        <MilestoneList title="MVP" milestones={mvp} status="current" />
        <MilestoneList title="Phase 2" milestones={phaseTwo} status="locked" />
      </section>

      {isAdmin ? (
        <section className="deck-studio" aria-labelledby="deck-studio-title">
          <div>
            <p className="app-hero__label">Phase 2 AI deck generator</p>
            <h2 id="deck-studio-title">Training Deck Studio</h2>
            <p>
              Generate a source-grounded facilitator deck and export an editable PowerPoint using the PBIS and SOP artifacts.
              OpenAI GPT-5.2 is the premium default; Gemini remains available as the fast fallback.
            </p>
          </div>

          <div className="provider-strip" aria-label="AI provider status">
            {deckProviders.map((item) => (
              <span data-configured={item.configured} key={item.id} title={item.note}>
                {item.label}: {item.configured ? 'ready' : 'needs key'}
              </span>
            ))}
          </div>

          <form className="deck-form" onSubmit={handleGenerateDeck}>
            <label>
              Provider
              <select value={provider} onChange={(event) => setProvider(event.target.value as AiDeckProvider)}>
                <option value="openai">OpenAI GPT-5.2</option>
                <option value="gemini">Gemini Flash</option>
                <option value="claude">Claude Sonnet</option>
              </select>
            </label>
            <label>
              Topic
              <input value={topic} onChange={(event) => setTopic(event.target.value)} />
            </label>
            <label>
              Audience
              <input value={audience} onChange={(event) => setAudience(event.target.value)} />
            </label>
            <div className="deck-form__row">
              <label>
                Minutes
                <input
                  min={10}
                  max={180}
                  type="number"
                  value={durationMinutes}
                  onChange={(event) => setDurationMinutes(Number(event.target.value))}
                />
              </label>
              <label>
                Slides
                <input
                  min={4}
                  max={14}
                  type="number"
                  value={slideCount}
                  onChange={(event) => setSlideCount(Number(event.target.value))}
                />
              </label>
            </div>
            <div className="deck-form__actions">
              <button disabled={isGenerating || !selectedProvider?.configured || selectedProvider.mode !== 'sync' || topic.length < 8} type="submit">
                {isGenerating ? 'Generating preview' : 'Generate preview'}
              </button>
              <button
                disabled={isDownloadingPptx || !selectedProvider?.configured || selectedProvider.mode !== 'sync' || topic.length < 8}
                onClick={handleDownloadPptx}
                type="button"
              >
                {isDownloadingPptx ? 'Building PowerPoint' : 'Download PowerPoint'}
              </button>
            </div>
            {deckError ? <p role="alert">{deckError}</p> : null}
          </form>

          {outline ? (
            <section className="deck-outline" aria-labelledby="deck-outline-title">
              <div>
                <p className="app-hero__label">{outline.provider} · {outline.model}</p>
                <h3 id="deck-outline-title">{outline.title}</h3>
                <p>{outline.durationMinutes} minutes for {outline.audience}</p>
              </div>
              <div className="deck-outline__rail" aria-label="Generated deck summary">
                <span>{outline.slides.length} editable slides</span>
                <span>{outline.sourceArtifacts.length} source artifacts</span>
                <span>Human review required</span>
              </div>
              <ol>
                {outline.slides.map((slide, index) => (
                  <li key={`${slide.title}-${index}`}>
                    <strong>{index + 1}. {slide.title}</strong>
                    <span>{slide.objective}</span>
                    <small>{slide.activityPrompt}</small>
                  </li>
                ))}
              </ol>
              <div className="source-list">
                {outline.sourceArtifacts.map((artifact) => <span key={artifact}>{artifact}</span>)}
              </div>
            </section>
          ) : null}
        </section>
      ) : null}
    </main>
  )
}

function MilestoneList({
  title,
  milestones,
  status,
}: {
  title: string
  milestones: ReturnType<typeof getMilestonesByPhase>
  status: 'current' | 'locked'
}) {
  return (
    <article className="plan-card">
      <div className="plan-card__header">
        <h2>{title}</h2>
        <StatusChip status={status} label={title === 'MVP' ? 'In motion' : 'Next'} />
      </div>
      <ol>
        {milestones.map((milestone) => (
          <li key={milestone.milestoneId}>
            <strong>{milestone.milestoneId}</strong>
            <span>{milestone.milestone}</span>
            <small>{milestone.deliveryWindow}</small>
          </li>
        ))}
      </ol>
    </article>
  )
}

export default App
