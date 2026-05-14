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
  SourceArtifact,
  SourceRef,
} from '../types'

export const CONTENT_VERSION = 'pbis-mvp-2026-05-08'
export const SOURCE_LIBRARY_VERSION = 'think-training-source-library-2026-05-13'
export const SITE_LEAD_ONBOARDING_CONTENT_VERSION = 'site-lead-onboarding-v0-2026-05-13'

export const trainingSourceLibrary: SourceArtifact[] = [
  {
    id: 'sop-program-induction',
    artifact: 'SOP_Program Induction.pdf',
    title: 'Program Induction Training Plan and Process',
    filePath: '/Users/clustox1/Documents/Think/retrainingaiclustoxthinktogether/SOP_Program Induction.pdf',
    documentType: 'sop',
    department: 'Program Pros',
    effectiveDate: 'February 2026',
    reviewDate: null,
    contentVersion: SOURCE_LIBRARY_VERSION,
    extractedAt: '2026-05-13T00:00:00.000Z',
  },
  {
    id: 'sop-site-lead-onboarding',
    artifact: 'SOP_Site Lead Onboarding.pdf',
    title: 'Site Lead Onboarding Program',
    filePath: '/Users/clustox1/Documents/Think/retrainingaiclustoxthinktogether/SOP_Site Lead Onboarding.pdf',
    documentType: 'sop',
    department: 'Program Pros',
    effectiveDate: 'February 2026',
    reviewDate: null,
    contentVersion: SOURCE_LIBRARY_VERSION,
    extractedAt: '2026-05-13T00:00:00.000Z',
  },
  {
    id: 'knowledge-check-back-to-school-2025',
    artifact: 'KNOWLEDGE CHECK_Back to School 2025.pdf',
    title: 'Back to School 2025 Knowledge Check',
    filePath: '/Users/clustox1/Documents/Think/retrainingaiclustoxthinktogether (1)/KNOWLEDGE CHECK_Back to School 2025.pdf',
    documentType: 'knowledge-check',
    department: 'Program Pros',
    contentVersion: SOURCE_LIBRARY_VERSION,
    extractedAt: '2026-05-13T00:00:00.000Z',
  },
  {
    id: 'pbis-ppt-master',
    artifact: 'PBIS PPT Master.pptx',
    title: 'PBIS 2025-2026 Program Induction',
    filePath: '/Users/clustox1/Documents/Think/retrainingaiclustoxthinktogether (1)/PBIS PPT Master.pptx',
    documentType: 'presentation',
    department: 'Program Pros',
    contentVersion: SOURCE_LIBRARY_VERSION,
    extractedAt: '2026-05-13T00:00:00.000Z',
  },
  {
    id: 'pbis-ec2-updated-2025-11-04',
    artifact: 'FINAL - PBIS EC2 - updated 11.4.25.pptx',
    title: 'PBIS EC2',
    filePath: '/Users/clustox1/Documents/Think/retrainingaiclustoxthinktogether (2)/FINAL - PBIS EC2 - updated 11.4.25.pptx',
    documentType: 'presentation',
    department: 'Program Pros',
    contentVersion: SOURCE_LIBRARY_VERSION,
    extractedAt: '2026-05-13T00:00:00.000Z',
  },
  {
    id: 'pbis-part-3-template',
    artifact: 'PBIS part 3 PPT Template.pptx',
    title: 'PBIS Part 3',
    filePath: '/Users/clustox1/Documents/Think/retrainingaiclustoxthinktogether (2)/PBIS part 3 PPT Template.pptx',
    documentType: 'presentation',
    department: 'Program Pros',
    contentVersion: SOURCE_LIBRARY_VERSION,
    extractedAt: '2026-05-13T00:00:00.000Z',
  },
]

export const sharedSourceArtifactNames = trainingSourceLibrary.map((source) => source.artifact)

export function getTrainingSourceArtifact(artifact: string): SourceArtifact | undefined {
  return trainingSourceLibrary.find((source) => source.artifact === artifact || source.id === artifact)
}

const programInductionSopRef = (locator: string): SourceRef => ({
  artifact: 'SOP_Program Induction.pdf',
  locator,
})

const siteLeadSopRef = (locator: string): SourceRef => ({
  artifact: 'SOP_Site Lead Onboarding.pdf',
  locator,
})

const knowledgeCheckRef = (locator: string): SourceRef => ({
  artifact: 'KNOWLEDGE CHECK_Back to School 2025.pdf',
  locator,
})

const pbisMasterRef = (locator: string): SourceRef => ({
  artifact: 'PBIS PPT Master.pptx',
  locator,
})

const pbisEc2Ref = (locator: string): SourceRef => ({
  artifact: 'FINAL - PBIS EC2 - updated 11.4.25.pptx',
  locator,
})

const pbisPart3Ref = (locator: string): SourceRef => ({
  artifact: 'PBIS part 3 PPT Template.pptx',
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
      sourceRefs: [
        pbisMasterRef('Slide 4: PBIS objectives'),
        pbisMasterRef('Slide 6: What is PBIS?'),
        pbisMasterRef('Slide 8: Think Together statement of behavioral purpose'),
      ],
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
      sourceRefs: [
        pbisMasterRef('Slide 10: Tier 1 for Year 1'),
        pbisEc2Ref('Slide 10: Tier 1 for Year 1'),
        knowledgeCheckRef('Page 2: Program PBIS question, Tier 1 support'),
      ],
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
      sourceRefs: [
        pbisMasterRef('Slide 12: Punitive vs Restorative Correction'),
        pbisMasterRef('Slides 14-17: Write-Up or Rise Up practice'),
      ],
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
      sourceRefs: [
        pbisMasterRef('Slides 18-24: Behavior Matrix and matrix mindset'),
        pbisEc2Ref('Slides 17-21: Behavior Matrix and behavior flow chart'),
        pbisPart3Ref('Slides 7-12: Matrix works and reality check'),
      ],
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
      sourceRefs: [
        pbisMasterRef('Slides 27-30: Active and Explicit Teaching definitions and practice'),
        pbisMasterRef('Slide 35: Plan for fluency'),
      ],
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
      sourceRefs: [
        pbisMasterRef('Slides 36-40: Minor vs Major behaviors and flowchart'),
        knowledgeCheckRef('Page 2: Program PBIS question, Minor PL Managed and Major SPM Managed'),
      ],
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
      sourceRefs: [
        pbisMasterRef('Slides 50-53: Pre-Corrective Phrases and spot the difference'),
        pbisPart3Ref('Slide 14: De-escalation strategy, restate expectation and give choice'),
      ],
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
      sourceRefs: [
        pbisMasterRef('Slides 56-59: Acknowledging Positive Behavior'),
        pbisEc2Ref('Slides 11-15: PBIS incentives core principles and levels'),
        pbisPart3Ref('Slide 14: Notice and praise small positive behaviors'),
      ],
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
      sourceRefs: [
        pbisMasterRef('Slide 60: Objectives review'),
        pbisPart3Ref('Slide 16: Understanding the de-escalation cycle'),
        programInductionSopRef('Page 4: Program Pros facilitate Knowledge Checks and Surveys'),
      ],
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
      sourceRefs: [
        pbisMasterRef('Slide 61: Commitments'),
        programInductionSopRef('Page 5: Day 3 LMS attendance entered by 4:00pm and clearance email by 5:00pm'),
        programInductionSopRef('Page 6: Clearance Email process'),
      ],
    },
    scenarioIds: [],
    knowledgeCheckItemIds: ['kc-commitment'],
    requiredForCompletion: true,
  },
]

const siteLeadOnboardingModules: Module[] = [
  {
    id: 'slo-purpose-and-role',
    title: 'SLO Purpose and Role Readiness',
    order: 1,
    estimatedMinutes: 6,
    content: {
      moduleId: 'slo-purpose-and-role',
      contentVersion: SITE_LEAD_ONBOARDING_CONTENT_VERSION,
      summary: 'Site Lead Onboarding prepares newly hired or promoted full-time Site Leads for leadership expectations, program culture, safety, and consistent site implementation.',
      learningObjectives: ['Describe the purpose of Site Lead Onboarding', 'Connect the Site Lead role to staff coaching and student success'],
      keyPoints: ['SLO is the standardized onboarding framework for new Site Leads', 'Participants complete the full series within their first 30 days'],
      sourceRefs: [
        siteLeadSopRef('Pages 1-2: Introduction, purpose, scope, and 30-day completion expectation'),
        siteLeadSopRef('Page 2: Outcomes for Site Lead foundational knowledge and site implementation'),
      ],
    },
    scenarioIds: [],
    knowledgeCheckItemIds: [],
    requiredForCompletion: true,
  },
  {
    id: 'slo-stakeholder-responsibilities',
    title: 'Stakeholder Responsibilities',
    order: 2,
    estimatedMinutes: 7,
    content: {
      moduleId: 'slo-stakeholder-responsibilities',
      contentVersion: SITE_LEAD_ONBOARDING_CONTENT_VERSION,
      summary: 'SLO depends on coordinated responsibilities across HR, Talent Development and Learning, Regional Supervisors, Site Leads, Program Pros, Program Quality and Compliance, Student Data, and Insights and Evaluation.',
      learningObjectives: ['Identify who owns enrollment, facilitation, supervision, attendance, and reporting', 'Name the Site Lead participation expectations'],
      keyPoints: ['HR supports ADP role setup for auto-enrollment', 'Regional Supervisors arrange coverage and track completion evidence', 'Site Leads attend, participate, complete assignments, and communicate conflicts at least 24 hours ahead'],
      sourceRefs: [
        siteLeadSopRef('Pages 3-4: Responsibilities by HR, Talent Development and Learning, Regional Supervisors, Site Leads, and Program Pros'),
        siteLeadSopRef('Page 4: Conflict notification and virtual camera expectations'),
      ],
    },
    scenarioIds: [],
    knowledgeCheckItemIds: [],
    requiredForCompletion: true,
  },
  {
    id: 'slo-cycle-and-makeup',
    title: 'Four-Week Cycle and Make-Up Process',
    order: 3,
    estimatedMinutes: 6,
    content: {
      moduleId: 'slo-cycle-and-makeup',
      contentVersion: SITE_LEAD_ONBOARDING_CONTENT_VERSION,
      summary: 'SLO is delivered during a four-week cycle with Monday and Tuesday course delivery, Week 4 make-up sessions when needed, and LMS reminder notifications tied to the learning path.',
      learningObjectives: ['Explain the four-week SLO cycle', 'Describe how missed sessions move into make-up support'],
      keyPoints: ['New Site Leads are auto-enrolled through ADP role assignment', 'Courses are delivered Monday and Tuesday during each cycle', 'Holiday adjustments and missed courses are handled through Week 4 make-up sessions'],
      sourceRefs: [
        siteLeadSopRef('Page 5: Auto-enrollment and learning path process'),
        siteLeadSopRef('Pages 5-6: Monday and Tuesday facilitation schedule and Week 4 make-up sessions'),
      ],
    },
    scenarioIds: [],
    knowledgeCheckItemIds: [],
    requiredForCompletion: true,
  },
  {
    id: 'slo-attendance-reporting-clearance',
    title: 'Attendance, Reporting, and Clearance',
    order: 4,
    estimatedMinutes: 8,
    content: {
      moduleId: 'slo-attendance-reporting-clearance',
      contentVersion: SITE_LEAD_ONBOARDING_CONTENT_VERSION,
      summary: 'Facilitators track SLO attendance through the LMS, supervisors monitor completion evidence, Insights and Evaluation shares dashboards, and Program Pros sends the clearance email at the close of the monthly cycle.',
      learningObjectives: ['Run and interpret the LMS attendance reporting workflow', 'Connect completion evidence to clearance communication'],
      keyPoints: ['Attendance is tracked in the LMS SLO Learning Path', 'Reports can be filtered by date, group, department, or learner', 'Clearance email is sent at the close of each monthly cycle'],
      sourceRefs: [
        siteLeadSopRef('Pages 4-5: LMS updates, training survey feedback, dashboards, and clearance email'),
        siteLeadSopRef('Pages 6-7: Attendance report steps and export options'),
      ],
    },
    scenarioIds: [],
    knowledgeCheckItemIds: [],
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
    sourceRefs: [pbisMasterRef('Slide 47: TK-MS flowchart scenario, light horseplay while waiting in line')],
    contentVersion: CONTENT_VERSION,
  },
  {
    id: 'physical-fight-transition',
    moduleId: 'minor-vs-major',
    title: 'Physical Fight During Transition',
    prompt: 'During a transition, two students begin hitting each other and nearby students step back.',
    skillFocus: 'major behavior escalation and safety response',
    expectedResponseElements: ['Call for support', 'Separate for safety when possible', 'Document and follow site protocol'],
    sourceRefs: [
      pbisMasterRef('Slide 37: Minor or Major, students physically fighting during transition'),
      pbisMasterRef('Slide 38: Managing Students Behavior, physical altercation'),
    ],
    contentVersion: CONTENT_VERSION,
  },
  {
    id: 'jacob-pencil-pouch-bullying',
    moduleId: 'restorative-correction',
    title: 'Jacob and the Pencil Pouch',
    prompt: 'Jacob says classmates keep taking his pencil pouch, laughing, and telling him not to report it.',
    skillFocus: 'bullying recognition, safety, and restorative follow-up',
    expectedResponseElements: ['Protect Jacob from further harm', 'Report and document bullying indicators', 'Plan restorative repair after safety is addressed'],
    sourceRefs: [
      pbisEc2Ref('Slide 30: Jacob pencil pouch scenario'),
      pbisEc2Ref('Slides 31-34: Jacob action options and outcomes'),
    ],
    contentVersion: CONTENT_VERSION,
  },
  {
    id: 'vague-line-up-phrase-rewrite',
    moduleId: 'active-explicit-teaching',
    title: 'Rewrite a Vague Line-Up Phrase',
    prompt: 'Rewrite the phrase "Line up right" into language students can see, hear, and practice.',
    skillFocus: 'explicit direction with observable behavior',
    expectedResponseElements: ['Name the exact action', 'Use positive language', 'Include voice/body expectations'],
    sourceRefs: [pbisMasterRef('Slides 51-52: Spot the difference line-up direction')],
    contentVersion: CONTENT_VERSION,
  },
  {
    id: 'running-hiding-under-table',
    moduleId: 'positive-acknowledgment',
    title: 'Student Running and Hiding Under Table',
    prompt: 'A student runs from the activity area and hides under a table when asked to join the group.',
    skillFocus: 'calm support, regulation, and reinforcing safe re-entry',
    expectedResponseElements: ['Stay calm and reduce audience', 'Offer a simple safe next step', 'Acknowledge any movement toward safety or rejoining'],
    sourceRefs: [
      pbisEc2Ref('Slide 22: TK-2 scenario, student runs and hides under a table'),
      pbisPart3Ref('Slide 16: De-escalation cycle, escalation and recovery'),
    ],
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
    sourceRefs: [
      pbisMasterRef('Slide 6: What is PBIS?'),
      pbisMasterRef('Slide 8: Think Together statement of behavioral purpose'),
    ],
    contentVersion: CONTENT_VERSION,
  },
  {
    id: 'kc-tier-1-prevention',
    moduleId: 'tier-1-support',
    prompt: 'Which response best reflects Tier 1 support?',
    choices: ['Use predictable routines, active supervision, and positive acknowledgment before behavior escalates.', 'Wait until students break a rule, then assign a consequence.', 'Use individualized behavior plans for every student first.'],
    correctAnswer: 'Use predictable routines, active supervision, and positive acknowledgment before behavior escalates.',
    rationale: 'Tier 1 is the universal prevention layer for all students.',
    sourceRefs: [
      knowledgeCheckRef('Page 2: Program PBIS question, What tier of support are we implementing?'),
      pbisMasterRef('Slide 10: Tier 1 for Year 1'),
    ],
    contentVersion: CONTENT_VERSION,
  },
  {
    id: 'kc-restorative-correction',
    moduleId: 'restorative-correction',
    prompt: 'Which correction is most restorative?',
    choices: ['Publicly shame the student so others learn', 'Calmly name the behavior, reteach the expectation, and plan repair', 'Ignore repeated harm to avoid conflict'],
    correctAnswer: 'Calmly name the behavior, reteach the expectation, and plan repair',
    rationale: 'Restorative correction keeps dignity while repairing harm.',
    sourceRefs: [pbisMasterRef('Slides 12-17: Punitive vs Restorative Correction and practice')],
    contentVersion: CONTENT_VERSION,
  },
  {
    id: 'kc-behavior-matrix',
    moduleId: 'behavior-matrix',
    prompt: 'What does a behavior matrix help staff do?',
    choices: ['Translate expectations into observable behaviors by setting', 'Create different rules for each staff member', 'Avoid teaching routines'],
    correctAnswer: 'Translate expectations into observable behaviors by setting',
    rationale: 'The matrix makes expectations consistent and visible.',
    sourceRefs: [
      pbisMasterRef('Slides 18-24: Behavior Matrix'),
      pbisPart3Ref('Slides 7-12: Matrix use in real situations'),
    ],
    contentVersion: CONTENT_VERSION,
  },
  {
    id: 'kc-explicit-teaching',
    moduleId: 'active-explicit-teaching',
    prompt: 'What makes a direction explicit?',
    choices: ['It tells students exactly what to do in observable terms', 'It is short enough to shout', 'It uses adult shorthand'],
    correctAnswer: 'It tells students exactly what to do in observable terms',
    rationale: 'Explicit directions remove ambiguity by naming visible actions.',
    sourceRefs: [pbisMasterRef('Slides 27-30: Active and Explicit Teaching')],
    contentVersion: CONTENT_VERSION,
  },
  {
    id: 'kc-minor-major',
    moduleId: 'minor-vs-major',
    prompt: 'What should happen first when behavior creates an immediate safety risk?',
    choices: ['Escalate for support and follow safety protocol', 'Use a quiet reminder only', 'Delay response until the end of program'],
    correctAnswer: 'Escalate for support and follow safety protocol',
    rationale: 'Major behavior requires immediate safety response.',
    sourceRefs: [
      knowledgeCheckRef('Page 2: Program PBIS question, two categories of behaviors'),
      pbisMasterRef('Slides 36-40: Minor vs Major behaviors and flowchart'),
    ],
    contentVersion: CONTENT_VERSION,
  },
  {
    id: 'kc-pre-correction',
    moduleId: 'pre-corrective-phrases',
    prompt: 'When is pre-correction most useful?',
    choices: ['Before a predictable challenge or transition', 'Only after a major incident', 'After students have already left'],
    correctAnswer: 'Before a predictable challenge or transition',
    rationale: 'Pre-correction reminds students before the moment of need.',
    sourceRefs: [pbisMasterRef('Slides 50-53: Pre-Corrective Phrases')],
    contentVersion: CONTENT_VERSION,
  },
  {
    id: 'kc-positive-acknowledgment',
    moduleId: 'positive-acknowledgment',
    prompt: 'Which acknowledgment is most behavior-specific?',
    choices: ['Good job', 'I like how you kept hands to self while waiting in line', 'Be better next time'],
    correctAnswer: 'I like how you kept hands to self while waiting in line',
    rationale: 'Behavior-specific praise names the expectation and action.',
    sourceRefs: [
      pbisMasterRef('Slides 56-59: Acknowledging Positive Behavior'),
      pbisPart3Ref('Slide 14: Notice and praise small positive behaviors'),
    ],
    contentVersion: CONTENT_VERSION,
  },
  {
    id: 'kc-final-prevention',
    moduleId: 'final-check',
    prompt: 'Which PBIS move should usually come before correction?',
    choices: ['Teaching, modeling, and reinforcing expectations', 'Removing students from every activity', 'Skipping routines to save time'],
    correctAnswer: 'Teaching, modeling, and reinforcing expectations',
    rationale: 'PBIS prioritizes proactive instruction.',
    sourceRefs: [
      pbisMasterRef('Slide 60: Objectives review'),
      pbisPart3Ref('Slide 16: Prevention in de-escalation cycle'),
    ],
    contentVersion: CONTENT_VERSION,
  },
  {
    id: 'kc-final-safety',
    moduleId: 'final-check',
    prompt: 'A physical fight starts during transition. What is the best first priority?',
    choices: ['Safety and escalation protocol', 'A long restorative conversation at the scene', 'Ignoring bystanders'],
    correctAnswer: 'Safety and escalation protocol',
    rationale: 'Restorative repair comes after immediate safety is addressed.',
    sourceRefs: [
      pbisMasterRef('Slide 38: Managing Students Behavior, physical altercation'),
      pbisPart3Ref('Slide 16: Crisis priority is safety and district crisis protocols'),
    ],
    contentVersion: CONTENT_VERSION,
  },
  {
    id: 'kc-commitment',
    moduleId: 'commitment',
    prompt: 'What should a PBIS commitment name?',
    choices: ['A specific practice the learner will use', 'A promise to never need support', 'A list of unrelated job duties'],
    correctAnswer: 'A specific practice the learner will use',
    rationale: 'A specific commitment supports transfer from training to program practice.',
    sourceRefs: [
      pbisMasterRef('Slide 61: Commitments'),
      programInductionSopRef('Page 6: Staff Commitment Forms and clearance email'),
    ],
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
  sourceRefs: [
    programInductionSopRef('Pages 1-2: Purpose, scope, and outcomes for Program Induction Training'),
    programInductionSopRef('Pages 4-6: Program Pros facilitation, knowledge checks, surveys, LMS attendance, and clearance email'),
    pbisMasterRef('Slides 4-61: PBIS Program Induction training content'),
    pbisEc2Ref('Slides 5-36: PBIS part two objectives, tools, behavior scenarios, and Jacob practice'),
    pbisPart3Ref('Slides 5-17: PBIS part three matrix, reality check, and de-escalation practice'),
    knowledgeCheckRef('Pages 1-2: Back to School 2025 knowledge-check questions, Program PBIS row'),
    siteLeadSopRef('Pages 1-4: Site Lead Onboarding purpose, scope, outcomes, responsibilities, and 4-week cycle'),
  ],
}

const siteLeadOnboardingPath: LearningPath = {
  id: 'site-lead-onboarding-v0',
  title: 'Site Lead Onboarding v0',
  description: 'Minimal Site Lead Onboarding path for validating SOP-sourced leadership onboarding content.',
  audience: 'Newly hired or promoted full-time Site Leads',
  contentVersion: SITE_LEAD_ONBOARDING_CONTENT_VERSION,
  moduleIds: siteLeadOnboardingModules.map((moduleItem) => moduleItem.id),
  modules: siteLeadOnboardingModules,
  sourceRefs: [
    siteLeadSopRef('Pages 1-2: Site Lead Onboarding purpose, scope, outcomes, and 30-day completion requirement'),
    siteLeadSopRef('Pages 3-5: Stakeholder responsibilities and participant expectations'),
    siteLeadSopRef('Pages 5-7: Auto-enrollment, four-week facilitation schedule, make-up sessions, LMS attendance reporting, and clearance email'),
  ],
}

const learningPaths = [learningPath, siteLeadOnboardingPath]

export const trainingModules = modules
export const siteLeadOnboardingTrainingModules = siteLeadOnboardingModules
export const trainingScenarios = scenarios
export const trainingKnowledgeCheckItems = knowledgeCheckItems
export const trainingLearningPaths = learningPaths

export function getLearningPath(pathId = 'program-induction-pbis'): LearningPath {
  return learningPaths.find((path) => path.id === pathId) ?? learningPath
}

export function getModuleById(moduleId: string): Module | undefined {
  return learningPaths.flatMap((path) => path.modules).find((moduleItem) => moduleItem.id === moduleId)
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
