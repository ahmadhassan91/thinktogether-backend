import { z } from 'zod'
import type { KnowledgeCheckItem, Module, Scenario, SourceRef } from '../../types'

export type ContentImportIssue = {
  code: string
  message: string
  path: Array<string | number>
}

export type ContentImportValidationFlag = {
  code: 'needs_human_validation'
  entityType: 'knowledge_check'
  entityId: string
  message: string
  sourceRefs: SourceRef[]
}

export type NormalizedTrainingContent = {
  modules: Module[]
  knowledgeCheckItems: KnowledgeCheckItem[]
  scenarios: Scenario[]
  validationFlags: ContentImportValidationFlag[]
  readyForApiInsertion: boolean
}

export type TrainingContentImportResult =
  | { ok: true; data: NormalizedTrainingContent }
  | { ok: false; errors: ContentImportIssue[] }

export type ContentImportOptions = {
  defaultContentVersion?: string
}

const sourceRefSchema = z.object({
  artifact: z.string().trim().min(1),
  locator: z.string().trim().min(1),
})

const baseContentItemSchema = z.object({
  id: z.string().trim().min(1),
  sourceRefs: z.array(sourceRefSchema).min(1),
  contentVersion: z.string().trim().min(1).optional(),
})

const importedModuleSchema = baseContentItemSchema.extend({
  title: z.string().trim().min(1),
  order: z.coerce.number().int().positive(),
  estimatedMinutes: z.coerce.number().int().positive(),
  summary: z.string().trim().min(1),
  learningObjectives: z.array(z.string().trim().min(1)).min(1),
  keyPoints: z.array(z.string().trim().min(1)).min(1),
  requiredForCompletion: z.boolean().optional().default(true),
})

const importedKnowledgeCheckSchema = baseContentItemSchema.extend({
  moduleId: z.string().trim().min(1),
  prompt: z.string().trim().min(1),
  choices: z.array(z.string().trim().min(1)).min(2),
  correctAnswer: z.string().trim(),
  rationale: z.string().trim().min(1),
  needsHumanValidation: z.boolean().optional().default(false),
})

const importedScenarioSchema = baseContentItemSchema.extend({
  moduleId: z.string().trim().min(1),
  title: z.string().trim().min(1),
  prompt: z.string().trim().min(1),
  skillFocus: z.string().trim().min(1),
  expectedResponseElements: z.array(z.string().trim().min(1)).min(1),
})

export const trainingContentImportSchema = z.object({
  modules: z.array(importedModuleSchema).default([]),
  knowledgeChecks: z.array(importedKnowledgeCheckSchema).default([]),
  scenarios: z.array(importedScenarioSchema).default([]),
})

type TrainingContentImport = z.infer<typeof trainingContentImportSchema>
type ImportedKnowledgeCheck = z.infer<typeof importedKnowledgeCheckSchema>

export function normalizeTrainingContentJson(
  input: unknown,
  options: ContentImportOptions = {},
): TrainingContentImportResult {
  const parsed = trainingContentImportSchema.safeParse(input)

  if (!parsed.success) {
    return { ok: false, errors: parsed.error.issues.map(zodIssueToImportIssue) }
  }

  return normalizeParsedImport(parsed.data, options)
}

export function normalizeTrainingContentCsv(
  csv: string,
  options: ContentImportOptions = {},
): TrainingContentImportResult {
  const parsedCsv = parseCsv(csv)

  if (!parsedCsv.ok) {
    return { ok: false, errors: parsedCsv.errors }
  }

  return normalizeTrainingContentJson(csvRowsToImport(parsedCsv.rows), options)
}

function normalizeParsedImport(
  contentImport: TrainingContentImport,
  options: ContentImportOptions,
): TrainingContentImportResult {
  const errors: ContentImportIssue[] = []
  const validationFlags: ContentImportValidationFlag[] = []
  const moduleIds = new Set<string>()

  collectDuplicateIds(contentImport.modules.map((moduleItem) => moduleItem.id), 'modules', errors)
  collectDuplicateIds(contentImport.knowledgeChecks.map((item) => item.id), 'knowledgeChecks', errors)
  collectDuplicateIds(contentImport.scenarios.map((scenario) => scenario.id), 'scenarios', errors)

  for (const moduleItem of contentImport.modules) {
    moduleIds.add(moduleItem.id)
  }

  for (const item of contentImport.knowledgeChecks) {
    if (!moduleIds.has(item.moduleId)) {
      errors.push({
        code: 'missing_module',
        message: `Knowledge check ${item.id} references missing module ${item.moduleId}.`,
        path: ['knowledgeChecks', item.id, 'moduleId'],
      })
    }

    const answerMissing = item.correctAnswer.trim().length === 0
    if (!answerMissing && !item.choices.includes(item.correctAnswer)) {
      errors.push({
        code: 'answer_not_in_choices',
        message: `Knowledge check ${item.id} correctAnswer must match one of its choices.`,
        path: ['knowledgeChecks', item.id, 'correctAnswer'],
      })
    }

    if (item.needsHumanValidation || answerMissing) {
      validationFlags.push({
        code: 'needs_human_validation',
        entityType: 'knowledge_check',
        entityId: item.id,
        message: `Knowledge check ${item.id} needs a verified answer key before API insertion.`,
        sourceRefs: item.sourceRefs,
      })
    }
  }

  for (const scenario of contentImport.scenarios) {
    if (!moduleIds.has(scenario.moduleId)) {
      errors.push({
        code: 'missing_module',
        message: `Scenario ${scenario.id} references missing module ${scenario.moduleId}.`,
        path: ['scenarios', scenario.id, 'moduleId'],
      })
    }
  }

  if (errors.length > 0) {
    return { ok: false, errors }
  }

  const contentVersion = options.defaultContentVersion ?? new Date().toISOString()
  const knowledgeCheckItems = contentImport.knowledgeChecks.map((item) => normalizeKnowledgeCheck(item, contentVersion))
  const scenarios = contentImport.scenarios.map((scenario) => ({
    id: scenario.id,
    moduleId: scenario.moduleId,
    title: scenario.title,
    prompt: scenario.prompt,
    skillFocus: scenario.skillFocus,
    expectedResponseElements: scenario.expectedResponseElements,
    sourceRefs: scenario.sourceRefs,
    contentVersion: scenario.contentVersion ?? contentVersion,
  }))
  const modules = contentImport.modules.map((moduleItem) => ({
    id: moduleItem.id,
    title: moduleItem.title,
    order: moduleItem.order,
    estimatedMinutes: moduleItem.estimatedMinutes,
    content: {
      moduleId: moduleItem.id,
      contentVersion: moduleItem.contentVersion ?? contentVersion,
      summary: moduleItem.summary,
      learningObjectives: moduleItem.learningObjectives,
      keyPoints: moduleItem.keyPoints,
      sourceRefs: moduleItem.sourceRefs,
    },
    scenarioIds: scenarios.filter((scenario) => scenario.moduleId === moduleItem.id).map((scenario) => scenario.id),
    knowledgeCheckItemIds: knowledgeCheckItems.filter((item) => item.moduleId === moduleItem.id).map((item) => item.id),
    requiredForCompletion: moduleItem.requiredForCompletion,
  }))

  return {
    ok: true,
    data: {
      modules,
      knowledgeCheckItems,
      scenarios,
      validationFlags,
      readyForApiInsertion: validationFlags.length === 0,
    },
  }
}

function normalizeKnowledgeCheck(item: ImportedKnowledgeCheck, fallbackContentVersion: string): KnowledgeCheckItem {
  return {
    id: item.id,
    moduleId: item.moduleId,
    prompt: item.prompt,
    choices: item.choices,
    correctAnswer: item.correctAnswer,
    rationale: item.rationale,
    sourceRefs: item.sourceRefs,
    contentVersion: item.contentVersion ?? fallbackContentVersion,
  }
}

function collectDuplicateIds(ids: string[], entityPath: string, errors: ContentImportIssue[]) {
  const seen = new Set<string>()

  for (const id of ids) {
    if (seen.has(id)) {
      errors.push({
        code: 'duplicate_id',
        message: `Duplicate ${entityPath} id ${id}.`,
        path: [entityPath, id],
      })
    }
    seen.add(id)
  }
}

function zodIssueToImportIssue(issue: z.core.$ZodIssue): ContentImportIssue {
  return {
    code: issue.code,
    message: issue.message,
    path: issue.path.filter((pathItem): pathItem is string | number => typeof pathItem !== 'symbol'),
  }
}

type CsvParseResult =
  | { ok: true; rows: Array<Record<string, string>> }
  | { ok: false; errors: ContentImportIssue[] }

function parseCsv(csv: string): CsvParseResult {
  const rows = parseCsvRecords(csv.trim())
  if (rows.length === 0) {
    return { ok: false, errors: [{ code: 'empty_csv', message: 'CSV import is empty.', path: [] }] }
  }

  const [headers, ...records] = rows
  const normalizedHeaders = headers.map((header) => header.trim())

  return {
    ok: true,
    rows: records
      .filter((record) => record.some((value) => value.trim().length > 0))
      .map((record) => Object.fromEntries(normalizedHeaders.map((header, index) => [header, record[index]?.trim() ?? '']))),
  }
}

function parseCsvRecords(csv: string): string[][] {
  const rows: string[][] = []
  let row: string[] = []
  let value = ''
  let inQuotes = false

  for (let index = 0; index < csv.length; index += 1) {
    const char = csv[index]
    const next = csv[index + 1]

    if (char === '"' && inQuotes && next === '"') {
      value += '"'
      index += 1
      continue
    }

    if (char === '"') {
      inQuotes = !inQuotes
      continue
    }

    if (char === ',' && !inQuotes) {
      row.push(value)
      value = ''
      continue
    }

    if ((char === '\n' || char === '\r') && !inQuotes) {
      if (char === '\r' && next === '\n') index += 1
      row.push(value)
      rows.push(row)
      row = []
      value = ''
      continue
    }

    value += char
  }

  row.push(value)
  rows.push(row)

  return rows
}

function csvRowsToImport(rows: Array<Record<string, string>>): unknown {
  return {
    modules: rows.filter((row) => row.type === 'module').map(csvRowToModule),
    knowledgeChecks: rows.filter((row) => row.type === 'knowledge_check').map(csvRowToKnowledgeCheck),
    scenarios: rows.filter((row) => row.type === 'scenario').map(csvRowToScenario),
  }
}

function csvRowToModule(row: Record<string, string>) {
  return {
    id: row.id,
    title: row.title,
    order: row.order,
    estimatedMinutes: row.estimated_minutes,
    summary: row.summary,
    learningObjectives: splitList(row.learning_objectives),
    keyPoints: splitList(row.key_points),
    requiredForCompletion: row.required_for_completion ? row.required_for_completion === 'true' : undefined,
    contentVersion: row.content_version || undefined,
    sourceRefs: csvSourceRefs(row),
  }
}

function csvRowToKnowledgeCheck(row: Record<string, string>) {
  return {
    id: row.id,
    moduleId: row.module_id,
    prompt: row.prompt,
    choices: splitList(row.choices),
    correctAnswer: row.correct_answer,
    rationale: row.rationale,
    needsHumanValidation: row.needs_human_validation === 'true',
    contentVersion: row.content_version || undefined,
    sourceRefs: csvSourceRefs(row),
  }
}

function csvRowToScenario(row: Record<string, string>) {
  return {
    id: row.id,
    moduleId: row.module_id,
    title: row.title,
    prompt: row.prompt,
    skillFocus: row.skill_focus,
    expectedResponseElements: splitList(row.expected_response_elements),
    contentVersion: row.content_version || undefined,
    sourceRefs: csvSourceRefs(row),
  }
}

function csvSourceRefs(row: Record<string, string>): SourceRef[] {
  return [{ artifact: row.source_artifact, locator: row.source_locator }]
}

function splitList(value: string | undefined): string[] {
  return (value ?? '')
    .split('|')
    .map((item) => item.trim())
    .filter(Boolean)
}
