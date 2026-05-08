import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { LearnerFlow } from './LearnerFlow.tsx'
import type { Learner, LearnerModule } from './learnerProgress'

const learner: Learner = {
  id: 'learner-1',
  name: 'Avery Chen',
  email: 'avery@example.org',
  region: 'Central Valley',
  role: 'Program Leader',
  site: 'Demo Elementary',
  cohortDate: '2026-05-08',
}

const modules: LearnerModule[] = [
  {
    id: 'overview',
    title: 'PBIS Overview',
    sequence: 1,
    estimatedMinutes: 4,
    required: true,
    content: ['PBIS is a consistent way to teach, practice, and acknowledge expectations.'],
    action: {
      type: 'quiz',
      prompt: 'What is the purpose of PBIS?',
      choices: ['Consistent support', 'Surprise consequences'],
      correctAnswer: 'Consistent support',
      explanation: 'PBIS keeps expectations positive, visible, and teachable.',
    },
  },
  {
    id: 'phrases',
    title: 'Pre-Corrective Phrases',
    sequence: 2,
    estimatedMinutes: 5,
    required: true,
    content: ['Pre-correct with a brief, observable direction before transitions.'],
    action: {
      type: 'practice',
      prompt: 'Write a clear direction for lining up.',
      expectedResponse: 'Use walking feet and keep hands to yourself.',
    },
  },
]

describe('LearnerFlow', () => {
  it('renders welcome verification and learning path progress', () => {
    render(<LearnerFlow learner={learner} modules={modules} />)

    expect(screen.getByRole('heading', { name: /welcome, avery chen/i })).toBeInTheDocument()
    expect(screen.getByText(/program induction - pbis/i)).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: /verify and start/i }))

    expect(screen.getByText('Progress: 0 of 2 required modules complete')).toBeInTheDocument()
    expect(screen.getByText(/Current/)).toBeInTheDocument()
    expect(screen.getByText(/Locked/)).toBeInTheDocument()
  })

  it('submits a quiz, advances to practice, and shows a completion receipt', async () => {
    render(<LearnerFlow learner={learner} modules={modules} pathTitle="Program Induction - PBIS" />)

    fireEvent.click(screen.getByRole('button', { name: /verify and start/i }))
    fireEvent.click(screen.getByLabelText('Consistent support'))
    fireEvent.click(screen.getByRole('button', { name: /submit answer/i }))

    expect(await screen.findByText(/1 of 2 required modules complete/i)).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: /pre-corrective phrases/i })).toBeInTheDocument()

    fireEvent.change(screen.getByLabelText(/practice response/i), {
      target: { value: 'Use walking feet and keep hands to yourself.' },
    })
    fireEvent.click(screen.getByRole('button', { name: /submit practice/i }))

    expect(await screen.findByRole('heading', { name: /completion receipt/i })).toBeInTheDocument()
    expect(screen.getByText(/Score: 100%/)).toBeInTheDocument()
    expect(screen.getByText(/Confirmation:/)).toBeInTheDocument()
  })

  it('does not persist module completion for an incorrect quiz answer', async () => {
    const onAnswerKnowledgeCheck = vi.fn().mockResolvedValue(undefined)
    const onCompleteModule = vi.fn().mockResolvedValue(undefined)

    render(
      <LearnerFlow
        learner={learner}
        modules={modules}
        onAnswerKnowledgeCheck={onAnswerKnowledgeCheck}
        onCompleteModule={onCompleteModule}
      />,
    )

    fireEvent.click(screen.getByRole('button', { name: /verify and start/i }))
    fireEvent.click(screen.getByLabelText('Surprise consequences'))
    fireEvent.click(screen.getByRole('button', { name: /submit answer/i }))

    expect(await screen.findByText(/needs review/i)).toBeInTheDocument()
    expect(onAnswerKnowledgeCheck).toHaveBeenCalledWith('overview', 'Surprise consequences')
    expect(onCompleteModule).not.toHaveBeenCalled()
  })
})
