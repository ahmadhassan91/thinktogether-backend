import { describe, expect, it } from 'vitest'
import {
  getCurrentMvpMilestoneSummary,
  getMilestonesByPhase,
  mvpMilestones,
} from './mvpMilestones'

describe('mvpMilestones', () => {
  it('contains the MVP and Phase 2 plan counts from the phase plan CSV', () => {
    expect(getMilestonesByPhase('MVP')).toHaveLength(10)
    expect(getMilestonesByPhase('Phase 2')).toHaveLength(9)
    expect(mvpMilestones).toHaveLength(19)
  })

  it('returns a concise current MVP milestone summary', () => {
    expect(getCurrentMvpMilestoneSummary()).toEqual({
      phase: 'MVP',
      totalMilestones: 10,
      currentMilestoneId: 'M1',
      currentMilestone: 'Discovery confirmation and demo scope lock',
      deliveryWindow: 'Week 1 Day 1-2',
      nextMilestoneId: 'M2',
    })
  })
})
