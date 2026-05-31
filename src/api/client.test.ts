import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  acceptInvite,
  createAdminCohort,
  createAdminLearner,
  createAiDeckOutline,
  createContentStudioPackage,
  createLearnerInvite,
  downloadAiDeckPptx,
  downloadAdminExport,
  getAdminCohorts,
  getAdminLearners,
  getAdminNotifications,
  getAutoAssignmentRules,
  getAiProviders,
  getContentStudioTemplates,
  getMe,
  getSourceLibrary,
  previewAssignmentCsv,
  revokeLearnerInvite,
  storeToken,
  submitTrainingSurvey,
  updateAdminLearnerAssignment,
  updateAdminNotificationStatus,
  updateGeneratedTrainingPackageStatus,
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
      .mockResolvedValueOnce(json({ learner: { id: 'learner-1', supervisor: 'Regional Supervisor B' } }))

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
    await updateAdminLearnerAssignment('learner-1', {
      cohortId: 'cohort-1',
      supervisor: 'Regional Supervisor B',
      assignedPathIds: ['program-induction-pbis'],
    })

    const learnerInit = fetchMock.mock.calls[0][1] as RequestInit
    const cohortInit = fetchMock.mock.calls[1][1] as RequestInit
    const assignmentInit = fetchMock.mock.calls[2][1] as RequestInit

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

    expect(fetchMock.mock.calls[2][0]).toBe('/api/admin/learners/learner-1/assignment')
    expect(assignmentInit.method).toBe('PUT')
    expect(assignmentInit.body).toBe(JSON.stringify({
      cohortId: 'cohort-1',
      supervisor: 'Regional Supervisor B',
      assignedPathIds: ['program-induction-pbis'],
    }))
    expect((assignmentInit.headers as Headers).get('authorization')).toBe('Bearer admin-token')
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

  it('downloads the supervisor digest export with auth headers', async () => {
    storeToken('admin-token')
    const anchor = document.createElement('a')
    const click = vi.spyOn(anchor, 'click').mockImplementation(() => undefined)
    vi.spyOn(document, 'createElement').mockReturnValue(anchor)
    fetchMock.mockResolvedValueOnce(new Response('owner,learner_name\nTraining Ops,Maya Rivera\n', {
      status: 200,
      headers: { 'content-type': 'text/csv' },
    }))

    await downloadAdminExport('supervisor-digest')

    const exportInit = fetchMock.mock.calls[0][1] as RequestInit
    expect(fetchMock.mock.calls[0][0]).toBe('/api/admin/exports/supervisor-digest.csv')
    expect((exportInit.headers as Headers).get('authorization')).toBe('Bearer admin-token')
    expect(anchor.download).toBe('think-supervisor-digest.csv')
    expect(click).toHaveBeenCalled()
  })

  it('downloads the content operations export with auth headers', async () => {
    storeToken('admin-token')
    const anchor = document.createElement('a')
    const click = vi.spyOn(anchor, 'click').mockImplementation(() => undefined)
    vi.spyOn(document, 'createElement').mockReturnValue(anchor)
    fetchMock.mockResolvedValueOnce(new Response('row_type,content_request_id\ncontent_request,request-1\n', {
      status: 200,
      headers: { 'content-type': 'text/csv' },
    }))

    await downloadAdminExport('content-operations')

    const exportInit = fetchMock.mock.calls[0][1] as RequestInit
    expect(fetchMock.mock.calls[0][0]).toBe('/api/admin/exports/content-operations.csv')
    expect((exportInit.headers as Headers).get('authorization')).toBe('Bearer admin-token')
    expect(anchor.download).toBe('think-content-operations-export.csv')
    expect(click).toHaveBeenCalled()
  })

  it('loads assignment rules and posts roster preview CSV with auth headers', async () => {
    storeToken('admin-token')
    fetchMock
      .mockResolvedValueOnce(json({
        rules: [
          {
            id: 'program-induction-new-hire',
            name: 'Program Induction for weekly new hires',
            active: true,
            matchCriteria: { titleKeywords: ['program leader'], requiredFields: ['email'] },
          },
        ],
      }))
      .mockResolvedValueOnce(json({
        generatedAt: '2026-05-24T00:00:00.000Z',
        rules: [],
        rows: [{ rowNumber: 1, status: 'auto_assign' }],
        summary: { totalRows: 1, autoAssignable: 1, needsReview: 0, duplicate: 0, noRule: 0 },
      }))

    await expect(getAutoAssignmentRules()).resolves.toEqual({
      rules: [
        {
          id: 'program-induction-new-hire',
          name: 'Program Induction for weekly new hires',
          active: true,
          matchCriteria: { titleKeywords: ['program leader'], requiredFields: ['email'] },
        },
      ],
    })
    await expect(previewAssignmentCsv('First Name,Email\nJordan,jordan@example.org')).resolves.toMatchObject({
      summary: { totalRows: 1, autoAssignable: 1 },
    })

    const rulesInit = fetchMock.mock.calls[0][1] as RequestInit
    const previewInit = fetchMock.mock.calls[1][1] as RequestInit
    expect(fetchMock.mock.calls[0][0]).toBe('/api/admin/assignment-rules')
    expect((rulesInit.headers as Headers).get('authorization')).toBe('Bearer admin-token')
    expect(fetchMock.mock.calls[1][0]).toBe('/api/admin/assignment-preview')
    expect(previewInit.method).toBe('POST')
    expect(previewInit.body).toBe(JSON.stringify({ csvText: 'First Name,Email\nJordan,jordan@example.org' }))
    expect((previewInit.headers as Headers).get('authorization')).toBe('Bearer admin-token')
  })

  it('loads source library releases with auth headers', async () => {
    storeToken('admin-token')
    fetchMock.mockResolvedValueOnce(json({
      sourceLibraryVersion: 'think-training-source-library-test',
      artifacts: [],
      learningPaths: [],
      releases: [
        {
          id: 'source-library-current',
          version: 'think-training-source-library-test',
          title: 'Shared Think Together artifact baseline',
          status: 'published',
          contentRequestId: null,
          artifactIds: ['pbis-ppt-master'],
          sourceMetrics: { artifacts: 1 },
          reviewOwner: 'Program Training & Development',
          reviewNotes: 'Baseline release.',
          createdBy: 'admin-1',
          createdAt: '2026-05-24T00:00:00.000Z',
          approvedAt: '2026-05-24T00:00:00.000Z',
          publishedAt: '2026-05-24T00:00:00.000Z',
        },
      ],
    }))

    await expect(getSourceLibrary()).resolves.toMatchObject({
      releases: [
        {
          id: 'source-library-current',
          status: 'published',
          reviewOwner: 'Program Training & Development',
        },
      ],
    })

    const sourceInit = fetchMock.mock.calls[0][1] as RequestInit
    expect(fetchMock.mock.calls[0][0]).toBe('/api/source-library')
    expect((sourceInit.headers as Headers).get('authorization')).toBe('Bearer admin-token')
  })

  it('loads and updates the admin notification queue with auth headers', async () => {
    storeToken('admin-token')
    fetchMock
      .mockResolvedValueOnce(json({
        notifications: [
          {
            id: 'notification-1',
            type: 'content_review',
            recipientName: 'Program Training & Development',
            recipientEmail: 'program.training.development@thinktogether.local',
            subject: 'Review needed: Behavior management training',
            body: 'Human review is needed before pilot delivery.',
            owner: 'Program Training & Development',
            priority: 'high',
            status: 'queued',
            entityType: 'content_request',
            entityId: 'request-1',
            metadata: {},
            scheduledFor: null,
            sentAt: null,
            createdAt: '2026-05-24T00:00:00.000Z',
            updatedAt: '2026-05-24T00:00:00.000Z',
          },
        ],
      }))
      .mockResolvedValueOnce(json({
        notification: {
          id: 'notification-1',
          type: 'content_review',
          recipientName: 'Program Training & Development',
          recipientEmail: 'program.training.development@thinktogether.local',
          subject: 'Review needed: Behavior management training',
          body: 'Human review is needed before pilot delivery.',
          owner: 'Program Training & Development',
          priority: 'high',
          status: 'sent',
          entityType: 'content_request',
          entityId: 'request-1',
          metadata: {},
          scheduledFor: null,
          sentAt: '2026-05-24T00:01:00.000Z',
          createdAt: '2026-05-24T00:00:00.000Z',
          updatedAt: '2026-05-24T00:01:00.000Z',
        },
      }))

    await expect(getAdminNotifications()).resolves.toMatchObject({
      notifications: [{ id: 'notification-1', status: 'queued' }],
    })
    await expect(updateAdminNotificationStatus('notification-1', 'sent')).resolves.toMatchObject({
      notification: { id: 'notification-1', status: 'sent' },
    })

    const updateInit = fetchMock.mock.calls[1][1] as RequestInit
    expect(fetchMock.mock.calls[0][0]).toBe('/api/admin/notifications')
    expect((fetchMock.mock.calls[0][1] as RequestInit).headers).toBeInstanceOf(Headers)
    expect(fetchMock.mock.calls[1][0]).toBe('/api/admin/notifications/notification-1/status')
    expect(updateInit.method).toBe('PATCH')
    expect(updateInit.body).toBe(JSON.stringify({ status: 'sent' }))
    expect((updateInit.headers as Headers).get('authorization')).toBe('Bearer admin-token')
  })

  it('posts learner training survey feedback with the expected API shape', async () => {
    storeToken('learner-token')
    fetchMock.mockResolvedValueOnce(json({
      survey: {
        id: 'survey-1',
        learnerId: 'learner-1',
        facilitatorId: 'facilitator-1',
        pathId: 'program-induction-pbis',
        rating: 'ready',
        score: 5,
        notes: 'The Program Pro made the site routine practice concrete.',
        surveySubmitted: true,
        submittedAt: '2026-05-09T00:00:00.000Z',
      },
    }))

    await expect(submitTrainingSurvey({
      pathId: 'program-induction-pbis',
      facilitatorId: 'facilitator-1',
      score: 5,
      notes: 'The Program Pro made the site routine practice concrete.',
    })).resolves.toMatchObject({
      survey: {
        learnerId: 'learner-1',
        facilitatorId: 'facilitator-1',
        pathId: 'program-induction-pbis',
        score: 5,
        surveySubmitted: true,
      },
    })

    const surveyInit = fetchMock.mock.calls[0][1] as RequestInit
    expect(fetchMock.mock.calls[0][0]).toBe('/api/surveys/training')
    expect(surveyInit.method).toBe('POST')
    expect(surveyInit.body).toBe(JSON.stringify({
      pathId: 'program-induction-pbis',
      facilitatorId: 'facilitator-1',
      score: 5,
      notes: 'The Program Pro made the site routine practice concrete.',
    }))
    expect((surveyInit.headers as Headers).get('authorization')).toBe('Bearer learner-token')
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

  it('posts Content Studio package requests with auth headers', async () => {
    storeToken('admin-token')
    fetchMock.mockResolvedValueOnce(json({
      package: {
        provider: 'deterministic',
        model: 'content-studio-fallback-v1',
        template: {
          id: 'core-in-person-training',
          name: 'Core In-Person Training',
          requiredOutputs: ['Deck', 'Knowledge check', 'Practice lab', 'Handout'],
          reviewChecklist: ['Objectives are measurable', 'Application is visible'],
        },
        title: 'PBIS practice lab',
        learningObjectives: ['Explain PBIS routines', 'Practice explicit teaching'],
        deckOutline: [],
        knowledgeCheckQuestions: [],
        practiceActivity: { title: 'Practice lab', instructions: [], facilitatorPrompt: '', successCriteria: [] },
        facilitatorGuideNotes: [],
        learnerHandout: { summary: '', resourceList: [] },
        deliveryNotes: { inPerson: [], virtual: [] },
        sourceArtifacts: [],
        generatedAt: '2026-05-21T00:00:00.000Z',
      },
      generatedPackage: {
        id: 'generated-package-1',
        contentRequestId: 'request-1',
        templateId: 'core-in-person-training',
        provider: 'deterministic',
        model: 'content-studio-fallback-v1',
        title: 'PBIS practice lab',
        audience: 'Program leaders',
        durationMinutes: 60,
        deliveryMode: 'hybrid',
        sourceArtifactIds: ['pbis-ppt-master'],
        package: {},
        reviewStatus: 'draft',
        reviewOwner: 'Program Training & Development',
        reviewNotes: 'AI draft generated.',
        createdBy: 'admin-1',
        createdAt: '2026-05-21T00:00:00.000Z',
        updatedAt: '2026-05-21T00:00:00.000Z',
        approvedAt: null,
        publishedAt: null,
      },
    }))

    await expect(createContentStudioPackage({
      provider: 'openai',
      templateId: 'core-in-person-training',
      contentRequestId: 'request-1',
      topic: 'PBIS practice lab',
      audience: 'Program leaders',
      durationMinutes: 60,
      deliveryMode: 'hybrid',
      sourceArtifactIds: ['pbis-ppt-master'],
    })).resolves.toMatchObject({
      package: {
        title: 'PBIS practice lab',
        provider: 'deterministic',
      },
      generatedPackage: {
        id: 'generated-package-1',
        reviewStatus: 'draft',
      },
    })

    const packageInit = fetchMock.mock.calls[0][1] as RequestInit
    expect(fetchMock.mock.calls[0][0]).toBe('/api/content-studio/packages')
    expect(packageInit.method).toBe('POST')
    expect(packageInit.body).toBe(JSON.stringify({
      provider: 'openai',
      templateId: 'core-in-person-training',
      contentRequestId: 'request-1',
      topic: 'PBIS practice lab',
      audience: 'Program leaders',
      durationMinutes: 60,
      deliveryMode: 'hybrid',
      sourceArtifactIds: ['pbis-ppt-master'],
    }))
    expect((packageInit.headers as Headers).get('authorization')).toBe('Bearer admin-token')
  })

  it('updates generated training package review status with auth headers', async () => {
    storeToken('admin-token')
    fetchMock.mockResolvedValueOnce(json({
      generatedPackage: {
        id: 'generated-package-1',
        reviewStatus: 'review-needed',
        reviewNotes: 'Queued for review.',
      },
      supervisorReport: {
        generatedAt: '2026-05-24T00:00:00.000Z',
        groups: { supervisors: [], facilitators: [], cohorts: [] },
        actionQueue: [],
        assignmentAutomation: { rules: [], readyForPilot: true, nextIntegration: '' },
        integrationReadiness: [],
        contentDevelopmentRequests: [],
        generatedTrainingPackages: [],
        rolloutForecast: {
          weeklyNewHires: 50,
          autoAssignablePercent: 100,
          supervisorDigestRecipients: 1,
          lmsRowsReady: 0,
          estimatedTrainerHoursSaved: 12,
        },
        completionNotifications: [],
        notificationQueue: [],
      },
    }))

    await expect(updateGeneratedTrainingPackageStatus(
      'generated-package-1',
      'review-needed',
      'Queued for review.',
    )).resolves.toMatchObject({
      generatedPackage: {
        id: 'generated-package-1',
        reviewStatus: 'review-needed',
      },
    })

    const updateInit = fetchMock.mock.calls[0][1] as RequestInit
    expect(fetchMock.mock.calls[0][0]).toBe('/api/admin/generated-packages/generated-package-1/status')
    expect(updateInit.method).toBe('PATCH')
    expect(updateInit.body).toBe(JSON.stringify({
      status: 'review-needed',
      reviewNotes: 'Queued for review.',
    }))
    expect((updateInit.headers as Headers).get('authorization')).toBe('Bearer admin-token')
  })

  it('loads Content Studio reusable templates with auth headers', async () => {
    storeToken('admin-token')
    fetchMock.mockResolvedValueOnce(json({
      templates: [
        {
          id: 'core-in-person-training',
          name: 'Core In-Person Training',
          description: 'Build a facilitator-led training package.',
          bestFor: 'Weekly requests.',
          deliveryMode: 'in-person',
          audience: 'Program leaders',
          durationMinutes: 45,
          topicStarter: 'PBIS lesson delivery',
          sourceArtifactIds: ['pbis-ppt-master'],
          requiredOutputs: ['Deck'],
          structure: [{ label: 'Objectives', purpose: 'Name outcomes.' }],
          reviewChecklist: ['Review objectives'],
        },
      ],
    }))

    await expect(getContentStudioTemplates()).resolves.toMatchObject({
      templates: [{ id: 'core-in-person-training', name: 'Core In-Person Training' }],
    })

    expect(fetchMock.mock.calls[0][0]).toBe('/api/content-studio/templates')
    expect((fetchMock.mock.calls[0][1].headers as Headers).get('authorization')).toBe('Bearer admin-token')
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
