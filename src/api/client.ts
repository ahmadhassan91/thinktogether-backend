import type { KnowledgeCheckItem, LearningPath, Module, Scenario, SourceArtifact, SourceRef } from '../types'

const TOKEN_KEY = 'think-training-token'
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL?.replace(/\/$/, '') ?? ''

export type AuthUser = {
  id: string
  email: string
  name: string
  role: 'admin' | 'learner'
  learnerId?: string | null
}

export type LearnerProfile = {
  id: string
  firstName?: string
  lastName?: string
  name?: string
  email: string
  cohortId?: string
  cohortName?: string
  region?: string
  role?: string
  title?: string
  site?: string
  cohortDate?: string
  assignedPathIds?: string[]
}

export type AuthSession = {
  token: string
  user: AuthUser
  expiresAt: string
}

export type InviteStatus = 'not_invited' | 'not_sent' | 'pending' | 'accepted' | 'expired' | 'revoked'
export type AdminExportKind = 'clearance' | 'completions' | 'supervisor-digest'

export type LearnerInvite = {
  learnerId: string
  inviteStatus?: InviteStatus
  inviteToken?: string
  inviteUrl?: string
  expiresAt?: string | null
}

export type LearningPathPayload = {
  path: LearningPath
  modules: Module[]
  knowledgeChecks: KnowledgeCheckItem[]
  scenarios: Scenario[]
}

export type ProgressPayload = {
  completedModuleIds: string[]
  progress: Array<{ moduleId: string; status: string; completedAt: string | null }>
  practiceSubmissions: Array<{
    id: string
    scenarioId: string
    response: string
    score: number
    label: string
    rationale: string
    coachingNote: string
    confidence: string
    sourceBasis: string[]
    submittedAt: string
  }>
}

export type AdminDashboardPayload = {
  kpis: {
    totalLearners: number
    attended: number
    completedModules: number
    clearanceReady: number
    blocked: number
    makeupRequired: number
    averageKnowledgeScore: number
    surveyCompletion: number
    facilitatorRating: number
    practiceSubmissions: number
    completionRate: number
  }
  readinessByTrack: Array<{
    track: string
    enrolled: number
    clearanceReady: number
    needsCoaching: number
    blocked: number
  }>
  cohorts: Array<{ id: string; name: string; region: string; participants: number }>
}

export type SupervisorReportLearner = {
  id: string
  name: string
  firstName: string
  lastName: string
  email: string
  supervisor: string
  facilitatorIds: string[]
  title: string | null
  site: string | null
  cohort: {
    id: string
    name: string
    region: string
  }
  path: {
    id: string
    title: string
  }
  progressPercent: number
  scores: {
    knowledgeScore: number
    practiceScore: number
    completionScore: number
  }
  completion: {
    status: 'not_started' | 'in_progress' | 'completed' | 'needs_review'
    completedModuleCount: number
    requiredModuleCount: number
    passFail: 'pass' | 'needs-review' | null
    confirmationCode: string | null
    completedAt: string | null
    exportedToLms: boolean
    exportedAt: string | null
  }
  practiceSubmissions: number
}

export type SupervisorReportGroup = {
  id: string
  label: string
  learnerCount: number
  cohortIds: string[]
  averageProgressPercent: number
  completionRate: number
  learners: SupervisorReportLearner[]
}

export type SupervisorActionQueueItem = {
  id: string
  type: 'completion_alert' | 'lms_export' | 'coaching_nudge' | 'makeup_review'
  learnerId: string
  learnerName: string
  owner: string
  priority: 'high' | 'medium' | 'low'
  status: 'ready' | 'review' | 'queued'
  title: string
  detail: string
}

export type AssignmentAutomationPreview = {
  rules: Array<{
    id: string
    trigger: string
    assignment: string
    reviewGate: string
  }>
  readyForPilot: boolean
  nextIntegration: string
}

export type AutoAssignmentRule = {
  id: string
  name: string
  priority: number
  active: boolean
  matchCriteria: {
    titleKeywords: string[]
    requiredFields: string[]
  }
  cohort: {
    id: string
    name: string
    region: string
  }
  pathIds: string[]
  pathTitles: string[]
  reviewGate: string
  notificationTemplate: string
  createdAt: string
  updatedAt: string
}

export type AssignmentPreviewPayload = {
  generatedAt: string
  rules: AutoAssignmentRule[]
  rows: Array<{
    rowNumber: number
    status: 'auto_assign' | 'needs_review' | 'duplicate' | 'no_rule'
    learner: {
      firstName: string
      lastName: string
      email: string
      employeeId: string
      title: string
      region: string
      site: string
      supervisor: string
      hireDate: string
    }
    matchedRule: {
      id: string
      name: string
      reviewGate: string
    } | null
    suggestedAssignment: {
      cohortId: string
      cohortName: string
      pathIds: string[]
      pathTitles: string[]
      notificationTemplate: string
    } | null
    missingFields: string[]
    reviewReasons: string[]
    inviteAction: 'queue_invite' | 'skip_existing_learner' | 'hold_for_training_ops_review'
  }>
  summary: {
    totalRows: number
    autoAssignable: number
    needsReview: number
    duplicate: number
    noRule: number
  }
}

export type IntegrationReadinessItem = {
  id: string
  system: 'HR/ADP' | 'LMS' | 'Email' | 'Content Library'
  status: 'ready' | 'needs_mapping' | 'needs_approval'
  owner: string
  nextStep: string
}

export type ContentDevelopmentRequest = {
  id: string
  request: string
  audience: string
  deliveryMode: ContentStudioDeliveryMode
  status: 'intake' | 'source-mapped' | 'draft-ready' | 'review-needed' | 'approved' | 'published'
  artifactsNeeded: string[]
  outputs: string[]
  reviewOwner: string
  reviewNotes: string
  createdAt: string
  updatedAt: string
  approvedAt: string | null
  publishedAt: string | null
}

export type ContentDevelopmentRequestInput = {
  request: string
  audience: string
  deliveryMode: ContentStudioDeliveryMode
  artifactsNeeded: string[]
  outputs: string[]
  reviewOwner: string
  reviewNotes?: string
}

export type GeneratedTrainingPackage = {
  id: string
  contentRequestId: string | null
  templateId: string
  provider: string
  model: string
  title: string
  audience: string
  durationMinutes: number
  deliveryMode: ContentStudioDeliveryMode
  sourceArtifactIds: string[]
  package: ContentStudioPackage
  reviewStatus: 'draft' | 'review-needed' | 'approved' | 'published' | 'rejected'
  reviewOwner: string
  reviewNotes: string
  createdBy: string | null
  createdAt: string
  updatedAt: string
  approvedAt: string | null
  publishedAt: string | null
}

export type RolloutForecast = {
  weeklyNewHires: number
  autoAssignablePercent: number
  supervisorDigestRecipients: number
  lmsRowsReady: number
  estimatedTrainerHoursSaved: number
}

export type CompletionNotificationPreview = {
  learnerId: string
  learnerName: string
  email: string
  recipientEmail: string
  supervisor: string
  facilitatorIds: string[]
  cohortId: string
  cohortName: string
  pathId: string
  pathTitle: string
  completionStatus: SupervisorReportLearner['completion']['status']
  progressPercent: number
  score: number
  confirmationCode: string | null
  completedAt: string | null
  exportedToLms: boolean
  exportedAt: string | null
  subject: string
  body: string
  digestType: 'completion' | 'coaching' | 'makeup'
  preview: string
}

export type NotificationQueueItem = {
  id: string
  type: 'learner_invite' | 'completion_digest' | 'coaching_nudge' | 'makeup_review' | 'content_review' | 'content_published'
  recipientName: string
  recipientEmail: string
  subject: string
  body: string
  owner: string
  priority: 'high' | 'medium' | 'low'
  status: 'draft' | 'queued' | 'sent' | 'dismissed'
  entityType: string
  entityId: string
  metadata: Record<string, unknown>
  scheduledFor: string | null
  sentAt: string | null
  createdAt: string
  updatedAt: string
}

export type SupervisorReportPayload = {
  generatedAt: string
  groups: {
    supervisors: SupervisorReportGroup[]
    facilitators: SupervisorReportGroup[]
    cohorts: SupervisorReportGroup[]
  }
  actionQueue: SupervisorActionQueueItem[]
  assignmentAutomation: AssignmentAutomationPreview
  integrationReadiness: IntegrationReadinessItem[]
  contentDevelopmentRequests: ContentDevelopmentRequest[]
  generatedTrainingPackages: GeneratedTrainingPackage[]
  rolloutForecast: RolloutForecast
  completionNotifications: CompletionNotificationPreview[]
  notificationQueue: NotificationQueueItem[]
}

export type AdminLearner = {
  id: string
  firstName: string
  lastName: string
  email: string
  cohortId: string
  cohortName: string
  region: string
  assignedPathIds: string[]
  inviteStatus?: InviteStatus
}

export type AdminLearnerInput = {
  firstName: string
  lastName: string
  email: string
  cohortId?: string
  assignedPathIds: string[]
}

export type AdminCohort = {
  id: string
  name: string
  region: string
  startsAt: string
  facilitatorIds: string[]
  pathIds: string[]
  learnerCount: number
}

export type AdminCohortInput = {
  name: string
  region: string
  startsAt: string
  facilitatorIds: string[]
  pathIds: string[]
}

export type ScenarioScorePayload = {
  id: string
  scenarioId: string
  createdAt: string
  score: 1 | 2 | 3 | 4
  label: 'Not Yet' | 'Developing' | 'Meets' | 'Exceeds'
  rationale: string
  coachingNote: string
  confidence: 'Source-backed' | 'Partially source-backed' | 'Not found in provided sources'
  sourceBasis: string[]
}

export type AiDeckProvider = 'gemini' | 'openai' | 'claude'

export type AiProviderStatus = {
  id: AiDeckProvider | 'notebooklm_enterprise'
  label: string
  configured: boolean
  mode: 'sync' | 'source-workspace'
  note: string
}

export type AiDeckOutlineInput = {
  provider: AiDeckProvider
  topic: string
  audience: string
  durationMinutes: number
  slideCount: number
}

export type AiDeckOutline = {
  provider: AiDeckProvider
  model: string
  title: string
  audience: string
  durationMinutes: number
  learningObjectives: string[]
  slides: Array<{
    title: string
    objective: string
    layout?: 'process' | 'matrix' | 'scenario' | 'commitment' | 'loop' | 'pyramid' | 'timeline' | 'scorecard'
    talkingPoints: string[]
    visualSpec?: {
      type: 'flow' | 'loop' | 'matrix' | 'scenario-ladder' | 'commitment-map' | 'pyramid' | 'timeline' | 'scorecard'
      headline: string
      stages: Array<{ label: string; detail?: string }>
      callout?: string
    }
    activityPrompt: string
    facilitatorNotes: string
    sourceRefs: Array<{ artifact: string; locator: string }>
  }>
  handoffNotes: string[]
  sourceArtifacts: string[]
  generatedAt: string
}

export type ContentStudioDeliveryMode = 'in-person' | 'virtual' | 'hybrid'

export type ContentStudioPackageInput = {
  provider?: AiDeckProvider
  contentRequestId?: string
  templateId?: string
  topic: string
  audience: string
  durationMinutes: number
  deliveryMode: ContentStudioDeliveryMode
  sourceArtifactIds?: string[]
}

export type ContentStudioPackage = {
  provider: AiDeckProvider | 'deterministic'
  model: string
  template: {
    id: string
    name: string
    requiredOutputs: string[]
    reviewChecklist: string[]
  }
  title: string
  audience: string
  durationMinutes: number
  learningObjectives: string[]
  deckOutline: Array<{
    sectionTitle: string
    objective: string
    keyPoints: string[]
    activityPrompt: string
    facilitatorNotes: string
    sourceRefs: SourceRef[]
  }>
  knowledgeCheckQuestions: Array<{
    question: string
    options: string[]
    correctAnswer: string
    rationale: string
    sourceRefs: SourceRef[]
  }>
  practiceActivity: {
    title: string
    instructions: string[]
    facilitatorPrompt: string
    successCriteria: string[]
    sourceRefs: SourceRef[]
  }
  facilitatorGuideNotes: string[]
  learnerHandout: {
    summary: string
    keyTakeaways?: string[]
    resourceList: Array<SourceRef & { title?: string }>
  }
  deliveryNotes: {
    inPerson: string[]
    virtual: string[]
  }
  sourceArtifacts: string[]
  generatedAt: string
}

export type ContentStudioTemplate = {
  id: string
  name: string
  description: string
  bestFor: string
  deliveryMode: ContentStudioDeliveryMode
  audience: string
  durationMinutes: number
  topicStarter: string
  sourceArtifactIds: string[]
  requiredOutputs: string[]
  structure: Array<{
    label: string
    purpose: string
  }>
  reviewChecklist: string[]
}

export type SourceLibraryPayload = {
  sourceLibraryVersion: string
  artifacts: SourceArtifact[]
  releases?: Array<{
    id: string
    version: string
    title: string
    status: 'draft' | 'review' | 'approved' | 'published' | 'retired'
    contentRequestId: string | null
    artifactIds: string[]
    sourceMetrics: Record<string, unknown>
    reviewOwner: string
    reviewNotes: string
    createdBy: string | null
    createdAt: string
    approvedAt: string | null
    publishedAt: string | null
  }>
  learningPaths: Array<{
    id: string
    title: string
    audience: string
    contentVersion: string
    moduleCount: number
    sourceRefs: SourceRef[]
  }>
}

export type SourceUsageSummaryPayload = {
  totals: {
    artifacts: number
    referencedArtifacts: number
    sourceRefs: number
    paths: number
    modules: number
  }
  artifacts: Array<{
    artifact: SourceArtifact
    totalReferences: number
    uniqueLocatorCount: number
    pathReferenceCount: number
    moduleReferenceCount: number
    scenarioReferenceCount: number
    knowledgeCheckReferenceCount: number
    referencedByPathIds: string[]
    referencedByModuleIds: string[]
    locators: string[]
  }>
}

export type SourceQaFlagsPayload = {
  artifactsNotReferencedByModules: SourceArtifact[]
  modulesWithNoSourceRefs: Array<{ moduleId: string; moduleTitle: string; pathId: string; pathTitle: string }>
  pathsWithNoModules: Array<{ pathId: string; pathTitle: string }>
  sourceRefsWithoutLibraryArtifact: Array<{ sourceRef: SourceRef; contexts: unknown[] }>
}

export type SourceSearchPayload = {
  results: Array<{
    type: 'artifact' | 'path' | 'module' | 'scenario' | 'knowledge-check'
    id: string
    title: string
    artifact: SourceArtifact
    locator: string
    sourceRef: SourceRef
    excerpt: string
    relevanceScore: number
  }>
}

export type AdminAuditEvent = {
  id: string
  actorUserId: string | null
  actorEmail: string | null
  actorName: string | null
  action: string
  entityType: string
  entityId: string
  metadata: Record<string, unknown>
  createdAt: string
}

export type TrainingSurveyInput = {
  pathId: string
  facilitatorId?: string
  score: number
  notes: string
}

export type TrainingSurveyPayload = {
  survey: {
    id: string
    learnerId: string
    facilitatorId: string
    pathId: string
    rating: 'ready' | 'needs-coaching' | 'not-ready'
    score: number
    notes: string
    surveySubmitted: boolean
    submittedAt: string
  }
}

export type KnowledgeAssistantPayload = {
  answer: string
  sourceBasis: string[]
  coachingNote: string
  confidence: 'Source-backed' | 'Partially source-backed' | 'Not found in provided sources'
  status: 'answered' | 'not_found'
}

export function readStoredToken() {
  return window.localStorage.getItem(TOKEN_KEY)
}

export function storeToken(token: string) {
  window.localStorage.setItem(TOKEN_KEY, token)
}

export function clearToken() {
  window.localStorage.removeItem(TOKEN_KEY)
}

export async function login(email: string, password: string) {
  const payload = await request<AuthSession>('/api/auth/login', {
    method: 'POST',
    body: JSON.stringify({ email, password }),
  })
  storeToken(payload.token)
  return payload
}

export async function getMe() {
  return request<{ user: AuthUser; learner?: LearnerProfile | null }>('/api/me')
}

export async function acceptInvite(token: string, password: string) {
  const payload = await request<AuthSession & { learner: LearnerProfile }>('/api/auth/accept-invite', {
    method: 'POST',
    body: JSON.stringify({ token, password }),
  })
  storeToken(payload.token)
  return payload
}

export async function getLearningPath(pathId = 'program-induction-pbis') {
  return request<LearningPathPayload>(`/api/learning-paths/${pathId}`)
}

export async function getSourceLibrary() {
  return request<SourceLibraryPayload>('/api/source-library')
}

export async function getSourceUsageSummary() {
  return request<SourceUsageSummaryPayload>('/api/admin/source-intelligence/summary')
}

export async function getSourceQaFlags() {
  return request<SourceQaFlagsPayload>('/api/admin/source-intelligence/qa-flags')
}

export async function searchSourceIntelligence(query: string) {
  return request<SourceSearchPayload>(`/api/admin/source-intelligence/search?query=${encodeURIComponent(query)}`)
}

export async function getProgress() {
  return request<ProgressPayload>('/api/progress')
}

export async function completeModule(moduleId: string) {
  return request<{ moduleId: string; status: 'completed'; completedAt: string }>('/api/progress/module-complete', {
    method: 'POST',
    body: JSON.stringify({ moduleId }),
  })
}

export async function answerKnowledgeCheck(itemId: string, selectedAnswer: string) {
  return request<{ correct: boolean; correctAnswer: string; rationale: string }>(`/api/knowledge-checks/${itemId}/answer`, {
    method: 'POST',
    body: JSON.stringify({ selectedAnswer }),
  })
}

export async function scoreScenario(scenarioId: string, response: string) {
  return request<ScenarioScorePayload>(`/api/scenarios/${scenarioId}/score`, {
    method: 'POST',
    body: JSON.stringify({ response }),
  })
}

export async function submitTrainingSurvey(input: TrainingSurveyInput) {
  return request<TrainingSurveyPayload>('/api/surveys/training', {
    method: 'POST',
    body: JSON.stringify(input),
  })
}

export async function askKnowledgeAssistant(question: string) {
  return request<KnowledgeAssistantPayload>('/api/knowledge-assistant/answer', {
    method: 'POST',
    body: JSON.stringify({ question }),
  })
}

export async function getAdminDashboard() {
  return request<AdminDashboardPayload>('/api/admin/dashboard')
}

export async function getAdminSupervisorReport() {
  return request<SupervisorReportPayload>('/api/admin/supervisor-report')
}

export async function getAdminNotifications() {
  return request<{ notifications: NotificationQueueItem[] }>('/api/admin/notifications')
}

export async function updateAdminNotificationStatus(id: string, status: NotificationQueueItem['status']) {
  return request<{ notification: NotificationQueueItem }>(`/api/admin/notifications/${encodeURIComponent(id)}/status`, {
    method: 'PATCH',
    body: JSON.stringify({ status }),
  })
}

export async function getAutoAssignmentRules() {
  return request<{ rules: AutoAssignmentRule[] }>('/api/admin/assignment-rules')
}

export async function previewAssignmentCsv(csvText: string) {
  return request<AssignmentPreviewPayload>('/api/admin/assignment-preview', {
    method: 'POST',
    body: JSON.stringify({ csvText }),
  })
}

export async function getAdminAuditEvents() {
  return request<{ events: AdminAuditEvent[] }>('/api/admin/audit-events')
}

export async function getAdminLearners() {
  return request<{ learners: AdminLearner[] }>('/api/admin/learners')
}

export async function createAdminLearner(learner: AdminLearnerInput) {
  return request<{ learner: AdminLearner }>('/api/admin/learners', {
    method: 'POST',
    body: JSON.stringify(learner),
  })
}

export async function createLearnerInvite(learnerId: string) {
  return request<{ invite: LearnerInvite; learner?: AdminLearner }>(`/api/admin/learners/${encodeURIComponent(learnerId)}/invite`, {
    method: 'POST',
  })
}

export async function revokeLearnerInvite(learnerId: string) {
  return request<{ learner: AdminLearner }>(`/api/admin/learners/${encodeURIComponent(learnerId)}/invite/revoke`, {
    method: 'POST',
  })
}

export async function downloadAdminExport(kind: AdminExportKind) {
  const exportConfig = {
    clearance: {
      path: '/api/admin/exports/clearance.csv',
      filename: 'think-clearance-export.csv',
    },
    completions: {
      path: '/api/admin/exports/completions.csv',
      filename: 'think-completion-export.csv',
    },
    'supervisor-digest': {
      path: '/api/admin/exports/supervisor-digest.csv',
      filename: 'think-supervisor-digest.csv',
    },
  } satisfies Record<AdminExportKind, { path: string; filename: string }>
  const { path, filename } = exportConfig[kind]
  const headers = new Headers()
  const token = readStoredToken()
  if (token) {
    headers.set('authorization', `Bearer ${token}`)
  }

  const response = await fetch(apiUrl(path), { headers })
  if (!response.ok) {
    if (response.status === 401) {
      clearToken()
    }
    const error = (await response.json().catch(() => null)) as { error?: string } | null
    throw new Error(error?.error ?? `Request failed: ${response.status}`)
  }

  const blob = await response.blob()
  const url = window.URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = filename
  document.body.append(anchor)
  anchor.click()
  anchor.remove()
  window.URL.revokeObjectURL(url)
}

export async function getAdminCohorts() {
  return request<{ cohorts: AdminCohort[] }>('/api/admin/cohorts')
}

export async function createAdminCohort(cohort: AdminCohortInput) {
  return request<{ cohort: AdminCohort }>('/api/admin/cohorts', {
    method: 'POST',
    body: JSON.stringify(cohort),
  })
}

export async function getAiProviders() {
  return request<{ providers: AiProviderStatus[] }>('/api/ai/providers')
}

export async function createAiDeckOutline(input: AiDeckOutlineInput) {
  const jobPayload = await request<{
    job: {
      id: string
      status: 'queued' | 'running' | 'ready' | 'failed'
      error?: string
    }
  }>('/api/ai/deck-outline-jobs', {
    method: 'POST',
    body: JSON.stringify(input),
  })
  const jobId = jobPayload.job.id
  let status = jobPayload.job.status
  let error = jobPayload.job.error

  for (let attempt = 0; attempt < 75 && status !== 'ready' && status !== 'failed'; attempt += 1) {
    const payload = await request<{
      job: {
        id: string
        status: 'queued' | 'running' | 'ready' | 'failed'
        error?: string
      }
      outline?: AiDeckOutline
      provider?: AiProviderStatus
    }>(`/api/ai/deck-outline-jobs/${jobId}`)
    status = payload.job.status
    error = payload.job.error
    if (payload.outline && payload.provider) {
      return { outline: payload.outline, provider: payload.provider }
    }
    if (status !== 'ready' && status !== 'failed') {
      await delay(2000)
    }
  }

  throw new Error(error ?? 'Deck preview generation timed out. Please try again.')
}

export async function createContentStudioPackage(input: ContentStudioPackageInput) {
  return request<{ package: ContentStudioPackage; generatedPackage?: GeneratedTrainingPackage | null }>('/api/content-studio/packages', {
    method: 'POST',
    body: JSON.stringify(input),
  })
}

export async function getContentStudioTemplates() {
  return request<{ templates: ContentStudioTemplate[] }>('/api/content-studio/templates')
}

export async function createContentDevelopmentRequest(input: ContentDevelopmentRequestInput) {
  return request<{ request: ContentDevelopmentRequest }>('/api/admin/content-requests', {
    method: 'POST',
    body: JSON.stringify(input),
  })
}

export async function updateContentDevelopmentRequestStatus(
  requestId: string,
  status: ContentDevelopmentRequest['status'],
  reviewNotes = '',
) {
  return request<{ request: ContentDevelopmentRequest }>(`/api/admin/content-requests/${requestId}/status`, {
    method: 'PATCH',
    body: JSON.stringify({ status, reviewNotes }),
  })
}

export async function updateGeneratedTrainingPackageStatus(
  packageId: string,
  status: GeneratedTrainingPackage['reviewStatus'],
  reviewNotes = '',
) {
  return request<{ generatedPackage: GeneratedTrainingPackage; supervisorReport: SupervisorReportPayload }>(
    `/api/admin/generated-packages/${packageId}/status`,
    {
      method: 'PATCH',
      body: JSON.stringify({ status, reviewNotes }),
    },
  )
}

export async function downloadAiDeckPptx(input: AiDeckOutlineInput) {
  const jobPayload = await request<{
    job: {
      id: string
      status: 'queued' | 'running' | 'ready' | 'failed'
      error?: string
    }
  }>('/api/ai/deck-jobs', {
    method: 'POST',
    body: JSON.stringify(input),
  })
  const jobId = jobPayload.job.id
  let status = jobPayload.job.status
  let error = jobPayload.job.error

  for (let attempt = 0; attempt < 75 && status !== 'ready' && status !== 'failed'; attempt += 1) {
    const payload = await request<{
      job: {
        id: string
        status: 'queued' | 'running' | 'ready' | 'failed'
        error?: string
      }
    }>(`/api/ai/deck-jobs/${jobId}`)
    status = payload.job.status
    error = payload.job.error
    if (status !== 'ready' && status !== 'failed') {
      await delay(2000)
    }
  }

  if (status !== 'ready') {
    throw new Error(error ?? 'PowerPoint generation timed out. Please try again.')
  }

  const headers = new Headers()
  const token = readStoredToken()
  if (token) {
    headers.set('authorization', `Bearer ${token}`)
  }

  const response = await fetch(apiUrl(`/api/ai/deck-jobs/${jobId}/pptx`), {
    headers,
  })
  if (!response.ok) {
    if (response.status === 401) {
      clearToken()
    }
    const error = (await response.json().catch(() => null)) as { error?: string } | null
    throw new Error(error?.error ?? `Request failed: ${response.status}`)
  }

  const blob = await response.blob()
  const disposition = response.headers.get('content-disposition') ?? ''
  const filename = disposition.match(/filename="([^"]+)"/)?.[1] ?? 'think-together-training-deck.pptx'
  const url = window.URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = filename
  document.body.append(anchor)
  anchor.click()
  anchor.remove()
  window.URL.revokeObjectURL(url)
}

function delay(ms: number) {
  return new Promise((resolve) => window.setTimeout(resolve, ms))
}

async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  const headers = new Headers(init.headers)
  headers.set('content-type', 'application/json')
  const token = readStoredToken()
  if (token) {
    headers.set('authorization', `Bearer ${token}`)
  }

  const response = await fetch(apiUrl(path), { ...init, headers })
  if (!response.ok) {
    if (response.status === 401) {
      clearToken()
    }
    const error = (await response.json().catch(() => null)) as { error?: string } | null
    throw new Error(error?.error ?? `Request failed: ${response.status}`)
  }

  if (response.status === 204) {
    return undefined as T
  }

  return response.json() as Promise<T>
}

function apiUrl(path: string) {
  return `${API_BASE_URL}${path}`
}
