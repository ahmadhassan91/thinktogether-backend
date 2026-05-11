import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { BrandHeader } from './BrandHeader'

describe('BrandHeader', () => {
  it('labels the Think Together training MVP brand and active learner mode', () => {
    render(<BrandHeader mode="learner" onModeChange={() => undefined} />)

    expect(
      screen.getByRole('banner', { name: /think together training mvp/i }),
    ).toBeInTheDocument()
    expect(
      screen.getByRole('heading', { name: /think together training mvp/i }),
    ).toBeInTheDocument()
    expect(screen.getByRole('img', { name: /think together logo/i })).toBeInTheDocument()
    expect(screen.getByRole('radio', { name: /learner mode/i })).toBeChecked()
    expect(screen.getByRole('radio', { name: /admin mode/i })).not.toBeChecked()
  })

  it('calls the mode switch action when admin mode is selected', async () => {
    const onModeChange = vi.fn()

    render(<BrandHeader mode="learner" onModeChange={onModeChange} />)
    fireEvent.click(screen.getByRole('radio', { name: /admin mode/i }))

    expect(onModeChange).toHaveBeenCalledWith('admin')
  })
})
