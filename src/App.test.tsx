import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import App from './App'
import { getLearningPath, trainingKnowledgeCheckItems, trainingScenarios } from './data/trainingData'

beforeEach(() => {
  window.history.replaceState({}, '', '/')
  window.localStorage.setItem('think-training-token', 'test-token')
  const contentRequests = [
    {
      id: 'behavior-management-request',
      request: 'Behavior management training not already in the catalog',
      audience: 'Program staff and site leaders',
      deliveryMode: 'hybrid',
      status: 'source-mapped',
      artifactsNeeded: ['PBIS PPT Master'],
      outputs: ['Facilitator deck', 'Knowledge check'],
      reviewOwner: 'Program Training & Development',
      reviewNotes: 'Source-mapped from PBIS decks.',
      createdAt: '2026-05-24T00:00:00.000Z',
      updatedAt: '2026-05-24T00:00:00.000Z',
      approvedAt: null,
      publishedAt: null,
    },
  ]
  const generatedTrainingPackage = {
    id: 'generated-package-1',
    contentRequestId: 'behavior-management-request',
    templateId: 'core-in-person-training',
    provider: 'deterministic',
    model: 'content-studio-fallback-v1',
    title: 'Behavior management training not already in the catalog',
    audience: 'Program staff and site leaders',
    durationMinutes: 45,
    deliveryMode: 'hybrid',
    sourceArtifactIds: ['PBIS PPT Master'],
    package: {
      provider: 'deterministic',
      model: 'content-studio-fallback-v1',
      template: {
        id: 'core-in-person-training',
        name: 'Core In-Person Training',
        requiredOutputs: ['Facilitator deck', 'Knowledge check'],
        reviewChecklist: ['Objectives are measurable'],
      },
      title: 'Behavior management training not already in the catalog',
      audience: 'Program staff and site leaders',
      durationMinutes: 45,
      learningObjectives: [],
      deckOutline: [],
      knowledgeCheckQuestions: [],
      practiceActivity: {
        title: 'Practice lab',
        instructions: [],
        facilitatorPrompt: '',
        successCriteria: [],
        sourceRefs: [],
      },
      facilitatorGuideNotes: [],
      learnerHandout: { summary: '', resourceList: [] },
      deliveryNotes: { inPerson: [], virtual: [] },
      sourceArtifacts: ['PBIS PPT Master.pptx'],
      generatedAt: '2026-05-24T00:00:00.000Z',
    },
    reviewStatus: 'draft',
    reviewOwner: 'Program Training & Development',
    reviewNotes: 'AI draft generated.',
    createdBy: 'admin-1',
    createdAt: '2026-05-24T00:00:00.000Z',
    updatedAt: '2026-05-24T00:00:00.000Z',
    approvedAt: null,
    publishedAt: null,
  }
  vi.stubGlobal('fetch', vi.fn(async (path: RequestInfo | URL) => {
    const url = String(path)
    if (url.endsWith('/api/me')) {
      return json({ user: { id: 'admin-1', email: 'admin@thinktogether.local', name: 'Admin', role: 'admin' } })
    }
    if (url.includes('/api/learning-paths/')) {
      const pathPayload = getLearningPath()
      return json({
        path: pathPayload,
        modules: pathPayload.modules,
        knowledgeChecks: trainingKnowledgeCheckItems,
        scenarios: trainingScenarios,
      })
    }
    if (url.endsWith('/api/progress')) {
      return json({ completedModuleIds: [], progress: [], practiceSubmissions: [] })
    }
    if (url.endsWith('/api/source-library')) {
      return json({
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
            reviewNotes: 'Baseline release from the shared SOP, PBIS, and knowledge-check artifacts.',
            createdBy: 'admin-1',
            createdAt: '2026-05-24T00:00:00.000Z',
            approvedAt: '2026-05-24T00:00:00.000Z',
            publishedAt: '2026-05-24T00:00:00.000Z',
          },
        ],
      })
    }
    if (url.endsWith('/api/admin/dashboard')) {
      return json({
        kpis: {
          totalLearners: 1,
          attended: 1,
          completedModules: 0,
          clearanceReady: 1,
          blocked: 0,
          makeupRequired: 0,
          averageKnowledgeScore: 0,
          surveyCompletion: 100,
          facilitatorRating: 4.8,
          practiceSubmissions: 0,
          completionRate: 0,
        },
        readinessByTrack: [],
        cohorts: [{ id: 'cohort-1', name: 'PBIS MVP Pilot', region: 'Emerging Region', participants: 1 }],
      })
    }
    if (url.endsWith('/api/admin/supervisor-report')) {
      return json({
        generatedAt: '2026-05-24T00:00:00.000Z',
        groups: { supervisors: [], facilitators: [], cohorts: [] },
        actionQueue: [],
        assignmentAutomation: {
          rules: [],
          readyForPilot: true,
          nextIntegration: 'Pilot weekly roster import before API sync.',
        },
        integrationReadiness: [],
        contentDevelopmentRequests: contentRequests,
        generatedTrainingPackages: [generatedTrainingPackage],
        rolloutForecast: {
          weeklyNewHires: 50,
          autoAssignablePercent: 100,
          supervisorDigestRecipients: 1,
          lmsRowsReady: 0,
          estimatedTrainerHoursSaved: 12,
        },
        completionNotifications: [],
        notificationQueue: [
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
            entityId: 'behavior-management-request',
            metadata: {},
            scheduledFor: null,
            sentAt: null,
            createdAt: '2026-05-24T00:00:00.000Z',
            updatedAt: '2026-05-24T00:00:00.000Z',
          },
        ],
      })
    }
    if (url.endsWith('/api/admin/notifications')) {
      return json({
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
            entityId: 'behavior-management-request',
            metadata: {},
            scheduledFor: null,
            sentAt: null,
            createdAt: '2026-05-24T00:00:00.000Z',
            updatedAt: '2026-05-24T00:00:00.000Z',
          },
        ],
      })
    }
    if (url.includes('/api/admin/notifications/')) {
      return json({
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
          entityId: 'behavior-management-request',
          metadata: {},
          scheduledFor: null,
          sentAt: '2026-05-24T00:01:00.000Z',
          createdAt: '2026-05-24T00:00:00.000Z',
          updatedAt: '2026-05-24T00:01:00.000Z',
        },
      })
    }
    if (url.endsWith('/api/admin/content-requests')) {
      return json({ request: contentRequests[0] })
    }
    if (url.endsWith('/api/content-studio/packages')) {
      return json({
        package: generatedTrainingPackage.package,
        generatedPackage: generatedTrainingPackage,
      })
    }
    if (url.includes('/api/admin/generated-packages/')) {
      return json({
        generatedPackage: { ...generatedTrainingPackage, reviewStatus: 'review-needed' },
        supervisorReport: {
          generatedAt: '2026-05-24T00:00:00.000Z',
          groups: { supervisors: [], facilitators: [], cohorts: [] },
          actionQueue: [],
          assignmentAutomation: {
            rules: [],
            readyForPilot: true,
            nextIntegration: 'Pilot weekly roster import before API sync.',
          },
          integrationReadiness: [],
          contentDevelopmentRequests: contentRequests,
          generatedTrainingPackages: [{ ...generatedTrainingPackage, reviewStatus: 'review-needed' }],
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
      })
    }
    if (url.includes('/api/admin/content-requests/')) {
      contentRequests[0] = { ...contentRequests[0], status: 'draft-ready', reviewNotes: 'Draft package is ready.' }
      return json({ request: contentRequests[0] })
    }
    if (url.endsWith('/api/admin/learners')) {
      return json({
        learners: [
          {
            id: 'learner-1',
            firstName: 'Maya',
            lastName: 'Rivera',
            email: 'maya.rivera@example.org',
            cohortId: 'cohort-1',
            cohortName: 'PBIS MVP Pilot',
            region: 'Emerging Region',
            assignedPathIds: ['program-induction-pbis'],
          },
        ],
      })
    }
    if (url.endsWith('/api/admin/cohorts')) {
      return json({
        cohorts: [
          {
            id: 'cohort-1',
            name: 'PBIS MVP Pilot',
            region: 'Emerging Region',
            startsAt: '2026-05-08T09:00:00.000Z',
            facilitatorIds: ['facilitator-1'],
            pathIds: ['program-induction-pbis'],
            learnerCount: 1,
          },
        ],
      })
    }
    if (url.endsWith('/api/ai/providers')) {
      return json({
        providers: [
          { id: 'openai', label: 'OpenAI GPT-5.5', configured: true, mode: 'sync', note: 'Premium planner' },
          { id: 'gemini', label: 'Gemini Flash', configured: true, mode: 'sync', note: 'Fast default' },
          { id: 'claude', label: 'Claude Sonnet', configured: false, mode: 'sync', note: 'Premium planner' },
          { id: 'notebooklm_enterprise', label: 'NotebookLM Enterprise', configured: false, mode: 'source-workspace', note: 'Source workspace' },
        ],
      })
    }
    if (url.endsWith('/api/content-studio/templates')) {
      return json({
        templates: [
          {
            id: 'core-in-person-training',
            name: 'Core In-Person Training',
            description: 'Build a facilitator-led training package.',
            bestFor: 'Weekly requests that need a consistent deck, practice, checks, and handout.',
            deliveryMode: 'in-person',
            audience: 'Think Together program leaders',
            durationMinutes: 45,
            topicStarter: 'Effective lesson delivery with 10:2 practice',
            sourceArtifactIds: ['pbis-ppt-master', 'sop-program-induction'],
            requiredOutputs: ['Deck', 'Knowledge check', 'Practice lab', 'Handout'],
            structure: [
              { label: 'Objectives', purpose: 'Name 2-3 learner outcomes.' },
              { label: 'Application', purpose: 'Give learners time to try the skill.' },
            ],
            reviewChecklist: ['Objectives are measurable', 'Application is visible'],
          },
          {
            id: 'virtual-makeup-path',
            name: 'Virtual Makeup Path',
            description: 'Convert missed in-person training into a virtual path.',
            bestFor: 'New hires who miss induction.',
            deliveryMode: 'virtual',
            audience: 'New hires who missed in-person induction',
            durationMinutes: 35,
            topicStarter: 'Virtual Program Induction makeup training',
            sourceArtifactIds: ['sop-program-induction'],
            requiredOutputs: ['Self-paced guide', 'Final check'],
            structure: [{ label: 'Watch', purpose: 'Make content self-paced.' }],
            reviewChecklist: ['Completion evidence is clear'],
          },
        ],
      })
    }
    if (url.endsWith('/api/ai/deck-outline-jobs')) {
      return json({ job: { id: 'outline-job-1', status: 'queued' } })
    }
    if (url.endsWith('/api/ai/deck-outline-jobs/outline-job-1')) {
      return json({
        job: { id: 'outline-job-1', status: 'ready' },
        outline: {
          provider: 'openai',
          model: 'gpt-5.5-test',
          title: 'Effective Lesson Delivery',
          audience: 'Program leaders',
          durationMinutes: 45,
          learningObjectives: ['Practice 10:2 delivery'],
          slides: [
            {
              title: 'Open with practice',
              objective: 'Use PBIS language in a short routine.',
              talkingPoints: ['Teach expectation'],
              activityPrompt: 'Pair practice an attention getter.',
              facilitatorNotes: 'Keep it human-led.',
              sourceRefs: [{ artifact: 'PBIS PPT Master.pptx', locator: 'Slide 4' }],
            },
          ],
          handoffNotes: ['Review before export.'],
          sourceArtifacts: ['PBIS PPT Master.pptx', 'SOP_Program Induction.pdf'],
          generatedAt: '2026-05-10T00:00:00.000Z',
        },
        provider: { id: 'openai', label: 'OpenAI GPT-5.5', configured: true, mode: 'sync', note: 'Premium planner' },
      })
    }
    return json({})
  }))
})

function json(body: unknown) {
  return Promise.resolve(new Response(JSON.stringify(body), {
    status: 200,
    headers: { 'content-type': 'application/json' },
  }))
}

describe('App', () => {
  it('lands admin users in the operations workspace by default', async () => {
    render(<App />)

    expect(await screen.findByRole('navigation', { name: /MVP workspace/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Dashboard' })).toHaveAttribute('aria-current', 'page')
    expect(screen.getByRole('heading', { name: 'Training Operations Dashboard' })).toBeInTheDocument()
  })

  it('switches between learner, coach, admin, users, cohorts, deck, reporting, and plan views', async () => {
    render(<App />)

    fireEvent.click(await screen.findByRole('button', { name: 'Practice' }))
    expect(screen.getByRole('heading', { name: 'Light Horseplay in Line' })).toBeInTheDocument()
    expect(screen.getByLabelText('Scenario')).toBeInTheDocument()
    expect(screen.getByLabelText('Scenario source references')).toHaveTextContent('PBIS PPT Master.pptx')
    fireEvent.click(screen.getByRole('button', { name: 'Next official scenario' }))
    expect(screen.getByRole('heading', { name: 'Physical Fight During Transition' })).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'Dashboard' }))
    expect(screen.getByRole('heading', { name: 'Training Operations Dashboard' })).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'Learners' }))
    expect(screen.getByRole('heading', { name: 'Learners and Invites' })).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'Cohorts' }))
    expect(screen.getByRole('heading', { name: 'Cohorts and Assignments' })).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'Deck Studio' }))
    expect(await screen.findByRole('heading', { name: 'Training Deck Studio' })).toBeInTheDocument()
    expect(await screen.findByLabelText('Template')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Virtual Makeup Path/i })).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Generate preview' }))
    expect(await screen.findByRole('heading', { name: 'Effective Lesson Delivery' })).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'Reporting' }))
    expect(screen.getByRole('heading', { name: 'Supervisor Reporting' })).toBeInTheDocument()
    expect(screen.getByLabelText('Supervisor reporting metrics')).toHaveTextContent('clearance-ready')
    expect(screen.getByRole('heading', { name: 'Notification queue' })).toBeInTheDocument()
    expect(screen.getByText('Review needed: Behavior management training')).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Content request pipeline' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Add content request' })).toBeInTheDocument()
    expect(screen.getAllByText('Behavior management training not already in the catalog').length).toBeGreaterThan(0)
    expect(screen.getByRole('heading', { name: 'Generated package review board' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Send to review' })).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'Roadmap' }))
    expect(screen.getByRole('heading', { name: 'MVP and Phase 2 Milestones' })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Content Library Releases' })).toBeInTheDocument()
    expect(screen.getByText('Shared Think Together artifact baseline')).toBeInTheDocument()
    expect(screen.queryByRole('heading', { name: 'Training Deck Studio' })).not.toBeInTheDocument()
  })

  it('uses learner profile from getMe and skips admin calls for learner users', async () => {
    const fetchMock = vi.fn(async (path: RequestInfo | URL, init?: RequestInit) => {
      void init
      const url = String(path)
      if (url.endsWith('/api/me')) {
        return json({
          user: { id: 'user-learner-1', email: 'real.learner@example.org', name: 'Fallback Name', role: 'learner' },
          learner: {
            id: 'learner-real-1',
            firstName: 'Real',
            lastName: 'Learner',
            email: 'real.learner@example.org',
            region: 'North',
            title: 'Program Leader',
            site: 'Palm Site',
          },
        })
      }
      if (url.includes('/api/learning-paths/')) {
        const pathPayload = getLearningPath()
        return json({
          path: pathPayload,
          modules: pathPayload.modules,
          knowledgeChecks: trainingKnowledgeCheckItems,
          scenarios: trainingScenarios,
        })
      }
      if (url.endsWith('/api/progress')) {
        return json({ completedModuleIds: [], progress: [], practiceSubmissions: [] })
      }
      return json({})
    })
    vi.stubGlobal('fetch', fetchMock)

    render(<App />)

    expect(await screen.findByRole('heading', { name: /Welcome/i })).toHaveTextContent('Real Learner')
    expect(screen.getByText('Program Induction - PBIS')).toBeInTheDocument()
    expect(screen.getByText('Palm Site')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Admin' })).not.toBeInTheDocument()
    await waitFor(() => {
      expect(fetchMock.mock.calls.map(([path]) => String(path)).some((url) => url.includes('/api/admin/'))).toBe(false)
    })
  })

  it('shows learner-facing Program Pro feedback copy and submits the training survey', async () => {
    const fetchMock = vi.fn(async (path: RequestInfo | URL) => {
      const url = String(path)
      if (url.endsWith('/api/me')) {
        return json({
          user: { id: 'user-learner-1', email: 'maya@example.org', name: 'Maya Rivera', role: 'learner' },
          learner: {
            id: 'learner-1',
            firstName: 'Maya',
            lastName: 'Rivera',
            email: 'maya@example.org',
            region: 'South',
            title: 'Program Leader',
            site: 'Maple Site',
          },
        })
      }
      if (url.includes('/api/learning-paths/')) {
        return json({
          path: {
            id: 'program-induction-pbis',
            title: 'Program Induction - PBIS',
            audience: 'Program Leaders',
            contentVersion: 'pbis-mvp-test',
            sourceRefs: [],
          },
          modules: [
            {
              id: 'overview',
              title: 'PBIS Overview',
              order: 1,
              estimatedMinutes: 4,
              requiredForCompletion: true,
              content: {
                summary: 'PBIS keeps expectations teachable and observable.',
                keyPoints: ['Use positive framing.'],
              },
              knowledgeCheckItemIds: ['kc-overview'],
            },
            {
              id: 'practice',
              title: 'Practice Routines',
              order: 2,
              estimatedMinutes: 5,
              requiredForCompletion: true,
              content: {
                summary: 'Practice makes site routines consistent.',
                keyPoints: ['Keep it brief.'],
              },
              knowledgeCheckItemIds: [],
            },
          ],
          knowledgeChecks: [
            {
              id: 'kc-overview',
              moduleId: 'overview',
              prompt: 'What should PBIS directions be?',
              choices: ['Start with one observable direction', 'Wait until behavior escalates'],
              correctAnswer: 'Start with one observable direction',
              rationale: 'Observable directions are easier to teach and reinforce.',
            },
          ],
          scenarios: [
            {
              id: 'scenario-1',
              title: 'Line Transition',
              prompt: 'A learner needs support during line-up.',
            },
          ],
        })
      }
      if (url.endsWith('/api/progress')) {
        return json({ completedModuleIds: [], progress: [], practiceSubmissions: [] })
      }
      if (url.includes('/api/knowledge-checks/')) {
        return json({ correct: true, correctAnswer: 'Start with one observable direction', rationale: 'Correct.' })
      }
      if (url.endsWith('/api/progress/module-complete')) {
        return json({ moduleId: 'overview', status: 'completed', completedAt: '2026-05-09T00:00:00.000Z' })
      }
      if (url.endsWith('/api/source-library')) {
        return json({ sourceLibraryVersion: 'test', artifacts: [], learningPaths: [] })
      }
      if (url.endsWith('/api/surveys/training')) {
        return json({
          survey: {
            id: 'survey-1',
            learnerId: 'learner-1',
            facilitatorId: 'facilitator-1',
            pathId: 'program-induction-pbis',
            rating: 'ready',
            score: 5,
            notes: 'Program Pro connected the practice to my site.',
            surveySubmitted: true,
            submittedAt: '2026-05-09T00:00:00.000Z',
          },
        })
      }
      return json({})
    })
    vi.stubGlobal('fetch', fetchMock)

    render(<App />)

    fireEvent.click(await screen.findByRole('button', { name: 'Verify and start' }))
    fireEvent.click(screen.getByRole('button', { name: 'Mark lesson complete' }))
    expect(await screen.findByRole('heading', { name: 'Practice Routines' })).toBeInTheDocument()

    fireEvent.change(screen.getByLabelText('Practice response'), {
      target: { value: 'Use walking feet and keep hands to yourself.' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Submit practice' }))

    expect(await screen.findByRole('heading', { name: 'Final Knowledge Check' })).toBeInTheDocument()
    fireEvent.click(screen.getByLabelText('Start with one observable direction'))
    fireEvent.click(screen.getByRole('button', { name: 'Submit final knowledge check' }))

    expect(await screen.findByRole('heading', { name: 'Survey and Commitment' })).toBeInTheDocument()
    expect(screen.getByRole('form', { name: 'Training survey' })).toBeInTheDocument()
    expect(screen.getByText('Facilitator/session rating')).toBeInTheDocument()
    expect(screen.getByText('Feedback for Program Pros')).toBeInTheDocument()

    fireEvent.change(screen.getByLabelText('Feedback for Program Pros'), {
      target: { value: 'Program Pro connected the practice to my site.' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Submit survey' }))

    expect(await screen.findByRole('status')).toHaveTextContent(
      'Survey submitted. Thank you for helping improve weekly training delivery.',
    )
    const surveyCall = fetchMock.mock.calls.find(([calledPath]) =>
      String(calledPath).endsWith('/api/surveys/training'),
    ) as [RequestInfo | URL, RequestInit?] | undefined
    expect(surveyCall?.[1]).toMatchObject({
      method: 'POST',
      body: JSON.stringify({
        pathId: 'program-induction-pbis',
        score: 5,
        notes: 'Program Pro connected the practice to my site.',
      }),
    })
  })

  it('accepts invite links and stores the returned learner session', async () => {
    window.localStorage.clear()
    window.history.pushState({}, '', '/?invite=invite-token-1')
    const fetchMock = vi.fn(async (path: RequestInfo | URL) => {
      const url = String(path)
      if (url.endsWith('/api/auth/accept-invite')) {
        return json({
          token: 'learner-token',
          expiresAt: '2026-05-09T00:00:00.000Z',
          user: { id: 'user-learner-1', email: 'invited@example.org', name: 'Invited Learner', role: 'learner' },
          learner: {
            id: 'learner-accepted-1',
            firstName: 'Invited',
            lastName: 'Learner',
            email: 'invited@example.org',
            region: 'South',
          },
        })
      }
      if (url.includes('/api/learning-paths/')) {
        const pathPayload = getLearningPath()
        return json({
          path: pathPayload,
          modules: pathPayload.modules,
          knowledgeChecks: trainingKnowledgeCheckItems,
          scenarios: trainingScenarios,
        })
      }
      if (url.endsWith('/api/progress')) {
        return json({ completedModuleIds: [], progress: [], practiceSubmissions: [] })
      }
      return json({})
    })
    vi.stubGlobal('fetch', fetchMock)

    render(<App />)

    expect(screen.getByRole('heading', { name: 'Accept invite' })).toBeInTheDocument()
    fireEvent.change(screen.getByLabelText('Password'), { target: { value: 'password123' } })
    fireEvent.click(screen.getByRole('button', { name: 'Accept invite' }))

    expect(await screen.findByRole('heading', { name: /Welcome/i })).toBeInTheDocument()
    expect(screen.getByText('Program Induction - PBIS')).toBeInTheDocument()
    expect(screen.getAllByText('Invited Learner').length).toBeGreaterThan(0)
    expect(window.localStorage.getItem('think-training-token')).toBe('learner-token')
    expect(fetchMock.mock.calls[0][0]).toBe('/api/auth/accept-invite')
  })
})
