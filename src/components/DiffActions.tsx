import { AIEdit } from '../types'

interface DiffActionsProps {
  pendingEdits: AIEdit[]
  currentEdit: AIEdit | undefined
  onAcceptEdit: (edit: AIEdit) => void
  onRejectEdit: (edit: AIEdit) => void
  onAcceptAll: () => void
}

export function DiffActions({
  pendingEdits,
  currentEdit,
  onAcceptEdit,
  onRejectEdit,
  onAcceptAll,
}: DiffActionsProps) {
  const activeEdit = currentEdit ?? pendingEdits[0]
  const editCount = pendingEdits.length

  return (
    <div className="diff-actions">
      <span className="diff-actions-label">
        🔀 {editCount} proposed edit{editCount > 1 ? 's' : ''}
      </span>
      <div style={{ display: 'flex', gap: '8px' }}>
        <button className="btn-accept" onClick={() => onAcceptEdit(activeEdit)}>
          ✓ Accept
        </button>
        <button className="btn-reject" onClick={() => onRejectEdit(activeEdit)}>
          ✗ Reject
        </button>
        <button
          className="btn-primary"
          style={{ padding: '4px 8px', fontSize: '11px' }}
          onClick={onAcceptAll}
        >
          Accept All
        </button>
      </div>
    </div>
  )
}