export type MvpPhase = 'MVP' | 'Phase 2'

export interface MvpMilestone {
  phase: MvpPhase
  milestoneId: string
  milestone: string
  deliveryWindow: string
  ownerStream: string
  deliverables: string
  acceptanceCriteria: string
  dependencies: string
  notes: string
}

export const mvpMilestones: readonly MvpMilestone[] = [
  {
    phase: 'MVP',
    milestoneId: 'M1',
    milestone: 'Discovery confirmation and demo scope lock',
    deliveryWindow: 'Week 1 Day 1-2',
    ownerStream: 'Product/Delivery',
    deliverables: 'Confirmed PBIS MVP scope; persona list; learner/admin demo script; source artifact inventory',
    acceptanceCriteria:
      'Stakeholders agree MVP is Program Induction PBIS mobile training plus scenario coach and admin reporting; exclusions documented',
    dependencies: 'Meeting notes; SOPs; PBIS decks; knowledge check sample',
    notes: 'Avoid positioning as LMS replacement',
  },
  {
    phase: 'MVP',
    milestoneId: 'M2',
    milestone: 'Content extraction and versioned source library',
    deliveryWindow: 'Week 1 Day 2-4',
    ownerStream: 'Content/Data',
    deliverables:
      'Structured extraction from SOP PDFs, PBIS decks, and knowledge check PDF; source metadata; citation map; validation flags',
    acceptanceCriteria:
      'All shared files are indexed with page/slide refs; ambiguous answers flagged for human review; content version recorded',
    dependencies: 'M1; source artifacts',
    notes:
      'Use current files as v0.1 content package: SOP_Program Induction.pdf; SOP_Site Lead Onboarding.pdf; KNOWLEDGE CHECK_Back to School 2025.pdf; PBIS PPT Master.pptx; FINAL - PBIS EC2 - updated 11.4.25.pptx; PBIS part 3 PPT Template.pptx',
  },
  {
    phase: 'MVP',
    milestoneId: 'M3',
    milestone: 'Design system and clickable UX shell',
    deliveryWindow: 'Week 1 Day 3-5',
    ownerStream: 'UX/UI',
    deliverables:
      'Think Together-inspired tokens; mobile learner shell; desktop admin shell; navigation; status components; empty/loading/error states',
    acceptanceCriteria:
      'Mobile learner screen fits 390px width; admin dashboard usable on desktop; logo/colors applied; WCAG AA contrast for primary controls',
    dependencies: 'M1; Think Together website/logo',
    notes: 'Use shadcn/Radix/Tailwind-style patterns or equivalent',
  },
  {
    phase: 'MVP',
    milestoneId: 'M4',
    milestone: 'Learner onboarding and learning path',
    deliveryWindow: 'Week 2 Day 1-3',
    ownerStream: 'Frontend/Learner',
    deliverables:
      'Welcome/verify screen; assigned PBIS path; ordered modules; progress state; resume behavior',
    acceptanceCriteria:
      'Learner can verify with demo identity; sees Program Induction PBIS path; modules show locked/current/complete states',
    dependencies: 'M2; M3',
    notes: 'No real ADP/LMS integration in MVP',
  },
  {
    phase: 'MVP',
    milestoneId: 'M5',
    milestone: 'PBIS micro-lessons and knowledge checks',
    deliveryWindow: 'Week 2 Day 3-5',
    ownerStream: 'Frontend/Learner',
    deliverables:
      'PBIS overview; Tier 1; restorative correction; behavior matrix; minor/major; pre-correction; positive acknowledgment; final quiz',
    acceptanceCriteria:
      'Each module has one check/practice; final quiz scores pass/fail; answers show feedback; content cites source refs internally',
    dependencies: 'M2; M4',
    notes: 'One question per screen on mobile',
  },
  {
    phase: 'MVP',
    milestoneId: 'M6',
    milestone: 'Scenario coach scoring engine',
    deliveryWindow: 'Week 3 Day 1-3',
    ownerStream: 'AI/Coaching',
    deliverables: 'Scenario response UI; rubric scoring; feedback template; retry flow; source-backed coaching notes',
    acceptanceCriteria:
      'At least 5 PBIS scenarios score into Not Yet/Developing/Meets/Exceeds; feedback includes rationale and next step; unsupported policy questions are refused',
    dependencies: 'M2; M5',
    notes: 'MVP can use deterministic local rubric plus mock AI-style feedback',
  },
  {
    phase: 'MVP',
    milestoneId: 'M7',
    milestone: 'Admin operations dashboard',
    deliveryWindow: 'Week 3 Day 2-5',
    ownerStream: 'Admin/Reporting',
    deliverables:
      'KPI dashboard; cohort table; participant records; completion status; weak-topic summary; facilitator feedback summary',
    acceptanceCriteria:
      'Admin can filter by cohort/region/status; sees enrolled/completed/blocked/makeup/average score; no oversized marketing layout',
    dependencies: 'M3; M4; M5',
    notes: 'Desktop density prioritized',
  },
  {
    phase: 'MVP',
    milestoneId: 'M8',
    milestone: 'Attendance clearance and export workflow',
    deliveryWindow: 'Week 4 Day 1-3',
    ownerStream: 'Admin/Reporting',
    deliverables:
      'Attendance status; clearance-ready list; CSV export; LMS verification status; export timestamp',
    acceptanceCriteria:
      'Admin can export clearance CSV; partial attendance is blocked; exported/verified status visible',
    dependencies: 'M7',
    notes: 'Import/export only; no LMS writeback',
  },
  {
    phase: 'MVP',
    milestoneId: 'M9',
    milestone: 'End-to-end pilot demo',
    deliveryWindow: 'Week 4 Day 3-5',
    ownerStream: 'QA/Delivery',
    deliverables: 'Seed demo data; learner path demo; scenario coach demo; admin export demo; QA checklist',
    acceptanceCriteria:
      'Core learner flow completes; admin sees completion; CSV export works; mobile and desktop verified; known gaps listed',
    dependencies: 'M4-M8',
    notes: 'Demo with one PBIS path and one cohort',
  },
  {
    phase: 'MVP',
    milestoneId: 'M10',
    milestone: 'MVP hardening and handoff',
    deliveryWindow: 'Week 5',
    ownerStream: 'Engineering/Delivery',
    deliverables:
      'Bug fixes; accessibility pass; responsive pass; README; deployment notes; pilot feedback capture list',
    acceptanceCriteria:
      'No blocking UI overlap; tests pass; build succeeds; source limitations documented; pilot-ready package delivered',
    dependencies: 'M9',
    notes: 'Optional if demo must be production-pilot ready',
  },
  {
    phase: 'Phase 2',
    milestoneId: 'P2-M1',
    milestone: 'Real authentication and role-based access',
    deliveryWindow: 'Weeks 6-7',
    ownerStream: 'Platform',
    deliverables: 'SSO/email auth; learner/admin roles; facilitator permissions; audit basics',
    acceptanceCriteria: 'Users see only allowed surfaces; admin actions auditable',
    dependencies: 'MVP approval',
    notes: 'Choose auth provider after IT review',
  },
  {
    phase: 'Phase 2',
    milestoneId: 'P2-M2',
    milestone: 'Robust content authoring and versioning',
    deliveryWindow: 'Weeks 7-9',
    ownerStream: 'Content Platform',
    deliverables:
      'Admin content editor; quiz/scenario authoring; source upload; version compare; publish workflow',
    acceptanceCriteria:
      'Training team can update PBIS modules without developer help; old completions retain historical version',
    dependencies: 'P2-M1',
    notes: 'Requires content governance',
  },
  {
    phase: 'Phase 2',
    milestoneId: 'P2-M3',
    milestone: 'Production RAG knowledge assistant',
    deliveryWindow: 'Weeks 8-10',
    ownerStream: 'AI/Knowledge',
    deliverables: 'Vector retrieval; citation UI; SOP Q&A; confidence labels; hallucination eval suite',
    acceptanceCriteria:
      '90%+ SOP retrieval target; 0 unsupported policy claims in eval set; citations visible',
    dependencies: 'MVP coach feedback; validated source library',
    notes: 'Can expand beyond PBIS after governance',
  },
  {
    phase: 'Phase 2',
    milestoneId: 'P2-M4',
    milestone: 'Video/self-recorded coaching',
    deliveryWindow: 'Weeks 10-13',
    ownerStream: 'AI/Coaching',
    deliverables:
      'Learner recording upload; rubric review; optional transcript; coach feedback; human review queue',
    acceptanceCriteria:
      'Staff can submit practice recording; system provides structured feedback; sensitive data policy approved',
    dependencies: 'P2-M1; AI/privacy approval',
    notes: 'High privacy and consent requirement',
  },
  {
    phase: 'Phase 2',
    milestoneId: 'P2-M5',
    milestone: 'LMS integration',
    deliveryWindow: 'Weeks 12-15',
    ownerStream: 'Integrations',
    deliverables: 'LMS course assignment; completion sync; reconciliation dashboard; scheduled exports',
    acceptanceCriteria: 'Platform and LMS completion statuses reconcile; failures visible',
    dependencies: 'LMS API/access confirmed',
    notes: 'MVP remains import/export until API is approved',
  },
  {
    phase: 'Phase 2',
    milestoneId: 'P2-M6',
    milestone: 'ADP/read-only HR integration',
    deliveryWindow: 'Weeks 14-17',
    ownerStream: 'Integrations',
    deliverables:
      'Read-only employee profile sync; role/title matching; auto-enrollment rules; exception queue',
    acceptanceCriteria:
      'Eligible staff auto-enroll based on role/title; mismatches are flagged; no writeback without approval',
    dependencies: 'ADP API/security review',
    notes: 'Start read-only',
  },
  {
    phase: 'Phase 2',
    milestoneId: 'P2-M7',
    milestone: 'Site Lead Onboarding path',
    deliveryWindow: 'Weeks 16-19',
    ownerStream: 'Learning Product',
    deliverables:
      'Four-week SLO learning path; assignments; participation tracking; makeup sessions; supervisor view',
    acceptanceCriteria:
      'Site Leads can complete SLO cycle tracking; supervisors see status and makeup needs',
    dependencies: 'MVP learner/admin foundations',
    notes: 'Use SOP_Site Lead Onboarding.pdf as source',
  },
  {
    phase: 'Phase 2',
    milestoneId: 'P2-M8',
    milestone: 'Training deck generation assistant',
    deliveryWindow: 'Weeks 18-21',
    ownerStream: 'AI/Content Creation',
    deliverables:
      'Prompted deck outline; Think Together style guide; slide draft export; human approval workflow',
    acceptanceCriteria:
      'Training team can generate draft in-person training deck from approved sources; requires human approval before use',
    dependencies: 'Content governance; brand UI rules',
    notes: 'Do not allow unchecked hallucinated curriculum',
  },
  {
    phase: 'Phase 2',
    milestoneId: 'P2-M9',
    milestone: 'Advanced analytics and region capacity planning',
    deliveryWindow: 'Weeks 20-24',
    ownerStream: 'Analytics',
    deliverables:
      'Throughput trends; facilitator load; emerging-region demand; cohort fill rates; weak-skill trends',
    acceptanceCriteria:
      'Leadership can compare demand vs capacity and identify training bottlenecks',
    dependencies: 'MVP reporting data; integrations preferred',
    notes: 'Supports 7k-12k staff scale planning',
  },
]

export function getMilestonesByPhase(phase: MvpPhase): MvpMilestone[] {
  return mvpMilestones.filter((milestone) => milestone.phase === phase)
}

export function getCurrentMvpMilestoneSummary() {
  const mvpPlan = getMilestonesByPhase('MVP')
  const currentMilestone = mvpPlan[0]
  const nextMilestone = mvpPlan[1]

  return {
    phase: 'MVP' as const,
    totalMilestones: mvpPlan.length,
    currentMilestoneId: currentMilestone?.milestoneId ?? '',
    currentMilestone: currentMilestone?.milestone ?? '',
    deliveryWindow: currentMilestone?.deliveryWindow ?? '',
    nextMilestoneId: nextMilestone?.milestoneId ?? '',
  }
}
