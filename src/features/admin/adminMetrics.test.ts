import { describe, expect, it } from 'vitest'
import {
  computeTrainingKpis,
  filterParticipants,
  getBlockedParticipants,
  getClearanceReadyParticipants,
  getWeakTopicSummary,
  type TrainingParticipant,
} from './adminMetrics'

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
    topicScores: [
      { topic: 'Safety', score: 95 },
      { topic: 'Family Engagement', score: 88 },
    ],
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
    topicScores: [
      { topic: 'Safety', score: 72 },
      { topic: 'Family Engagement', score: 61 },
    ],
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
    topicScores: [
      { topic: 'Safety', score: 83 },
      { topic: 'Family Engagement', score: 79 },
    ],
  },
  {
    id: 'p-4',
    name: 'Diego Santos',
    region: 'South',
    cohort: 'Induction May 2026',
    role: 'Program Leader',
    status: 'blocked',
    attendedDays: 3,
    requiredDays: 3,
    completedTraining: true,
    clearanceChecklistComplete: false,
    knowledgeCheckScore: 78,
    surveySubmitted: false,
    facilitatorRating: 4.4,
    lmsVerified: false,
    exportedToLms: false,
    topicScores: [
      { topic: 'Safety', score: 77 },
      { topic: 'Family Engagement', score: 82 },
    ],
  },
]

describe('admin training metrics', () => {
  it('computes operational KPIs for the training dashboard', () => {
    expect(computeTrainingKpis(participants)).toEqual({
      enrolled: 4,
      attended: 4,
      completed: 2,
      clearanceReady: 1,
      blocked: 2,
      makeupRequired: 1,
      averageScore: 80,
      surveyCompletion: 50,
      facilitatorRating: 4.3,
    })
  })

  it('filters participants by region, status, and cohort', () => {
    expect(
      filterParticipants(participants, {
        region: 'East',
        status: 'attended',
        cohort: 'Induction May 2026',
      }),
    ).toEqual([participants[2]])
  })

  it('separates blocked and clearance-ready participants', () => {
    expect(getBlockedParticipants(participants).map((participant) => participant.id)).toEqual([
      'p-2',
      'p-4',
    ])
    expect(getClearanceReadyParticipants(participants).map((participant) => participant.id)).toEqual([
      'p-1',
    ])
  })

  it('summarizes weak training topics by lowest average score first', () => {
    expect(getWeakTopicSummary(participants, 80)).toEqual([
      {
        topic: 'Family Engagement',
        averageScore: 77.5,
        participantsBelowThreshold: 2,
      },
      {
        topic: 'Safety',
        averageScore: 81.75,
        participantsBelowThreshold: 2,
      },
    ])
  })
})
