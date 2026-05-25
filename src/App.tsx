import { type FormEvent, useCallback, useEffect, useMemo, useState } from 'react'
import {
  BarChart3,
  BookOpen,
  BotMessageSquare,
  CalendarDays,
  Dumbbell,
  FileText,
  LayoutDashboard,
  Map,
  Menu,
  Presentation,
  Upload,
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
  getAutoAssignmentRules,
  getLearningPath,
  getMe,
  getProgress,
  getSourceQaFlags,
  getSourceLibrary,
  getSourceUsageSummary,
  login,
  previewAssignmentCsv,
  readStoredToken,
  revokeLearnerInvite,
  scoreScenario,
  searchSourceIntelligence,
  submitTrainingSurvey,
  updateAdminNotificationStatus,
  updateContentDevelopmentRequestStatus,
  updateGeneratedTrainingPackageStatus,
  type AdminAuditEvent,
  type AdminCohort,
  type AdminDashboardPayload,
  type AdminLearner,
  type AssignmentPreviewPayload,
  type AutoAssignmentRule,
  type AiDeckOutline,
  type AiDeckProvider,
  type AiProviderStatus,
  type AuthUser,
  type ContentStudioPackage,
  type ContentStudioDeliveryMode,
  type ContentStudioTemplate,
  type ContentDevelopmentRequest,
  type ContentDevelopmentRequestInput,
  type GeneratedTrainingPackage,
  type LearningPathPayload,
  type LearnerProfile,
  type NotificationQueueItem,
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
  { view: 'admin', label: 'Dashboard', section: 'Operations', description: 'Readiness and exports', Icon: LayoutDashboard },
  { view: 'users', label: 'Learners', section: 'Operations', description: 'Add users and invites', Icon: Users },
  { view: 'cohorts', label: 'Cohorts', section: 'Operations', description: 'Sessions and assignments', Icon: CalendarDays },
  { view: 'deck', label: 'Deck Studio', section: 'Operations', description: 'Training package drafts', Icon: Presentation },
  { view: 'reporting', label: 'Reporting', section: 'Operations', description: 'Supervisor and roster view', Icon: BarChart3 },
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
  const [notificationQueue, setNotificationQueue] = useState<NotificationQueueItem[]>([])
  const [adminLearners, setAdminLearners] = useState<AdminLearner[]>([])
  const [adminCohorts, setAdminCohorts] = useState<AdminCohort[]>([])
  const [adminAuditEvents, setAdminAuditEvents] = useState<AdminAuditEvent[]>([])
  const [sourceLibrary, setSourceLibrary] = useState<SourceLibraryPayload | null>(null)
  const [sourceUsageSummary, setSourceUsageSummary] = useState<SourceUsageSummaryPayload | null>(null)
  const [sourceQaFlags, setSourceQaFlags] = useState<SourceQaFlagsPayload | null>(null)
  const [selectedScenarioId, setSelectedScenarioId] = useState('')
  const [loadError, setLoadError] = useState('')
  const [mobileNavOpen, setMobileNavOpen] = useState(false)
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
        notificationsPayload,
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
      setNotificationQueue(notificationsPayload.notifications)
      setAdminLearners(learnersPayload.learners)
      setAdminCohorts(cohortsPayload.cohorts)
      setAdminAuditEvents(auditPayload.events)
      setSourceUsageSummary(usagePayload)
      setSourceQaFlags(qaFlagsPayload)
    } else {
      setDashboard(null)
      setSupervisorReport(null)
      setNotificationQueue([])
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
  const showQuickActions = user?.role === 'admin' ? view === 'admin' : view === 'learner'

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
    setNotificationQueue([])
    setAdminLearners([])
    setAdminCohorts([])
    setAdminAuditEvents([])
    setSourceUsageSummary(null)
    setSourceQaFlags(null)
  }

  const handleWorkspaceNavigate = (nextView: WorkspaceView, targetId?: string) => {
    setView(adminOnlyViews.includes(nextView) && user?.role !== 'admin' ? 'learner' : nextView)
    setMobileNavOpen(false)
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
            notificationQueue,
            adminLearners,
            adminCohorts,
            adminAuditEvents,
            learner: learner ?? toLearnerIdentity(user),
            isAdmin: user.role === 'admin',
            contentVersion: content.path.contentVersion,
            sourceLibrary,
            sourceUsageSummary,
            sourceQaFlags,
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
            onCreateContentRequest: async (input) => {
              await createContentDevelopmentRequest(input)
              const [supervisorReportPayload, auditPayload] = await Promise.all([
                getAdminSupervisorReport(),
                getAdminAuditEvents(),
              ])
              setSupervisorReport(supervisorReportPayload)
              setAdminAuditEvents(auditPayload.events)
            },
            onUpdateContentRequestStatus: async (requestId, status, reviewNotes) => {
              await updateContentDevelopmentRequestStatus(requestId, status, reviewNotes)
              const [supervisorReportPayload, auditPayload, notificationsPayload] = await Promise.all([
                getAdminSupervisorReport(),
                getAdminAuditEvents(),
                getAdminNotifications(),
              ])
              setSupervisorReport(supervisorReportPayload)
              setAdminAuditEvents(auditPayload.events)
              setNotificationQueue(notificationsPayload.notifications)
            },
            onUpdateGeneratedPackageStatus: async (packageId, status, reviewNotes) => {
              const payload = await updateGeneratedTrainingPackageStatus(packageId, status, reviewNotes)
              const [auditPayload, notificationsPayload] = await Promise.all([
                getAdminAuditEvents(),
                getAdminNotifications(),
              ])
              setSupervisorReport(payload.supervisorReport)
              setAdminAuditEvents(auditPayload.events)
              setNotificationQueue(notificationsPayload.notifications)
            },
            onUpdateNotificationStatus: async (notificationId, status) => {
              const payload = await updateAdminNotificationStatus(notificationId, status)
              setNotificationQueue((items) => items.map((item) => (item.id === notificationId ? payload.notification : item)))
              const [supervisorReportPayload, auditPayload] = await Promise.all([
                getAdminSupervisorReport(),
                getAdminAuditEvents(),
              ])
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
  notificationQueue,
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
  onCreateContentRequest,
  onUpdateContentRequestStatus,
  onUpdateGeneratedPackageStatus,
  onUpdateNotificationStatus,
  onCreateLearnerInvite,
  onRevokeLearnerInvite,
  onDownloadExport,
  onSubmitSurvey,
}: {
  view: WorkspaceView
  learnerModules: LearnerModule[]
  coachScenario: CoachScenario
  coachScenarios: CoachScenario[]
  progress: ProgressPayload
  dashboard: AdminDashboardPayload | null
  supervisorReport: SupervisorReportPayload | null
  notificationQueue: NotificationQueueItem[]
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
  onUpdateNotificationStatus: (notificationId: string, status: NotificationQueueItem['status']) => Promise<void>
  onCreateLearnerInvite: Parameters<typeof AdminDashboard>[0]['onCreateLearnerInvite']
  onRevokeLearnerInvite: Parameters<typeof AdminDashboard>[0]['onRevokeLearnerInvite']
  onDownloadExport: Parameters<typeof AdminDashboard>[0]['onDownloadExport']
  onSubmitSurvey: (score: number, notes: string) => Promise<void>
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
      />
    )
  }

  if (view === 'deck' && isAdmin) {
    return <DeckStudio />
  }

  if (view === 'reporting' && isAdmin) {
    return (
      <SupervisorReportingPanel
        dashboard={dashboard}
        supervisorReport={supervisorReport}
        notificationQueue={notificationQueue}
        learners={adminLearners}
        cohorts={adminCohorts}
        onCreateContentRequest={onCreateContentRequest}
        onUpdateContentRequestStatus={onUpdateContentRequestStatus}
        onUpdateGeneratedPackageStatus={onUpdateGeneratedPackageStatus}
        onUpdateNotificationStatus={onUpdateNotificationStatus}
        onDownloadExport={onDownloadExport}
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
        {
          view: 'reporting',
          label: 'Preview roster',
          detail: 'Paste weekly HR export and review assignments',
          Icon: Upload,
          targetId: 'assignment-preview-title',
        },
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
}

function SupervisorReportingPanel({
  dashboard,
  supervisorReport,
  notificationQueue,
  learners,
  cohorts,
  onCreateContentRequest,
  onUpdateContentRequestStatus,
  onUpdateGeneratedPackageStatus,
  onUpdateNotificationStatus,
  onDownloadExport,
}: {
  dashboard: AdminDashboardPayload | null
  supervisorReport: SupervisorReportPayload | null
  notificationQueue: NotificationQueueItem[]
  learners: AdminLearner[]
  cohorts: AdminCohort[]
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
  onUpdateNotificationStatus: (notificationId: string, status: NotificationQueueItem['status']) => Promise<void>
  onDownloadExport?: (kind: 'supervisor-digest') => Promise<void> | void
}) {
  const sampleRosterCsv = [
    'First Name,Last Name,Email,Employee ID,Title,Region,Site,Supervisor,Hire Date',
    'Jordan,Rivera,jordan.rivera@thinktogether.local,EMP-1042,Program Leader,Emerging Region,East Bay Site,Regional Supervisor A,2026-06-03',
    'Sam,Patel,sam.patel@thinktogether.local,EMP-1043,Site Lead,Emerging Region,North Valley Site,Regional Supervisor B,2026-06-03',
    'Alex,Chen,alex.chen@thinktogether.local,EMP-1044,Instructional Aide,Emerging Region,,Regional Supervisor B,2026-06-03',
  ].join('\n')
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
  const [reportExportError, setReportExportError] = useState('')
  const [selectedGroupId, setSelectedGroupId] = useState('')
  const [assignmentRules, setAssignmentRules] = useState<AutoAssignmentRule[]>([])
  const [assignmentCsv, setAssignmentCsv] = useState(sampleRosterCsv)
  const [assignmentPreview, setAssignmentPreview] = useState<AssignmentPreviewPayload | null>(null)
  const [assignmentLoading, setAssignmentLoading] = useState(false)
  const [assignmentError, setAssignmentError] = useState('')
  const [notificationSavingId, setNotificationSavingId] = useState('')
  const [notificationError, setNotificationError] = useState('')
  const [packageGeneratingId, setPackageGeneratingId] = useState('')
  const [packageReviewSavingId, setPackageReviewSavingId] = useState('')
  const supervisorGroups = supervisorReport?.groups?.supervisors ?? []
  const facilitatorGroups = supervisorReport?.groups?.facilitators ?? []
  const cohortGroups = supervisorReport?.groups?.cohorts ?? []
  const drilldownGroups = [...supervisorGroups, ...facilitatorGroups, ...cohortGroups]
  const selectedGroup = drilldownGroups.find((group) => group.id === selectedGroupId) ?? drilldownGroups[0]
  const actionQueue = supervisorReport?.actionQueue ?? []
  const assignmentAutomation = supervisorReport?.assignmentAutomation
  const integrationReadiness = supervisorReport?.integrationReadiness ?? []
  const contentRequests = supervisorReport?.contentDevelopmentRequests ?? []
  const generatedPackages = supervisorReport?.generatedTrainingPackages ?? []
  const rolloutForecast = supervisorReport?.rolloutForecast
  const notificationPreviews = supervisorReport?.completionNotifications ?? []
  const queuedNotifications = notificationQueue.filter((item) => item.status === 'queued' || item.status === 'draft')
  const sentNotifications = notificationQueue.filter((item) => item.status === 'sent')
  const missingCohorts = learners.filter((learnerItem) => !learnerItem.cohortId || !learnerItem.cohortName).length
  const pendingInvites = learners.filter((learnerItem) => learnerItem.inviteStatus === 'pending').length

  useEffect(() => {
    let ignore = false
    void (async () => {
      try {
        const payload = await getAutoAssignmentRules()
        if (!ignore) setAssignmentRules(payload.rules)
      } catch {
        if (!ignore) setAssignmentRules([])
      }
    })()
    return () => {
      ignore = true
    }
  }, [])

  const handleAssignmentPreview = async () => {
    setAssignmentLoading(true)
    setAssignmentError('')
    try {
      setAssignmentPreview(await previewAssignmentCsv(assignmentCsv))
    } catch (error) {
      setAssignmentError(error instanceof Error ? error.message : 'Unable to preview roster assignments')
    } finally {
      setAssignmentLoading(false)
    }
  }

  const handleDownloadSupervisorDigest = async () => {
    if (!onDownloadExport) return

    setReportExportError('')
    try {
      await onDownloadExport('supervisor-digest')
    } catch (error) {
      setReportExportError(error instanceof Error ? error.message : 'Unable to download supervisor digest')
    }
  }

  const handleContentRequestSubmit = async (event: FormEvent<HTMLFormElement>) => {
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

  const handleNotificationStatus = async (notificationId: string, status: NotificationQueueItem['status']) => {
    setNotificationSavingId(notificationId)
    setNotificationError('')
    try {
      await onUpdateNotificationStatus(notificationId, status)
    } catch (error) {
      setNotificationError(error instanceof Error ? error.message : 'Unable to update notification status')
    } finally {
      setNotificationSavingId('')
    }
  }

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
            {rolloutForecast ? (
              <>
                <span><strong>{rolloutForecast.autoAssignablePercent}%</strong> auto-assignable</span>
                <span><strong>{rolloutForecast.lmsRowsReady}</strong> LMS rows ready</span>
                <span><strong>{rolloutForecast.estimatedTrainerHoursSaved}</strong> hrs saved/week</span>
              </>
            ) : null}
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
                      <strong>{item.subject}</strong>
                      <span>{item.recipientEmail}</span>
                      <em>{item.body}</em>
                    </li>
                  ))}
                </ul>
              ) : (
                <p>No completion notifications are waiting. Completed learners will appear here for supervisor follow-up.</p>
              )}
              <button className="button-secondary" type="button" onClick={() => void handleDownloadSupervisorDigest()}>
                Download supervisor digest CSV
              </button>
              {reportExportError ? <p role="alert">{reportExportError}</p> : null}
            </article>
            <article>
              <h2>Phase 2 automation preview</h2>
              {assignmentAutomation ? (
                <>
                  <p>{assignmentAutomation.nextIntegration}</p>
                  <ul>
                    {assignmentAutomation.rules.map((rule) => (
                      <li key={rule.id}>
                        <strong>{rule.assignment}</strong>
                        <span>{rule.trigger}</span>
                        <em>{rule.reviewGate}</em>
                      </li>
                    ))}
                  </ul>
                </>
              ) : (
                <p>Assignment rules appear here once supervisor reporting data is available.</p>
              )}
            </article>
          </section>
          <section className="reporting-view__table" aria-labelledby="notification-queue-title">
            <div className="reporting-view__section-heading">
              <div>
                <p className="app-hero__label">Notification workflow</p>
                <h2 id="notification-queue-title">Notification queue</h2>
                <p>Review generated supervisor follow-ups, content review alerts, and published-training notices before email integration is switched on.</p>
              </div>
              <span>{queuedNotifications.length} queued · {sentNotifications.length} sent</span>
            </div>
            {queuedNotifications.length ? (
              <table className="reporting-table reporting-table--notifications">
                <thead>
                  <tr>
                    <th>Recipient</th>
                    <th>Message</th>
                    <th>Owner</th>
                    <th>Priority</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {queuedNotifications.map((item) => (
                    <tr key={item.id}>
                      <td data-label="Recipient">
                        <strong>{item.recipientName}</strong>
                        <small>{item.recipientEmail}</small>
                      </td>
                      <td data-label="Message">
                        <strong>{item.subject}</strong>
                        <small>{item.body}</small>
                      </td>
                      <td data-label="Owner">{item.owner}</td>
                      <td data-label="Priority">
                        <span className="reporting-chip" data-priority={item.priority}>{item.priority}</span>
                      </td>
                      <td data-label="Actions">
                        <div className="notification-actions">
                          <button
                            className="button-secondary"
                            disabled={notificationSavingId === item.id}
                            onClick={() => void handleNotificationStatus(item.id, 'sent')}
                            type="button"
                          >
                            Mark sent
                          </button>
                          <button
                            className="button-secondary"
                            disabled={notificationSavingId === item.id}
                            onClick={() => void handleNotificationStatus(item.id, 'dismissed')}
                            type="button"
                          >
                            Dismiss
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : (
              <p>No notification drafts are queued. Completion records and content review gates will create reviewable messages here.</p>
            )}
            {notificationError ? <p role="alert">{notificationError}</p> : null}
          </section>
          <section className="reporting-view__table reporting-view__table--assignment-preview" aria-labelledby="assignment-preview-title">
            <div className="reporting-view__section-heading">
              <div>
                <p className="app-hero__label">Roster automation</p>
                <h2 id="assignment-preview-title">Weekly roster assignment preview</h2>
                <p>Paste an HR/ADP roster export, preview the automatic rules, then hold exceptions for Training Ops review.</p>
              </div>
              <span>{assignmentRules.filter((rule) => rule.active).length} active rules</span>
            </div>
            <div className="assignment-preview">
              <div className="assignment-preview__workflow" aria-label="Roster preview workflow">
                <span><strong>1</strong> Paste roster CSV</span>
                <span><strong>2</strong> Match title and region rules</span>
                <span><strong>3</strong> Queue invites or hold review</span>
              </div>
              <div className="assignment-preview__rules" aria-label="Auto-assignment rules">
                {assignmentRules.map((rule) => (
                  <article key={rule.id}>
                    <span className="reporting-chip" data-status={rule.active ? 'ready' : 'needs_mapping'}>
                      priority {rule.priority}
                    </span>
                    <strong>{rule.name}</strong>
                    <small>{rule.matchCriteria.titleKeywords.join(', ')}</small>
                    <p>{rule.pathTitles.join(' + ')} · {rule.cohort.name}</p>
                    <em>{rule.reviewGate}</em>
                  </article>
                ))}
              </div>
              <label className="assignment-preview__input">
                Paste weekly HR/ADP roster CSV
                <textarea
                  value={assignmentCsv}
                  onChange={(event) => setAssignmentCsv(event.target.value)}
                  rows={6}
                  spellCheck={false}
                />
              </label>
              <div className="assignment-preview__actions">
                <button className="button-secondary" type="button" onClick={() => setAssignmentCsv(sampleRosterCsv)}>
                  Use sample roster
                </button>
                <button type="button" onClick={() => void handleAssignmentPreview()} disabled={assignmentLoading}>
                  {assignmentLoading ? 'Previewing roster...' : 'Preview assignments'}
                </button>
              </div>
              {assignmentError ? <p role="alert">{assignmentError}</p> : null}
              {assignmentPreview ? (
                <div className="assignment-preview__results">
                  <div className="assignment-preview__result-header">
                    <div>
                      <p className="app-hero__label">Decision preview</p>
                      <h3>Review before invites go out</h3>
                    </div>
                    <span>Generated {new Date(assignmentPreview.generatedAt).toLocaleTimeString()}</span>
                  </div>
                  <div className="reporting-view__metrics" aria-label="Assignment preview summary">
                    <span><strong>{assignmentPreview.summary.totalRows}</strong> roster rows</span>
                    <span><strong>{assignmentPreview.summary.autoAssignable}</strong> auto-assign</span>
                    <span><strong>{assignmentPreview.summary.needsReview}</strong> needs review</span>
                    <span><strong>{assignmentPreview.summary.duplicate}</strong> duplicates</span>
                    <span><strong>{assignmentPreview.summary.noRule}</strong> no rule</span>
                  </div>
                  <table className="reporting-table reporting-table--assignment">
                    <thead>
                      <tr>
                        <th>Roster row</th>
                        <th>Matched rule</th>
                        <th>Suggested assignment</th>
                        <th>Status</th>
                        <th>Review reason</th>
                      </tr>
                    </thead>
                    <tbody>
                      {assignmentPreview.rows.map((row) => (
                        <tr key={row.rowNumber}>
                          <td data-label="Roster row">
                            <strong>{row.learner.firstName} {row.learner.lastName}</strong>
                            <small>{row.learner.email || 'Email missing'}</small>
                            <small>{row.learner.title || 'Title missing'} · {row.learner.region || 'Region pending'}</small>
                          </td>
                          <td data-label="Matched rule">{row.matchedRule?.name ?? 'No match'}</td>
                          <td data-label="Suggested assignment">
                            {row.suggestedAssignment
                              ? `${row.suggestedAssignment.cohortName} · ${row.suggestedAssignment.pathTitles.join(' + ')}`
                              : 'Training Ops review'}
                          </td>
                          <td data-label="Status">
                            <span className="reporting-chip" data-status={row.status}>{row.status.replace(/_/g, ' ')}</span>
                          </td>
                          <td data-label="Review reason">
                            {row.reviewReasons.length ? row.reviewReasons.join(' ') : row.inviteAction.replace(/_/g, ' ')}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : null}
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
          <section className="reporting-view__grid reporting-view__grid--wide" aria-label="Phase 2 integration and content development">
            <article>
              <h2>Integration readiness</h2>
              <div className="readiness-list">
                {integrationReadiness.map((item) => (
                  <div key={item.id}>
                    <span className="reporting-chip" data-status={item.status}>{item.status.replace(/_/g, ' ')}</span>
                    <strong>{item.system}</strong>
                    <small>{item.owner}</small>
                    <p>{item.nextStep}</p>
                  </div>
                ))}
              </div>
            </article>
            <article>
              <h2>Content request pipeline</h2>
              <form className="content-request-form" onSubmit={handleContentRequestSubmit}>
                <label>
                  Request
                  <input
                    value={contentRequestForm.request}
                    onChange={(event) => setContentRequestForm((current) => ({ ...current, request: event.target.value }))}
                    placeholder="Training request"
                    required
                  />
                </label>
                <div className="content-request-form__row">
                  <label>
                    Audience
                    <input
                      value={contentRequestForm.audience}
                      onChange={(event) => setContentRequestForm((current) => ({ ...current, audience: event.target.value }))}
                      required
                    />
                  </label>
                  <label>
                    Delivery
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
                <label>
                  Source artifacts needed
                  <input
                    value={contentRequestForm.artifactsNeeded}
                    onChange={(event) => setContentRequestForm((current) => ({ ...current, artifactsNeeded: event.target.value }))}
                    required
                  />
                </label>
                <label>
                  Outputs
                  <input
                    value={contentRequestForm.outputs}
                    onChange={(event) => setContentRequestForm((current) => ({ ...current, outputs: event.target.value }))}
                    required
                  />
                </label>
                <div className="content-request-form__row">
                  <label>
                    Review owner
                    <input
                      value={contentRequestForm.reviewOwner}
                      onChange={(event) => setContentRequestForm((current) => ({ ...current, reviewOwner: event.target.value }))}
                      required
                    />
                  </label>
                  <label>
                    Review note
                    <input
                      value={contentRequestForm.reviewNotes}
                      onChange={(event) => setContentRequestForm((current) => ({ ...current, reviewNotes: event.target.value }))}
                    />
                  </label>
                </div>
                <button type="submit" disabled={contentRequestSaving}>
                  {contentRequestSaving ? 'Saving...' : 'Add content request'}
                </button>
                {contentRequestError ? <p role="alert">{contentRequestError}</p> : null}
              </form>
              <div className="content-request-list">
                {contentRequests.map((item) => (
                  <div key={item.id}>
                    <span className="reporting-chip" data-status={item.status}>{item.status.replace(/-/g, ' ')}</span>
                    <strong>{item.request}</strong>
                    <small>{item.audience} · {item.deliveryMode}</small>
                    <p>{item.outputs.join(' + ')}</p>
                    <small>Owner: {item.reviewOwner}</small>
                    {item.reviewNotes ? <p>{item.reviewNotes}</p> : null}
                    <small>
                      Packages: {generatedPackages.filter((packageItem) => packageItem.contentRequestId === item.id).length}
                    </small>
                    {item.status !== 'published' ? (
                      <button
                        className="button-secondary"
                        type="button"
                        disabled={packageGeneratingId === item.id || contentRequestSaving}
                        onClick={() => void generatePackageForRequest(item)}
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
                      >
                        {nextContentRequestActionLabel(item.status)}
                      </button>
                    ) : (
                      <small>Published and ready for rollout planning.</small>
                    )}
                  </div>
                ))}
              </div>
            </article>
          </section>
          <section className="reporting-view__table" aria-labelledby="generated-package-title">
            <div className="reporting-view__section-heading">
              <div>
                <p className="app-hero__label">Content development</p>
                <h2 id="generated-package-title">Generated package review board</h2>
                <p>Durable AI drafts linked to intake requests. Reviewers can gate, approve, and publish before assignment.</p>
              </div>
              <span>{generatedPackages.length} drafts</span>
            </div>
            {generatedPackages.length ? (
              <table className="reporting-table reporting-table--packages">
                <thead>
                  <tr>
                    <th>Package</th>
                    <th>Outputs</th>
                    <th>Review</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {generatedPackages.slice(0, 8).map((item) => (
                    <tr key={item.id}>
                      <td data-label="Package">
                        <strong>{item.title}</strong>
                        <small>{item.audience} · {item.deliveryMode} · {item.durationMinutes} min</small>
                        <small>{item.provider} · {item.model}</small>
                      </td>
                      <td data-label="Outputs">
                        <small>{item.package.template.requiredOutputs.join(' + ')}</small>
                        <small>{item.sourceArtifactIds.length} source artifacts</small>
                      </td>
                      <td data-label="Review">
                        <span className="reporting-chip" data-status={item.reviewStatus}>{item.reviewStatus.replace(/-/g, ' ')}</span>
                        <small>{item.reviewOwner}</small>
                        <small>{item.reviewNotes}</small>
                      </td>
                      <td data-label="Actions">
                        {nextGeneratedPackageStatus(item.reviewStatus) ? (
                          <button
                            className="button-secondary"
                            disabled={packageReviewSavingId === item.id}
                            onClick={() => void advanceGeneratedPackage(item)}
                            type="button"
                          >
                            {nextGeneratedPackageActionLabel(item.reviewStatus)}
                          </button>
                        ) : (
                          <small>Published to content library release flow.</small>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : (
              <p>No generated packages are saved yet. Use “Generate AI package” on a content request to create the first reviewable draft.</p>
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

function splitListInput(value: string) {
  return value
    .split(/[\n;,]+/)
    .map((item) => item.trim())
    .filter(Boolean)
}

function nextContentRequestStatus(status: ContentDevelopmentRequest['status']): ContentDevelopmentRequest['status'] | null {
  if (status === 'intake' || status === 'source-mapped') return 'draft-ready'
  if (status === 'draft-ready') return 'review-needed'
  if (status === 'review-needed') return 'approved'
  if (status === 'approved') return 'published'
  return null
}

function nextContentRequestActionLabel(status: ContentDevelopmentRequest['status']) {
  if (status === 'intake' || status === 'source-mapped') return 'Mark draft ready'
  if (status === 'draft-ready') return 'Send to review'
  if (status === 'review-needed') return 'Approve'
  if (status === 'approved') return 'Publish'
  return 'Updated'
}

function contentRequestNextNote(status: ContentDevelopmentRequest['status']) {
  if (status === 'draft-ready') return 'Draft package is ready for source and facilitation review.'
  if (status === 'review-needed') return 'Human review requested before pilot delivery.'
  if (status === 'approved') return 'Approved by training reviewer for pilot use.'
  if (status === 'published') return 'Published for rollout planning and assignment.'
  return ''
}

function nextGeneratedPackageStatus(status: GeneratedTrainingPackage['reviewStatus']): GeneratedTrainingPackage['reviewStatus'] | null {
  if (status === 'draft') return 'review-needed'
  if (status === 'review-needed') return 'approved'
  if (status === 'approved') return 'published'
  return null
}

function nextGeneratedPackageActionLabel(status: GeneratedTrainingPackage['reviewStatus']) {
  if (status === 'draft') return 'Send to review'
  if (status === 'review-needed') return 'Approve package'
  if (status === 'approved') return 'Publish package'
  return 'Updated'
}

function generatedPackageNextNote(status: GeneratedTrainingPackage['reviewStatus']) {
  if (status === 'review-needed') {
    return 'AI draft queued for human review; verify objectives, application, knowledge checks, and resources.'
  }
  if (status === 'approved') {
    return 'Package approved by review owner; ready for publish and assignment planning.'
  }
  if (status === 'published') {
    return 'Published training package; ready to attach to cohorts, makeup paths, and supervisor reporting.'
  }
  if (status === 'rejected') {
    return 'Package rejected; revise prompt, source map, and trainer guidance before review.'
  }
  return 'Package status advanced.'
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


function DeckStudio() {
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
  const selectedProvider = deckProviders.find((item) => item.id === effectiveProvider)
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

  return (
    <main className="deck-page" aria-labelledby="deck-studio-title">
      <section className="deck-studio">
        <div className="deck-studio__hero">
          <p className="app-hero__label">Content development studio</p>
          <h1 id="deck-studio-title">Training Deck Studio</h1>
          <p>
            Turn a weekly training request into a source-grounded package: editable PowerPoint, knowledge check, practice
            scenario, handout, and review notes. This is the main workflow for reducing trainer content-development time.
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
                  <option value="openai">OpenAI Premium</option>
                  <option value="gemini">Gemini Flash</option>
                  <option value="claude">Claude Sonnet</option>
                </select>
              </label>
              <label>
                Template
                <select
                  value={selectedTemplateId}
                  onChange={(event) => {
                    const template = templates.find((item) => item.id === event.target.value)
                    if (template) applyTemplate(template)
                    else setSelectedTemplateId(event.target.value)
                  }}
                >
                  {templates.map((template) => (
                    <option key={template.id} value={template.id}>{template.name}</option>
                  ))}
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
                  <label>
                    Delivery mode
                    <select value={deliveryMode} onChange={(event) => setDeliveryMode(event.target.value as ContentStudioDeliveryMode)}>
                      <option value="in-person">In-person</option>
                      <option value="virtual">Virtual</option>
                      <option value="hybrid">Hybrid</option>
                    </select>
                  </label>
              <div className="deck-form__actions">
                <button disabled={isGenerating || !selectedProvider?.configured || selectedProvider.mode !== 'sync' || topic.length < 8} type="submit">
                  {isGenerating ? (
                    <>
                      <span className="tt-spinner" aria-hidden="true" />
                      Generating preview...
                    </>
                  ) : (
                    'Generate preview'
                  )}
                </button>
                <button
                  disabled={isDownloadingPptx || !selectedProvider?.configured || selectedProvider.mode !== 'sync' || topic.length < 8}
                  onClick={handleDownloadPptx}
                  type="button"
                >
                  {isDownloadingPptx ? (
                    <>
                      <span className="tt-spinner" aria-hidden="true" />
                      Building PowerPoint...
                    </>
                  ) : (
                    'Download PowerPoint'
                  )}
                </button>
                <button
                  className="button-secondary"
                  disabled={isGeneratingPackage || topic.length < 8}
                  onClick={handleGenerateContentPackage}
                  type="button"
                >
                  {isGeneratingPackage ? (
                    <>
                      <span className="tt-spinner" aria-hidden="true" />
                      Building content package...
                    </>
                  ) : (
                    'Generate full package'
                  )}
                </button>
              </div>
              {deckError ? <p role="alert">{deckError}</p> : null}
            </form>
          </div>

          <aside className="deck-studio__quality" aria-label="Deck quality system">
            <p className="app-hero__label">Output standard</p>
            <h2>Facilitator-ready, editable PowerPoint</h2>
            <div className="deck-studio__workflow" aria-label="Content creation workflow">
              <span><strong>1</strong> Request</span>
              <span><strong>2</strong> Source-map</span>
              <span><strong>3</strong> Draft</span>
              <span><strong>4</strong> Review</span>
            </div>
            <div className="deck-studio__proof">
              <span>Source-linked evidence strip</span>
              <span>PBIS/SOP artifact grounding</span>
              <span>Editable infographic shapes</span>
              <span>Human review gate</span>
            </div>
            {selectedTemplate ? (
              <div className="template-detail">
                <strong>{selectedTemplate.name}</strong>
                <span>{selectedTemplate.bestFor}</span>
                <ol>
                  {selectedTemplate.structure.slice(0, 4).map((step) => (
                    <li key={step.label}>
                      <b>{step.label}</b>
                      {step.purpose}
                    </li>
                  ))}
                </ol>
              </div>
            ) : null}

            <section className="content-starters" aria-label="Phase 2 content request starters">
              <div>
                <p className="app-hero__label">Reusable templates</p>
                <h2>Standardize course development</h2>
                <p>Pick a template to align every new request to objectives, application, checks, resources, and review gates.</p>
              </div>
              <div className="content-starters__grid">
                {templates.map((template) => (
                  <button
                    aria-pressed={template.id === selectedTemplateId}
                    key={template.id}
                    onClick={() => applyTemplate(template)}
                    type="button"
                  >
                    <strong>{template.name}</strong>
                    <span>{template.requiredOutputs.join(' + ')}</span>
                  </button>
                ))}
              </div>
            </section>
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
