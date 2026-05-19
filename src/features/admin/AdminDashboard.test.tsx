import { fireEvent, render, screen, within } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { AdminDashboard } from './AdminDashboard'
import type { TrainingParticipant } from './adminMetrics'

const participants: TrainingParticipant[] = [
  {
    id: 'p-1',
    name: 'Ariana Moore',
    region: 'East',
    cohort: 'NHO May 2026',
    role: 'Program Leader',
    status: 'completed',
    attendedDays: 3,
    requiredDays: 3,
    completedTraining: true,
    clearanceChecklistComplete: true,
    knowledgeCheckScore: 92,
    surveySubmitted: true,
    facilitatorRating: 4.8,
    lmsVerified: true,
    exportedToLms: true,
  },
  {
    id: 'p-2',
    name: 'Ben Carter',
    region: 'West',
    cohort: 'NHO May 2026',
    role: 'Site Lead',
    status: 'makeup_required',
    attendedDays: 1,
    requiredDays: 3,
    completedTraining: false,
    clearanceChecklistComplete: false,
    knowledgeCheckScore: 68,
    surveySubmitted: false,
    facilitatorRating: 3.7,
    lmsVerified: false,
    exportedToLms: false,
  },
  {
    id: 'p-3',
    name: 'Celia Nguyen',
    region: 'East',
    cohort: 'Induction May 2026',
    role: 'Teacher',
    status: 'attended',
    attendedDays: 2,
    requiredDays: 2,
    completedTraining: false,
    clearanceChecklistComplete: true,
    knowledgeCheckScore: 80,
    surveySubmitted: true,
    facilitatorRating: 4.1,
    lmsVerified: false,
    exportedToLms: true,
  },
]

describe('AdminDashboard', () => {
  it('renders the KPI strip, MVP boundaries, and participant table', () => {
    render(<AdminDashboard participants={participants} />)

    expect(screen.getByRole('heading', { name: 'Training Operations Dashboard' })).toBeInTheDocument()
    expect(screen.getByLabelText('Enrolled KPI')).toHaveTextContent('3')
    expect(screen.getByLabelText('Clearance-ready KPI')).toHaveTextContent('1')
    expect(screen.getByLabelText('Average score KPI')).toHaveTextContent('80%')
    expect(screen.getByLabelText('Survey completion KPI')).toHaveTextContent('67%')
    expect(screen.getByLabelText('Facilitator rating KPI')).toHaveTextContent('4.2')

    expect(screen.getByText('CSV import/export')).toBeInTheDocument()
    expect(screen.getByText('LMS verified/exported status')).toBeInTheDocument()
    expect(screen.getByText('No ADP writeback')).toBeInTheDocument()

    const arianaRow = screen.getByRole('row', { name: /Ariana Moore/i })
    expect(within(arianaRow).getByText('Completed')).toBeInTheDocument()
    expect(within(arianaRow).getByText('LMS verified')).toBeInTheDocument()
    expect(within(arianaRow).getByText('Exported')).toBeInTheDocument()

    const benRow = screen.getByRole('row', { name: /Ben Carter/i })
    expect(within(benRow).getByText('Makeup required')).toBeInTheDocument()
    expect(within(benRow).getByText('LMS pending')).toBeInTheDocument()
  })

  it('filters the participant table by region, status, and cohort', async () => {
    render(<AdminDashboard participants={participants} />)

    fireEvent.change(screen.getByLabelText('Region'), { target: { value: 'East' } })
    fireEvent.change(screen.getByLabelText('Status'), { target: { value: 'attended' } })
    fireEvent.change(screen.getByLabelText('Cohort'), { target: { value: 'Induction May 2026' } })

    expect(screen.getByRole('row', { name: /Celia Nguyen/i })).toBeInTheDocument()
    expect(screen.queryByRole('row', { name: /Ariana Moore/i })).not.toBeInTheDocument()
    expect(screen.queryByRole('row', { name: /Ben Carter/i })).not.toBeInTheDocument()
  })

  it('renders management forms and calls supplied create handlers', async () => {
    const onCreateLearner = vi.fn()
    const onCreateCohort = vi.fn()
    const onCreateLearnerInvite = vi.fn(() => ({
      learnerId: 'learner-1',
      inviteStatus: 'pending' as const,
      inviteToken: 'invite-token-1',
      inviteUrl: 'http://localhost:5173/?invite=invite-token-1',
    }))

    render(
      <AdminDashboard
        mode="users"
        managementCohorts={[
          {
            id: 'cohort-1',
            name: 'PIT May 2026',
            region: 'East',
            startsAt: '2026-05-14T09:00:00.000Z',
            facilitatorIds: ['facilitator-1'],
            pathIds: ['program-induction-pbis'],
            learnerCount: 3,
          },
        ]}
        learners={[
          {
            id: 'learner-1',
            firstName: 'Mina',
            lastName: 'Patel',
            email: 'mina@example.org',
            cohortId: 'cohort-1',
            cohortName: 'PIT May 2026',
            region: 'East',
            assignedPathIds: ['program-induction-pbis'],
            inviteStatus: 'not_invited',
          },
        ]}
        onCreateLearner={onCreateLearner}
        onCreateCohort={onCreateCohort}
        onCreateLearnerInvite={onCreateLearnerInvite}
      />,
    )

    expect(screen.getByRole('form', { name: 'Create learner' })).toBeInTheDocument()
    expect(screen.getByRole('row', { name: /Mina Patel/i })).toHaveTextContent('PIT May 2026')
    expect(screen.getByRole('row', { name: /Mina Patel/i })).toHaveTextContent('Not invited')

    fireEvent.change(screen.getByLabelText('Learner first name'), { target: { value: 'Noah' } })
    fireEvent.change(screen.getByLabelText('Learner last name'), { target: { value: 'Kim' } })
    fireEvent.change(screen.getByLabelText('Learner email'), { target: { value: 'noah@example.org' } })
    fireEvent.change(screen.getByLabelText('Learner cohort'), { target: { value: 'cohort-1' } })
    fireEvent.click(screen.getByRole('button', { name: 'Add learner' }))

    expect(onCreateLearner).toHaveBeenCalledWith({
      firstName: 'Noah',
      lastName: 'Kim',
      email: 'noah@example.org',
      cohortId: 'cohort-1',
      assignedPathIds: ['program-induction-pbis'],
    })

    fireEvent.click(screen.getByRole('button', { name: 'Generate invite' }))
    expect(onCreateLearnerInvite).toHaveBeenCalledWith('learner-1')
    expect(await screen.findByText('Invite ready')).toBeInTheDocument()
    expect(screen.getByText('http://localhost:5173/?invite=invite-token-1')).toBeInTheDocument()
  })

  it('renders cohort management from the dedicated cohorts view', () => {
    const onCreateCohort = vi.fn()

    render(
      <AdminDashboard
        mode="cohorts"
        managementCohorts={[
          {
            id: 'cohort-1',
            name: 'PIT May 2026',
            region: 'East',
            startsAt: '2026-05-14T09:00:00.000Z',
            facilitatorIds: ['facilitator-1'],
            pathIds: ['program-induction-pbis'],
            learnerCount: 3,
          },
        ]}
        onCreateCohort={onCreateCohort}
      />,
    )

    expect(screen.getByRole('form', { name: 'Create cohort' })).toBeInTheDocument()

    fireEvent.change(screen.getByLabelText('Cohort name'), { target: { value: 'NHO June 2026' } })
    fireEvent.change(screen.getByLabelText('Cohort region'), { target: { value: 'Central' } })
    fireEvent.change(screen.getByLabelText('Cohort facilitator IDs'), { target: { value: 'facilitator-2' } })
    fireEvent.change(screen.getByLabelText('Cohort path IDs'), { target: { value: 'program-induction-pbis' } })
    fireEvent.change(screen.getByLabelText('Cohort starts at'), { target: { value: '2026-06-03T09:00' } })
    fireEvent.click(screen.getByRole('button', { name: 'Add cohort' }))

    expect(onCreateCohort).toHaveBeenCalledWith({
      name: 'NHO June 2026',
      region: 'Central',
      startsAt: '2026-06-03T04:00:00.000Z',
      facilitatorIds: ['facilitator-2'],
      pathIds: ['program-induction-pbis'],
    })
  })
})
