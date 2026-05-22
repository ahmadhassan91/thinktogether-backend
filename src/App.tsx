import { useCallback, useEffect, useMemo, useState } from 'react'
import './App.css'
import {
  acceptInvite,
  askKnowledgeAssistant,
  answerKnowledgeCheck,
  clearToken,
  completeModule,
  createAiDeckOutline,
  createAdminCohort,
  createAdminLearner,
  createContentStudioPackage,
  createLearnerInvite,
  downloadAiDeckPptx,
  downloadAdminExport,
  getAdminDashboard,
  getAdminAuditEvents,
  getAdminCohorts,
  getAdminLearners,
  getAdminSupervisorReport,
  getAiProviders,
  getLearningPath,
  getMe,
  getProgress,
  getSourceQaFlags,
  getSourceLibrary,
  getSourceUsageSummary,
  login,
  readStoredToken,
  revokeLearnerInvite,
  scoreScenario,
  searchSourceIntelligence,
  submitTrainingSurvey,
  type AdminAuditEvent,
  type AdminCohort,
  type AdminDashboardPayload,
  type AdminLearner,
  type AiDeckOutline,
  type AiDeckProvider,
  type AiProviderStatus,
  type AuthUser,
  type ContentStudioPackage,
  type LearningPathPayload,
  type LearnerProfile,
  type SourceLibraryPayload,
  type SourceQaFlagsPayload,
  type SourceSearchPayload,
  type SourceUsageSummaryPayload,
  type SupervisorReportPayload,
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

type WorkspaceView = 'learner' | 'practice' | 'assist' | 'admin' | 'users' | 'cohorts' | 'deck' | 'reporting' | 'plan'

const navItems: Array<{ view: WorkspaceView; label: string }> = [
  { view: 'learner', label: 'Learn' },
  { view: 'practice', label: 'Practice' },
  { view: 'assist', label: 'Assist' },
  { view: 'admin', label: 'Admin' },
  { view: 'users', label: 'Users' },
  { view: 'cohorts', label: 'Cohorts' },
  { view: 'deck', label: 'Decks' },
  { view: 'reporting', label: 'Reporting' },
  { view: 'plan', label: 'Plan' },
]

const adminOnlyViews: WorkspaceView[] = ['admin', 'users', 'cohorts', 'deck', 'reporting']

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
  const [supervisorReport, setSupervisorReport] = useState<SupervisorReportPayload | null>(null)
  const [adminLearners, setAdminLearners] = useState<AdminLearner[]>([])
  const [adminCohorts, setAdminCohorts] = useState<AdminCohort[]>([])
  const [adminAuditEvents, setAdminAuditEvents] = useState<AdminAuditEvent[]>([])
  const [sourceLibrary, setSourceLibrary] = useState<SourceLibraryPayload | null>(null)
  const [sourceUsageSummary, setSourceUsageSummary] = useState<SourceUsageSummaryPayload | null>(null)
  const [sourceQaFlags, setSourceQaFlags] = useState<SourceQaFlagsPayload | null>(null)
  const [loadError, setLoadError] = useState('')
  const inviteToken = useMemo(() => new URLSearchParams(window.location.search).get('invite'), [])

  const refreshWorkspace = useCallback(async (currentUser: AuthUser) => {
    const [pathPayload, progressPayload, sourcePayload] = await Promise.all([getLearningPath(), getProgress(), getSourceLibrary()])
    setContent(pathPayload)
    setProgress(progressPayload)
    setSourceLibrary(sourcePayload)

    if (currentUser.role === 'admin') {
      const [dashboardPayload, supervisorReportPayload, learnersPayload, cohortsPayload, auditPayload, usagePayload, qaFlagsPayload] = await Promise.all([
        getAdminDashboard(),
        getAdminSupervisorReport(),
        getAdminLearners(),
        getAdminCohorts(),
        getAdminAuditEvents(),
        getSourceUsageSummary(),
        getSourceQaFlags(),
      ])
      setDashboard(dashboardPayload)
      setSupervisorReport(supervisorReportPayload)
      setAdminLearners(learnersPayload.learners)
      setAdminCohorts(cohortsPayload.cohorts)
      setAdminAuditEvents(auditPayload.events)
      setSourceUsageSummary(usagePayload)
      setSourceQaFlags(qaFlagsPayload)
    } else {
      setDashboard(null)
      setSupervisorReport(null)
      setAdminLearners([])
      setAdminCohorts([])
      setAdminAuditEvents([])
      setSourceUsageSummary(null)
      setSourceQaFlags(null)
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

  const visibleNavItems = user?.role === 'admin' ? navItems : navItems.filter((item) => !adminOnlyViews.includes(item.view))
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
    setSupervisorReport(null)
    setAdminLearners([])
    setAdminCohorts([])
    setAdminAuditEvents([])
    setSourceUsageSummary(null)
    setSourceQaFlags(null)
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
              onClick={() => setView(adminOnlyViews.includes(item.view) && user.role !== 'admin' ? 'learner' : item.view)}
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

        <div className="workspace-body">
          <div className="app-content">
            <WorkspaceHelper view={view} isAdmin={user.role === 'admin'} />
            {renderView({
            view,
            learnerModules,
            coachScenario,
            progress,
            dashboard,
            supervisorReport,
            adminLearners,
            adminCohorts,
            adminAuditEvents,
            learner: learner ?? toLearnerIdentity(user),
            isAdmin: user.role === 'admin',
            contentVersion: content.path.contentVersion,
            sourceLibrary,
            sourceUsageSummary,
            sourceQaFlags,
            onCompleteModule: async (moduleId) => {
              await completeModule(moduleId)
              setProgress(await getProgress())
              if (user.role === 'admin') {
                const [dashboardPayload, supervisorReportPayload] = await Promise.all([
                  getAdminDashboard(),
                  getAdminSupervisorReport(),
                ])
                setDashboard(dashboardPayload)
                setSupervisorReport(supervisorReportPayload)
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
              const [learnersPayload, dashboardPayload, supervisorReportPayload, auditPayload] = await Promise.all([
                getAdminLearners(),
                getAdminDashboard(),
                getAdminSupervisorReport(),
                getAdminAuditEvents(),
              ])
              setAdminLearners(learnersPayload.learners)
              setDashboard(dashboardPayload)
              setSupervisorReport(supervisorReportPayload)
              setAdminAuditEvents(auditPayload.events)
            },
            onCreateCohort: async (cohort) => {
              await createAdminCohort(cohort)
              const [cohortsPayload, dashboardPayload, supervisorReportPayload, auditPayload] = await Promise.all([
                getAdminCohorts(),
                getAdminDashboard(),
                getAdminSupervisorReport(),
                getAdminAuditEvents(),
              ])
              setAdminCohorts(cohortsPayload.cohorts)
              setDashboard(dashboardPayload)
              setSupervisorReport(supervisorReportPayload)
              setAdminAuditEvents(auditPayload.events)
            },
            onCreateLearnerInvite: async (learnerId) => {
              const invitePayload = await createLearnerInvite(learnerId)
              setAdminAuditEvents((await getAdminAuditEvents()).events)
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
              setAdminAuditEvents((await getAdminAuditEvents()).events)
            },
            onDownloadExport: downloadAdminExport,
            onSubmitSurvey: async (score, notes) => {
              await submitTrainingSurvey({ pathId: content.path.id, score, notes })
              if (user.role === 'admin') {
                const [dashboardPayload, supervisorReportPayload] = await Promise.all([
                  getAdminDashboard(),
                  getAdminSupervisorReport(),
                ])
                setDashboard(dashboardPayload)
                setSupervisorReport(supervisorReportPayload)
              }
            },
            })}
          </div>
          {user.role === 'admin' ? <SandboxReviewerPanel view={view} /> : null}
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
  supervisorReport,
  adminLearners,
  adminCohorts,
  adminAuditEvents,
  learner,
  isAdmin,
  contentVersion,
  sourceLibrary,
  sourceUsageSummary,
  sourceQaFlags,
  onCompleteModule,
  onAnswerKnowledgeCheck,
  onCreateLearner,
  onCreateCohort,
  onCreateLearnerInvite,
  onRevokeLearnerInvite,
  onDownloadExport,
  onSubmitSurvey,
}: {
  view: WorkspaceView
  learnerModules: LearnerModule[]
  coachScenario: CoachScenario
  progress: ProgressPayload
  dashboard: AdminDashboardPayload | null
  supervisorReport: SupervisorReportPayload | null
  adminLearners: AdminLearner[]
  adminCohorts: AdminCohort[]
  adminAuditEvents: AdminAuditEvent[]
  learner: Learner
  isAdmin: boolean
  contentVersion: string
  sourceLibrary: SourceLibraryPayload | null
  sourceUsageSummary: SourceUsageSummaryPayload | null
  sourceQaFlags: SourceQaFlagsPayload | null
  onCompleteModule: (moduleId: string) => Promise<void>
  onAnswerKnowledgeCheck: (moduleId: string, answer: string) => Promise<void>
  onCreateLearner: Parameters<typeof AdminDashboard>[0]['onCreateLearner']
  onCreateCohort: Parameters<typeof AdminDashboard>[0]['onCreateCohort']
  onCreateLearnerInvite: Parameters<typeof AdminDashboard>[0]['onCreateLearnerInvite']
  onRevokeLearnerInvite: Parameters<typeof AdminDashboard>[0]['onRevokeLearnerInvite']
  onDownloadExport: Parameters<typeof AdminDashboard>[0]['onDownloadExport']
  onSubmitSurvey: (score: number, notes: string) => Promise<void>
}) {
  if (view === 'practice') {
    return <ScenarioCoach scenario={coachScenario} onScoreScenario={scoreScenario} />
  }

  if (view === 'assist') {
    return <KnowledgeAssistantPanel sourceLibrary={sourceLibrary} />
  }

  if (['admin', 'users', 'cohorts'].includes(view) && isAdmin) {
    return (
      <AdminDashboard
        mode={view === 'users' ? 'users' : view === 'cohorts' ? 'cohorts' : 'overview'}
        dashboard={dashboard ?? undefined}
        learners={adminLearners}
        managementCohorts={adminCohorts}
        auditEvents={adminAuditEvents}
        onCreateLearner={onCreateLearner}
        onCreateCohort={onCreateCohort}
        onCreateLearnerInvite={onCreateLearnerInvite}
        onRevokeLearnerInvite={onRevokeLearnerInvite}
        onDownloadExport={onDownloadExport}
      />
    )
  }

  if (view === 'deck' && isAdmin) {
    return <DeckStudio />
  }

  if (view === 'reporting' && isAdmin) {
    return <SupervisorReportingPanel dashboard={dashboard} supervisorReport={supervisorReport} learners={adminLearners} cohorts={adminCohorts} />
  }

  if (view === 'plan') {
    return (
      <MilestonePlan
        isAdmin={isAdmin}
        sourceLibrary={sourceLibrary}
        sourceUsageSummary={sourceUsageSummary}
        sourceQaFlags={sourceQaFlags}
      />
    )
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
      surveyPanel={<TrainingSurveyPanel onSubmitSurvey={onSubmitSurvey} />}
    />
  )
}

function WorkspaceHelper({ view, isAdmin }: { view: WorkspaceView; isAdmin: boolean }) {
  if (!isAdmin || !['users', 'cohorts', 'deck', 'reporting'].includes(view)) return null

  const copy: Record<string, { label: string; title: string; body: string }> = {
    users: {
      label: 'Admin helper',
      title: 'Add learners, assign cohorts, then issue invites.',
      body: 'Use the roster filters to find invite exceptions and missing assignments before exporting clearance data.',
    },
    cohorts: {
      label: 'Admin helper',
      title: 'Create the training session in plain language.',
      body: 'Pick the learning path and primary facilitator from friendly lists; the MVP keeps the backend IDs behind the scenes.',
    },
    deck: {
      label: 'Deck helper',
      title: 'Generate a draft, then keep a human review gate.',
      body: 'Deck exports are source-grounded starting points for Program Pros, not automatic policy or LMS updates.',
    },
    reporting: {
      label: 'Supervisor view',
      title: 'Reporting is visible for MVP review.',
      body: 'Current dashboard data is summarized here while richer supervisor drilldowns and scheduled exports come next.',
    },
  }
  const helper = copy[view]

  return (
    <aside className="workspace-helper" aria-label={`${helper.title} guidance`}>
      <p className="app-hero__label">{helper.label}</p>
      <strong>{helper.title}</strong>
      <span>{helper.body}</span>
    </aside>
  )
}

function SandboxReviewerPanel({ view }: { view: WorkspaceView }) {
  const [notes, setNotes] = useState('')
  const viewLabel = navItems.find((item) => item.view === view)?.label ?? 'Workspace'

  return (
    <aside className="sandbox-reviewer" aria-labelledby="sandbox-reviewer-title">
      <div>
        <p className="app-hero__label">Sandbox review</p>
        <h2 id="sandbox-reviewer-title">Reviewer notes</h2>
        <p>
          Capture what feels unclear, missing, or demo-ready while moving through {viewLabel}.
        </p>
      </div>
      <label>
        Notes for follow-up
        <textarea
          onChange={(event) => setNotes(event.target.value)}
          placeholder="Example: Cohort labels are clear, but supervisor export needs owner/date."
          value={notes}
        />
      </label>
      <div className="sandbox-reviewer__prompts" aria-label="Review prompts">
        <span>Could a regional supervisor read this without training?</span>
        <span>Is any ID, status, or export boundary unclear?</span>
        <span>What should be promoted before pilot handoff?</span>
      </div>
    </aside>
  )
}

function SupervisorReportingPanel({
  dashboard,
  supervisorReport,
  learners,
  cohorts,
}: {
  dashboard: AdminDashboardPayload | null
  supervisorReport: SupervisorReportPayload | null
  learners: AdminLearner[]
  cohorts: AdminCohort[]
}) {
  const supervisorGroups = supervisorReport?.groups?.supervisors ?? []
  const facilitatorGroups = supervisorReport?.groups?.facilitators ?? []
  const notificationPreviews = supervisorReport?.completionNotifications ?? []
  const missingCohorts = learners.filter((learnerItem) => !learnerItem.cohortId || !learnerItem.cohortName).length
  const pendingInvites = learners.filter((learnerItem) => learnerItem.inviteStatus === 'pending').length

  return (
    <main className="reporting-view" aria-labelledby="reporting-title">
      <header>
        <p className="app-hero__label">Supervisor and Reporting</p>
        <h1 id="reporting-title">Supervisor Reporting</h1>
        <p>
          MVP reporting uses the admin dashboard feed already available in the client. Phase 2 adds supervisor drilldowns,
          recurring exports, and region-owner routing.
        </p>
      </header>

      {dashboard ? (
        <>
          <section className="reporting-view__metrics" aria-label="Supervisor reporting metrics">
            <span><strong>{dashboard.kpis.totalLearners}</strong> learners</span>
            <span><strong>{dashboard.kpis.clearanceReady}</strong> clearance-ready</span>
            <span><strong>{dashboard.kpis.makeupRequired}</strong> need makeup</span>
            <span><strong>{dashboard.kpis.facilitatorRating.toFixed(1)}</strong> facilitator rating</span>
          </section>
          <section className="reporting-view__grid">
            <article>
              <h2>Supervisor snapshot</h2>
              <dl>
                <div><dt>Cohorts in scope</dt><dd>{cohorts.length || dashboard.cohorts.length}</dd></div>
                <div><dt>Pending invites</dt><dd>{pendingInvites}</dd></div>
                <div><dt>Missing cohort</dt><dd>{missingCohorts}</dd></div>
                <div><dt>Supervisor groups</dt><dd>{supervisorGroups.length}</dd></div>
              </dl>
            </article>
            <article>
              <h2>Completion notifications</h2>
              {notificationPreviews.length ? (
                <ul>
                  {notificationPreviews.slice(0, 3).map((item) => (
                    <li key={`${item.learnerId}-${item.pathId}`}>
                      {item.preview}
                    </li>
                  ))}
                </ul>
              ) : (
                <p>No completion notifications are waiting. Completed learners will appear here for supervisor follow-up.</p>
              )}
            </article>
          </section>
          {supervisorGroups.length || facilitatorGroups.length ? (
            <section className="reporting-view__table" aria-labelledby="supervisor-groups-title">
              <h2 id="supervisor-groups-title">Supervisor and facilitator drilldown</h2>
              <table>
                <thead>
                  <tr>
                    <th>Group</th>
                    <th>Learners</th>
                    <th>Avg progress</th>
                    <th>Completion rate</th>
                  </tr>
                </thead>
                <tbody>
                  {[...supervisorGroups, ...facilitatorGroups].slice(0, 8).map((group) => (
                    <tr key={group.id}>
                      <td>{group.label}</td>
                      <td>{group.learnerCount}</td>
                      <td>{group.averageProgressPercent}%</td>
                      <td>{group.completionRate}%</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </section>
          ) : null}
        </>
      ) : (
        <section className="reporting-view__coming-next">
          <h2>MVP coming next</h2>
          <p>
            Supervisor reporting will activate when dashboard data is loaded. The MVP boundary is clear:
            CSV/XLSX export first, no direct ADP or LMS writeback.
          </p>
        </section>
      )}
    </main>
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

function MilestonePlan({
  isAdmin,
  sourceLibrary,
  sourceUsageSummary,
  sourceQaFlags,
}: {
  isAdmin: boolean
  sourceLibrary: SourceLibraryPayload | null
  sourceUsageSummary: SourceUsageSummaryPayload | null
  sourceQaFlags: SourceQaFlagsPayload | null
}) {
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

      <SourceIntelligencePanel
        isAdmin={isAdmin}
        sourceUsageSummary={sourceUsageSummary}
        sourceQaFlags={sourceQaFlags}
      />
      <SourceLibraryPanel sourceLibrary={sourceLibrary} />

    </main>
  )
}


function DeckStudio() {
  const [providers, setProviders] = useState<AiProviderStatus[]>([])
  const [provider, setProvider] = useState<AiDeckProvider>('openai')
  const [topic, setTopic] = useState('Effective lesson delivery with 10:2 practice')
  const [audience, setAudience] = useState('Think Together program leaders')
  const [durationMinutes, setDurationMinutes] = useState(45)
  const [slideCount, setSlideCount] = useState(6)
  const [outline, setOutline] = useState<AiDeckOutline | null>(null)
  const [contentPackage, setContentPackage] = useState<ContentStudioPackage | null>(null)
  const [isGenerating, setIsGenerating] = useState(false)
  const [isDownloadingPptx, setIsDownloadingPptx] = useState(false)
  const [isGeneratingPackage, setIsGeneratingPackage] = useState(false)
  const [deckError, setDeckError] = useState('')

  const deckProviders = useMemo(
    () => providers.filter((item): item is AiProviderStatus & { id: AiDeckProvider } =>
      item.id === 'openai' || item.id === 'gemini' || item.id === 'claude'),
    [providers],
  )

  useEffect(() => {
    void getAiProviders()
      .then((payload) => setProviders(payload.providers))
      .catch((error) => setDeckError(error instanceof Error ? error.message : 'Unable to load AI providers.'))
  }, [])

  const fallbackProvider = deckProviders.find((item) => item.id === 'openai' && item.configured)
    ?? deckProviders.find((item) => item.id === 'gemini' && item.configured)
    ?? deckProviders[0]
  const effectiveProvider = deckProviders.some((item) => item.id === provider) ? provider : fallbackProvider?.id ?? provider
  const selectedProvider = deckProviders.find((item) => item.id === effectiveProvider)

  const handleGenerateDeck = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setDeckError('')
    setIsGenerating(true)
    try {
      const payload = await createAiDeckOutline({ provider: effectiveProvider, topic, audience, durationMinutes, slideCount })
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
      await downloadAiDeckPptx({ provider: effectiveProvider, topic, audience, durationMinutes, slideCount })
    } catch (error) {
      setDeckError(error instanceof Error ? error.message : 'Unable to generate PowerPoint.')
    } finally {
      setIsDownloadingPptx(false)
    }
  }

  const handleGenerateContentPackage = async () => {
    setDeckError('')
    setIsGeneratingPackage(true)
    try {
      const payload = await createContentStudioPackage({
        provider: effectiveProvider,
        topic,
        audience,
        durationMinutes,
        deliveryMode: 'in-person',
        sourceArtifactIds: outline?.sourceArtifacts,
      })
      setContentPackage(payload.package)
    } catch (error) {
      setDeckError(error instanceof Error ? error.message : 'Unable to generate training package.')
    } finally {
      setIsGeneratingPackage(false)
    }
  }

  return (
    <main className="deck-page" aria-labelledby="deck-studio-title">
      <section className="deck-studio">
        <div className="deck-studio__hero">
          <p className="app-hero__label">AI deck generator</p>
          <h1 id="deck-studio-title">Training Deck Studio</h1>
          <p>
            Generate a source-grounded facilitator deck and export an editable PowerPoint using the PBIS and SOP artifacts.
            OpenAI GPT-5.5 is the premium default; Gemini remains available as the fast fallback.
          </p>
        </div>

        <div className="deck-studio__workspace">
          <div className="deck-studio__controls">
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
                <select value={effectiveProvider} onChange={(event) => setProvider(event.target.value as AiDeckProvider)}>
                  <option value="openai">OpenAI GPT-5.5</option>
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
                  <input min={10} max={180} type="number" value={durationMinutes} onChange={(event) => setDurationMinutes(Number(event.target.value))} />
                </label>
                <label>
                  Slides
                  <input min={4} max={14} type="number" value={slideCount} onChange={(event) => setSlideCount(Number(event.target.value))} />
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
                <button
                  className="button-secondary"
                  disabled={isGeneratingPackage || topic.length < 8}
                  onClick={handleGenerateContentPackage}
                  type="button"
                >
                  {isGeneratingPackage ? 'Building content package' : 'Generate full package'}
                </button>
              </div>
              {deckError ? <p role="alert">{deckError}</p> : null}
            </form>
          </div>

          <aside className="deck-studio__quality" aria-label="Deck quality system">
            <p className="app-hero__label">Output standard</p>
            <h2>Facilitator-ready, editable PowerPoint</h2>
            <div className="deck-studio__proof">
              <span>Source-linked evidence strip</span>
              <span>PBIS/SOP artifact grounding</span>
              <span>Editable infographic shapes</span>
              <span>Human review gate</span>
            </div>
          </aside>
        </div>

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
            <ol className="deck-outline__cards">
              {outline.slides.map((slide, index) => (
                <li data-layout={slide.layout} key={`${slide.title}-${index}`}>
                  <small>{slide.layout}</small>
                  <strong>{index + 1}. {slide.title}</strong>
                  <span>{slide.objective}</span>
                  <em>{slide.activityPrompt}</em>
                </li>
              ))}
            </ol>
            <div className="source-list">
              {outline.sourceArtifacts.map((artifact) => <span key={artifact}>{artifact}</span>)}
            </div>
          </section>
        ) : null}
        {contentPackage ? (
          <section className="content-package" aria-labelledby="content-package-title">
            <div>
              <p className="app-hero__label">{contentPackage.provider} · {contentPackage.model}</p>
              <h2 id="content-package-title">{contentPackage.title}</h2>
              <p>
                Full training package for {contentPackage.audience}: deck sections, knowledge checks, practice lab,
                facilitator notes, learner handout, and in-person/virtual delivery guidance.
              </p>
            </div>
            <div className="content-package__grid">
              <article>
                <h3>Objectives</h3>
                <ul>
                  {contentPackage.learningObjectives.map((objective) => <li key={objective}>{objective}</li>)}
                </ul>
              </article>
              <article>
                <h3>Knowledge checks</h3>
                <ol>
                  {contentPackage.knowledgeCheckQuestions.map((question) => (
                    <li key={question.question}>{question.question}</li>
                  ))}
                </ol>
              </article>
              <article>
                <h3>Practice lab</h3>
                <strong>{contentPackage.practiceActivity.title}</strong>
                <p>{contentPackage.practiceActivity.facilitatorPrompt}</p>
              </article>
              <article>
                <h3>Learner handout</h3>
                <p>{contentPackage.learnerHandout.summary}</p>
              </article>
            </div>
            <ol className="content-package__sections">
              {contentPackage.deckOutline.map((section) => (
                <li key={section.sectionTitle}>
                  <strong>{section.sectionTitle}</strong>
                  <span>{section.objective}</span>
                  <em>{section.activityPrompt}</em>
                </li>
              ))}
            </ol>
          </section>
        ) : null}
      </section>
    </main>
  )
}

function KnowledgeAssistantPanel({ sourceLibrary }: { sourceLibrary: SourceLibraryPayload | null }) {
  const [question, setQuestion] = useState('What happens if a Site Lead misses a session?')
  const [answer, setAnswer] = useState<Awaited<ReturnType<typeof askKnowledgeAssistant>> | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const handleAsk = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setError('')
    setLoading(true)
    try {
      setAnswer(await askKnowledgeAssistant(question))
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Unable to answer from the source library.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <main className="assistant-view" aria-labelledby="assistant-title">
      <header>
        <p className="app-hero__label">Source-grounded assistant</p>
        <h1 id="assistant-title">Ask the Training Library</h1>
        <p>
          Answers are restricted to the shared SOPs, PBIS decks, and knowledge-check material. If the source
          is weak, the assistant refuses instead of inventing policy.
        </p>
      </header>
      <form className="assistant-form" onSubmit={handleAsk}>
        <label>
          Question
          <textarea value={question} onChange={(event) => setQuestion(event.target.value)} />
        </label>
        <button disabled={loading || question.trim().length < 4} type="submit">
          {loading ? 'Checking sources' : 'Ask assistant'}
        </button>
      </form>
      {error ? <p role="alert">{error}</p> : null}
      {answer ? (
        <section className="assistant-answer" data-status={answer.status} aria-label="Assistant answer">
          <div>
            <strong>{answer.confidence}</strong>
            <p>{answer.answer}</p>
          </div>
          <div>
            <h2>Source basis</h2>
            {answer.sourceBasis.length ? (
              <ul>
                {answer.sourceBasis.map((source) => <li key={source}>{source}</li>)}
              </ul>
            ) : (
              <p>No approved source found.</p>
            )}
          </div>
          <small>{answer.coachingNote}</small>
        </section>
      ) : null}
      {sourceLibrary ? (
        <p className="assistant-footnote">
          Searching {sourceLibrary.artifacts.length} artifacts across {sourceLibrary.learningPaths.length} learning paths.
        </p>
      ) : null}
    </main>
  )
}

function TrainingSurveyPanel({ onSubmitSurvey }: { onSubmitSurvey: (score: number, notes: string) => Promise<void> }) {
  const [score, setScore] = useState(5)
  const [notes, setNotes] = useState('The module helped me practice before going onsite.')
  const [status, setStatus] = useState('')
  const [submitting, setSubmitting] = useState(false)

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setStatus('')
    setSubmitting(true)
    try {
      await onSubmitSurvey(score, notes)
      setStatus('Survey submitted. Thank you for helping improve weekly training delivery.')
    } catch (caught) {
      setStatus(caught instanceof Error ? caught.message : 'Unable to submit survey.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <form className="training-survey" onSubmit={handleSubmit} aria-label="Training survey">
      <h2>Training survey</h2>
      <label>
        Facilitator/session rating
        <input min={1} max={5} step={1} type="number" value={score} onChange={(event) => setScore(Number(event.target.value))} />
      </label>
      <label>
        Feedback for Program Pros
        <textarea value={notes} onChange={(event) => setNotes(event.target.value)} />
      </label>
      <button disabled={submitting || notes.trim().length < 3} type="submit">
        {submitting ? 'Submitting survey' : 'Submit survey'}
      </button>
      {status ? <p role="status">{status}</p> : null}
    </form>
  )
}

function SourceIntelligencePanel({
  isAdmin,
  sourceUsageSummary,
  sourceQaFlags,
}: {
  isAdmin: boolean
  sourceUsageSummary: SourceUsageSummaryPayload | null
  sourceQaFlags: SourceQaFlagsPayload | null
}) {
  const [query, setQuery] = useState('10:2 practice PBIS')
  const [searchResults, setSearchResults] = useState<SourceSearchPayload['results']>([])
  const [searchError, setSearchError] = useState('')
  const [searching, setSearching] = useState(false)

  if (!isAdmin || !sourceUsageSummary || !sourceQaFlags) return null

  const qaIssueCount =
    (sourceQaFlags.artifactsNotReferencedByModules?.length ?? 0) +
    (sourceQaFlags.modulesWithNoSourceRefs?.length ?? 0) +
    (sourceQaFlags.pathsWithNoModules?.length ?? 0) +
    (sourceQaFlags.sourceRefsWithoutLibraryArtifact?.length ?? 0)
  const sourceTotals = sourceUsageSummary.totals ?? { artifacts: 0, modules: 0, paths: 0, referencedArtifacts: 0, sourceRefs: 0 }

  const handleSearch = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setSearchError('')
    setSearching(true)
    try {
      setSearchResults((await searchSourceIntelligence(query)).results.slice(0, 5))
    } catch (caught) {
      setSearchError(caught instanceof Error ? caught.message : 'Unable to search source intelligence.')
    } finally {
      setSearching(false)
    }
  }

  return (
    <section className="source-intelligence" aria-labelledby="source-intelligence-title">
      <div>
        <p className="app-hero__label">Evidence map</p>
        <h2 id="source-intelligence-title">Artifact Coverage and Source Search</h2>
        <p>
          Every learning path, scenario, and generated deck can be traced back to the SOPs, PBIS decks,
          and knowledge check shared by Think Together.
        </p>
      </div>
      <div className="source-intelligence__metrics" aria-label="Source intelligence metrics">
        <span><strong>{sourceTotals.artifacts}</strong> artifacts loaded</span>
        <span><strong>{sourceTotals.sourceRefs}</strong> source references</span>
        <span><strong>{sourceTotals.modules}</strong> modules mapped</span>
        <span data-status={qaIssueCount ? 'warning' : 'ok'}><strong>{qaIssueCount}</strong> QA flags</span>
      </div>
      <form className="source-intelligence__search" onSubmit={handleSearch}>
        <label>
          Search approved sources
          <input value={query} onChange={(event) => setQuery(event.target.value)} />
        </label>
        <button disabled={searching || query.trim().length < 2} type="submit">
          {searching ? 'Searching' : 'Search evidence'}
        </button>
      </form>
      {searchError ? <p role="alert">{searchError}</p> : null}
      {searchResults.length ? (
        <div className="source-intelligence__results" aria-label="Source search results">
          {searchResults.map((result) => (
            <article key={`${result.type}-${result.id}-${result.locator}`}>
              <strong>{result.title}</strong>
              <span>{result.artifact.artifact} · {result.locator}</span>
              <p>{result.excerpt}</p>
            </article>
          ))}
        </div>
      ) : null}
    </section>
  )
}

function SourceLibraryPanel({ sourceLibrary }: { sourceLibrary: SourceLibraryPayload | null }) {
  if (!sourceLibrary) return null
  const artifacts = sourceLibrary.artifacts ?? []
  const learningPaths = sourceLibrary.learningPaths ?? []

  return (
    <section className="source-library" aria-labelledby="source-library-title">
      <div>
        <p className="app-hero__label">Shared artifacts</p>
        <h2 id="source-library-title">Source Library</h2>
        <p>{sourceLibrary.sourceLibraryVersion}</p>
      </div>
      <div className="source-library__grid">
        {artifacts.map((artifact) => (
          <article key={artifact.id}>
            <strong>{artifact.artifact}</strong>
            <span>{artifact.documentType}</span>
            <p>{artifact.title}</p>
          </article>
        ))}
      </div>
      <div className="source-library__paths">
        {learningPaths.map((path) => (
          <article key={path.id}>
            <strong>{path.title}</strong>
            <span>{path.moduleCount} modules · {path.audience}</span>
          </article>
        ))}
      </div>
    </section>
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
