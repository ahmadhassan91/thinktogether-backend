import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { StatusChip, type StatusChipStatus } from './StatusChip'

describe('StatusChip', () => {
  it.each<[StatusChipStatus, string]>([
    ['complete', 'Status: Complete'],
    ['current', 'Status: Current'],
    ['locked', 'Status: Locked'],
    ['blocked', 'Status: Blocked'],
    ['clearance-ready', 'Status: Clearance ready'],
    ['makeup', 'Status: Makeup required'],
    ['exported', 'Status: Exported'],
    ['verified', 'Status: Verified'],
  ])('renders accessible text for %s status', (status, accessibleName) => {
    render(<StatusChip status={status} />)

    expect(screen.getByRole('status', { name: accessibleName })).toBeInTheDocument()
  })
})
