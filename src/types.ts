export type ContentVersion = string

export type SourceRef = {
  artifact: string
  locator: string
}

export type Learner = {
  id: string
  firstName: string
  lastName: string
  email: string
  phone?: string
  employeeId?: string
  cohortId: string
  assignedPathIds: string[]
}

export type LearningPath = {
  id: string
  title: string
  description: string
  audience: string
  contentVersion: ContentVersion
  moduleIds: string[]
  modules: Module[]
  sourceRefs: SourceRef[]
}

export type Module = {
  id: string
  title: string
  order: number
  estimatedMinutes: number
  content: LessonContent
  scenarioIds: string[]
  knowledgeCheckItemIds: string[]
  requiredForCompletion: boolean
}

export type LessonContent = {
  moduleId: string
  contentVersion: ContentVersion
  summary: string
  learningObjectives: string[]
  keyPoints: string[]
  sourceRefs: SourceRef[]
}

export type Scenario = {
  id: string
  moduleId: string
  title: string
  prompt: string
  skillFocus: string
  expectedResponseElements: string[]
  sourceRefs: SourceRef[]
  contentVersion: ContentVersion
}

export type KnowledgeCheckItem = {
  id: string
  moduleId: string
  prompt: string
  choices: string[]
  correctAnswer: string
  rationale: string
  sourceRefs: SourceRef[]
  contentVersion: ContentVersion
}

export type PracticeSubmissionStatus = 'accepted' | 'needs_review' | 'rejected'

export type PracticeSubmission = {
  id: string
  learnerId: string
  scenarioId: string
  response: string
  status: PracticeSubmissionStatus
  submittedAt: string
  reviewedBy?: string
  feedback?: string
  contentVersion: ContentVersion
}

export type CompletionStatus = 'not_started' | 'in_progress' | 'completed' | 'failed'

export type CompletionRecord = {
  id: string
  learnerId: string
  pathId: string
  moduleId: string
  status: CompletionStatus
  score?: number
  completedAt?: string
  contentVersion: ContentVersion
}

export type Cohort = {
  id: string
  name: string
  region: string
  startsAt: string
  facilitatorIds: string[]
  pathIds: string[]
}

export type Participant = {
  id: string
  cohortId: string
  learnerId: string
  role: 'learner' | 'facilitator' | 'program-pro'
  joinedAt: string
}

export type AttendanceRecord = {
  id: string
  cohortId: string
  participantId: string
  sessionDate: string
  status: 'present' | 'absent' | 'excused'
  recordedBy: string
}

export type ClearanceRecord = {
  id: string
  learnerId: string
  clearanceType: 'background-check' | 'site-clearance' | 'training-clearance'
  status: 'pending' | 'cleared' | 'blocked'
  updatedAt: string
  notes?: string
}

export type FacilitatorFeedback = {
  id: string
  learnerId: string
  facilitatorId: string
  pathId: string
  moduleId?: string
  rating: 'ready' | 'needs-coaching' | 'not-ready'
  notes: string
  createdAt: string
}

export type ExportBatch = {
  id: string
  cohortId: string
  pathId: string
  format: 'csv' | 'json'
  recordCount: number
  requestedBy: string
  createdAt: string
  filters: Record<string, string>
}

export type LearnerProgressSummary = {
  learnerId: string
  pathId: string
  totalModules: number
  completedModules: number
  inProgressModules: number
  completionPercent: number
  lastCompletedModuleId?: string
  finalCheckStatus: CompletionStatus
  practiceSubmitted: number
  needsReviewCount: number
  contentVersion: ContentVersion
}
