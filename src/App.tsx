import { useCallback, useEffect, useMemo, useState } from 'react'
import './App.css'
import {
  acceptInvite,
  answerKnowledgeCheck,
  clearToken,
  completeModule,
  createAdminCohort,
  createAdminLearner,
  createLearnerInvite,
  downloadAdminExport,
  getAdminDashboard,
  getAdminCohorts,
  getAdminLearners,
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
  type AuthUser,
  type LearningPathPayload,
  type LearnerProfile,
  type ProgressPayload,
} from './api/client'
import { BrandHeader, type BrandHeaderMode } from './components/BrandHeader'
import { StatusChip } from './components/StatusChip'
import { getMilestonesByPhase } from './data/mvpMilestones'
import { AdminDashboard } from './features/admin/AdminDashboard'
import { ScenarioCoach } from './features/coach/ScenarioCoach'
import type { CoachScenario } from './features/coach/coachEngine'
import { LearnerFlow } from './features/learner/LearnerFlow'
import type { Learner, LearnerModule } from './features/learner/learnerProgress'

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

  const brandMode: BrandHeaderMode = view === 'admin' ? 'admin' : 'learner'
  const visibleNavItems = user?.role === 'admin' ? navItems : navItems.filter((item) => item.view !== 'admin')

  const handleLogin = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setAuthError('')
    setLoading(true)
    try {
      const auth = await login(authEmail, authPassword)
      const me = auth.user.role === 'learner' ? await getMe() : { user: auth.user }
      setUser(me.user)
      setLearner(me.user.role === 'learner' ? toLearnerIdentity(me.user, me.learner ?? undefined) : null)
      setView('learner')
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
    <div className="app-shell">
      <BrandHeader
        mode={brandMode}
        showAdminMode={user.role === 'admin'}
        onModeChange={(mode) => setView(mode === 'admin' && user.role === 'admin' ? 'admin' : 'learner')}
      />

      <section className="app-hero" aria-label="MVP summary">
        <div>
          <p className="app-hero__label">Program Induction PBIS MVP</p>
          <h2>Mobile training, practice coaching, and clearance reporting in one demo.</h2>
          <p>
            Built around Think Together artifacts: SOPs, PBIS decks, knowledge checks,
            weekly induction rhythm, and import/export-first admin operations.
          </p>
        </div>
        <div className="app-hero__stats" aria-label="MVP scope">
          <div>
            <strong>{content.modules.length}</strong>
            <span>PBIS modules</span>
          </div>
          <div>
            <strong>{content.scenarios.length}</strong>
            <span>scenario seeds</span>
          </div>
          <div>
            <strong>19</strong>
            <span>delivery milestones</span>
          </div>
        </div>
      </section>

      <nav className="app-tabs" aria-label="MVP workspace">
        {visibleNavItems.map((item) => (
          <button
            aria-current={view === item.view ? 'page' : undefined}
            className="app-tabs__button"
            data-active={view === item.view}
            key={item.view}
            onClick={() => setView(item.view === 'admin' && user.role !== 'admin' ? 'learner' : item.view)}
            type="button"
          >
            {item.label}
          </button>
        ))}
      </nav>

      <button className="logout-button" onClick={handleLogout} type="button">
        Sign out {user.name}
      </button>

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
    return <MilestonePlan />
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

function MilestonePlan() {
  const mvp = getMilestonesByPhase('MVP')
  const phaseTwo = getMilestonesByPhase('Phase 2')

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
