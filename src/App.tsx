import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  BarChart3,
  BookOpen,
  BotMessageSquare,
  CalendarDays,
  Dumbbell,
  FileText,
  Map,
  Menu,
  Presentation,
  UserPlus,
  Users,
  X,
  type LucideIcon,
} from 'lucide-react'
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
  createContentDevelopmentRequest,
  createContentStudioPackage,
  createLearnerInvite,
  downloadAiDeckPptx,
  downloadAdminExport,
  getAdminDashboard,
  getAdminAuditEvents,
  getAdminCohorts,
  getAdminLearners,
  getAdminNotifications,
  getAdminSupervisorReport,
  getAiProviders,
  getContentStudioTemplates,
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
  updateContentDevelopmentRequestStatus,
  updateGeneratedTrainingPackageStatus,
  type AdminAuditEvent,
  type AdminCohort,
  type AdminDashboardPayload,
  type AdminLearner,
  type AiDeckOutline,
  type AiDeckProvider,
  type AiProviderStatus,
  type AuthUser,
  type ContentStudioPackage,
  type ContentStudioDeliveryMode,
  type ContentStudioTemplate,
  type LearningPathPayload,
  type LearnerProfile,
  type SourceLibraryPayload,
  type SourceQaFlagsPayload,
  type SourceSearchPayload,
  type SourceUsageSummaryPayload,
  type SupervisorReportPayload,
  type ProgressPayload,
  type ContentDevelopmentRequest,
  type ContentDevelopmentRequestInput,
  type GeneratedTrainingPackage,
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

type NavItem = {
  view: WorkspaceView
  label: string
  section: 'Learning' | 'Operations' | 'Planning'
  description: string
  Icon: LucideIcon
}

const navItems: NavItem[] = [
  { view: 'learner', label: 'Learn', section: 'Learning', description: 'Assigned path and checks', Icon: BookOpen },
  { view: 'practice', label: 'Practice', section: 'Learning', description: 'Official scenario coaching', Icon: Dumbbell },
  { view: 'assist', label: 'Ask AI', section: 'Learning', description: 'Source-grounded answers', Icon: BotMessageSquare },
  { view: 'reporting', label: 'Supervisor Center', section: 'Operations', description: 'Supervisor operations panel', Icon: BarChart3 },
  { view: 'users', label: 'Learners', section: 'Operations', description: 'Roster, import & assignment', Icon: Users },
  { view: 'cohorts', label: 'Cohorts', section: 'Operations', description: 'Sessions and assignments', Icon: CalendarDays },
  { view: 'deck', label: 'Curriculum Studio', section: 'Operations', description: 'Draft review & Slide Studio', Icon: Presentation },
  { view: 'plan', label: 'Roadmap', section: 'Planning', description: 'MVP and Phase 2 scope', Icon: Map },
]

const navSections: NavItem['section'][] = ['Learning', 'Operations', 'Planning']

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
  const [selectedScenarioId, setSelectedScenarioId] = useState('')
  const [loadError, setLoadError] = useState('')
  const [mobileNavOpen, setMobileNavOpen] = useState(false)
  const [workspaceTargetId, setWorkspaceTargetId] = useState<string | undefined>(undefined)
  const inviteToken = useMemo(() => new URLSearchParams(window.location.search).get('invite'), [])

  const refreshWorkspace = useCallback(async (currentUser: AuthUser) => {
    const [pathPayload, progressPayload, sourcePayload] = await Promise.all([getLearningPath(), getProgress(), getSourceLibrary()])
    setContent(pathPayload)
    setProgress(progressPayload)
    setSourceLibrary(sourcePayload)

    if (currentUser.role === 'admin') {
      const [
        dashboardPayload,
        supervisorReportPayload,
        learnersPayload,
        cohortsPayload,
        auditPayload,
        usagePayload,
        qaFlagsPayload,
      ] = await Promise.all([
        getAdminDashboard(),
        getAdminSupervisorReport(),
        getAdminLearners(),
        getAdminCohorts(),
        getAdminAuditEvents(),
        getSourceUsageSummary(),
        getSourceQaFlags(),
        getAdminNotifications(),
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
        setView(me.user.role === 'admin' ? 'reporting' : 'learner')
        await refreshWorkspace(me.user)
      } catch (caught) {
        setLoadError(caught instanceof Error ? caught.message : 'Unable to load workspace.')
      } finally {
        setLoading(false)
      }
    })()
  }, [refreshWorkspace])

  const learnerModules = useMemo(() => (content ? toLearnerModules(content) : []), [content])
  const coachScenarios = useMemo(() => (content ? toCoachScenarios(content) : []), [content])
  const coachScenario = useMemo(
    () => coachScenarios.find((scenario) => scenario.id === selectedScenarioId) ?? coachScenarios[0] ?? null,
    [coachScenarios, selectedScenarioId],
  )

  const visibleNavItems = user?.role === 'admin' ? navItems : navItems.filter((item) => !adminOnlyViews.includes(item.view))
  const activeViewItem = navItems.find((item) => item.view === view)
  const activeViewLabel = activeViewItem?.label ?? 'Workspace'
  const activeViewDescription = activeViewItem?.description ?? 'Training operations workspace'
  const activeSectionLabel = user?.role === 'admin'
    ? activeViewItem?.section ?? 'Workspace'
    : 'Program Induction PBIS'
  const showQuickActions = user?.role === 'admin' ? view === 'reporting' : view === 'learner'

  const handleLogin = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setAuthError('')
    setLoading(true)
    try {
      const auth = await login(authEmail, authPassword)
      const me = auth.user.role === 'learner' ? await getMe() : { user: auth.user }
      setUser(me.user)
      setLearner(me.user.role === 'learner' ? toLearnerIdentity(me.user, me.learner ?? undefined) : null)
      setView(me.user.role === 'admin' ? 'reporting' : 'learner')
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

  const handleCreateContentRequest = useCallback(async (input: ContentDevelopmentRequestInput) => {
    await createContentDevelopmentRequest(input)
    const [reportPayload, auditPayload] = await Promise.all([
      getAdminSupervisorReport(),
      getAdminAuditEvents(),
    ])
    setSupervisorReport(reportPayload)
    setAdminAuditEvents(auditPayload.events)
  }, [])

  const handleUpdateContentRequestStatus = useCallback(async (
    requestId: string,
    status: ContentDevelopmentRequest['status'],
    reviewNotes: string,
  ) => {
    await updateContentDevelopmentRequestStatus(requestId, status, reviewNotes)
    const [reportPayload, auditPayload] = await Promise.all([
      getAdminSupervisorReport(),
      getAdminAuditEvents(),
    ])
    setSupervisorReport(reportPayload)
    setAdminAuditEvents(auditPayload.events)
  }, [])

  const handleUpdateGeneratedPackageStatus = useCallback(async (
    packageId: string,
    status: GeneratedTrainingPackage['reviewStatus'],
    reviewNotes: string,
  ) => {
    await updateGeneratedTrainingPackageStatus(packageId, status, reviewNotes)
    const [reportPayload, auditPayload] = await Promise.all([
      getAdminSupervisorReport(),
      getAdminAuditEvents(),
    ])
    setSupervisorReport(reportPayload)
    setAdminAuditEvents(auditPayload.events)
  }, [])

  const handleWorkspaceNavigate = (nextView: WorkspaceView, targetId?: string) => {
    setView(adminOnlyViews.includes(nextView) && user?.role !== 'admin' ? 'learner' : nextView)
    setMobileNavOpen(false)
    setWorkspaceTargetId(targetId)
    if (!targetId) return

    window.setTimeout(() => {
      document.getElementById(targetId)?.scrollIntoView({ behavior: 'smooth', block: 'start' })
    }, 0)
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
    <div className="app-shell app-shell--workspace" data-nav-open={mobileNavOpen}>
      <header className="mobile-appbar">
        <div className="mobile-appbar__brand">
          <img src={thinkTogetherLogo} alt="" aria-hidden="true" />
          <span>Training Operations</span>
        </div>
        <button
          aria-controls="workspace-navigation"
          aria-expanded={mobileNavOpen}
          aria-label={mobileNavOpen ? 'Close navigation menu' : 'Open navigation menu'}
          className="mobile-appbar__menu"
          onClick={() => setMobileNavOpen((open) => !open)}
          type="button"
        >
          {mobileNavOpen ? <X aria-hidden="true" size={22} /> : <Menu aria-hidden="true" size={22} />}
        </button>
      </header>
      <button
        aria-label="Close navigation menu"
        className="app-sidebar__scrim"
        onClick={() => setMobileNavOpen(false)}
        type="button"
      />
      <aside className="app-sidebar" aria-label="Workspace navigation">
        <div className="app-sidebar__brand">
          <img className="app-sidebar__logo" src={thinkTogetherLogo} alt="" aria-hidden="true" />
          <div>
            <p>Think Together</p>
            <strong>Training Operations</strong>
          </div>
        </div>

        <nav className="app-sidebar__nav" id="workspace-navigation" aria-label="MVP workspace">
          {navSections.map((section) => {
            const sectionItems = visibleNavItems.filter((item) => item.section === section)
            if (!sectionItems.length) return null

            return (
              <div className="app-sidebar__nav-group" key={section}>
                <span className="app-sidebar__nav-label">{section}</span>
                {sectionItems.map((item) => {
                  const Icon = item.Icon
                  return (
                    <button
                      aria-label={item.label}
                      aria-current={view === item.view ? 'page' : undefined}
                      className="app-sidebar__nav-button"
                      data-active={view === item.view}
                      key={item.view}
                      onClick={() => handleWorkspaceNavigate(item.view)}
                      type="button"
                    >
                      <Icon aria-hidden="true" size={18} strokeWidth={2.3} />
                      <span>
                        <strong>{item.label}</strong>
                        <small>{item.description}</small>
                      </span>
                    </button>
                  )
                })}
              </div>
            )
          })}
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
            <p className="app-hero__label">{activeSectionLabel}</p>
            <h1>{activeViewLabel}</h1>
            <span>{activeViewDescription}</span>
          </div>
          <div className="workspace-topbar__meta" aria-label="Training scope">
            <span>{content.modules.length} modules</span>
            <span>{content.scenarios.length} scenarios</span>
          </div>
        </header>
        {showQuickActions ? (
          <WorkspaceQuickActions
            activeView={view}
            isAdmin={user.role === 'admin'}
            onNavigate={handleWorkspaceNavigate}
          />
        ) : null}

        <div className="workspace-body">
          <div className="app-content">
            <WorkspaceHelper view={view} isAdmin={user.role === 'admin'} />
            {renderView({
             view,
             learnerModules,
             coachScenario,
             coachScenarios,
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
             targetId: workspaceTargetId,
             onCreateContentRequest: handleCreateContentRequest,
             onUpdateContentRequestStatus: handleUpdateContentRequestStatus,
             onUpdateGeneratedPackageStatus: handleUpdateGeneratedPackageStatus,
             onSelectScenario: setSelectedScenarioId,
            onNextScenario: () => {
              setSelectedScenarioId((currentId) => {
                const currentIndex = coachScenarios.findIndex((scenario) => scenario.id === currentId)
                const nextIndex = currentIndex < 0 ? 1 % coachScenarios.length : (currentIndex + 1) % coachScenarios.length
                return coachScenarios[nextIndex]?.id ?? currentId
              })
            },
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
            }
            })}
          </div>
        </div>
      </main>
    </div>
  )
}

function renderView({
  view,
  learnerModules,
  coachScenario,
  coachScenarios,
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
  onSelectScenario,
  onNextScenario,
  onCompleteModule,
  onAnswerKnowledgeCheck,
  onCreateLearner,
  onCreateCohort,
  onCreateLearnerInvite,
  onRevokeLearnerInvite,
  onDownloadExport,
  onSubmitSurvey,
  targetId,
  onCreateContentRequest,
  onUpdateContentRequestStatus,
  onUpdateGeneratedPackageStatus,
}: {
  view: WorkspaceView
  learnerModules: LearnerModule[]
  coachScenario: CoachScenario
  coachScenarios: CoachScenario[]
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
  onSelectScenario: (scenarioId: string) => void
  onNextScenario: () => void
  onCompleteModule: (moduleId: string) => Promise<void>
  onAnswerKnowledgeCheck: (moduleId: string, answer: string) => Promise<void>
  onCreateLearner: Parameters<typeof AdminDashboard>[0]['onCreateLearner']
  onCreateCohort: Parameters<typeof AdminDashboard>[0]['onCreateCohort']
  onCreateLearnerInvite: Parameters<typeof AdminDashboard>[0]['onCreateLearnerInvite']
  onRevokeLearnerInvite: Parameters<typeof AdminDashboard>[0]['onRevokeLearnerInvite']
  onDownloadExport: Parameters<typeof AdminDashboard>[0]['onDownloadExport']
  onSubmitSurvey: (score: number, notes: string) => Promise<void>
  targetId?: string
  onCreateContentRequest: Parameters<typeof CurriculumStudio>[0]['onCreateContentRequest']
  onUpdateContentRequestStatus: Parameters<typeof CurriculumStudio>[0]['onUpdateContentRequestStatus']
  onUpdateGeneratedPackageStatus: Parameters<typeof CurriculumStudio>[0]['onUpdateGeneratedPackageStatus']
}) {
  if (view === 'practice') {
    return (
      <ScenarioCoach
        scenario={coachScenario}
        scenarios={coachScenarios}
        onSelectScenario={onSelectScenario}
        onNextScenario={onNextScenario}
        onScoreScenario={scoreScenario}
      />
    )
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
        targetId={targetId}
      />
    )
  }

  if (view === 'deck' && isAdmin) {
    return (
      <CurriculumStudio
        supervisorReport={supervisorReport}
        onCreateContentRequest={onCreateContentRequest}
        onUpdateContentRequestStatus={onUpdateContentRequestStatus}
        onUpdateGeneratedPackageStatus={onUpdateGeneratedPackageStatus}
      />
    )
  }

  if (view === 'reporting' && isAdmin) {
    return (
      <SupervisorReportingPanel
        dashboard={dashboard}
        supervisorReport={supervisorReport}
      />
    )
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

function WorkspaceQuickActions({
  activeView,
  isAdmin,
  onNavigate,
}: {
  activeView: WorkspaceView
  isAdmin: boolean
  onNavigate: (view: WorkspaceView, targetId?: string) => void
}) {
  const actions: Array<{ view: WorkspaceView; label: string; detail: string; Icon: LucideIcon; targetId?: string }> = isAdmin
    ? [
        { view: 'users', label: 'Invite learner', detail: 'Add one person or copy invite link', Icon: UserPlus },
        { view: 'deck', label: 'Create training package', detail: 'Generate deck, check, practice, and handout', Icon: Presentation },
        {
          view: 'reporting',
          label: 'Supervisor digest',
          detail: 'Review follow-ups and export CSV',
          Icon: FileText,
          targetId: 'supervisor-actions-title',
        },
      ]
    : [
        { view: 'learner', label: 'Continue path', detail: 'Complete assigned modules', Icon: BookOpen },
        { view: 'practice', label: 'Practice scenario', detail: 'Get coaching feedback', Icon: Dumbbell },
        { view: 'assist', label: 'Ask AI', detail: 'Use Think Together sources', Icon: BotMessageSquare },
      ]

  return (
    <section className="workspace-actions" aria-label="Recommended actions">
      <div>
        <p className="app-hero__label">{isAdmin ? 'Quick launch' : 'Next steps'}</p>
        <strong>{isAdmin ? 'Choose the job you need to do' : 'Your learner workflow'}</strong>
      </div>
      <div className="workspace-actions__list">
        {actions.map((action) => {
          const Icon = action.Icon
          return (
            <button
              aria-label={action.label}
              className="workspace-actions__button"
              data-active={activeView === action.view}
              key={`${action.view}-${action.label}`}
              onClick={() => onNavigate(action.view, action.targetId)}
              type="button"
            >
              <Icon aria-hidden="true" size={18} strokeWidth={2.4} />
              <span>
                <strong>{action.label}</strong>
                <small>{action.detail}</small>
              </span>
            </button>
          )
        })}
      </div>
    </section>
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
      title: 'Use Reporting to answer the client’s biggest operations questions.',
      body: 'Start with roster preview, then review supervisor follow-ups, content requests, and exports from one place.',
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
}function SupervisorReportingPanel({
  dashboard,
  supervisorReport,
}: {
  dashboard: AdminDashboardPayload | null
  supervisorReport: SupervisorReportPayload | null
}) {
  const [selectedGroupId, setSelectedGroupId] = useState('')

  const supervisorGroups = supervisorReport?.groups?.supervisors ?? []
  const facilitatorGroups = supervisorReport?.groups?.facilitators ?? []
  const cohortGroups = supervisorReport?.groups?.cohorts ?? []
  const drilldownGroups = [...supervisorGroups, ...facilitatorGroups, ...cohortGroups]
  const selectedGroup = drilldownGroups.find((group) => group.id === selectedGroupId) ?? drilldownGroups[0]
  const actionQueue = supervisorReport?.actionQueue ?? []
  const rolloutForecast = supervisorReport?.rolloutForecast
  const notificationQueue = supervisorReport?.notificationQueue ?? []
  const integrationReadiness = supervisorReport?.integrationReadiness ?? []
  const supervisorImpactCards = [
    {
      label: 'Supervisor visibility',
      value: `${drilldownGroups.length} groups`,
      body: 'Review learner progress, scores, and next actions by supervisor, facilitator, or cohort.',
    },
    {
      label: 'Completion follow-up',
      value: `${notificationQueue.length} notices`,
      body: 'Queue completion, coaching, and make-up notifications instead of manually chasing status.',
    },
    {
      label: 'Weekly hiring scale',
      value: rolloutForecast ? `${rolloutForecast.weeklyNewHires} hires/wk` : 'Ready',
      body: 'Preview auto-assignment rules for new hires before invites are sent.',
    },
    {
      label: 'System integration',
      value: `${integrationReadiness.filter((item) => item.status === 'ready').length}/${integrationReadiness.length || 0} ready`,
      body: 'Keep HR, LMS, email, and content-library handoffs visible before production writeback.',
    },
  ]

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

          <section className="reporting-view__impact" aria-labelledby="reporting-impact-title">
            <div className="reporting-view__section-heading">
              <div>
                <p className="app-hero__label">Client feedback covered</p>
                <h2 id="reporting-impact-title">What a supervisor can do from here</h2>
              </div>
              <span>Demo-ready</span>
            </div>
            <div className="reporting-view__impact-grid">
              {supervisorImpactCards.map((item) => (
                <article key={item.label}>
                  <small>{item.label}</small>
                  <strong>{item.value}</strong>
                  <p>{item.body}</p>
                </article>
              ))}
            </div>
          </section>

          <section className="reporting-view__table" aria-labelledby="supervisor-actions-title">
            <div className="reporting-view__section-heading">
              <div>
                <p className="app-hero__label">Supervisor digest</p>
                <h2 id="supervisor-actions-title">Action queue</h2>
              </div>
              <span>{actionQueue.length} queued</span>
            </div>
            {actionQueue.length ? (
              <table className="reporting-table reporting-table--actions">
                <thead>
                  <tr>
                    <th>Action</th>
                    <th>Learner</th>
                    <th>Owner</th>
                    <th>Priority</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {actionQueue.map((item) => (
                    <tr key={item.id}>
                      <td data-label="Action">
                        <strong>{item.title}</strong>
                        <small>{item.detail}</small>
                      </td>
                      <td data-label="Learner">{item.learnerName}</td>
                      <td data-label="Owner">{item.owner}</td>
                      <td data-label="Priority"><span className="reporting-chip" data-priority={item.priority}>{item.priority}</span></td>
                      <td data-label="Status">{item.status}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : (
              <p>No supervisor actions are queued. Completed learners, LMS exports, and coaching nudges will appear here.</p>
            )}
          </section>

          {supervisorGroups.length || facilitatorGroups.length ? (
            <section className="reporting-view__table" aria-labelledby="supervisor-groups-title">
              <div className="reporting-view__section-heading">
                <div>
                  <p className="app-hero__label">Drilldown</p>
                  <h2 id="supervisor-groups-title">Supervisor, cohort, and facilitator detail</h2>
                </div>
                {selectedGroup ? <span>{selectedGroup.learnerCount} learners</span> : null}
              </div>
              <label className="reporting-view__group-select">
                Review group
                <select value={selectedGroup?.id ?? ''} onChange={(event) => setSelectedGroupId(event.target.value)}>
                  {drilldownGroups.map((group) => (
                    <option key={group.id} value={group.id}>
                      {group.label} · {group.learnerCount} learners · {group.averageProgressPercent}% avg
                    </option>
                  ))}
                </select>
              </label>
              <table className="reporting-table reporting-table--groups">
                <thead>
                  <tr>
                    <th>Learner</th>
                    <th>Path</th>
                    <th>Progress</th>
                    <th>Score</th>
                    <th>Next action</th>
                  </tr>
                </thead>
                <tbody>
                  {(selectedGroup?.learners ?? []).map((learnerItem) => (
                    <tr key={`${selectedGroup?.id}-${learnerItem.id}-${learnerItem.path.id}`}>
                      <td data-label="Learner">
                        <strong>{learnerItem.name}</strong>
                        <small>{learnerItem.email}</small>
                        <small>{learnerItem.cohort.name} · {learnerItem.site ?? 'Site pending'}</small>
                      </td>
                      <td data-label="Path">{learnerItem.path.title}</td>
                      <td data-label="Progress">{learnerItem.progressPercent}%</td>
                      <td data-label="Score">{learnerItem.scores.completionScore}%</td>
                      <td data-label="Next action">{supervisorNextAction(learnerItem)}</td>
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

function supervisorNextAction(learner: SupervisorReportPayload['groups']['supervisors'][number]['learners'][number]) {
  if (learner.completion.status === 'completed' && !learner.completion.exportedToLms) {
    return 'Review LMS export and send completion notice'
  }
  if (learner.completion.status === 'completed') {
    return 'Include in next supervisor digest'
  }
  if (learner.progressPercent >= 50) {
    return 'Send coaching nudge before final check'
  }
  if (learner.practiceSubmissions > 0) {
    return 'Review practice evidence for makeup support'
  }
  return 'Monitor invite and first module start'
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

function toCoachScenarios(payload: LearningPathPayload): CoachScenario[] {
  return payload.scenarios.map((scenario) => ({
    id: scenario.id,
    title: scenario.title,
    brief: scenario.prompt,
    skillFocus: scenario.skillFocus,
    expectedAnchors: scenario.expectedResponseElements,
    sourceRefs: scenario.sourceRefs,
  }))
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


function nextContentRequestStatus(status: ContentDevelopmentRequest['status']): ContentDevelopmentRequest['status'] | null {
  switch (status) {
    case 'source-mapped':
      return 'draft-ready'
    case 'draft-ready':
      return 'review-needed'
    case 'review-needed':
      return 'approved'
    case 'approved':
      return 'published'
    default:
      return null
  }
}

function nextContentRequestActionLabel(status: ContentDevelopmentRequest['status']): string {
  switch (status) {
    case 'source-mapped':
      return 'Advance to draft ready'
    case 'draft-ready':
      return 'Send to review'
    case 'review-needed':
      return 'Approve request'
    case 'approved':
      return 'Publish request'
    default:
      return 'Advance status'
  }
}

function contentRequestNextNote(status: ContentDevelopmentRequest['status']): string {
  return `Advanced to ${status.replace(/-/g, ' ')}.`
}

function nextGeneratedPackageStatus(status: GeneratedTrainingPackage['reviewStatus']): GeneratedTrainingPackage['reviewStatus'] | null {
  switch (status) {
    case 'draft':
      return 'review-needed'
    case 'review-needed':
      return 'approved'
    case 'approved':
      return 'published'
    default:
      return null
  }
}

function nextGeneratedPackageActionLabel(status: GeneratedTrainingPackage['reviewStatus']): string {
  switch (status) {
    case 'draft':
      return 'Send to review'
    case 'review-needed':
      return 'Approve package'
    case 'approved':
      return 'Publish package'
    default:
      return 'Advance draft status'
  }
}

function generatedPackageNextNote(status: GeneratedTrainingPackage['reviewStatus']): string {
  return `Advanced draft to ${status.replace(/-/g, ' ')}.`
}

function splitListInput(inputString: string): string[] {
  return inputString
    .split(/[;,]/)
    .map((item) => item.trim())
    .filter(Boolean)
}

function CurriculumStudio({
  supervisorReport,
  onCreateContentRequest,
  onUpdateContentRequestStatus,
  onUpdateGeneratedPackageStatus,
}: {
  supervisorReport: SupervisorReportPayload | null
  onCreateContentRequest: (input: ContentDevelopmentRequestInput) => Promise<void>
  onUpdateContentRequestStatus: (
    requestId: string,
    status: ContentDevelopmentRequest['status'],
    reviewNotes: string,
  ) => Promise<void>
  onUpdateGeneratedPackageStatus: (
    packageId: string,
    status: GeneratedTrainingPackage['reviewStatus'],
    reviewNotes: string,
  ) => Promise<void>
}) {
  const [activeTab, setActiveTab] = useState<'slide' | 'intake' | 'drafts'>('slide')

  // --- Slide Studio States (original DeckStudio) ---
  const [providers, setProviders] = useState<AiProviderStatus[]>([])
  const [templates, setTemplates] = useState<ContentStudioTemplate[]>([])
  const [provider, setProvider] = useState<AiDeckProvider>('openai')
  const [selectedTemplateId, setSelectedTemplateId] = useState('core-in-person-training')
  const [topic, setTopic] = useState('Effective lesson delivery with 10:2 practice')
  const [audience, setAudience] = useState('Think Together program leaders')
  const [durationMinutes, setDurationMinutes] = useState(45)
  const [slideCount, setSlideCount] = useState(6)
  const [deliveryMode, setDeliveryMode] = useState<ContentStudioDeliveryMode>('in-person')
  const [outline, setOutline] = useState<AiDeckOutline | null>(null)
  const [contentPackage, setContentPackage] = useState<ContentStudioPackage | null>(null)
  const [isGenerating, setIsGenerating] = useState(false)
  const [isDownloadingPptx, setIsDownloadingPptx] = useState(false)
  const [isGeneratingPackage, setIsGeneratingPackage] = useState(false)
  const [deckError, setDeckError] = useState('')

  // --- Intake Pipeline & AI Drafts States ---
  const [contentRequestForm, setContentRequestForm] = useState({
    request: 'Behavior management for high-energy transitions',
    audience: 'Program staff and site leaders',
    deliveryMode: 'hybrid' as ContentStudioDeliveryMode,
    artifactsNeeded: 'PBIS PPT Master; PBIS part 3 template; Knowledge check sample',
    outputs: 'Facilitator deck; Knowledge check; Practice scenarios; Learner handout',
    reviewOwner: 'Program Training & Development',
    reviewNotes: 'Needs source map and human review before pilot.',
  })
  const [contentRequestSaving, setContentRequestSaving] = useState(false)
  const [contentRequestError, setContentRequestError] = useState('')
  const [packageGeneratingId, setPackageGeneratingId] = useState('')
  const [packageReviewSavingId, setPackageReviewSavingId] = useState('')
  const [selectedPackageId, setSelectedPackageId] = useState<string | null>(null)

  const contentRequests = supervisorReport?.contentDevelopmentRequests ?? []
  const generatedPackages = supervisorReport?.generatedTrainingPackages ?? []
  const selectedPackage = generatedPackages.find((pkg) => pkg.id === selectedPackageId) || generatedPackages[0]
  const pipelineStats = [
    { label: 'Requests', value: contentRequests.length, detail: 'training needs captured' },
    { label: 'AI drafts', value: generatedPackages.length, detail: 'packages in review' },
    {
      label: 'Review gates',
      value: generatedPackages.filter((item) => item.reviewStatus === 'review-needed').length,
      detail: 'waiting for human approval',
    },
    {
      label: 'Published',
      value: generatedPackages.filter((item) => item.reviewStatus === 'published').length,
      detail: 'ready for rollout',
    },
  ]

  const deckProviders = useMemo(
    () => providers.filter((item): item is AiProviderStatus & { id: AiDeckProvider } =>
      item.id === 'openai' || item.id === 'gemini' || item.id === 'claude'),
    [providers],
  )

  useEffect(() => {
    void Promise.all([getAiProviders(), getContentStudioTemplates()])
      .then(([providerPayload, templatePayload]) => {
        setProviders(providerPayload.providers)
        setTemplates(templatePayload.templates)
        if (templatePayload.templates.length > 0) {
          setSelectedTemplateId(templatePayload.templates[0].id)
        }
      })
      .catch((error) => setDeckError(error instanceof Error ? error.message : 'Unable to load AI providers.'))
  }, [])

  const fallbackProvider = deckProviders.find((item) => item.id === 'openai' && item.configured)
    ?? deckProviders.find((item) => item.id === 'gemini' && item.configured)
    ?? deckProviders[0]
  const effectiveProvider = deckProviders.some((item) => item.id === provider) ? provider : fallbackProvider?.id ?? provider
  const selectedTemplate = templates.find((template) => template.id === selectedTemplateId)

  const applyTemplate = (template: ContentStudioTemplate) => {
    setSelectedTemplateId(template.id)
    setTopic(template.topicStarter)
    setAudience(template.audience)
    setDurationMinutes(template.durationMinutes)
    setDeliveryMode(template.deliveryMode)
    setContentPackage(null)
  }

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
        templateId: selectedTemplate?.id ?? selectedTemplateId,
        topic,
        audience,
        durationMinutes,
        deliveryMode,
        sourceArtifactIds: outline?.sourceArtifacts ?? selectedTemplate?.sourceArtifactIds,
      })
      setContentPackage(payload.package)
    } catch (error) {
      setDeckError(error instanceof Error ? error.message : 'Unable to generate training package.')
    } finally {
      setIsGeneratingPackage(false)
    }
  }

  // --- Intake Pipeline Handlers ---
  const handleContentRequestSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setContentRequestSaving(true)
    setContentRequestError('')
    try {
      await onCreateContentRequest({
        request: contentRequestForm.request,
        audience: contentRequestForm.audience,
        deliveryMode: contentRequestForm.deliveryMode,
        artifactsNeeded: splitListInput(contentRequestForm.artifactsNeeded),
        outputs: splitListInput(contentRequestForm.outputs),
        reviewOwner: contentRequestForm.reviewOwner,
        reviewNotes: contentRequestForm.reviewNotes,
      })
      setContentRequestForm((current) => ({
        ...current,
        request: '',
        reviewNotes: '',
      }))
    } catch (error) {
      setContentRequestError(error instanceof Error ? error.message : 'Unable to add content request')
    } finally {
      setContentRequestSaving(false)
    }
  }

  const advanceContentRequest = async (item: ContentDevelopmentRequest) => {
    const nextStatus = nextContentRequestStatus(item.status)
    if (!nextStatus) return
    const note = contentRequestNextNote(nextStatus)
    setContentRequestSaving(true)
    setContentRequestError('')
    try {
      await onUpdateContentRequestStatus(item.id, nextStatus, note)
    } catch (error) {
      setContentRequestError(error instanceof Error ? error.message : 'Unable to update content request')
    } finally {
      setContentRequestSaving(false)
    }
  }

  const generatePackageForRequest = async (item: ContentDevelopmentRequest) => {
    setPackageGeneratingId(item.id)
    setContentRequestError('')
    try {
      const templateId = item.deliveryMode === 'virtual'
        ? 'virtual-makeup-path'
        : item.request.toLowerCase().includes('template')
          ? 'trainer-template-system'
          : 'core-in-person-training'
      await createContentStudioPackage({
        provider: 'openai',
        contentRequestId: item.id,
        templateId,
        topic: item.request,
        audience: item.audience,
        durationMinutes: item.deliveryMode === 'virtual' ? 35 : 45,
        deliveryMode: item.deliveryMode,
        sourceArtifactIds: item.artifactsNeeded,
      })
      await onUpdateContentRequestStatus(item.id, 'draft-ready', `AI training package generated for review from request ${item.id}.`)
    } catch (error) {
      setContentRequestError(error instanceof Error ? error.message : 'Unable to generate training package')
    } finally {
      setPackageGeneratingId('')
    }
  }

  // --- AI Drafts Handlers ---
  const advanceGeneratedPackage = async (item: GeneratedTrainingPackage) => {
    const nextStatus = nextGeneratedPackageStatus(item.reviewStatus)
    if (!nextStatus) return
    setPackageReviewSavingId(item.id)
    setContentRequestError('')
    try {
      await onUpdateGeneratedPackageStatus(item.id, nextStatus, generatedPackageNextNote(nextStatus))
    } catch (error) {
      setContentRequestError(error instanceof Error ? error.message : 'Unable to update generated package')
    } finally {
      setPackageReviewSavingId('')
    }
  }

  return (
    <main className="deck-page" aria-labelledby="deck-studio-title">
      <section className="deck-studio">
        <div className="deck-studio__hero">
          <p className="app-hero__label">Consolidated Curriculum workspace</p>
          <h1 id="deck-studio-title">Curriculum Studio</h1>
          <p>
            Unified suite to manually draft slides, request content deliveries through the intake pipeline, and review generated AI drafts with the detail inspector.
          </p>
        </div>

        <section className="curriculum-command-center" aria-label="Curriculum Studio command center">
          <div>
            <p className="app-hero__label">Training team workflow</p>
            <h2>Turn weekly requests into standardized training packages</h2>
            <p>
              Intake captures the need, source mapping keeps it grounded in approved artifacts, AI creates the first draft,
              and human review controls what gets published.
            </p>
          </div>
          <div className="curriculum-command-center__stats">
            {pipelineStats.map((item) => (
              <span key={item.label}>
                <strong>{item.value}</strong>
                {item.label}
                <small>{item.detail}</small>
              </span>
            ))}
          </div>
        </section>

        <ol className="curriculum-workflow" aria-label="Curriculum development workflow">
          <li data-active={activeTab === 'intake'}>
            <strong>1. Capture request</strong>
            <span>Behavior management, virtual make-up, or site-specific training need.</span>
          </li>
          <li data-active={activeTab === 'slide'}>
            <strong>2. Draft package</strong>
            <span>Generate editable deck, checks, practice lab, handout, and facilitator notes.</span>
          </li>
          <li data-active={activeTab === 'drafts'}>
            <strong>3. Review gate</strong>
            <span>Approve, reject, or publish only after source and training-owner review.</span>
          </li>
        </ol>

        <nav className="curriculum-tabs" aria-label="Curriculum Studio Sections" style={{ display: 'flex', gap: '0.5rem', marginBottom: '1.5rem', borderBottom: '2px solid var(--tt-line)', paddingBottom: '0.25rem' }}>
          <button
            className="curriculum-tabs__button"
            data-active={activeTab === 'slide'}
            onClick={() => setActiveTab('slide')}
            type="button"
          >
            Slide Studio
          </button>
          <button
            className="curriculum-tabs__button"
            data-active={activeTab === 'intake'}
            onClick={() => setActiveTab('intake')}
            type="button"
          >
            Intake Pipeline
          </button>
          <button
            className="curriculum-tabs__button"
            data-active={activeTab === 'drafts'}
            onClick={() => setActiveTab('drafts')}
            type="button"
          >
            AI Drafts
          </button>
        </nav>

        {activeTab === 'slide' && (
          <>
            <div className="deck-studio__workspace">
              <div className="deck-studio__controls">
                <h2>Provider details</h2>
                <div className="provider-strip" aria-label="AI Providers">
                  {deckProviders.map((item) => (
                    <span key={item.id} data-configured={item.configured}>
                      {item.label} {item.configured ? '✓' : '(not configured)'}
                    </span>
                  ))}
                </div>
                <form className="deck-form" onSubmit={handleGenerateDeck}>
                  <label>
                    AI Model Provider
                    <select
                      value={effectiveProvider}
                      onChange={(event) => setProvider(event.target.value as AiDeckProvider)}
                    >
                      {deckProviders.map((item) => (
                        <option key={item.id} value={item.id} disabled={!item.configured}>
                          {item.label} {item.configured ? '' : '(not configured)'}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label>
                    Template
                    <select
                      value={selectedTemplateId}
                      onChange={(event) => setSelectedTemplateId(event.target.value)}
                    >
                      {templates.map((template) => (
                        <option key={template.id} value={template.id}>
                          {template.name} ({template.deliveryMode})
                        </option>
                      ))}
                    </select>
                  </label>
                  <label>
                    Topic Starter
                    <input value={topic} onChange={(event) => setTopic(event.target.value)} required />
                  </label>
                  <label>
                    Target Audience
                    <input value={audience} onChange={(event) => setAudience(event.target.value)} required />
                  </label>
                  <div className="deck-form__row">
                    <label>
                      Duration (minutes)
                      <input
                        type="number"
                        value={durationMinutes}
                        onChange={(event) => setDurationMinutes(Number(event.target.value))}
                        required
                      />
                    </label>
                    <label>
                      Slide count
                      <input
                        type="number"
                        value={slideCount}
                        onChange={(event) => setSlideCount(Number(event.target.value))}
                        required
                      />
                    </label>
                  </div>
                  <label>
                    Delivery Mode
                    <select
                      value={deliveryMode}
                      onChange={(event) => setDeliveryMode(event.target.value as ContentStudioDeliveryMode)}
                    >
                      <option value="in-person">In-person</option>
                      <option value="virtual">Virtual</option>
                      <option value="hybrid">Hybrid</option>
                    </select>
                  </label>
                  <div className="deck-form__actions">
                    <button type="submit" disabled={isGenerating}>
                      {isGenerating ? 'Generating outline...' : 'Generate preview'}
                    </button>
                    <button
                      type="button"
                      className="button-secondary"
                      disabled={isDownloadingPptx}
                      onClick={() => void handleDownloadPptx()}
                    >
                      {isDownloadingPptx ? 'Exporting...' : 'Download PowerPoint'}
                    </button>
                    {outline ? (
                      <button
                        type="button"
                        className="button-secondary"
                        disabled={isGeneratingPackage}
                        onClick={() => void handleGenerateContentPackage()}
                      >
                        {isGeneratingPackage ? 'Creating package...' : 'Generate full package'}
                      </button>
                    ) : null}
                  </div>
                  {deckError ? <p role="alert" className="deck-form__hint" style={{ color: 'var(--tt-orange)', fontWeight: 800 }}>{deckError}</p> : null}
                </form>
              </div>

              <div className="deck-studio__quality">
                <h2>Standard Quality Checklist</h2>
                <div className="deck-studio__proof">
                  <span>Facilitator-ready, editable PowerPoint</span>
                  <span>Objectives mapped to certified SOP references</span>
                  <span>10:2 interactive learner practice routine</span>
                  <span>Three knowledge checks with clear rationales</span>
                </div>
                <div className="deck-studio__workflow" aria-label="Deck outline workflow steps">
                  <span><strong>1</strong> Request</span>
                  <span><strong>2</strong> Source-map</span>
                  <span><strong>3</strong> Draft</span>
                  <span><strong>4</strong> Review</span>
                </div>
                {selectedTemplate ? (
                  <div className="template-detail" aria-labelledby="template-detail-title" style={{ marginTop: '1rem' }}>
                    <strong id="template-detail-title">{selectedTemplate.name}</strong>
                    <span>{selectedTemplate.description}</span>
                    <span>Best for: {selectedTemplate.bestFor}</span>
                    <ol>
                      <li>
                        <b>Audience:</b>
                        <span>{selectedTemplate.audience}</span>
                      </li>
                      <li>
                        <b>Duration:</b>
                        <span>{selectedTemplate.durationMinutes} min</span>
                      </li>
                      <li>
                        <b>Outputs:</b>
                        <span>{selectedTemplate.requiredOutputs.join(', ')}</span>
                      </li>
                    </ol>
                  </div>
                ) : null}
                <div className="content-starters">
                  <h2>Quick templates starters</h2>
                  <div className="content-starters__grid">
                    {templates.map((template) => (
                      <button
                        key={template.id}
                        type="button"
                        aria-pressed={selectedTemplateId === template.id}
                        onClick={() => applyTemplate(template)}
                      >
                        <strong>{template.name}</strong>
                        <span>{template.description}</span>
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </div>

            {outline ? (
              <section className="deck-outline" aria-labelledby="deck-outline-title" style={{ marginTop: '1.5rem' }}>
                <div>
                  <p className="app-hero__label">AI draft preview</p>
                  <h2 id="deck-outline-title">{outline.title}</h2>
                  <p>Review the generated structure, objectives, and talking points before exporting to PPTX.</p>
                </div>
                <div className="deck-outline__rail">
                  <span>{outline.provider} provider</span>
                  <span>{outline.slides.length} slides</span>
                  <span>{outline.durationMinutes} minutes</span>
                </div>
                <ol className="deck-outline__cards">
                  {outline.slides.map((slide, index) => (
                    <li key={index}>
                      <small>Slide {index + 1}</small>
                      <strong>{slide.title}</strong>
                      <em>Objective: {slide.objective}</em>
                      <em>Activity: {slide.activityPrompt}</em>
                      <em>Talking points: {slide.talkingPoints.join(' · ')}</em>
                      <em>Trainer note: {slide.facilitatorNotes}</em>
                      <div className="source-list">
                        {slide.sourceRefs.map((ref) => (
                          <span key={`${ref.artifact}-${ref.locator}`}>
                            {ref.artifact} · {ref.locator}
                          </span>
                        ))}
                      </div>
                    </li>
                  ))}
                </ol>
              </section>
            ) : null}

            {contentPackage ? (
              <section className="content-package" aria-labelledby="content-package-title" style={{ marginTop: '1.5rem' }}>
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
                    <h3>Template QA</h3>
                    <strong>{contentPackage.template.name}</strong>
                    <ul>
                      {contentPackage.template.reviewChecklist.map((item) => <li key={item}>{item}</li>)}
                    </ul>
                  </article>
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
          </>
        )}

        {activeTab === 'intake' && (
          <div className="deck-studio__workspace">
            <div className="deck-studio__controls">
              <h2 id="content-request-pipeline-title">Content request pipeline</h2>
              <p>Form to request new training courses. Standardized intake creates trackable, source-grounded packages.</p>
              <form className="content-request-form" onSubmit={handleContentRequestSubmit}>
                <label>
                  Request Description
                  <input
                    value={contentRequestForm.request}
                    onChange={(event) => setContentRequestForm((current) => ({ ...current, request: event.target.value }))}
                    placeholder="E.g. PBIS support for high-energy playground sessions"
                    required
                  />
                </label>
                <div className="content-request-form__row" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem', marginTop: '0.5rem' }}>
                  <label>
                    Target Audience
                    <input
                      value={contentRequestForm.audience}
                      onChange={(event) => setContentRequestForm((current) => ({ ...current, audience: event.target.value }))}
                      required
                    />
                  </label>
                  <label>
                    Delivery Mode
                    <select
                      value={contentRequestForm.deliveryMode}
                      onChange={(event) =>
                        setContentRequestForm((current) => ({
                          ...current,
                          deliveryMode: event.target.value as ContentStudioDeliveryMode,
                        }))
                      }
                    >
                      <option value="hybrid">Hybrid</option>
                      <option value="in-person">In-person</option>
                      <option value="virtual">Virtual</option>
                    </select>
                  </label>
                </div>
                <label style={{ display: 'block', marginTop: '0.5rem' }}>
                  Source Artifacts Needed (semicolon separated)
                  <input
                    value={contentRequestForm.artifactsNeeded}
                    onChange={(event) => setContentRequestForm((current) => ({ ...current, artifactsNeeded: event.target.value }))}
                    required
                  />
                </label>
                <label style={{ display: 'block', marginTop: '0.5rem' }}>
                  Outputs Mapped (semicolon separated)
                  <input
                    value={contentRequestForm.outputs}
                    onChange={(event) => setContentRequestForm((current) => ({ ...current, outputs: event.target.value }))}
                    required
                  />
                </label>
                <div className="content-request-form__row" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem', marginTop: '0.5rem', marginBottom: '0.7rem' }}>
                  <label>
                    Review Owner
                    <input
                      value={contentRequestForm.reviewOwner}
                      onChange={(event) => setContentRequestForm((current) => ({ ...current, reviewOwner: event.target.value }))}
                      required
                    />
                  </label>
                  <label>
                    Review Note
                    <input
                      value={contentRequestForm.reviewNotes}
                      onChange={(event) => setContentRequestForm((current) => ({ ...current, reviewNotes: event.target.value }))}
                    />
                  </label>
                </div>
                <button type="submit" disabled={contentRequestSaving} style={{ width: '100%' }}>
                  {contentRequestSaving ? 'Saving...' : 'Add content request'}
                </button>
                {contentRequestError ? <p role="alert" style={{ color: 'var(--tt-orange)', marginTop: '0.5rem', fontWeight: 'bold' }}>{contentRequestError}</p> : null}
              </form>
            </div>

            <div className="deck-studio__quality" style={{ display: 'grid', gap: '1rem' }}>
              <h2>Requested Deliveries</h2>
              <div className="content-request-list" style={{ display: 'grid', gap: '1rem' }}>
                {contentRequests.length ? (
                  contentRequests.map((item) => (
                    <div key={item.id} style={{ padding: '1rem', border: '1px solid var(--tt-line)', borderRadius: 'var(--tt-radius-sm)', background: 'var(--tt-white)', display: 'grid', gap: '0.45rem' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <span className="reporting-chip" data-status={item.status}>{item.status.replace(/-/g, ' ')}</span>
                        <small style={{ color: 'var(--tt-muted)' }}>{item.reviewOwner}</small>
                      </div>
                      <strong style={{ fontSize: '1.05rem', color: 'var(--tt-dark)' }}>{item.request}</strong>
                      <small style={{ color: 'var(--tt-muted)', fontWeight: 700 }}>
                        {item.audience} · {item.deliveryMode}
                      </small>
                      <p style={{ margin: 0, fontSize: '0.88rem', color: 'var(--tt-muted)' }}>
                        <b>Outputs:</b> {item.outputs.join(' + ')}
                      </p>
                      {item.reviewNotes ? (
                        <p style={{ margin: 0, fontSize: '0.84rem', color: 'var(--tt-muted)', background: '#fff9ef', padding: '0.35rem', borderLeft: '2px solid var(--tt-orange)' }}>
                          {item.reviewNotes}
                        </p>
                      ) : null}
                      <small style={{ color: 'var(--tt-teal-dark)', fontWeight: 'bold' }}>
                        Linked packages: {generatedPackages.filter((packageItem) => packageItem.contentRequestId === item.id).length}
                      </small>
                      <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.25rem' }}>
                        {item.status !== 'published' ? (
                          <button
                            className="button-secondary"
                            type="button"
                            disabled={packageGeneratingId === item.id || contentRequestSaving}
                            onClick={() => void generatePackageForRequest(item)}
                            style={{ flex: 1, minHeight: '2rem', fontSize: '0.85rem' }}
                          >
                            {packageGeneratingId === item.id ? 'Generating package...' : 'Generate AI package'}
                          </button>
                        ) : null}
                        {nextContentRequestStatus(item.status) ? (
                          <button
                            className="button-secondary"
                            type="button"
                            disabled={contentRequestSaving}
                            onClick={() => void advanceContentRequest(item)}
                            style={{ flex: 1, minHeight: '2rem', fontSize: '0.85rem' }}
                          >
                            {nextContentRequestActionLabel(item.status)}
                          </button>
                        ) : (
                          <span style={{ fontSize: '0.82rem', color: 'var(--tt-teal-dark)', fontWeight: 'bold', alignSelf: 'center' }}>Published to Release flow.</span>
                        )}
                      </div>
                    </div>
                  ))
                ) : (
                  <p>No content requests pending. Use the form to submit new requests.</p>
                )}
              </div>
            </div>
          </div>
        )}

        {activeTab === 'drafts' && (
          <div className="deck-studio__workspace">
            <div className="deck-studio__controls">
              <h2 id="generated-package-title">Generated drafts</h2>
              <p>Durable AI packages linked to intake requests. Review and inspector detail before gate approvals.</p>
              {generatedPackages.length ? (
                <div className="content-request-list" style={{ display: 'grid', gap: '0.65rem' }}>
                  {generatedPackages.map((pkg) => (
                    <button
                      key={pkg.id}
                      className={`content-request-item`}
                      onClick={() => setSelectedPackageId(pkg.id)}
                      style={{
                        width: '100%',
                        textAlign: 'left',
                        display: 'block',
                        padding: '0.9rem',
                        borderRadius: 'var(--tt-radius-sm)',
                        border: selectedPackageId === pkg.id || (!selectedPackageId && selectedPackage?.id === pkg.id)
                          ? '2px solid var(--tt-teal)'
                          : '1px solid var(--tt-line)',
                        background: selectedPackageId === pkg.id || (!selectedPackageId && selectedPackage?.id === pkg.id)
                          ? 'var(--tt-soft-teal)'
                          : 'var(--tt-white)',
                        cursor: 'pointer',
                        transition: 'all 150ms ease'
                      }}
                      type="button"
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <strong style={{ display: 'block', color: 'var(--tt-dark)', fontSize: '0.95rem' }}>{pkg.title}</strong>
                        <span className="reporting-chip" data-status={pkg.reviewStatus}>{pkg.reviewStatus.replace(/-/g, ' ')}</span>
                      </div>
                      <small style={{ color: 'var(--tt-muted)', display: 'block', marginTop: '0.25rem', fontWeight: 700 }}>
                        {pkg.audience} · {pkg.deliveryMode} · {pkg.durationMinutes} min
                      </small>
                      <small style={{ color: 'var(--tt-muted)', display: 'block', fontSize: '0.8rem' }}>
                        {pkg.provider} · {pkg.model}
                      </small>
                    </button>
                  ))}
                </div>
              ) : (
                <p>No generated drafts available. Submit an intake request to start the AI generation pipeline.</p>
              )}
            </div>

            <aside className="deck-studio__quality" style={{ display: 'grid', gap: '1rem', minHeight: '30rem' }}>
              {selectedPackage ? (
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start', borderBottom: '1px solid var(--tt-line)', paddingBottom: '0.75rem', marginBottom: '0.75rem' }}>
                    <div>
                      <p className="app-hero__label" style={{ margin: 0 }}>{selectedPackage.provider} · {selectedPackage.model}</p>
                      <h2 style={{ fontSize: '1.25rem', margin: '0.15rem 0 0' }}>{selectedPackage.title}</h2>
                    </div>
                    <span className="reporting-chip" data-status={selectedPackage.reviewStatus}>{selectedPackage.reviewStatus.replace(/-/g, ' ')}</span>
                  </div>

                  <div style={{ display: 'grid', gap: '1.25rem' }}>
                    {/* Status Advance Controls */}
                    <div style={{ padding: '0.85rem', background: 'var(--tt-white)', borderRadius: 'var(--tt-radius-sm)', border: '1px solid rgba(72, 192, 176, 0.25)' }}>
                      <h3 style={{ fontSize: '0.9rem', margin: '0 0 0.5rem', textTransform: 'uppercase', color: 'var(--tt-teal-dark)' }}>Advance Review Gate</h3>
                      <p style={{ margin: '0 0 0.5rem', fontSize: '0.85rem', color: 'var(--tt-muted)' }}>
                        <strong>Owner:</strong> {selectedPackage.reviewOwner} <br />
                        <strong>Notes:</strong> {selectedPackage.reviewNotes || 'None'}
                      </p>
                      {nextGeneratedPackageStatus(selectedPackage.reviewStatus) ? (
                        <button
                          className="button-secondary"
                          disabled={packageReviewSavingId === selectedPackage.id}
                          onClick={() => void advanceGeneratedPackage(selectedPackage)}
                          style={{ width: '100%', minHeight: '2.25rem' }}
                          type="button"
                        >
                          {packageReviewSavingId === selectedPackage.id ? 'Saving...' : nextGeneratedPackageActionLabel(selectedPackage.reviewStatus)}
                        </button>
                      ) : (
                        <div style={{ padding: '0.45rem', background: 'var(--tt-soft-teal)', color: 'var(--tt-teal-dark)', borderRadius: 'var(--tt-radius-sm)', fontWeight: 'bold', fontSize: '0.85rem', textAlign: 'center' }}>
                          Published to content library release flow.
                        </div>
                      )}
                    </div>

                    {/* Objectives */}
                    <div>
                      <h3 style={{ fontSize: '0.95rem', margin: '0 0 0.25rem', color: 'var(--tt-dark)' }}>Measurable Objectives</h3>
                      {selectedPackage.package.learningObjectives && selectedPackage.package.learningObjectives.length ? (
                        <ul style={{ margin: 0, paddingLeft: '1.15rem', fontSize: '0.9rem', color: 'var(--tt-muted)' }}>
                          {selectedPackage.package.learningObjectives.map((obj) => <li key={obj}>{obj}</li>)}
                        </ul>
                      ) : (
                        <p style={{ fontStyle: 'italic', margin: 0, fontSize: '0.9rem' }}>No objectives generated.</p>
                      )}
                    </div>

                    {/* Created modules/outline */}
                    <div>
                      <h3 style={{ fontSize: '0.95rem', margin: '0 0 0.5rem', color: 'var(--tt-dark)' }}>Outline & Created Modules</h3>
                      <ol style={{ margin: 0, padding: 0, display: 'grid', gap: '0.55rem' }}>
                        {selectedPackage.package.deckOutline && selectedPackage.package.deckOutline.length ? (
                          selectedPackage.package.deckOutline.map((sec, idx) => (
                            <li key={idx} style={{ listStyle: 'none', background: 'var(--tt-white)', padding: '0.75rem', borderRadius: 'var(--tt-radius-sm)', border: '1px solid var(--tt-line)' }}>
                              <strong style={{ display: 'block', fontSize: '0.9rem', color: 'var(--tt-dark)' }}>{idx + 1}. {sec.sectionTitle}</strong>
                              <span style={{ fontSize: '0.85rem', color: 'var(--tt-muted)', display: 'block', marginTop: '0.2rem' }}>
                                <b>Objective:</b> {sec.objective}
                              </span>
                              <span style={{ fontSize: '0.85rem', color: 'var(--tt-muted)', display: 'block', marginTop: '0.2rem' }}>
                                <b>Activity Prompt:</b> <i>{sec.activityPrompt}</i>
                              </span>
                              {sec.facilitatorNotes && (
                                <span style={{ fontSize: '0.82rem', color: 'var(--tt-muted)', display: 'block', background: '#fffcf7', borderLeft: '2px solid var(--tt-orange)', paddingLeft: '0.4rem', marginTop: '0.25rem', paddingTop: '0.15rem', paddingBottom: '0.15rem' }}>
                                  <b>Trainer Guide Notes:</b> {sec.facilitatorNotes}
                                </span>
                              )}
                            </li>
                          ))
                        ) : (
                          <p style={{ fontStyle: 'italic', margin: 0, fontSize: '0.9rem' }}>No outline modules generated.</p>
                        )}
                      </ol>
                    </div>

                    {/* Guide Notes */}
                    <div>
                      <h3 style={{ fontSize: '0.95rem', margin: '0 0 0.25rem', color: 'var(--tt-dark)' }}>Facilitator Guide Notes</h3>
                      {selectedPackage.package.facilitatorGuideNotes && selectedPackage.package.facilitatorGuideNotes.length ? (
                        <ul style={{ margin: 0, paddingLeft: '1.15rem', fontSize: '0.9rem', color: 'var(--tt-muted)' }}>
                          {selectedPackage.package.facilitatorGuideNotes.map((note, idx) => <li key={idx}>{note}</li>)}
                        </ul>
                      ) : (
                        <p style={{ fontStyle: 'italic', margin: 0, fontSize: '0.9rem' }}>No additional guide notes generated.</p>
                      )}
                    </div>

                    {/* Resource Links */}
                    <div>
                      <h3 style={{ fontSize: '0.95rem', margin: '0 0 0.25rem', color: 'var(--tt-dark)' }}>Resource Links & Takeaways</h3>
                      <p style={{ margin: '0 0 0.5rem', fontSize: '0.88rem', color: 'var(--tt-muted)' }}>
                        {selectedPackage.package.learnerHandout?.summary || 'No summary generated.'}
                      </p>
                      {selectedPackage.package.learnerHandout?.resourceList && selectedPackage.package.learnerHandout.resourceList.length ? (
                        <div style={{ display: 'grid', gap: '0.35rem', marginTop: '0.5rem' }}>
                          {selectedPackage.package.learnerHandout.resourceList.map((res, idx) => (
                            <div key={idx} style={{ padding: '0.5rem 0.65rem', background: 'var(--tt-white)', borderRadius: 'var(--tt-radius-sm)', border: '1px solid var(--tt-line)', display: 'flex', gap: '0.4rem', alignItems: 'center' }}>
                              <FileText size={14} color="var(--tt-teal-dark)" />
                              <span style={{ fontSize: '0.85rem', fontWeight: 650, color: 'var(--tt-teal-dark)' }}>
                                {res.title || res.artifact} · <small style={{ color: 'var(--tt-muted)' }}>{res.locator}</small>
                              </span>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <p style={{ fontStyle: 'italic', margin: 0, fontSize: '0.85rem', color: 'var(--tt-muted)' }}>No resource links mapped.</p>
                      )}
                    </div>
                  </div>
                </div>
              ) : (
                <p>No package selected. Click a draft package on the left to inspect its details.</p>
              )}
            </aside>
          </div>
        )}
      </section>
    </main>


  )
}

function KnowledgeAssistantPanel({ sourceLibrary }: { sourceLibrary: SourceLibraryPayload | null }) {
  const [question, setQuestion] = useState('What happens if a Site Lead misses a session?')
  const [answer, setAnswer] = useState<Awaited<ReturnType<typeof askKnowledgeAssistant>> | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const sampleQuestions = [
    'What happens if a Site Lead misses a session?',
    'What is the purpose of PBIS in Program Induction?',
    'How should staff respond before correcting behavior?',
  ]

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
        <div className="assistant-prompts" aria-label="Suggested library questions">
          {sampleQuestions.map((item) => (
            <button key={item} className="button-secondary" type="button" onClick={() => setQuestion(item)}>
              {item}
            </button>
          ))}
        </div>
        <button disabled={loading || question.trim().length < 4} type="submit">
          {loading ? 'Checking sources' : 'Ask assistant'}
        </button>
      </form>
      {error ? <p role="alert">{error}</p> : null}
      {answer ? (
        <section className="assistant-answer" data-status={answer.status} aria-label="Assistant answer">
          <div className="assistant-answer__summary">
            <span className="reporting-chip" data-status={answer.status === 'answered' ? 'ready' : 'needs_review'}>
              {answer.confidence}
            </span>
            <h2>Direct answer</h2>
            <p>{answer.answer}</p>
            {answer.status === 'answered' ? (
              <ol>
                <li>Use the answer as a first response, not final policy language.</li>
                <li>Open the cited artifact before coaching, escalation, or clearance decisions.</li>
                <li>Route weak or missing evidence to Program Training & Development.</li>
              </ol>
            ) : null}
          </div>
          <div className="assistant-answer__sources">
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
  const releases = sourceLibrary.releases ?? []

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
      {releases.length ? (
        <div className="source-library__releases" aria-label="Content library versions">
          <div>
            <p className="app-hero__label">Version control</p>
            <h3>Content Library Releases</h3>
          </div>
          {releases.slice(0, 4).map((release) => (
            <article key={release.id}>
              <span className="reporting-chip" data-status={release.status}>{release.status}</span>
              <strong>{release.title}</strong>
              <small>{release.version}</small>
              <p>{release.reviewNotes}</p>
              <small>
                Owner: {release.reviewOwner} · {release.artifactIds.length} artifacts · {release.publishedAt ? 'published' : 'review gate'}
              </small>
            </article>
          ))}
        </div>
      ) : null}
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
