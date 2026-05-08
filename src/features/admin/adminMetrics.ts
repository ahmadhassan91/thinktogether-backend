export type ParticipantStatus =
  | 'enrolled'
  | 'attended'
  | 'completed'
  | 'blocked'
  | 'makeup_required'

export type TopicScore = {
  topic: string
  score: number
}

export type TrainingParticipant = {
  id: string
  name: string
  region: string
  cohort: string
  role: string
  status: ParticipantStatus
  attendedDays: number
  requiredDays: number
  completedTraining: boolean
  clearanceChecklistComplete: boolean
  knowledgeCheckScore?: number
  surveySubmitted: boolean
  facilitatorRating?: number
  lmsVerified: boolean
  exportedToLms: boolean
  topicScores?: TopicScore[]
}

export type ParticipantFilters = {
  region?: string
  status?: ParticipantStatus | 'all'
  cohort?: string
}

export type TrainingKpis = {
  enrolled: number
  attended: number
  completed: number
  clearanceReady: number
  blocked: number
  makeupRequired: number
  averageScore: number
  surveyCompletion: number
  facilitatorRating: number
}

export type WeakTopicSummary = {
  topic: string
  averageScore: number
  participantsBelowThreshold: number
}

const PASSING_SCORE = 80

const roundTo = (value: number, decimals = 0) => {
  const factor = 10 ** decimals
  return Math.round(value * factor) / factor
}

const average = (values: number[], decimals = 0) => {
  if (values.length === 0) {
    return 0
  }

  return roundTo(
    values.reduce((total, value) => total + value, 0) / values.length,
    decimals,
  )
}

const hasPartialAttendance = (participant: TrainingParticipant) =>
  participant.attendedDays > 0 && participant.attendedDays < participant.requiredDays

const hasCompletedAttendance = (participant: TrainingParticipant) =>
  participant.requiredDays > 0 && participant.attendedDays >= participant.requiredDays

export const getBlockedParticipants = (participants: TrainingParticipant[]) =>
  participants.filter(
    (participant) => participant.status === 'blocked' || hasPartialAttendance(participant),
  )

export const getClearanceReadyParticipants = (participants: TrainingParticipant[]) =>
  participants.filter(
    (participant) =>
      participant.completedTraining &&
      participant.clearanceChecklistComplete &&
      hasCompletedAttendance(participant) &&
      (participant.knowledgeCheckScore ?? 0) >= PASSING_SCORE &&
      participant.status !== 'blocked',
  )

export const computeTrainingKpis = (participants: TrainingParticipant[]): TrainingKpis => ({
  enrolled: participants.length,
  attended: participants.filter((participant) => participant.attendedDays > 0).length,
  completed: participants.filter((participant) => participant.completedTraining).length,
  clearanceReady: getClearanceReadyParticipants(participants).length,
  blocked: getBlockedParticipants(participants).length,
  makeupRequired: participants.filter((participant) => participant.status === 'makeup_required').length,
  averageScore: average(
    participants
      .map((participant) => participant.knowledgeCheckScore)
      .filter((score): score is number => typeof score === 'number'),
  ),
  surveyCompletion:
    participants.length === 0
      ? 0
      : roundTo(
          (participants.filter((participant) => participant.surveySubmitted).length / participants.length) *
            100,
        ),
  facilitatorRating: average(
    participants
      .map((participant) => participant.facilitatorRating)
      .filter((rating): rating is number => typeof rating === 'number'),
    1,
  ),
})

export const filterParticipants = (
  participants: TrainingParticipant[],
  filters: ParticipantFilters,
) =>
  participants.filter((participant) => {
    const regionMatches = !filters.region || filters.region === 'all' || participant.region === filters.region
    const statusMatches = !filters.status || filters.status === 'all' || participant.status === filters.status
    const cohortMatches = !filters.cohort || filters.cohort === 'all' || participant.cohort === filters.cohort

    return regionMatches && statusMatches && cohortMatches
  })

export const getWeakTopicSummary = (
  participants: TrainingParticipant[],
  threshold = PASSING_SCORE,
): WeakTopicSummary[] => {
  const topicScores = new Map<string, number[]>()

  participants.forEach((participant) => {
    participant.topicScores?.forEach(({ topic, score }) => {
      topicScores.set(topic, [...(topicScores.get(topic) ?? []), score])
    })
  })

  return [...topicScores.entries()]
    .map(([topic, scores]) => ({
      topic,
      averageScore: average(scores, 2),
      participantsBelowThreshold: scores.filter((score) => score < threshold).length,
    }))
    .sort((left, right) => left.averageScore - right.averageScore || left.topic.localeCompare(right.topic))
}
