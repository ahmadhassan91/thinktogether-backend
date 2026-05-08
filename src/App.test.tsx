import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import App from './App'
import { getLearningPath, trainingKnowledgeCheckItems, trainingScenarios } from './data/trainingData'

beforeEach(() => {
  window.history.replaceState({}, '', '/')
  window.localStorage.setItem('think-training-token', 'test-token')
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
  it('renders the integrated learner workspace by default', async () => {
    render(<App />)

    expect(await screen.findByRole('banner', { name: /Think Together training MVP/i })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: /Welcome/i })).toBeInTheDocument()
    expect(screen.getByText('Program Induction - PBIS')).toBeInTheDocument()
  })

  it('switches between learner, coach, admin, and plan views', async () => {
    render(<App />)

    fireEvent.click(await screen.findByRole('button', { name: 'Practice' }))
    expect(screen.getByRole('heading', { name: 'Jacob and the Pencil Pouch' })).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'Admin' }))
    expect(screen.getByRole('heading', { name: 'Training Operations Dashboard' })).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'Plan' }))
    expect(screen.getByRole('heading', { name: 'MVP and Phase 2 Milestones' })).toBeInTheDocument()
  })

  it('uses learner profile from getMe and skips admin calls for learner users', async () => {
    const fetchMock = vi.fn(async (path: RequestInfo | URL) => {
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

    expect(await screen.findByRole('heading', { name: 'Welcome, Real Learner' })).toBeInTheDocument()
    expect(screen.getByText('Palm Site')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Admin' })).not.toBeInTheDocument()
    await waitFor(() => {
      expect(fetchMock.mock.calls.map(([path]) => String(path)).some((url) => url.includes('/api/admin/'))).toBe(false)
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

    expect(await screen.findByRole('heading', { name: 'Welcome, Invited Learner' })).toBeInTheDocument()
    expect(window.localStorage.getItem('think-training-token')).toBe('learner-token')
    expect(fetchMock.mock.calls[0][0]).toBe('/api/auth/accept-invite')
  })
})
