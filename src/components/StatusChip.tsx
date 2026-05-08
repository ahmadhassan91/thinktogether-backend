import '../styles/design-system.css'

export type StatusChipStatus =
  | 'complete'
  | 'current'
  | 'locked'
  | 'blocked'
  | 'clearance-ready'
  | 'makeup'
  | 'exported'
  | 'verified'

const statusLabels: Record<StatusChipStatus, string> = {
  complete: 'Complete',
  current: 'Current',
  locked: 'Locked',
  blocked: 'Blocked',
  'clearance-ready': 'Clearance ready',
  makeup: 'Makeup required',
  exported: 'Exported',
  verified: 'Verified',
}

export type StatusChipProps = {
  status: StatusChipStatus
  label?: string
}

export function StatusChip({ status, label = statusLabels[status] }: StatusChipProps) {
  return (
    <span
      aria-label={`Status: ${label}`}
      className="tt-status-chip"
      data-status={status}
      role="status"
    >
      {label}
    </span>
  )
}
