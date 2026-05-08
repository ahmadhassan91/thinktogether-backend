export type CsvValue = string | number | boolean | Date | null | undefined

export type CsvColumn<Row extends Record<string, unknown>> =
  | keyof Row
  | {
      key: keyof Row | string
      header?: string
      value?: (row: Row) => CsvValue
    }

export interface ClearanceParticipant {
  id: string
  learnerId: string
  learnerName: string
  email: string
  cohort: string
  contentVersion?: string
}

export interface ClearanceCompletion {
  participantId: string
  score: number
  passed: boolean
  contentVersion?: string
}

export interface ClearanceAttendance {
  participantId: string
  status: 'present' | 'partial' | 'absent' | 'excused'
  attendedMinutes?: number
  requiredMinutes?: number
}

export interface ClearanceExportRow {
  learnerId: string
  learnerName: string
  email: string
  cohort: string
  score: number | ''
  clearanceStatus: 'clearance-ready' | 'blocked-incomplete' | 'blocked-partial-attendance' | 'blocked-absent'
  exportedAt: string
  contentVersion: string
}

export function exportRowsToCsv<Row extends Record<string, unknown>>(
  rows: readonly Row[],
  columns: readonly CsvColumn<Row>[],
): string {
  const headers = columns.map((column) => formatCsvCell(getColumnHeader(column)))
  const body = rows.map((row) =>
    columns.map((column) => formatCsvCell(getColumnValue(row, column))).join(','),
  )

  return [headers.join(','), ...body].join('\n')
}

export function buildClearanceExport(
  participants: readonly ClearanceParticipant[],
  completions: readonly ClearanceCompletion[],
  attendance: readonly ClearanceAttendance[],
): ClearanceExportRow[] {
  const exportedAt = new Date().toISOString()
  const completionsByParticipant = new Map(completions.map((completion) => [completion.participantId, completion]))
  const attendanceByParticipant = new Map(attendance.map((record) => [record.participantId, record]))

  return participants.map((participant) => {
    const completion = completionsByParticipant.get(participant.id)
    const attendanceRecord = attendanceByParticipant.get(participant.id)

    return {
      learnerId: participant.learnerId,
      learnerName: participant.learnerName,
      email: participant.email,
      cohort: participant.cohort,
      score: completion?.score ?? '',
      clearanceStatus: getClearanceStatus(completion, attendanceRecord),
      exportedAt,
      contentVersion: completion?.contentVersion ?? participant.contentVersion ?? '',
    }
  })
}

function getColumnHeader<Row extends Record<string, unknown>>(column: CsvColumn<Row>): CsvValue {
  if (typeof column === 'object') {
    return column.header ?? String(column.key)
  }

  return String(column)
}

function getColumnValue<Row extends Record<string, unknown>>(row: Row, column: CsvColumn<Row>): CsvValue {
  if (typeof column === 'object') {
    return column.value ? column.value(row) : valueToCsvValue(row[column.key])
  }

  return valueToCsvValue(row[column])
}

function valueToCsvValue(value: unknown): CsvValue {
  if (
    typeof value === 'string' ||
    typeof value === 'number' ||
    typeof value === 'boolean' ||
    value instanceof Date ||
    value == null
  ) {
    return value
  }

  return JSON.stringify(value)
}

function formatCsvCell(value: CsvValue): string {
  const text = value instanceof Date ? value.toISOString() : String(value ?? '')
  const escaped = text.replaceAll('"', '""')

  return /[",\r\n]/.test(escaped) ? `"${escaped}"` : escaped
}

function getClearanceStatus(
  completion: ClearanceCompletion | undefined,
  attendance: ClearanceAttendance | undefined,
): ClearanceExportRow['clearanceStatus'] {
  if (!completion?.passed) {
    return 'blocked-incomplete'
  }

  if (!attendance || attendance.status === 'absent' || attendance.status === 'excused') {
    return 'blocked-absent'
  }

  const hasPartialMinutes =
    attendance.requiredMinutes !== undefined &&
    attendance.attendedMinutes !== undefined &&
    attendance.attendedMinutes < attendance.requiredMinutes

  if (attendance.status === 'partial' || hasPartialMinutes) {
    return 'blocked-partial-attendance'
  }

  return 'clearance-ready'
}
