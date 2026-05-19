import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  acceptInvite,
  createAdminCohort,
  createAdminLearner,
  createAiDeckOutline,
  createLearnerInvite,
  downloadAiDeckPptx,
  downloadAdminExport,
  getAdminCohorts,
  getAdminLearners,
  getAiProviders,
  getMe,
  revokeLearnerInvite,
  storeToken,
} from './client'

const fetchMock = vi.fn()

beforeEach(() => {
  window.localStorage.clear()
  fetchMock.mockReset()
  vi.stubGlobal('fetch', fetchMock)
  vi.stubGlobal('URL', {
    ...window.URL,
    createObjectURL: vi.fn(() => 'blob:export'),
    revokeObjectURL: vi.fn(),
  })
})

afterEach(() => {
  vi.restoreAllMocks()
})

function json(body: unknown) {
  return Promise.resolve(new Response(JSON.stringify(body), {
    status: 200,
    headers: { 'content-type': 'application/json' },
  }))
}

describe('admin management client', () => {
  it('loads admin learners and cohorts from planned endpoints', async () => {
    fetchMock
      .mockResolvedValueOnce(json({ learners: [{ id: 'learner-1', firstName: 'Ari', lastName: 'Moore', email: 'ari@example.org' }] }))
      .mockResolvedValueOnce(json({ cohorts: [{ id: 'cohort-1', name: 'NHO May 2026', learnerCount: 1 }] }))

    await expect(getAdminLearners()).resolves.toEqual({
      learners: [{ id: 'learner-1', firstName: 'Ari', lastName: 'Moore', email: 'ari@example.org' }],
    })
    await expect(getAdminCohorts()).resolves.toEqual({
      cohorts: [{ id: 'cohort-1', name: 'NHO May 2026', learnerCount: 1 }],
    })

    expect(fetchMock).toHaveBeenNthCalledWith(
      1,
      '/api/admin/learners',
      expect.objectContaining({ headers: expect.any(Headers) }),
    )
    expect(fetchMock).toHaveBeenNthCalledWith(
      2,
      '/api/admin/cohorts',
      expect.objectContaining({ headers: expect.any(Headers) }),
    )
  })

  it('posts learner and cohort management payloads with auth headers', async () => {
    storeToken('admin-token')
    fetchMock
      .mockResolvedValueOnce(json({ learner: { id: 'learner-1', firstName: 'Noah', lastName: 'Kim' } }))
      .mockResolvedValueOnce(json({ cohort: { id: 'cohort-1', name: 'NHO June 2026' } }))

    await createAdminLearner({
      firstName: 'Noah',
      lastName: 'Kim',
      email: 'noah@example.org',
      cohortId: 'cohort-1',
      assignedPathIds: ['program-induction-pbis'],
    })
    await createAdminCohort({
      name: 'NHO June 2026',
      region: 'Central',
      startsAt: '2026-06-03T16:00:00.000Z',
      facilitatorIds: ['facilitator-2'],
      pathIds: ['program-induction-pbis'],
    })

    const learnerInit = fetchMock.mock.calls[0][1] as RequestInit
    const cohortInit = fetchMock.mock.calls[1][1] as RequestInit

    expect(fetchMock.mock.calls[0][0]).toBe('/api/admin/learners')
    expect(learnerInit.method).toBe('POST')
    expect(learnerInit.body).toBe(JSON.stringify({
      firstName: 'Noah',
      lastName: 'Kim',
      email: 'noah@example.org',
      cohortId: 'cohort-1',
      assignedPathIds: ['program-induction-pbis'],
    }))
    expect((learnerInit.headers as Headers).get('authorization')).toBe('Bearer admin-token')

    expect(fetchMock.mock.calls[1][0]).toBe('/api/admin/cohorts')
    expect(cohortInit.method).toBe('POST')
    expect(cohortInit.body).toBe(JSON.stringify({
      name: 'NHO June 2026',
      region: 'Central',
      startsAt: '2026-06-03T16:00:00.000Z',
      facilitatorIds: ['facilitator-2'],
      pathIds: ['program-induction-pbis'],
    }))
    expect((cohortInit.headers as Headers).get('authorization')).toBe('Bearer admin-token')
  })

  it('posts learner invite requests with auth headers', async () => {
    storeToken('admin-token')
    fetchMock.mockResolvedValueOnce(json({
      invite: {
        learnerId: 'learner-1',
        inviteStatus: 'pending',
        inviteUrl: 'https://training.example.org/invite/token-1',
        expiresAt: '2026-06-01T00:00:00.000Z',
      },
    }))

    await expect(createLearnerInvite('learner-1')).resolves.toEqual({
      invite: {
        learnerId: 'learner-1',
        inviteStatus: 'pending',
        inviteUrl: 'https://training.example.org/invite/token-1',
        expiresAt: '2026-06-01T00:00:00.000Z',
      },
    })

    const inviteInit = fetchMock.mock.calls[0][1] as RequestInit
    expect(fetchMock.mock.calls[0][0]).toBe('/api/admin/learners/learner-1/invite')
    expect(inviteInit.method).toBe('POST')
    expect((inviteInit.headers as Headers).get('authorization')).toBe('Bearer admin-token')
  })

  it('revokes learner invites with auth headers', async () => {
    storeToken('admin-token')
    fetchMock.mockResolvedValueOnce(json({
      learner: {
        id: 'learner-1',
        firstName: 'Ari',
        lastName: 'Moore',
        email: 'ari@example.org',
        inviteStatus: 'revoked',
      },
    }))

    await expect(revokeLearnerInvite('learner-1')).resolves.toMatchObject({
      learner: { id: 'learner-1', inviteStatus: 'revoked' },
    })

    const revokeInit = fetchMock.mock.calls[0][1] as RequestInit
    expect(fetchMock.mock.calls[0][0]).toBe('/api/admin/learners/learner-1/invite/revoke')
    expect(revokeInit.method).toBe('POST')
    expect((revokeInit.headers as Headers).get('authorization')).toBe('Bearer admin-token')
  })

  it('downloads CSV exports with auth headers', async () => {
    storeToken('admin-token')
    const anchor = document.createElement('a')
    const click = vi.spyOn(anchor, 'click').mockImplementation(() => undefined)
    vi.spyOn(document, 'createElement').mockReturnValue(anchor)
    fetchMock.mockResolvedValueOnce(new Response('learner_id\nlearner-1\n', {
      status: 200,
      headers: { 'content-type': 'text/csv' },
    }))

    await downloadAdminExport('completions')

    const exportInit = fetchMock.mock.calls[0][1] as RequestInit
    expect(fetchMock.mock.calls[0][0]).toBe('/api/admin/exports/completions.csv')
    expect((exportInit.headers as Headers).get('authorization')).toBe('Bearer admin-token')
    expect(anchor.href).toBe('blob:export')
    expect(anchor.download).toBe('think-completion-export.csv')
    expect(click).toHaveBeenCalled()
  })

  it('loads AI providers, posts deck outlines, and downloads PPTX with auth headers', async () => {
    storeToken('admin-token')
    fetchMock
      .mockResolvedValueOnce(json({
        providers: [{ id: 'openai', label: 'OpenAI GPT-5.5', configured: true, mode: 'sync', note: 'Premium planner' }],
      }))
      .mockResolvedValueOnce(json({
        job: { id: 'outline-job-1', status: 'running' },
      }))
      .mockResolvedValueOnce(json({
        job: { id: 'outline-job-1', status: 'ready' },
        outline: { title: 'PBIS Refresher', provider: 'openai', slides: [] },
        provider: { id: 'openai', label: 'OpenAI GPT-5.5', configured: true, mode: 'sync', note: 'Premium planner' },
      }))
      .mockResolvedValueOnce(json({
        job: { id: 'deck-job-1', status: 'ready' },
      }))
      .mockResolvedValueOnce(Promise.resolve(new Response(new Blob(['pptx']), {
        status: 200,
        headers: { 'content-disposition': 'attachment; filename="pbis-refresher.pptx"' },
      })))

    await expect(getAiProviders()).resolves.toMatchObject({
      providers: [{ id: 'openai', configured: true }],
    })
    await expect(createAiDeckOutline({
      provider: 'openai',
      topic: 'PBIS refresher for program leaders',
      audience: 'Program leaders',
      durationMinutes: 45,
      slideCount: 6,
    })).resolves.toMatchObject({ outline: { title: 'PBIS Refresher' } })
    await downloadAiDeckPptx({
      provider: 'openai',
      topic: 'PBIS refresher for program leaders',
      audience: 'Program leaders',
      durationMinutes: 45,
      slideCount: 6,
    })

    expect(fetchMock.mock.calls[0][0]).toBe('/api/ai/providers')
    const deckInit = fetchMock.mock.calls[1][1] as RequestInit
    expect(fetchMock.mock.calls[1][0]).toBe('/api/ai/deck-outline-jobs')
    expect(deckInit.method).toBe('POST')
    expect(deckInit.body).toBe(JSON.stringify({
      provider: 'openai',
      topic: 'PBIS refresher for program leaders',
      audience: 'Program leaders',
      durationMinutes: 45,
      slideCount: 6,
    }))
    expect((deckInit.headers as Headers).get('authorization')).toBe('Bearer admin-token')
    expect(fetchMock.mock.calls[2][0]).toBe('/api/ai/deck-outline-jobs/outline-job-1')
    const jobInit = fetchMock.mock.calls[3][1] as RequestInit
    expect(fetchMock.mock.calls[3][0]).toBe('/api/ai/deck-jobs')
    expect(jobInit.method).toBe('POST')
    expect(jobInit.body).toBe(JSON.stringify({
      provider: 'openai',
      topic: 'PBIS refresher for program leaders',
      audience: 'Program leaders',
      durationMinutes: 45,
      slideCount: 6,
    }))
    expect((jobInit.headers as Headers).get('authorization')).toBe('Bearer admin-token')
    const pptxInit = fetchMock.mock.calls[4][1] as RequestInit
    expect(fetchMock.mock.calls[4][0]).toBe('/api/ai/deck-jobs/deck-job-1/pptx')
    expect((pptxInit.headers as Headers).get('authorization')).toBe('Bearer admin-token')
  })
})

describe('invite auth client', () => {
  it('accepts learner invites and stores the returned session token', async () => {
    fetchMock.mockResolvedValueOnce(json({
      token: 'learner-session',
      expiresAt: '2026-06-01T00:00:00.000Z',
      user: {
        id: 'user-1',
        email: 'ari@example.org',
        name: 'Ari Moore',
        role: 'learner',
        learnerId: 'learner-1',
      },
      learner: {
        id: 'learner-1',
        firstName: 'Ari',
        lastName: 'Moore',
        email: 'ari@example.org',
        cohortId: 'cohort-1',
        assignedPathIds: ['program-induction-pbis'],
      },
    }))

    await expect(acceptInvite('invite-token', 'new-password')).resolves.toMatchObject({
      token: 'learner-session',
      user: { learnerId: 'learner-1' },
      learner: { id: 'learner-1' },
    })

    const acceptInit = fetchMock.mock.calls[0][1] as RequestInit
    expect(fetchMock.mock.calls[0][0]).toBe('/api/auth/accept-invite')
    expect(acceptInit.method).toBe('POST')
    expect(acceptInit.body).toBe(JSON.stringify({ token: 'invite-token', password: 'new-password' }))
    expect(window.localStorage.getItem('think-training-token')).toBe('learner-session')
  })

  it('loads the current user and optional learner profile from /api/me', async () => {
    storeToken('learner-session')
    fetchMock.mockResolvedValueOnce(json({
      user: {
        id: 'user-1',
        email: 'ari@example.org',
        name: 'Ari Moore',
        role: 'learner',
        learnerId: 'learner-1',
      },
      learner: {
        id: 'learner-1',
        firstName: 'Ari',
        lastName: 'Moore',
        email: 'ari@example.org',
        cohortId: 'cohort-1',
        cohortName: 'NHO May 2026',
        assignedPathIds: ['program-induction-pbis'],
      },
    }))

    await expect(getMe()).resolves.toMatchObject({
      user: { learnerId: 'learner-1' },
      learner: { cohortName: 'NHO May 2026' },
    })

    const meInit = fetchMock.mock.calls[0][1] as RequestInit
    expect(fetchMock.mock.calls[0][0]).toBe('/api/me')
    expect((meInit.headers as Headers).get('authorization')).toBe('Bearer learner-session')
  })
})
