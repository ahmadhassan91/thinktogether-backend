import type { KnowledgeCheckItem, LearningPath, Module, Scenario } from '../types'

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
export type AdminExportKind = 'clearance' | 'completions'

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

export async function getAdminDashboard() {
  return request<AdminDashboardPayload>('/api/admin/dashboard')
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
  const path = kind === 'clearance' ? '/api/admin/exports/clearance.csv' : '/api/admin/exports/completions.csv'
  const filename = kind === 'clearance' ? 'think-clearance-export.csv' : 'think-completion-export.csv'
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
