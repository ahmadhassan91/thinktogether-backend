import type {
  AttendanceRecord,
  ClearanceRecord,
  Cohort,
  CompletionRecord,
  ExportBatch,
  FacilitatorFeedback,
  KnowledgeCheckItem,
  Learner,
  LearnerProgressSummary,
  LearningPath,
  Module,
  Participant,
  PracticeSubmission,
  Scenario,
  SourceRef,
} from '../types'

export const CONTENT_VERSION = 'pbis-mvp-2026-05-08'

const pbisDeckRef = (locator: string): SourceRef => ({
  artifact: 'Program Induction PBIS deck',
  locator,
})

const behaviorDeckRef = (locator: string): SourceRef => ({
  artifact: 'PBIS behavior response scenarios deck',
  locator,
})

const modules: Module[] = [
  {
    id: 'pbis-overview',
    title: 'PBIS Overview',
    order: 1,
    estimatedMinutes: 6,
    content: {
      moduleId: 'pbis-overview',
      contentVersion: CONTENT_VERSION,
      summary: 'PBIS is a proactive framework for teaching, modeling, and reinforcing expected behavior.',
      learningObjectives: ['Explain PBIS as prevention first', 'Connect PBIS to safe program culture'],
      keyPoints: ['Teach expectations before correction', 'Use consistent adult responses across spaces'],
      sourceRefs: [pbisDeckRef('PBIS overview: proactive, positive, instructional approach')],
    },
    scenarioIds: [],
    knowledgeCheckItemIds: ['kc-pbis-purpose'],
    requiredForCompletion: true,
  },
  {
    id: 'tier-1-support',
    title: 'Tier 1 Support',
    order: 2,
    estimatedMinutes: 7,
    content: {
      moduleId: 'tier-1-support',
      contentVersion: CONTENT_VERSION,
      summary: 'Tier 1 support is the universal layer: routines, active supervision, and reinforcement for all students.',
      learningObjectives: ['Name Tier 1 prevention moves', 'Use universal supports before escalation'],
      keyPoints: ['Routines reduce ambiguity', 'Active supervision pairs scanning with proximity'],
      sourceRefs: [pbisDeckRef('Tier 1 supports: universal prevention strategies')],
    },
    scenarioIds: ['light-horseplay-line'],
    knowledgeCheckItemIds: ['kc-tier-1-prevention'],
    requiredForCompletion: true,
  },
  {
    id: 'restorative-correction',
    title: 'Restorative Correction',
    order: 3,
    estimatedMinutes: 8,
    content: {
      moduleId: 'restorative-correction',
      contentVersion: CONTENT_VERSION,
      summary: 'Correction should be calm, brief, private when possible, and aimed at repairing harm.',
      learningObjectives: ['Distinguish punitive and restorative responses', 'Use correction that preserves dignity'],
      keyPoints: ['Correct the behavior, not the student identity', 'Reconnect students to expectations'],
      sourceRefs: [pbisDeckRef('Punitive vs restorative correction')],
    },
    scenarioIds: ['jacob-pencil-pouch-bullying'],
    knowledgeCheckItemIds: ['kc-restorative-correction'],
    requiredForCompletion: true,
  },
  {
    id: 'behavior-matrix',
    title: 'Behavior Matrix',
    order: 4,
    estimatedMinutes: 6,
    content: {
      moduleId: 'behavior-matrix',
      contentVersion: CONTENT_VERSION,
      summary: 'A behavior matrix translates broad expectations into observable actions by setting.',
      learningObjectives: ['Read a matrix by expectation and location', 'Use matrix language during routines'],
      keyPoints: ['Observable language supports consistency', 'Expectations should be positively stated'],
      sourceRefs: [pbisDeckRef('Behavior matrix examples by setting')],
    },
    scenarioIds: [],
    knowledgeCheckItemIds: ['kc-behavior-matrix'],
    requiredForCompletion: true,
  },
  {
    id: 'active-explicit-teaching',
    title: 'Active and Explicit Teaching',
    order: 5,
    estimatedMinutes: 7,
    content: {
      moduleId: 'active-explicit-teaching',
      contentVersion: CONTENT_VERSION,
      summary: 'Explicit teaching names the expectation, models it, gives practice, and checks for understanding.',
      learningObjectives: ['Rewrite vague directions', 'Model and practice expectations'],
      keyPoints: ['Say exactly what students should do', 'Practice routines before high-energy moments'],
      sourceRefs: [pbisDeckRef('Active and explicit teaching of expectations')],
    },
    scenarioIds: ['vague-line-up-phrase-rewrite'],
    knowledgeCheckItemIds: ['kc-explicit-teaching'],
    requiredForCompletion: true,
  },
  {
    id: 'minor-vs-major',
    title: 'Minor vs Major Behavior',
    order: 6,
    estimatedMinutes: 8,
    content: {
      moduleId: 'minor-vs-major',
      contentVersion: CONTENT_VERSION,
      summary: 'Minor behaviors can often be corrected in the moment; major incidents need immediate escalation.',
      learningObjectives: ['Classify behavior intensity', 'Know when to call for support'],
      keyPoints: ['Safety risk changes the response', 'Documentation supports follow-up and consistency'],
      sourceRefs: [behaviorDeckRef('Minor vs major behavior decision practice')],
    },
    scenarioIds: ['physical-fight-transition'],
    knowledgeCheckItemIds: ['kc-minor-major'],
    requiredForCompletion: true,
  },
  {
    id: 'pre-corrective-phrases',
    title: 'Pre-Corrective Phrases',
    order: 7,
    estimatedMinutes: 5,
    content: {
      moduleId: 'pre-corrective-phrases',
      contentVersion: CONTENT_VERSION,
      summary: 'Pre-correction reminds students what success looks like before a predictable challenge.',
      learningObjectives: ['Use before-the-moment prompts', 'Pair reminders with specific expectations'],
      keyPoints: ['Pre-correct before transitions', 'Keep phrasing brief, positive, and observable'],
      sourceRefs: [pbisDeckRef('Pre-corrective phrases before transitions')],
    },
    scenarioIds: [],
    knowledgeCheckItemIds: ['kc-pre-correction'],
    requiredForCompletion: true,
  },
  {
    id: 'positive-acknowledgment',
    title: 'Positive Acknowledgment',
    order: 8,
    estimatedMinutes: 6,
    content: {
      moduleId: 'positive-acknowledgment',
      contentVersion: CONTENT_VERSION,
      summary: 'Specific acknowledgment tells students which expectation they met and why it matters.',
      learningObjectives: ['Write behavior-specific praise', 'Balance correction with acknowledgment'],
      keyPoints: ['Name the expectation', 'Acknowledge effort quickly and sincerely'],
      sourceRefs: [pbisDeckRef('Positive behavior acknowledgment examples')],
    },
    scenarioIds: ['running-hiding-under-table'],
    knowledgeCheckItemIds: ['kc-positive-acknowledgment'],
    requiredForCompletion: true,
  },
  {
    id: 'final-check',
    title: 'Final Knowledge Check',
    order: 9,
    estimatedMinutes: 10,
    content: {
      moduleId: 'final-check',
      contentVersion: CONTENT_VERSION,
      summary: 'The final check confirms PBIS decision-making across prevention, correction, and escalation.',
      learningObjectives: ['Apply PBIS across common program situations', 'Confirm readiness for field practice'],
      keyPoints: ['Use the least intensive effective response', 'Escalate immediately when safety is at risk'],
      sourceRefs: [pbisDeckRef('Final PBIS review and readiness check')],
    },
    scenarioIds: [],
    knowledgeCheckItemIds: ['kc-final-prevention', 'kc-final-safety'],
    requiredForCompletion: true,
  },
  {
    id: 'commitment',
    title: 'Commitment',
    order: 10,
    estimatedMinutes: 4,
    content: {
      moduleId: 'commitment',
      contentVersion: CONTENT_VERSION,
      summary: 'Learners commit to consistent, positive, restorative PBIS practices in program spaces.',
      learningObjectives: ['Name one PBIS practice to use first', 'Submit completion evidence'],
      keyPoints: ['Commitments make transfer to practice visible', 'Completion includes content version evidence'],
      sourceRefs: [pbisDeckRef('PBIS commitment and completion receipt')],
    },
    scenarioIds: [],
    knowledgeCheckItemIds: ['kc-commitment'],
    requiredForCompletion: true,
  },
]

const scenarios: Scenario[] = [
  {
    id: 'light-horseplay-line',
    moduleId: 'tier-1-support',
    title: 'Light Horseplay in Line',
    prompt: 'Two students lightly push and laugh while waiting in line. The group is still moving, but the behavior could spread.',
    skillFocus: 'Tier 1 active supervision and calm redirection',
    expectedResponseElements: ['Move closer', 'Restate the line expectation', 'Acknowledge students meeting expectations'],
    sourceRefs: [behaviorDeckRef('Scenario: light horseplay in line')],
    contentVersion: CONTENT_VERSION,
  },
  {
    id: 'physical-fight-transition',
    moduleId: 'minor-vs-major',
    title: 'Physical Fight During Transition',
    prompt: 'During a transition, two students begin hitting each other and nearby students step back.',
    skillFocus: 'major behavior escalation and safety response',
    expectedResponseElements: ['Call for support', 'Separate for safety when possible', 'Document and follow site protocol'],
    sourceRefs: [behaviorDeckRef('Scenario: physical fight during transition')],
    contentVersion: CONTENT_VERSION,
  },
  {
    id: 'jacob-pencil-pouch-bullying',
    moduleId: 'restorative-correction',
    title: 'Jacob and the Pencil Pouch',
    prompt: 'Jacob says classmates keep taking his pencil pouch, laughing, and telling him not to report it.',
    skillFocus: 'bullying recognition, safety, and restorative follow-up',
    expectedResponseElements: ['Protect Jacob from further harm', 'Report and document bullying indicators', 'Plan restorative repair after safety is addressed'],
    sourceRefs: [behaviorDeckRef('Scenario: bullying/pencil pouch Jacob case')],
    contentVersion: CONTENT_VERSION,
  },
  {
    id: 'vague-line-up-phrase-rewrite',
    moduleId: 'active-explicit-teaching',
    title: 'Rewrite a Vague Line-Up Phrase',
    prompt: 'Rewrite the phrase "Line up right" into language students can see, hear, and practice.',
    skillFocus: 'explicit direction with observable behavior',
    expectedResponseElements: ['Name the exact action', 'Use positive language', 'Include voice/body expectations'],
    sourceRefs: [pbisDeckRef('Practice: vague line-up phrase rewrite')],
    contentVersion: CONTENT_VERSION,
  },
  {
    id: 'running-hiding-under-table',
    moduleId: 'positive-acknowledgment',
    title: 'Student Running and Hiding Under Table',
    prompt: 'A student runs from the activity area and hides under a table when asked to join the group.',
    skillFocus: 'calm support, regulation, and reinforcing safe re-entry',
    expectedResponseElements: ['Stay calm and reduce audience', 'Offer a simple safe next step', 'Acknowledge any movement toward safety or rejoining'],
    sourceRefs: [behaviorDeckRef('Scenario: student running/hiding under table')],
    contentVersion: CONTENT_VERSION,
  },
]

const knowledgeCheckItems: KnowledgeCheckItem[] = [
  {
    id: 'kc-pbis-purpose',
    moduleId: 'pbis-overview',
    prompt: 'What is the main purpose of PBIS in Program Induction?',
    choices: ['React quickly after every incident', 'Teach and reinforce expected behavior proactively', 'Replace all site safety procedures'],
    correctAnswer: 'Teach and reinforce expected behavior proactively',
    rationale: 'PBIS starts with prevention, teaching, and positive reinforcement.',
    sourceRefs: [pbisDeckRef('PBIS overview: purpose')],
    contentVersion: CONTENT_VERSION,
  },
  {
    id: 'kc-tier-1-prevention',
    moduleId: 'tier-1-support',
    prompt: 'Which response best reflects Tier 1 support?',
    choices: ['Use predictable routines, active supervision, and positive acknowledgment before behavior escalates.', 'Wait until students break a rule, then assign a consequence.', 'Use individualized behavior plans for every student first.'],
    correctAnswer: 'Use predictable routines, active supervision, and positive acknowledgment before behavior escalates.',
    rationale: 'Tier 1 is the universal prevention layer for all students.',
    sourceRefs: [pbisDeckRef('Tier 1 support check')],
    contentVersion: CONTENT_VERSION,
  },
  {
    id: 'kc-restorative-correction',
    moduleId: 'restorative-correction',
    prompt: 'Which correction is most restorative?',
    choices: ['Publicly shame the student so others learn', 'Calmly name the behavior, reteach the expectation, and plan repair', 'Ignore repeated harm to avoid conflict'],
    correctAnswer: 'Calmly name the behavior, reteach the expectation, and plan repair',
    rationale: 'Restorative correction keeps dignity while repairing harm.',
    sourceRefs: [pbisDeckRef('Restorative correction check')],
    contentVersion: CONTENT_VERSION,
  },
  {
    id: 'kc-behavior-matrix',
    moduleId: 'behavior-matrix',
    prompt: 'What does a behavior matrix help staff do?',
    choices: ['Translate expectations into observable behaviors by setting', 'Create different rules for each staff member', 'Avoid teaching routines'],
    correctAnswer: 'Translate expectations into observable behaviors by setting',
    rationale: 'The matrix makes expectations consistent and visible.',
    sourceRefs: [pbisDeckRef('Behavior matrix check')],
    contentVersion: CONTENT_VERSION,
  },
  {
    id: 'kc-explicit-teaching',
    moduleId: 'active-explicit-teaching',
    prompt: 'What makes a direction explicit?',
    choices: ['It tells students exactly what to do in observable terms', 'It is short enough to shout', 'It uses adult shorthand'],
    correctAnswer: 'It tells students exactly what to do in observable terms',
    rationale: 'Explicit directions remove ambiguity by naming visible actions.',
    sourceRefs: [pbisDeckRef('Explicit teaching check')],
    contentVersion: CONTENT_VERSION,
  },
  {
    id: 'kc-minor-major',
    moduleId: 'minor-vs-major',
    prompt: 'What should happen first when behavior creates an immediate safety risk?',
    choices: ['Escalate for support and follow safety protocol', 'Use a quiet reminder only', 'Delay response until the end of program'],
    correctAnswer: 'Escalate for support and follow safety protocol',
    rationale: 'Major behavior requires immediate safety response.',
    sourceRefs: [behaviorDeckRef('Minor vs major check')],
    contentVersion: CONTENT_VERSION,
  },
  {
    id: 'kc-pre-correction',
    moduleId: 'pre-corrective-phrases',
    prompt: 'When is pre-correction most useful?',
    choices: ['Before a predictable challenge or transition', 'Only after a major incident', 'After students have already left'],
    correctAnswer: 'Before a predictable challenge or transition',
    rationale: 'Pre-correction reminds students before the moment of need.',
    sourceRefs: [pbisDeckRef('Pre-correction check')],
    contentVersion: CONTENT_VERSION,
  },
  {
    id: 'kc-positive-acknowledgment',
    moduleId: 'positive-acknowledgment',
    prompt: 'Which acknowledgment is most behavior-specific?',
    choices: ['Good job', 'I like how you kept hands to self while waiting in line', 'Be better next time'],
    correctAnswer: 'I like how you kept hands to self while waiting in line',
    rationale: 'Behavior-specific praise names the expectation and action.',
    sourceRefs: [pbisDeckRef('Positive acknowledgment check')],
    contentVersion: CONTENT_VERSION,
  },
  {
    id: 'kc-final-prevention',
    moduleId: 'final-check',
    prompt: 'Which PBIS move should usually come before correction?',
    choices: ['Teaching, modeling, and reinforcing expectations', 'Removing students from every activity', 'Skipping routines to save time'],
    correctAnswer: 'Teaching, modeling, and reinforcing expectations',
    rationale: 'PBIS prioritizes proactive instruction.',
    sourceRefs: [pbisDeckRef('Final check: prevention')],
    contentVersion: CONTENT_VERSION,
  },
  {
    id: 'kc-final-safety',
    moduleId: 'final-check',
    prompt: 'A physical fight starts during transition. What is the best first priority?',
    choices: ['Safety and escalation protocol', 'A long restorative conversation at the scene', 'Ignoring bystanders'],
    correctAnswer: 'Safety and escalation protocol',
    rationale: 'Restorative repair comes after immediate safety is addressed.',
    sourceRefs: [behaviorDeckRef('Final check: safety escalation')],
    contentVersion: CONTENT_VERSION,
  },
  {
    id: 'kc-commitment',
    moduleId: 'commitment',
    prompt: 'What should a PBIS commitment name?',
    choices: ['A specific practice the learner will use', 'A promise to never need support', 'A list of unrelated job duties'],
    correctAnswer: 'A specific practice the learner will use',
    rationale: 'A specific commitment supports transfer from training to program practice.',
    sourceRefs: [pbisDeckRef('Commitment check')],
    contentVersion: CONTENT_VERSION,
  },
]

export const learners: Learner[] = [
  {
    id: 'learner-1',
    firstName: 'Maya',
    lastName: 'Rivera',
    email: 'maya.rivera@example.org',
    cohortId: 'cohort-pbis-mvp-1',
    assignedPathIds: ['program-induction-pbis'],
  },
]

export const cohorts: Cohort[] = [
  {
    id: 'cohort-pbis-mvp-1',
    name: 'PBIS MVP Pilot',
    region: 'Emerging Region',
    startsAt: '2026-05-08T09:00:00.000Z',
    facilitatorIds: ['facilitator-1'],
    pathIds: ['program-induction-pbis'],
  },
]

export const participants: Participant[] = [
  {
    id: 'participant-1',
    cohortId: 'cohort-pbis-mvp-1',
    learnerId: 'learner-1',
    role: 'learner',
    joinedAt: '2026-05-08T09:00:00.000Z',
  },
]

export const attendanceRecords: AttendanceRecord[] = []
export const clearanceRecords: ClearanceRecord[] = []
export const facilitatorFeedback: FacilitatorFeedback[] = []
export const exportBatches: ExportBatch[] = []

const learningPath: LearningPath = {
  id: 'program-induction-pbis',
  title: 'Program Induction - PBIS',
  description: 'Structured PBIS micro-learning path for Program Induction MVP learners.',
  audience: 'Think Together program staff',
  contentVersion: CONTENT_VERSION,
  moduleIds: modules.map((moduleItem) => moduleItem.id),
  modules,
  sourceRefs: [pbisDeckRef('Program Induction PBIS path'), behaviorDeckRef('PBIS scenario practice seeds')],
}

export const trainingModules = modules
export const trainingScenarios = scenarios
export const trainingKnowledgeCheckItems = knowledgeCheckItems

export function getLearningPath(): LearningPath {
  return learningPath
}

export function getModuleById(moduleId: string): Module | undefined {
  return modules.find((moduleItem) => moduleItem.id === moduleId)
}

export function getScenarioById(scenarioId: string): Scenario | undefined {
  return scenarios.find((scenario) => scenario.id === scenarioId)
}

export function getKnowledgeCheckItems(moduleId?: string): KnowledgeCheckItem[] {
  if (!moduleId) {
    return knowledgeCheckItems
  }

  return knowledgeCheckItems.filter((item) => item.moduleId === moduleId)
}

export function getLearnerProgressSummary(
  learnerId: string,
  completionRecords: CompletionRecord[] = [],
  practiceSubmissions: PracticeSubmission[] = [],
): LearnerProgressSummary {
  const learnerCompletions = completionRecords.filter((record) => record.learnerId === learnerId)
  const completedRecords = learnerCompletions.filter((record) => record.status === 'completed')
  const inProgressModules = learnerCompletions.filter((record) => record.status === 'in_progress').length
  const lastCompletedRecord = completedRecords
    .filter((record) => record.completedAt)
    .sort((left, right) => String(left.completedAt).localeCompare(String(right.completedAt)))
    .at(-1)
  const finalCheckStatus = learnerCompletions.find((record) => record.moduleId === 'final-check')?.status ?? 'not_started'
  const learnerPractice = practiceSubmissions.filter((submission) => submission.learnerId === learnerId)
  const needsReviewCount = learnerPractice.filter((submission) => submission.status === 'needs_review').length

  return {
    learnerId,
    pathId: learningPath.id,
    totalModules: learningPath.modules.length,
    completedModules: completedRecords.length,
    inProgressModules,
    completionPercent: Math.round((completedRecords.length / learningPath.modules.length) * 100),
    lastCompletedModuleId: lastCompletedRecord?.moduleId,
    finalCheckStatus,
    practiceSubmitted: learnerPractice.length,
    needsReviewCount,
    contentVersion: CONTENT_VERSION,
  }
}
