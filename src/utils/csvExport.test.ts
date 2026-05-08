import { describe, expect, it, vi } from 'vitest'
import { buildClearanceExport, exportRowsToCsv } from './csvExport'

describe('exportRowsToCsv', () => {
  it('quotes fields containing commas, quotes, and newlines', () => {
    const csv = exportRowsToCsv(
      [
        {
          name: 'Avery "AJ" Patel',
          cohort: 'PBIS, Spring',
          note: 'Ready\nNeeds facilitator sign-off',
        },
      ],
      [
        { key: 'name', header: 'Learner' },
        { key: 'cohort', header: 'Cohort' },
        { key: 'note', header: 'Notes' },
      ],
    )

    expect(csv).toBe(
      'Learner,Cohort,Notes\n"Avery ""AJ"" Patel","PBIS, Spring","Ready\nNeeds facilitator sign-off"',
    )
  })
})

describe('buildClearanceExport', () => {
  it('returns learner identity, cohort, score, clearance, timestamp, and content version fields', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-05-08T10:30:00.000Z'))

    const rows = buildClearanceExport(
      [
        {
          id: 'p-1',
          learnerId: 'EMP-001',
          learnerName: 'Jordan Rivera',
          email: 'jordan@example.org',
          cohort: 'PBIS May Pilot',
        },
      ],
      [
        {
          participantId: 'p-1',
          score: 92,
          passed: true,
          contentVersion: 'pbis-v0.1',
        },
      ],
      [
        {
          participantId: 'p-1',
          status: 'present',
        },
      ],
    )

    expect(rows).toEqual([
      {
        learnerId: 'EMP-001',
        learnerName: 'Jordan Rivera',
        email: 'jordan@example.org',
        cohort: 'PBIS May Pilot',
        score: 92,
        clearanceStatus: 'clearance-ready',
        exportedAt: '2026-05-08T10:30:00.000Z',
        contentVersion: 'pbis-v0.1',
      },
    ])

    vi.useRealTimers()
  })
})
