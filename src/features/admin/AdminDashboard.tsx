import { useMemo, useState, useEffect, type CSSProperties, type FormEvent } from 'react'
import {
  computeTrainingKpis,
  filterParticipants,
  type ParticipantStatus,
  type TrainingParticipant,
} from './adminMetrics'
import {
  previewAssignmentCsv,
  getAutoAssignmentRules,
  type AdminCohort,
  type AdminCohortInput,
  type AdminAuditEvent,
  type AdminDashboardPayload,
  type AdminExportKind,
  type AdminLearner,
  type AdminLearnerInput,
  type LearnerInvite,
  type AutoAssignmentRule,
  type AssignmentPreviewPayload,
} from '../../api/client'

export type AdminDashboardProps = {
  mode?: 'overview' | 'users' | 'cohorts'
  participants?: TrainingParticipant[]
  dashboard?: AdminDashboardPayload
  learners?: AdminLearner[]
  managementCohorts?: AdminCohort[]
  auditEvents?: AdminAuditEvent[]
  onCreateLearner?: (learner: AdminLearnerInput) => Promise<void> | void
  onCreateCohort?: (cohort: AdminCohortInput) => Promise<void> | void
  onCreateLearnerInvite?: (learnerId: string) => Promise<LearnerInvite> | LearnerInvite
  onRevokeLearnerInvite?: (learnerId: string) => Promise<void> | void
  onDownloadExport?: (kind: AdminExportKind) => Promise<void> | void
  targetId?: string
}

const statusLabels: Record<ParticipantStatus, string> = {
  enrolled: 'Enrolled',
  attended: 'Attended',
  completed: 'Completed',
  blocked: 'Blocked',
  makeup_required: 'Makeup required',
}

const uniqueValues = (values: string[]) => [...new Set(values)].sort((left, right) => left.localeCompare(right))
const inviteExceptionStatuses = ['pending', 'revoked', 'expired'] as const
const baseLearningPathIds = ['program-induction-pbis']
const baseFacilitatorIds = ['facilitator-1']

const chipStyle = {
  border: '1px solid #ccd5df',
  borderRadius: '999px',
  display: 'inline-flex',
  fontSize: '0.78rem',
  fontWeight: 700,
  lineHeight: 1,
  padding: '0.35rem 0.55rem',
} satisfies CSSProperties

const emptyLearnerForm: AdminLearnerInput = {
  firstName: '',
  lastName: '',
  email: '',
  cohortId: '',
  supervisor: '',
  assignedPathIds: ['program-induction-pbis'],
}

const emptyCohortForm: AdminCohortInput = {
  name: '',
  region: '',
  startsAt: '',
  facilitatorIds: ['facilitator-1'],
  pathIds: ['program-induction-pbis'],
}

export function AdminDashboard({
  mode = 'overview',
  participants = [],
  dashboard,
  learners = [],
  managementCohorts = [],
  auditEvents = [],
  onCreateLearner,
  onCreateCohort,
  onCreateLearnerInvite,
  onRevokeLearnerInvite,
  onDownloadExport,
  targetId,
}: AdminDashboardProps) {
  const [region, setRegion] = useState('all')
  const [status, setStatus] = useState<ParticipantStatus | 'all'>('all')
  const [cohort, setCohort] = useState('all')
  const [learnerForm, setLearnerForm] = useState<AdminLearnerInput>(emptyLearnerForm)
  const [cohortForm, setCohortForm] = useState<AdminCohortInput>(emptyCohortForm)
  const [inviteResult, setInviteResult] = useState<LearnerInvite | null>(null)
  const [inviteError, setInviteError] = useState('')
  const [exportError, setExportError] = useState('')
  const [learnerSearch, setLearnerSearch] = useState('')
  const [learnerInviteFilter, setLearnerInviteFilter] = useState<AdminLearner['inviteStatus'] | 'all' | 'exceptions'>(
    'all',
  )
  const [learnerRiskFilter, setLearnerRiskFilter] = useState<'all' | 'unassigned_cohort' | 'unassigned_path'>('all')

  const [subTab, setSubTab] = useState<'roster' | 'import' | 'rules'>(() =>
    mode === 'users' && targetId === 'assignment-preview-title' ? 'import' : 'roster',
  )
  const [assignmentCsv, setAssignmentCsv] = useState(`First Name,Last Name,Email,Employee ID,Title,Region,Site,Supervisor,Hire Date
Jordan,Rivera,jordan.rivera@thinktogether.local,EMP-1042,Program Leader,Emerging Region,East Bay Site,Regional Supervisor A,2026-06-03
Sam,Patel,sam.patel@thinktogether.local,EMP-1043,Site Lead,Emerging Region,North Valley Site,Regional Supervisor B,2026-06-03
Alex,Chen,alex.chen@thinktogether.local,EMP-1044,Instructional Aide,Emerging Region,,Regional Supervisor B,2026-06-03`)
  const [assignmentPreview, setAssignmentPreview] = useState<AssignmentPreviewPayload | null>(null)
  const [assignmentLoading, setAssignmentLoading] = useState(false)
  const [assignmentError, setAssignmentError] = useState('')
  const [assignmentRules, setAssignmentRules] = useState<AutoAssignmentRule[]>([])

  useEffect(() => {
    if (mode === 'users') {
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
    }
  }, [mode])

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

  const filteredParticipants = useMemo(
    () => filterParticipants(participants, { region, status, cohort }),
    [cohort, participants, region, status],
  )
  const kpis = useMemo(() => computeTrainingKpis(participants), [participants])
  const regions = useMemo(() => uniqueValues(participants.map((participant) => participant.region)), [participants])
  const cohorts = useMemo(() => uniqueValues(participants.map((participant) => participant.cohort)), [participants])
  const learnerRegions = useMemo(() => uniqueValues(learners.map((learner) => learner.region).filter(Boolean)), [learners])
  const learningPathOptions = useMemo(
    () =>
      uniqueValues([
        ...baseLearningPathIds,
        ...managementCohorts.flatMap((item) => item.pathIds),
        ...learners.flatMap((learner) => learner.assignedPathIds),
      ]).map((id) => ({ id, label: formatLearningPathId(id) })),
    [learners, managementCohorts],
  )
  const facilitatorOptions = useMemo(
    () =>
      uniqueValues([
        ...baseFacilitatorIds,
        ...managementCohorts.flatMap((item) => item.facilitatorIds),
      ]).map((id) => ({ id, label: formatFacilitatorId(id) })),
    [managementCohorts],
  )
  const inviteExceptions = useMemo(
    () => learners.filter((learner) => isInviteException(learner.inviteStatus)),
    [learners],
  )
  const unassignedCohortLearners = useMemo(
    () => learners.filter((learner) => !learner.cohortId || !learner.cohortName),
    [learners],
  )
  const unassignedPathLearners = useMemo(
    () => learners.filter((learner) => !learner.assignedPathIds.length),
    [learners],
  )
  const trackExceptions = useMemo(
    () => dashboard?.readinessByTrack.filter((track) => track.blocked > 0 || track.needsCoaching > 0) ?? [],
    [dashboard],
  )
  const filteredLearners = useMemo(() => {
    const normalizedSearch = learnerSearch.trim().toLowerCase()

    return learners.filter((learner) => {
      const searchable = [
        learner.firstName,
        learner.lastName,
        learner.email,
        learner.cohortName,
        learner.region,
        ...learner.assignedPathIds,
      ]
        .join(' ')
        .toLowerCase()
      const matchesSearch = !normalizedSearch || searchable.includes(normalizedSearch)
      const matchesInvite =
        learnerInviteFilter === 'all' ||
        (learnerInviteFilter === 'exceptions'
          ? isInviteException(learner.inviteStatus)
          : learner.inviteStatus === learnerInviteFilter)
      const matchesRisk =
        learnerRiskFilter === 'all' ||
        (learnerRiskFilter === 'unassigned_cohort' && (!learner.cohortId || !learner.cohortName)) ||
        (learnerRiskFilter === 'unassigned_path' && !learner.assignedPathIds.length)

      return matchesSearch && matchesInvite && matchesRisk
    })
  }, [learnerInviteFilter, learnerRiskFilter, learnerSearch, learners])

  const handleLearnerSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    await onCreateLearner?.(learnerForm)
    setLearnerForm(emptyLearnerForm)
  }

  const handleCohortSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    await onCreateCohort?.(cohortForm)
    setCohortForm(emptyCohortForm)
  }

  const handleCreateInvite = async (learnerId: string) => {
    if (!onCreateLearnerInvite) return

    setInviteError('')
    try {
      const invite = await onCreateLearnerInvite(learnerId)
      setInviteResult(invite)
      const copyValue = invite.inviteUrl ?? invite.inviteToken
      if (copyValue && window.navigator.clipboard) {
        await window.navigator.clipboard.writeText(copyValue)
      }
    } catch (caught) {
      setInviteError(caught instanceof Error ? caught.message : 'Unable to create invite.')
    }
  }

  const handleRevokeInvite = async (learnerId: string) => {
    if (!onRevokeLearnerInvite) return

    setInviteError('')
    try {
      await onRevokeLearnerInvite(learnerId)
      setInviteResult(null)
    } catch (caught) {
      setInviteError(caught instanceof Error ? caught.message : 'Unable to revoke invite.')
    }
  }

  const handleDownloadExport = async (kind: AdminExportKind) => {
    if (!onDownloadExport) return

    setExportError('')
    try {
      await onDownloadExport(kind)
    } catch (caught) {
      setExportError(caught instanceof Error ? caught.message : 'Unable to download export.')
    }
  }

  const kpiItems = dashboard
    ? ([
        ['Learners', dashboard.kpis.totalLearners],
        ['Attended', dashboard.kpis.attended],
        ['Completed modules', dashboard.kpis.completedModules],
        ['Clearance-ready', dashboard.kpis.clearanceReady],
        ['Blocked', dashboard.kpis.blocked],
        ['Makeup required', dashboard.kpis.makeupRequired],
        ['Average score', `${dashboard.kpis.averageKnowledgeScore}%`],
        ['Survey completion', `${dashboard.kpis.surveyCompletion}%`],
        ['Facilitator rating', dashboard.kpis.facilitatorRating.toFixed(1)],
        ['Practice submissions', dashboard.kpis.practiceSubmissions],
        ['Completion rate', `${dashboard.kpis.completionRate}%`],
      ] as const)
    : ([
        ['Enrolled', kpis.enrolled],
        ['Attended', kpis.attended],
        ['Completed', kpis.completed],
        ['Clearance-ready', kpis.clearanceReady],
        ['Blocked', kpis.blocked],
        ['Makeup required', kpis.makeupRequired],
        ['Average score', `${kpis.averageScore}%`],
        ['Survey completion', `${kpis.surveyCompletion}%`],
        ['Facilitator rating', kpis.facilitatorRating.toFixed(1)],
      ] as const)

  const showOverview = mode === 'overview'
  const showUsers = mode === 'users'
  const showCohorts = mode === 'cohorts'
  const headerCopy = {
    overview: {
      eyebrow: 'Think Together admin MVP',
      title: 'Training Operations Dashboard',
    },
    users: {
      eyebrow: 'User administration',
      title: 'Learners and Invites',
    },
    cohorts: {
      eyebrow: 'Cohort administration',
      title: 'Cohorts and Assignments',
    },
  }[mode]

  return (
    <section style={{ color: '#1d2430', fontFamily: 'system-ui, sans-serif', padding: '2rem', textAlign: 'left' }}>
      <header style={{ marginBottom: '1.5rem' }}>
        <p style={{ color: '#5b6675', fontSize: '0.9rem', fontWeight: 700, margin: 0 }}>
          {headerCopy.eyebrow}
        </p>
        <h1 style={{ fontSize: '2rem', letterSpacing: 0, margin: '0.25rem 0 0' }}>
          {headerCopy.title}
        </h1>
      </header>

      {showOverview ? (
        <>
          <div
            aria-label="Training KPI strip"
            style={{
              display: 'grid',
              gap: '0.75rem',
              gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))',
              marginBottom: '1.25rem',
            }}
          >
            {kpiItems.map(([label, value]) => (
              <div
                aria-label={`${label} KPI`}
                key={label}
                style={{ border: '1px solid #d8dee7', borderRadius: 8, padding: '0.8rem' }}
              >
                <div style={{ color: '#657184', fontSize: '0.76rem', fontWeight: 800, textTransform: 'uppercase' }}>
                  {label}
                </div>
                <div style={{ fontSize: '1.5rem', fontWeight: 800, marginTop: '0.25rem' }}>{value}</div>
              </div>
            ))}
          </div>

          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem', marginBottom: '1.25rem' }}>
            {(dashboard
              ? ['Postgres-backed data', 'Role-gated admin API', 'CSV export endpoint']
              : ['CSV import/export', 'LMS verified/exported status', 'No ADP writeback']
            ).map((boundary) => (
              <span key={boundary} style={{ ...chipStyle, background: '#eef4ff', color: '#27446d' }}>
                {boundary}
              </span>
            ))}
          </div>
        </>
      ) : null}

      {showOverview ? (
        <section
          aria-labelledby="operational-readiness-heading"
          style={{
            border: '1px solid #d8dee7',
            borderRadius: 8,
            marginBottom: '1.25rem',
            padding: '1rem',
          }}
        >
          <div
            style={{
              alignItems: 'center',
              display: 'flex',
              flexWrap: 'wrap',
              gap: '0.75rem',
              justifyContent: 'space-between',
              marginBottom: '0.75rem',
            }}
          >
            <div>
              <p style={{ color: '#657184', fontSize: '0.76rem', fontWeight: 800, margin: 0, textTransform: 'uppercase' }}>
                Command center
              </p>
              <h2 id="operational-readiness-heading" style={{ fontSize: '1.2rem', margin: '0.15rem 0 0' }}>
                Operational readiness
              </h2>
            </div>
            <span
              style={{
                ...chipStyle,
                background:
                  inviteExceptions.length || unassignedCohortLearners.length || unassignedPathLearners.length || trackExceptions.length
                    ? '#fff7ed'
                    : '#ecfdf3',
              }}
            >
              {inviteExceptions.length || unassignedCohortLearners.length || unassignedPathLearners.length || trackExceptions.length
                ? 'Exceptions need review'
                : 'No readiness exceptions'}
            </span>
          </div>

        <div
          aria-label="Operational exception summary"
          style={{
            display: 'grid',
            gap: '0.75rem',
            gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))',
          }}
        >
          <ReadinessCard
            label="Invite exceptions"
            tone={inviteExceptions.length ? 'warning' : 'ok'}
            value={inviteExceptions.length}
          >
            Pending {countLearnersByInviteStatus(learners, 'pending')} / Revoked{' '}
            {countLearnersByInviteStatus(learners, 'revoked')} / Expired {countLearnersByInviteStatus(learners, 'expired')}
          </ReadinessCard>
          <ReadinessCard
            label="Unassigned cohort"
            tone={unassignedCohortLearners.length ? 'warning' : 'ok'}
            value={unassignedCohortLearners.length}
          >
            Learners without a cohort assignment
          </ReadinessCard>
          <ReadinessCard
            label="Unassigned path"
            tone={unassignedPathLearners.length ? 'warning' : 'ok'}
            value={unassignedPathLearners.length}
          >
            Learners without a training path
          </ReadinessCard>
          <ReadinessCard
            label="Track blockers"
            tone={trackExceptions.length ? 'warning' : 'ok'}
            value={trackExceptions.reduce((total, track) => total + track.blocked + track.needsCoaching, 0)}
          >
            Blocked and coaching-needed track counts
          </ReadinessCard>
        </div>

        {dashboard ? (
          <div style={{ marginTop: '1rem' }}>
            <h3 style={{ fontSize: '1rem', margin: '0 0 0.5rem' }}>Readiness by track</h3>
            {dashboard.readinessByTrack.length ? (
              <div className="admin-table-wrap">
                <table style={{ borderCollapse: 'collapse', width: '100%' }}>
                  <thead>
                    <tr>
                      {['Track', 'Enrolled', 'Clearance-ready', 'Needs coaching', 'Blocked'].map((heading) => (
                        <th key={heading} style={{ borderBottom: '1px solid #cbd5e1', padding: '0.6rem' }}>
                          {heading}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {dashboard.readinessByTrack.map((track) => (
                      <tr key={track.track}>
                        <td style={{ borderBottom: '1px solid #e5e7eb', padding: '0.6rem' }}>{track.track}</td>
                        <td style={{ borderBottom: '1px solid #e5e7eb', padding: '0.6rem' }}>{track.enrolled}</td>
                        <td style={{ borderBottom: '1px solid #e5e7eb', padding: '0.6rem' }}>{track.clearanceReady}</td>
                        <td style={{ borderBottom: '1px solid #e5e7eb', padding: '0.6rem' }}>
                          <span style={{ ...chipStyle, background: track.needsCoaching ? '#fff7ed' : '#ecfdf3' }}>
                            {track.needsCoaching}
                          </span>
                        </td>
                        <td style={{ borderBottom: '1px solid #e5e7eb', padding: '0.6rem' }}>
                          <span style={{ ...chipStyle, background: track.blocked ? '#fee2e2' : '#ecfdf3' }}>
                            {track.blocked}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <p style={{ color: '#657184', margin: 0 }}>No track readiness records are available yet.</p>
            )}
          </div>
        ) : (
          <p style={{ color: '#657184', margin: '0.75rem 0 0' }}>
            Dashboard readiness data is not loaded yet. Learner roster exceptions will appear when learners are available.
          </p>
        )}
        </section>
      ) : null}

      {showOverview && onDownloadExport ? (
        <section aria-label="Admin exports" style={{ marginBottom: '1.25rem' }}>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
            <button onClick={() => void handleDownloadExport('clearance')} type="button">
              Download clearance-ready CSV
            </button>
            <button onClick={() => void handleDownloadExport('completions')} type="button">
              Download completions CSV
            </button>
            <button onClick={() => void handleDownloadExport('supervisor-digest')} type="button">
              Download supervisor digest CSV
            </button>
            <button onClick={() => void handleDownloadExport('content-operations')} type="button">
              Download content operations CSV
            </button>
          </div>
          {exportError ? <p role="alert">{exportError}</p> : null}
        </section>
      ) : null}

      {showOverview && auditEvents.length ? (
        <section
          aria-labelledby="admin-audit-heading"
          style={{ border: '1px solid #d8dee7', borderRadius: 8, marginBottom: '1.25rem', padding: '1rem' }}
        >
          <div style={{ marginBottom: '0.75rem' }}>
            <p style={{ color: '#657184', fontSize: '0.76rem', fontWeight: 800, margin: 0, textTransform: 'uppercase' }}>
              Production controls
            </p>
            <h2 id="admin-audit-heading" style={{ fontSize: '1.2rem', margin: '0.15rem 0 0' }}>
              Admin audit trail
            </h2>
          </div>
          <div className="admin-table-wrap">
            <table style={{ borderCollapse: 'collapse', width: '100%' }}>
              <thead>
                <tr>
                  {['Time', 'Action', 'Actor', 'Target'].map((heading) => (
                    <th key={heading} style={{ borderBottom: '1px solid #cbd5e1', padding: '0.6rem' }}>
                      {heading}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {auditEvents.slice(0, 8).map((event) => (
                  <tr key={event.id}>
                    <td style={{ borderBottom: '1px solid #e5e7eb', padding: '0.6rem' }}>
                      {new Date(event.createdAt).toLocaleString()}
                    </td>
                    <td style={{ borderBottom: '1px solid #e5e7eb', padding: '0.6rem' }}>{humanizeAuditAction(event.action)}</td>
                    <td style={{ borderBottom: '1px solid #e5e7eb', padding: '0.6rem' }}>
                      {event.actorName ?? event.actorEmail ?? 'System'}
                    </td>
                    <td style={{ borderBottom: '1px solid #e5e7eb', padding: '0.6rem' }}>
                      <span style={{ ...chipStyle, background: '#eef4ff', color: '#27446d' }}>{event.entityType}</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      ) : null}

      {showOverview && dashboard ? (
        <section aria-label="Cohort readiness" style={{ marginBottom: '1.25rem' }}>
          <h2 style={{ fontSize: '1.2rem', marginBottom: '0.5rem' }}>Cohorts</h2>
          <div className="admin-table-wrap">
          <table style={{ borderCollapse: 'collapse', width: '100%' }}>
            <thead>
              <tr>
                {['Cohort', 'Region', 'Participants'].map((heading) => (
                  <th key={heading} style={{ borderBottom: '1px solid #cbd5e1', padding: '0.6rem' }}>
                    {heading}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {dashboard.cohorts.map((item) => (
                <tr key={item.id}>
                  <td style={{ borderBottom: '1px solid #e5e7eb', padding: '0.6rem' }}>{item.name}</td>
                  <td style={{ borderBottom: '1px solid #e5e7eb', padding: '0.6rem' }}>{item.region}</td>
                  <td style={{ borderBottom: '1px solid #e5e7eb', padding: '0.6rem' }}>{item.participants}</td>
                </tr>
              ))}
            </tbody>
          </table>
          </div>
          {!dashboard.cohorts.length ? <p style={{ color: '#657184', margin: '0.75rem 0 0' }}>No cohorts are available yet.</p> : null}
        </section>
      ) : null}

      {(showUsers && (onCreateLearner || learners.length)) || (showCohorts && (onCreateCohort || managementCohorts.length)) ? (
        <section
          aria-label="Admin learner and cohort management"
          style={{
            border: '1px solid #d8dee7',
            borderRadius: 8,
            marginBottom: '1.25rem',
            padding: '1rem',
          }}
        >
          <h2 style={{ fontSize: '1.2rem', margin: '0 0 0.75rem' }}>
            {showUsers ? 'Learner management' : 'Cohort management'}
          </h2>
          <p style={{ color: '#657184', margin: '-0.35rem 0 0.9rem', maxWidth: 760 }}>
            {showUsers
              ? 'Create learner records, connect them to a cohort and supervisor, then generate invite links when the roster is ready.'
              : 'Set the session name, region, primary facilitator, learning path, and start time without needing to paste raw system IDs.'}
          </p>

          {showUsers ? (
            <div style={{ display: 'flex', gap: '0.5rem', borderBottom: '1px solid #cbd5e1', marginBottom: '1.25rem', paddingBottom: '0.25rem' }}>
              <button
                aria-selected={subTab === 'roster'}
                onClick={() => setSubTab('roster')}
                style={{
                  background: subTab === 'roster' ? '#eef2ff' : 'none',
                  border: 'none',
                  borderBottom: subTab === 'roster' ? '2px solid #2563eb' : 'none',
                  color: subTab === 'roster' ? '#2563eb' : '#4b5563',
                  cursor: 'pointer',
                  fontWeight: subTab === 'roster' ? 'bold' : 'normal',
                  padding: '0.4rem 0.75rem',
                  borderRadius: '4px 4px 0 0',
                }}
                type="button"
              >
                Active Roster
              </button>
              <button
                aria-selected={subTab === 'import'}
                onClick={() => setSubTab('import')}
                style={{
                  background: subTab === 'import' ? '#eef2ff' : 'none',
                  border: 'none',
                  borderBottom: subTab === 'import' ? '2px solid #2563eb' : 'none',
                  color: subTab === 'import' ? '#2563eb' : '#4b5563',
                  cursor: 'pointer',
                  fontWeight: subTab === 'import' ? 'bold' : 'normal',
                  padding: '0.4rem 0.75rem',
                  borderRadius: '4px 4px 0 0',
                }}
                type="button"
              >
                Bulk CSV Import
              </button>
              <button
                aria-selected={subTab === 'rules'}
                onClick={() => setSubTab('rules')}
                style={{
                  background: subTab === 'rules' ? '#eef2ff' : 'none',
                  border: 'none',
                  borderBottom: subTab === 'rules' ? '2px solid #2563eb' : 'none',
                  color: subTab === 'rules' ? '#2563eb' : '#4b5563',
                  cursor: 'pointer',
                  fontWeight: subTab === 'rules' ? 'bold' : 'normal',
                  padding: '0.4rem 0.75rem',
                  borderRadius: '4px 4px 0 0',
                }}
                type="button"
              >
                Auto-Assignment Rules
              </button>
            </div>
          ) : null}

          {(!showUsers || subTab === 'roster') ? (
          <div style={{ display: 'grid', gap: '1rem', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))' }}>
            {showUsers && onCreateLearner ? (
              <form aria-label="Create learner" onSubmit={handleLearnerSubmit}>
                <h3 style={{ fontSize: '1rem', margin: '0 0 0.75rem' }}>Add learner</h3>
                <p style={{ color: '#657184', fontSize: '0.9rem', margin: '-0.35rem 0 0.75rem' }}>
                  Manual entry supports a supervisor name for reporting. At scale, the supervisor comes from the HR/ADP roster import.
                </p>
                <div style={{ display: 'grid', gap: '0.65rem' }}>
                  <label>
                    First name
                    <input
                      aria-label="Learner first name"
                      onChange={(event) => setLearnerForm({ ...learnerForm, firstName: event.target.value })}
                      required
                      style={{ display: 'block', marginTop: '0.25rem', width: '100%' }}
                      value={learnerForm.firstName}
                    />
                  </label>
                  <label>
                    Last name
                    <input
                      aria-label="Learner last name"
                      onChange={(event) => setLearnerForm({ ...learnerForm, lastName: event.target.value })}
                      required
                      style={{ display: 'block', marginTop: '0.25rem', width: '100%' }}
                      value={learnerForm.lastName}
                    />
                  </label>
                  <label>
                    Email
                    <input
                      aria-label="Learner email"
                      onChange={(event) => setLearnerForm({ ...learnerForm, email: event.target.value })}
                      required
                      style={{ display: 'block', marginTop: '0.25rem', width: '100%' }}
                      type="email"
                      value={learnerForm.email}
                    />
                  </label>
                  <label>
                    Cohort
                    <select
                      aria-label="Learner cohort"
                      onChange={(event) => setLearnerForm({ ...learnerForm, cohortId: event.target.value })}
                      style={{ display: 'block', marginTop: '0.25rem', width: '100%' }}
                      value={learnerForm.cohortId}
                    >
                      <option value="">Unassigned</option>
                      {managementCohorts.map((item) => (
                        <option key={item.id} value={item.id}>
                          {item.name}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label>
                    Supervisor
                    <input
                      aria-label="Learner supervisor"
                      onChange={(event) => setLearnerForm({ ...learnerForm, supervisor: event.target.value })}
                      placeholder="Regional Supervisor A"
                      style={{ display: 'block', marginTop: '0.25rem', width: '100%' }}
                      value={learnerForm.supervisor ?? ''}
                    />
                  </label>
                  <button type="submit">Add learner</button>
                </div>
              </form>
            ) : null}

            {showCohorts && onCreateCohort ? (
              <form aria-label="Create cohort" onSubmit={handleCohortSubmit}>
                <h3 style={{ fontSize: '1rem', margin: '0 0 0.75rem' }}>Add cohort</h3>
                <p style={{ color: '#657184', fontSize: '0.9rem', margin: '-0.35rem 0 0.75rem' }}>
                  MVP cohorts use one primary facilitator and one primary learning path. The saved payload still carries the API IDs.
                </p>
                <div style={{ display: 'grid', gap: '0.65rem' }}>
                  <label>
                    Cohort name
                    <input
                      aria-label="Cohort name"
                      onChange={(event) => setCohortForm({ ...cohortForm, name: event.target.value })}
                      required
                      style={{ display: 'block', marginTop: '0.25rem', width: '100%' }}
                      value={cohortForm.name}
                    />
                  </label>
                  <label>
                    Region
                    <input
                      aria-label="Cohort region"
                      onChange={(event) => setCohortForm({ ...cohortForm, region: event.target.value })}
                      required
                      style={{ display: 'block', marginTop: '0.25rem', width: '100%' }}
                      value={cohortForm.region}
                    />
                  </label>
                  <label>
                    Primary facilitator
                    <select
                      aria-label="Cohort facilitator"
                      onChange={(event) => setCohortForm({ ...cohortForm, facilitatorIds: event.target.value ? [event.target.value] : [] })}
                      style={{ display: 'block', marginTop: '0.25rem', width: '100%' }}
                      value={cohortForm.facilitatorIds[0] ?? ''}
                    >
                      <option value="">Select facilitator</option>
                      {facilitatorOptions.map((option) => (
                        <option key={option.id} value={option.id}>
                          {option.label}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label>
                    Learning path
                    <select
                      aria-label="Cohort learning path"
                      onChange={(event) => setCohortForm({ ...cohortForm, pathIds: event.target.value ? [event.target.value] : [] })}
                      required
                      style={{ display: 'block', marginTop: '0.25rem', width: '100%' }}
                      value={cohortForm.pathIds[0] ?? ''}
                    >
                      {learningPathOptions.map((option) => (
                        <option key={option.id} value={option.id}>
                          {option.label}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label>
                    Starts at
                    <input
                      aria-label="Cohort starts at"
                      onChange={(event) => setCohortForm({ ...cohortForm, startsAt: toIsoFromLocalInput(event.target.value) })}
                      required
                      style={{ display: 'block', marginTop: '0.25rem', width: '100%' }}
                      type="datetime-local"
                      value={toLocalDatetimeValue(cohortForm.startsAt)}
                    />
                  </label>
                  <button type="submit">Add cohort</button>
                </div>
              </form>
            ) : null}
          </div>
          ) : null}

          {showCohorts ? (
            <div style={{ marginTop: '1rem' }}>
              <h3 style={{ fontSize: '1rem', marginBottom: '0.5rem' }}>Managed cohorts</h3>
              {managementCohorts.length ? (
                <div className="admin-table-wrap">
                  <table style={{ borderCollapse: 'collapse', width: '100%' }}>
                    <thead>
                      <tr>
                        {['Cohort', 'Region', 'Starts', 'Learners', 'Paths', 'Facilitators'].map((heading) => (
                          <th key={heading} style={{ borderBottom: '1px solid #cbd5e1', padding: '0.6rem' }}>
                            {heading}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {managementCohorts.map((item) => (
                        <tr key={item.id}>
                          <td style={{ borderBottom: '1px solid #e5e7eb', padding: '0.6rem' }}>{item.name}</td>
                          <td style={{ borderBottom: '1px solid #e5e7eb', padding: '0.6rem' }}>{item.region}</td>
                          <td style={{ borderBottom: '1px solid #e5e7eb', padding: '0.6rem' }}>
                            {formatDateTime(item.startsAt)}
                          </td>
                          <td style={{ borderBottom: '1px solid #e5e7eb', padding: '0.6rem' }}>{item.learnerCount}</td>
                          <td style={{ borderBottom: '1px solid #e5e7eb', padding: '0.6rem' }}>
                            {formatIdList(item.pathIds, formatLearningPathId)}
                          </td>
                          <td style={{ borderBottom: '1px solid #e5e7eb', padding: '0.6rem' }}>
                            {formatIdList(item.facilitatorIds, formatFacilitatorId)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <p style={{ color: '#657184', margin: '1rem 0 0' }}>
                  No managed cohorts are available yet. Add a cohort to begin assignments.
                </p>
              )}
            </div>
          ) : null}

          {showUsers && subTab === 'roster' && learners.length ? (
            <div style={{ marginTop: '1rem' }}>
              <h3 style={{ fontSize: '1rem', marginBottom: '0.5rem' }}>Managed learners</h3>
              <div
                aria-label="Managed learner filters"
                style={{ display: 'flex', flexWrap: 'wrap', gap: '0.65rem', marginBottom: '0.75rem' }}
              >
                <label>
                  Search learners
                  <input
                    aria-label="Search managed learners"
                    onChange={(event) => setLearnerSearch(event.target.value)}
                    placeholder="Name, email, cohort, path"
                    style={{ display: 'block', marginTop: '0.25rem', minWidth: 220 }}
                    type="search"
                    value={learnerSearch}
                  />
                </label>
                <label>
                  Invite status
                  <select
                    aria-label="Filter managed learners by invite status"
                    onChange={(event) =>
                      setLearnerInviteFilter(
                        event.target.value as AdminLearner['inviteStatus'] | 'all' | 'exceptions',
                      )
                    }
                    style={{ display: 'block', marginTop: '0.25rem' }}
                    value={learnerInviteFilter}
                  >
                    <option value="all">All invite statuses</option>
                    <option value="exceptions">Pending, revoked, expired</option>
                    <option value="not_invited">Not invited</option>
                    <option value="pending">Pending</option>
                    <option value="accepted">Accepted</option>
                    <option value="expired">Expired</option>
                    <option value="revoked">Revoked</option>
                  </select>
                </label>
                <label>
                  Assignment risk
                  <select
                    aria-label="Filter managed learners by assignment risk"
                    onChange={(event) =>
                      setLearnerRiskFilter(event.target.value as 'all' | 'unassigned_cohort' | 'unassigned_path')
                    }
                    style={{ display: 'block', marginTop: '0.25rem' }}
                    value={learnerRiskFilter}
                  >
                    <option value="all">All assignment states</option>
                    <option value="unassigned_cohort">Missing cohort</option>
                    <option value="unassigned_path">Missing path</option>
                  </select>
                </label>
                {learnerRegions.length ? (
                  <div aria-label="Managed learner regions" style={{ alignSelf: 'end', color: '#657184', fontSize: '0.85rem' }}>
                    {learnerRegions.length} region{learnerRegions.length === 1 ? '' : 's'}
                  </div>
                ) : null}
              </div>
              <div className="admin-table-wrap">
              <table style={{ borderCollapse: 'collapse', width: '100%' }}>
                <thead>
                  <tr>
                    {['Learner', 'Email', 'Cohort', 'Supervisor', 'Region', 'Invite', 'Action'].map((heading) => (
                      <th key={heading} style={{ borderBottom: '1px solid #cbd5e1', padding: '0.6rem' }}>
                        {heading}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {filteredLearners.map((learner) => {
                    const canRevokeInvite = learner.inviteStatus === 'pending'
                    const inviteActionLabel = learner.inviteStatus === 'pending' ? 'Copy fresh invite link' : 'Generate invite'

                    return (
                      <tr key={learner.id}>
                        <td style={{ borderBottom: '1px solid #e5e7eb', padding: '0.6rem' }}>
                          {learner.firstName} {learner.lastName}
                        </td>
                        <td style={{ borderBottom: '1px solid #e5e7eb', padding: '0.6rem' }}>{learner.email}</td>
                        <td style={{ borderBottom: '1px solid #e5e7eb', padding: '0.6rem' }}>
                          {learner.cohortName || <span style={{ color: '#9a3412', fontWeight: 700 }}>Missing cohort</span>}
                        </td>
                        <td style={{ borderBottom: '1px solid #e5e7eb', padding: '0.6rem' }}>
                          {learner.supervisor || <span style={{ color: '#9a3412', fontWeight: 700 }}>Missing supervisor</span>}
                        </td>
                        <td style={{ borderBottom: '1px solid #e5e7eb', padding: '0.6rem' }}>{learner.region || 'Unassigned'}</td>
                        <td style={{ borderBottom: '1px solid #e5e7eb', padding: '0.6rem' }}>
                          <span style={{ ...chipStyle, background: learner.inviteStatus === 'accepted' ? '#ecfdf3' : '#fff7ed' }}>
                            {formatInviteStatus(learner.inviteStatus)}
                          </span>
                        </td>
                        <td style={{ borderBottom: '1px solid #e5e7eb', padding: '0.6rem' }}>
                          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.4rem' }}>
                            {onCreateLearnerInvite && learner.inviteStatus !== 'accepted' ? (
                              <button onClick={() => void handleCreateInvite(learner.id)} type="button">
                                {inviteActionLabel}
                              </button>
                            ) : null}
                            {onRevokeLearnerInvite && canRevokeInvite ? (
                              <button onClick={() => void handleRevokeInvite(learner.id)} type="button">
                                Revoke invite
                              </button>
                            ) : null}
                          </div>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
              </div>
              {!filteredLearners.length ? (
                <p style={{ color: '#657184', margin: '0.75rem 0 0' }}>
                  No learners match the current search and filters.
                </p>
              ) : null}
              {inviteResult ? (
                <div aria-live="polite" style={{ marginTop: '0.75rem' }}>
                  <strong>Invite ready</strong>
                  <p style={{ margin: '0.25rem 0', overflowWrap: 'anywhere' }}>
                    {inviteResult.inviteUrl ?? inviteResult.inviteToken ?? inviteResult.learnerId}
                  </p>
                  <small>Status: {formatInviteStatus(inviteResult.inviteStatus)}</small>
                </div>
              ) : null}
              {inviteError ? <p role="alert">{inviteError}</p> : null}
            </div>
          ) : showUsers && subTab === 'roster' ? (
            <p style={{ color: '#657184', margin: '1rem 0 0' }}>
              No managed learners are available yet. Add a learner to start issuing invites.
            </p>
          ) : null}

          {showUsers && subTab === 'import' ? (
            <div style={{ marginTop: '1rem' }}>
              <h3 id="assignment-preview-title" style={{ fontSize: '1.1rem', margin: '0 0 0.5rem' }}>Weekly roster assignment preview</h3>
              <p style={{ color: '#657184', margin: '0 0 1rem' }}>
                Paste the latest ADP/HR CSV below to dry-run path assignment rules, supervisor group binding, and record missing site indicators.
              </p>
              <div
                aria-label="Supervisor assignment explanation"
                style={{
                  background: '#f0fdfa',
                  border: '1px solid #99f6e4',
                  borderRadius: 8,
                  display: 'grid',
                  gap: '0.35rem',
                  marginBottom: '1rem',
                  padding: '0.85rem',
                }}
              >
                <strong>How supervisor assignment works</strong>
                <span style={{ color: '#475569' }}>
                  The imported <b>Supervisor</b> column is saved with each learner and becomes the grouping key in Supervisor Center,
                  completion digest exports, coaching nudges, and make-up review queues.
                </span>
                <small style={{ color: '#0f766e', fontWeight: 700 }}>
                  Phase 2 production path: map this field directly from HR/ADP, then route blanks to facilitator or Training Ops.
                </small>
              </div>
              
              <label style={{ display: 'block', margin: '1rem 0' }}>
                <span style={{ fontWeight: 600 }}>Paste weekly HR/ADP roster CSV</span>
                <textarea
                  aria-label="CSV input"
                  value={assignmentCsv}
                  onChange={(e) => setAssignmentCsv(e.target.value)}
                  rows={8}
                  style={{ display: 'block', width: '100%', marginTop: '0.5rem', fontFamily: 'monospace', fontSize: '0.9rem', padding: '0.5rem', borderRadius: 4, border: '1px solid #cbd5e1' }}
                  spellCheck={false}
                />
              </label>

              <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1.5rem' }}>
                <button
                  type="button"
                  onClick={handleAssignmentPreview}
                  disabled={assignmentLoading}
                >
                  {assignmentLoading ? 'Processing CSV...' : 'Preview assignments'}
                </button>
                <button
                  type="button"
                  onClick={() => setAssignmentCsv(`First Name,Last Name,Email,Employee ID,Title,Region,Site,Supervisor,Hire Date
Jordan,Rivera,jordan.rivera@thinktogether.local,EMP-1042,Program Leader,Emerging Region,East Bay Site,Regional Supervisor A,2026-06-03
Sam,Patel,sam.patel@thinktogether.local,EMP-1043,Site Lead,Emerging Region,North Valley Site,Regional Supervisor B,2026-06-03
Alex,Chen,alex.chen@thinktogether.local,EMP-1044,Instructional Aide,Emerging Region,,Regional Supervisor B,2026-06-03`)}
                  style={{ background: '#f3f4f6', color: '#374151', border: '1px solid #d1d5db' }}
                >
                  Use sample roster
                </button>
              </div>

              {assignmentError ? (
                <div style={{ color: '#dc2626', background: '#fef2f2', border: '1px solid #fecaca', padding: '0.75rem', borderRadius: 4, marginBottom: '1rem' }} role="alert">
                  {assignmentError}
                </div>
              ) : null}

              {assignmentPreview ? (
                <div>
                  <h4 style={{ fontSize: '1rem', margin: '0 0 0.50rem' }}>Roster Preview Results ({assignmentPreview.summary.totalRows} rows matched)</h4>
                  <div className="admin-table-wrap">
                    <table style={{ borderCollapse: 'collapse', width: '100%' }}>
                      <thead>
                        <tr>
                          {['Row', 'Employee', 'Matched Path', 'Assigned Supervisor', 'Region & Site', 'Automation Action', 'System Flags'].map((h) => (
                            <th key={h} style={{ borderBottom: '1px solid #cbd5e1', padding: '0.6rem' }}>{h}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {assignmentPreview.rows.map((row, idx) => (
                          <tr key={idx}>
                            <td style={{ borderBottom: '1px solid #e5e7eb', padding: '0.6rem' }}>{row.rowNumber}</td>
                            <td style={{ borderBottom: '1px solid #e5e7eb', padding: '0.6rem' }}>
                              <strong>{row.learner.firstName} {row.learner.lastName}</strong>
                              <div style={{ fontSize: '0.75rem', color: '#6b7280' }}>{row.learner.email} • {row.learner.employeeId}</div>
                            </td>
                            <td style={{ borderBottom: '1px solid #e5e7eb', padding: '0.6rem' }}>
                              {row.suggestedAssignment?.pathIds[0] ? formatLearningPathId(row.suggestedAssignment.pathIds[0]) : <span style={{ color: '#dc2626', fontWeight: 600 }}>Unmatched</span>}
                            </td>
                            <td style={{ borderBottom: '1px solid #e5e7eb', padding: '0.6rem' }}>{row.learner.supervisor || <span style={{ color: '#6b7280' }}>None</span>}</td>
                            <td style={{ borderBottom: '1px solid #e5e7eb', padding: '0.6rem' }}>
                              {row.learner.region || 'Unassigned'}
                              <div style={{ fontSize: '0.75rem', color: '#6b7280' }}>{row.learner.site || 'No Site'}</div>
                            </td>
                            <td style={{ borderBottom: '1px solid #e5e7eb', padding: '0.6rem' }}>
                              <span style={{ ...chipStyle, background: row.inviteAction === 'queue_invite' ? '#ecfdf3' : '#eff6ff' }}>
                                {row.inviteAction === 'queue_invite' ? 'Create & Invite' : 'Merge Record'}
                              </span>
                            </td>
                            <td style={{ borderBottom: '1px solid #e5e7eb', padding: '0.6rem' }}>
                              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.25rem' }}>
                                {row.reviewReasons.map((flag) => (
                                  <span key={flag} style={{ ...chipStyle, background: '#fef2f2', color: '#991b1b', fontSize: '0.7rem' }}>{flag}</span>
                                ))}
                                {!row.reviewReasons.length ? <span style={{ color: '#10b981', fontSize: '0.8rem' }}>✓ Clean</span> : null}
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              ) : null}
            </div>
          ) : null}

          {showUsers && subTab === 'rules' ? (
            <div style={{ marginTop: '1rem' }}>
              <h3 style={{ fontSize: '1.1rem', margin: '0 0 0.5rem' }}>Auto-assignment rules</h3>
              <p style={{ color: '#657184', margin: '0 0 1.25rem' }}>
                The rules below run automatically when new hire records are imported. They dynamically match titles, regions, and sites.
              </p>
              {assignmentRules.length ? (
                <div style={{ display: 'grid', gap: '1rem', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))' }}>
                  {assignmentRules.map((rule) => (
                    <div key={rule.id} style={{ border: '1px solid #e5e7eb', borderRadius: 8, padding: '1rem', background: '#f9fafb' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                        <strong style={{ fontSize: '1.0rem' }}>{rule.name}</strong>
                        <span style={{ ...chipStyle, background: rule.active ? '#ecfdf3' : '#f3f4f6', color: rule.active ? '#047857' : '#4b5563' }}>
                          {rule.active ? 'Active' : 'Draft'}
                        </span>
                      </div>
                      <p style={{ fontSize: '0.9rem', color: '#4b5563', margin: '0 0 0.75rem' }}>
                        <strong>Trigger:</strong> matches title <code>{rule.matchCriteria.titleKeywords.join(', ')}</code> in region <code>{rule.cohort.region || 'Any'}</code>.
                      </p>
                      <div style={{ fontSize: '0.85rem', color: '#6b7280' }}>
                        <div><strong>Auto assigns:</strong> {formatLearningPathId(rule.pathIds[0] || '')}</div>
                        <div style={{ marginTop: '0.25rem' }}><strong>Supervisor source:</strong> HR/ADP Supervisor column; fallback to facilitator/Training Ops if blank.</div>
                        <div style={{ marginTop: '0.25rem' }}><strong>Evaluation Priority:</strong> {rule.priority}</div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p style={{ color: '#657184' }}>No active rules found. Set up title matching in your source configuration.</p>
              )}
            </div>
          ) : null}
        </section>
      ) : null}

      {showOverview && participants.length ? <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.75rem', marginBottom: '1rem' }}>
        <label>
          Region
          <select
            aria-label="Region"
            onChange={(event) => setRegion(event.target.value)}
            style={{ display: 'block', marginTop: '0.25rem' }}
            value={region}
          >
            <option value="all">All regions</option>
            {regions.map((option) => (
              <option key={option} value={option}>
                {option}
              </option>
            ))}
          </select>
        </label>
        <label>
          Status
          <select
            aria-label="Status"
            onChange={(event) => setStatus(event.target.value as ParticipantStatus | 'all')}
            style={{ display: 'block', marginTop: '0.25rem' }}
            value={status}
          >
            <option value="all">All statuses</option>
            {Object.entries(statusLabels).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </label>
        <label>
          Cohort
          <select
            aria-label="Cohort"
            onChange={(event) => setCohort(event.target.value)}
            style={{ display: 'block', marginTop: '0.25rem' }}
            value={cohort}
          >
            <option value="all">All cohorts</option>
            {cohorts.map((option) => (
              <option key={option} value={option}>
                {option}
              </option>
            ))}
          </select>
        </label>
      </div> : null}

      {showOverview && participants.length ? <div className="admin-table-wrap"><table style={{ borderCollapse: 'collapse', width: '100%' }}>
        <thead>
          <tr>
            {['Participant', 'Region', 'Cohort', 'Role', 'Status', 'Attendance', 'LMS'].map((heading) => (
              <th key={heading} style={{ borderBottom: '1px solid #cbd5e1', padding: '0.6rem' }}>
                {heading}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {filteredParticipants.map((participant) => (
            <tr key={participant.id}>
              <td style={{ borderBottom: '1px solid #e5e7eb', padding: '0.6rem' }}>{participant.name}</td>
              <td style={{ borderBottom: '1px solid #e5e7eb', padding: '0.6rem' }}>{participant.region}</td>
              <td style={{ borderBottom: '1px solid #e5e7eb', padding: '0.6rem' }}>{participant.cohort}</td>
              <td style={{ borderBottom: '1px solid #e5e7eb', padding: '0.6rem' }}>{participant.role}</td>
              <td style={{ borderBottom: '1px solid #e5e7eb', padding: '0.6rem' }}>
                <span style={{ ...chipStyle, background: '#f8fafc' }}>{statusLabels[participant.status]}</span>
              </td>
              <td style={{ borderBottom: '1px solid #e5e7eb', padding: '0.6rem' }}>
                {participant.attendedDays}/{participant.requiredDays} days
              </td>
              <td style={{ borderBottom: '1px solid #e5e7eb', padding: '0.6rem' }}>
                <span style={{ ...chipStyle, background: participant.lmsVerified ? '#ecfdf3' : '#fff7ed' }}>
                  {participant.lmsVerified ? 'LMS verified' : 'LMS pending'}
                </span>{' '}
                <span style={{ ...chipStyle, background: participant.exportedToLms ? '#eef4ff' : '#f8fafc' }}>
                  {participant.exportedToLms ? 'Exported' : 'Not exported'}
                </span>
              </td>
            </tr>
          ))}
        </tbody>
      </table></div> : null}
      {showOverview && participants.length && !filteredParticipants.length ? (
        <p style={{ color: '#657184', margin: '0.75rem 0 0' }}>No participant records match the current filters.</p>
      ) : null}
      {showOverview && !participants.length && !dashboard && !learners.length ? (
        <section
          aria-label="Admin dashboard empty state"
          style={{ border: '1px solid #d8dee7', borderRadius: 8, marginTop: '1.25rem', padding: '1rem' }}
        >
          <h2 style={{ fontSize: '1.2rem', margin: '0 0 0.4rem' }}>No admin data loaded</h2>
          <p style={{ color: '#657184', margin: 0 }}>
            Training operations data will appear here after dashboard, learner, or participant records are available.
          </p>
        </section>
      ) : null}
    </section>
  )
}

function ReadinessCard({
  children,
  label,
  tone,
  value,
}: {
  children: React.ReactNode
  label: string
  tone: 'ok' | 'warning'
  value: number
}) {
  return (
    <div
      aria-label={`${label}: ${value}`}
      style={{
        background: tone === 'warning' ? '#fff7ed' : '#f8fafc',
        border: `1px solid ${tone === 'warning' ? '#fed7aa' : '#d8dee7'}`,
        borderRadius: 8,
        padding: '0.8rem',
      }}
    >
      <div style={{ color: '#657184', fontSize: '0.76rem', fontWeight: 800, textTransform: 'uppercase' }}>{label}</div>
      <div style={{ fontSize: '1.45rem', fontWeight: 800, marginTop: '0.2rem' }}>{value}</div>
      <p style={{ color: '#5b6675', fontSize: '0.85rem', margin: '0.25rem 0 0' }}>{children}</p>
    </div>
  )
}

function isInviteException(status: AdminLearner['inviteStatus']) {
  return inviteExceptionStatuses.includes(status as (typeof inviteExceptionStatuses)[number])
}

function formatLearningPathId(id: string) {
  if (id === 'program-induction-pbis') return 'Program Induction - PBIS'
  return humanizeId(id)
}

function formatFacilitatorId(id: string) {
  if (id === 'facilitator-1') return 'Program Pro Facilitator'
  return humanizeId(id)
}

function formatIdList(values: string[], formatter: (value: string) => string) {
  return values.length ? values.map(formatter).join(', ') : 'None'
}

function humanizeId(value: string) {
  return value
    .split(/[-_]/)
    .filter(Boolean)
    .map((part) => part.toUpperCase() === part ? part : part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ')
}

function humanizeAuditAction(action: string) {
  return action
    .split('.')
    .map((part) => part.replace(/_/g, ' '))
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ')
}

function countLearnersByInviteStatus(learners: AdminLearner[], status: AdminLearner['inviteStatus']) {
  return learners.filter((learner) => learner.inviteStatus === status).length
}

function formatInviteStatus(status: AdminLearner['inviteStatus'] | LearnerInvite['inviteStatus'] | undefined) {
  if (!status || status === 'not_invited' || status === 'not_sent') return 'Not invited'
  return status.replace(/_/g, ' ').replace(/^\w/, (first) => first.toUpperCase())
}

function formatDateTime(value: string) {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return 'Not scheduled'
  return date.toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' })
}

function toIsoFromLocalInput(value: string) {
  if (!value) return ''
  return new Date(value).toISOString()
}

function toLocalDatetimeValue(value: string) {
  if (!value) return ''
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return ''
  return date.toISOString().slice(0, 16)
}
