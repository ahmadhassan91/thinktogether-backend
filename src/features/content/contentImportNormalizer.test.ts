import { describe, expect, it } from 'vitest'
import {
  normalizeTrainingContentCsv,
  normalizeTrainingContentJson,
  trainingContentImportSchema,
} from './contentImportNormalizer'

describe('content import normalizer', () => {
  it('normalizes JSON content into API-ready modules, checks, and scenarios', () => {
    const result = normalizeTrainingContentJson({
      modules: [
        {
          id: 'pbis-overview',
          title: 'PBIS Overview',
          order: 1,
          estimatedMinutes: 6,
          summary: 'PBIS is a proactive framework for teaching expected behavior.',
          learningObjectives: ['Explain PBIS prevention first'],
          keyPoints: ['Teach expectations before correction'],
          sourceRefs: [{ artifact: 'PBIS deck', locator: 'Slide 3' }],
        },
      ],
      knowledgeChecks: [
        {
          id: 'kc-pbis-purpose',
          moduleId: 'pbis-overview',
          prompt: 'What is the main purpose of PBIS?',
          choices: ['Proactive teaching', 'Punishment only', 'Skip routines'],
          correctAnswer: 'Proactive teaching',
          rationale: 'PBIS starts with prevention and positive reinforcement.',
          sourceRefs: [{ artifact: 'PBIS deck', locator: 'Slide 4' }],
        },
      ],
      scenarios: [
        {
          id: 'line-redirection',
          moduleId: 'pbis-overview',
          title: 'Line Redirection',
          prompt: 'Students begin pushing while lining up.',
          skillFocus: 'calm redirection',
          expectedResponseElements: ['Move closer', 'Restate the expectation'],
          sourceRefs: [{ artifact: 'Scenario deck', locator: 'Slide 9' }],
        },
      ],
    }, { defaultContentVersion: 'pbis-import-v1' })

    expect(result.ok).toBe(true)
    if (!result.ok) throw new Error('expected successful normalization')

    expect(result.data.readyForApiInsertion).toBe(true)
    expect(result.data.modules[0]).toMatchObject({
      id: 'pbis-overview',
      requiredForCompletion: true,
      knowledgeCheckItemIds: ['kc-pbis-purpose'],
      scenarioIds: ['line-redirection'],
      content: {
        moduleId: 'pbis-overview',
        contentVersion: 'pbis-import-v1',
      },
    })
    expect(result.data.knowledgeCheckItems[0].contentVersion).toBe('pbis-import-v1')
    expect(result.data.scenarios[0].contentVersion).toBe('pbis-import-v1')
    expect(result.data.validationFlags).toEqual([])
  })

  it('parses typed CSV rows and trims list fields', () => {
    const csv = [
      'type,id,module_id,title,order,estimated_minutes,summary,learning_objectives,key_points,prompt,choices,correct_answer,rationale,skill_focus,expected_response_elements,source_artifact,source_locator',
      'module,pbis-overview,,PBIS Overview,1,6,PBIS summary,"Objective one|Objective two","Point one|Point two",,,,,,,PBIS deck,Slide 1',
      'knowledge_check,kc-pbis-purpose,pbis-overview,,,,,,,"What is PBIS?","Teaching|Punishment","Teaching",Because it is proactive,,,PBIS deck,Slide 2',
      'scenario,line-redirection,pbis-overview,Line Redirection,,,,,,Students push in line,,,,calm redirection,"Move closer|Restate expectation",Scenario deck,Slide 3',
    ].join('\n')

    const result = normalizeTrainingContentCsv(csv, { defaultContentVersion: 'pbis-csv-v1' })

    expect(result.ok).toBe(true)
    if (!result.ok) throw new Error('expected successful CSV normalization')

    expect(result.data.modules[0].content.learningObjectives).toEqual(['Objective one', 'Objective two'])
    expect(result.data.knowledgeCheckItems[0].choices).toEqual(['Teaching', 'Punishment'])
    expect(result.data.scenarios[0].expectedResponseElements).toEqual(['Move closer', 'Restate expectation'])
    expect(result.data.readyForApiInsertion).toBe(true)
  })

  it('returns blocking errors for duplicate ids and missing module references', () => {
    const result = normalizeTrainingContentJson({
      modules: [
        {
          id: 'pbis-overview',
          title: 'PBIS Overview',
          order: 1,
          estimatedMinutes: 6,
          summary: 'PBIS summary',
          learningObjectives: ['Explain PBIS'],
          keyPoints: ['Teach expectations'],
          sourceRefs: [{ artifact: 'PBIS deck', locator: 'Slide 1' }],
        },
        {
          id: 'pbis-overview',
          title: 'PBIS Duplicate',
          order: 2,
          estimatedMinutes: 6,
          summary: 'Duplicate module',
          learningObjectives: ['Explain PBIS'],
          keyPoints: ['Teach expectations'],
          sourceRefs: [{ artifact: 'PBIS deck', locator: 'Slide 2' }],
        },
      ],
      knowledgeChecks: [
        {
          id: 'kc-orphan',
          moduleId: 'missing-module',
          prompt: 'Missing module?',
          choices: ['Yes', 'No'],
          correctAnswer: 'Yes',
          rationale: 'This should be rejected before insertion.',
          sourceRefs: [{ artifact: 'PBIS deck', locator: 'Slide 3' }],
        },
      ],
      scenarios: [],
    })

    expect(result.ok).toBe(false)
    if (result.ok) throw new Error('expected validation failure')
    expect(result.errors).toEqual(expect.arrayContaining([
      expect.objectContaining({ code: 'duplicate_id', path: ['modules', 'pbis-overview'] }),
      expect.objectContaining({ code: 'missing_module', path: ['knowledgeChecks', 'kc-orphan', 'moduleId'] }),
    ]))
  })

  it('flags ambiguous knowledge checks for human validation before API insertion', () => {
    const result = normalizeTrainingContentJson({
      modules: [
        {
          id: 'pbis-overview',
          title: 'PBIS Overview',
          order: 1,
          estimatedMinutes: 6,
          summary: 'PBIS summary',
          learningObjectives: ['Explain PBIS'],
          keyPoints: ['Teach expectations'],
          sourceRefs: [{ artifact: 'PBIS deck', locator: 'Slide 1' }],
        },
      ],
      knowledgeChecks: [
        {
          id: 'kc-ambiguous',
          moduleId: 'pbis-overview',
          prompt: 'Which answer is explicit in the source?',
          choices: ['A', 'B', 'C'],
          correctAnswer: '',
          rationale: 'The source did not include an answer key.',
          needsHumanValidation: true,
          sourceRefs: [{ artifact: 'Knowledge check PDF', locator: 'Page 2' }],
        },
      ],
      scenarios: [],
    })

    expect(result.ok).toBe(true)
    if (!result.ok) throw new Error('expected normalization with validation flag')
    expect(result.data.readyForApiInsertion).toBe(false)
    expect(result.data.validationFlags).toEqual([
      expect.objectContaining({
        code: 'needs_human_validation',
        entityType: 'knowledge_check',
        entityId: 'kc-ambiguous',
      }),
    ])
    expect(() => trainingContentImportSchema.parse({
      modules: [],
      knowledgeChecks: [],
      scenarios: [],
    })).not.toThrow()
  })
})
