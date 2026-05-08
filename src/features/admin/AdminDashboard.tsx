import { useMemo, useState, type FormEvent } from 'react'
import {
  computeTrainingKpis,
  filterParticipants,
  type ParticipantStatus,
  type TrainingParticipant,
} from './adminMetrics'
import type {
  AdminCohort,
  AdminCohortInput,
  AdminDashboardPayload,
  AdminExportKind,
  AdminLearner,
  AdminLearnerInput,
  LearnerInvite,
} from '../../api/client'

export type AdminDashboardProps = {
  participants?: TrainingParticipant[]
  dashboard?: AdminDashboardPayload
  learners?: AdminLearner[]
  managementCohorts?: AdminCohort[]
  onCreateLearner?: (learner: AdminLearnerInput) => Promise<void> | void
  onCreateCohort?: (cohort: AdminCohortInput) => Promise<void> | void
  onCreateLearnerInvite?: (learnerId: string) => Promise<LearnerInvite> | LearnerInvite
  onRevokeLearnerInvite?: (learnerId: string) => Promise<void> | void
  onDownloadExport?: (kind: AdminExportKind) => Promise<void> | void
}

const statusLabels: Record<ParticipantStatus, string> = {
  enrolled: 'Enrolled',
  attended: 'Attended',
  completed: 'Completed',
  blocked: 'Blocked',
  makeup_required: 'Makeup required',
}

const uniqueValues = (values: string[]) => [...new Set(values)].sort((left, right) => left.localeCompare(right))

const chipStyle = {
  border: '1px solid #ccd5df',
  borderRadius: '999px',
  display: 'inline-flex',
  fontSize: '0.78rem',
  fontWeight: 700,
  lineHeight: 1,
  padding: '0.35rem 0.55rem',
} satisfies React.CSSProperties

const emptyLearnerForm: AdminLearnerInput = {
  firstName: '',
  lastName: '',
  email: '',
  cohortId: '',
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
  participants = [],
  dashboard,
  learners = [],
  managementCohorts = [],
  onCreateLearner,
  onCreateCohort,
  onCreateLearnerInvite,
  onRevokeLearnerInvite,
  onDownloadExport,
}: AdminDashboardProps) {
  const [region, setRegion] = useState('all')
  const [status, setStatus] = useState<ParticipantStatus | 'all'>('all')
  const [cohort, setCohort] = useState('all')
  const [learnerForm, setLearnerForm] = useState<AdminLearnerInput>(emptyLearnerForm)
  const [cohortForm, setCohortForm] = useState<AdminCohortInput>(emptyCohortForm)
  const [inviteResult, setInviteResult] = useState<LearnerInvite | null>(null)
  const [inviteError, setInviteError] = useState('')
  const [exportError, setExportError] = useState('')

  const filteredParticipants = useMemo(
    () => filterParticipants(participants, { region, status, cohort }),
    [cohort, participants, region, status],
  )
  const kpis = useMemo(() => computeTrainingKpis(participants), [participants])
  const regions = useMemo(() => uniqueValues(participants.map((participant) => participant.region)), [participants])
  const cohorts = useMemo(() => uniqueValues(participants.map((participant) => participant.cohort)), [participants])

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

  return (
    <section style={{ color: '#1d2430', fontFamily: 'system-ui, sans-serif', padding: '2rem', textAlign: 'left' }}>
      <header style={{ marginBottom: '1.5rem' }}>
        <p style={{ color: '#5b6675', fontSize: '0.9rem', fontWeight: 700, margin: 0 }}>
          Think Together admin MVP
        </p>
        <h1 style={{ fontSize: '2rem', letterSpacing: 0, margin: '0.25rem 0 0' }}>
          Training Operations Dashboard
        </h1>
      </header>

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

      {onDownloadExport ? (
        <section aria-label="Admin exports" style={{ marginBottom: '1.25rem' }}>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
            <button onClick={() => void handleDownloadExport('clearance')} type="button">
              Download clearance CSV
            </button>
            <button onClick={() => void handleDownloadExport('completions')} type="button">
              Download completion CSV
            </button>
          </div>
          {exportError ? <p role="alert">{exportError}</p> : null}
        </section>
      ) : null}

      {dashboard ? (
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
        </section>
      ) : null}

      {(onCreateLearner || onCreateCohort || learners.length || managementCohorts.length) ? (
        <section
          aria-label="Admin learner and cohort management"
          style={{
            border: '1px solid #d8dee7',
            borderRadius: 8,
            marginBottom: '1.25rem',
            padding: '1rem',
          }}
        >
          <h2 style={{ fontSize: '1.2rem', margin: '0 0 0.75rem' }}>Learner and cohort management</h2>
          <div style={{ display: 'grid', gap: '1rem', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))' }}>
            {onCreateLearner ? (
              <form aria-label="Create learner" onSubmit={handleLearnerSubmit}>
                <h3 style={{ fontSize: '1rem', margin: '0 0 0.75rem' }}>Add learner</h3>
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
                  <button type="submit">Add learner</button>
                </div>
              </form>
            ) : null}

            {onCreateCohort ? (
              <form aria-label="Create cohort" onSubmit={handleCohortSubmit}>
                <h3 style={{ fontSize: '1rem', margin: '0 0 0.75rem' }}>Add cohort</h3>
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
                    Facilitator IDs
                    <input
                      aria-label="Cohort facilitator IDs"
                      onChange={(event) =>
                        setCohortForm({ ...cohortForm, facilitatorIds: splitCsvInput(event.target.value) })
                      }
                      style={{ display: 'block', marginTop: '0.25rem', width: '100%' }}
                      value={cohortForm.facilitatorIds.join(', ')}
                    />
                  </label>
                  <label>
                    Path IDs
                    <input
                      aria-label="Cohort path IDs"
                      onChange={(event) => setCohortForm({ ...cohortForm, pathIds: splitCsvInput(event.target.value) })}
                      required
                      style={{ display: 'block', marginTop: '0.25rem', width: '100%' }}
                      value={cohortForm.pathIds.join(', ')}
                    />
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

          {learners.length ? (
            <div style={{ marginTop: '1rem' }}>
              <h3 style={{ fontSize: '1rem', marginBottom: '0.5rem' }}>Managed learners</h3>
              <div className="admin-table-wrap">
              <table style={{ borderCollapse: 'collapse', width: '100%' }}>
                <thead>
                  <tr>
                    {['Learner', 'Email', 'Cohort', 'Region', 'Invite', 'Action'].map((heading) => (
                      <th key={heading} style={{ borderBottom: '1px solid #cbd5e1', padding: '0.6rem' }}>
                        {heading}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {learners.map((learner) => {
                    const canRevokeInvite = learner.inviteStatus === 'pending'
                    const inviteActionLabel = learner.inviteStatus === 'pending' ? 'Resend invite' : 'Generate invite'

                    return (
                      <tr key={learner.id}>
                        <td style={{ borderBottom: '1px solid #e5e7eb', padding: '0.6rem' }}>
                          {learner.firstName} {learner.lastName}
                        </td>
                        <td style={{ borderBottom: '1px solid #e5e7eb', padding: '0.6rem' }}>{learner.email}</td>
                        <td style={{ borderBottom: '1px solid #e5e7eb', padding: '0.6rem' }}>{learner.cohortName}</td>
                        <td style={{ borderBottom: '1px solid #e5e7eb', padding: '0.6rem' }}>{learner.region}</td>
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
          ) : null}
        </section>
      ) : null}

      {participants.length ? <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.75rem', marginBottom: '1rem' }}>
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

      {participants.length ? <div className="admin-table-wrap"><table style={{ borderCollapse: 'collapse', width: '100%' }}>
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
    </section>
  )
}

function splitCsvInput(value: string) {
  return value.split(',').map((item) => item.trim()).filter(Boolean)
}

function formatInviteStatus(status: AdminLearner['inviteStatus'] | LearnerInvite['inviteStatus'] | undefined) {
  if (!status || status === 'not_invited' || status === 'not_sent') return 'Not invited'
  return status.replace(/_/g, ' ').replace(/^\w/, (first) => first.toUpperCase())
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
