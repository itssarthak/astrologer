// Generic confirmation modal. Defaults to a destructive (red) confirm action.
export default function ConfirmDialog({
  title,
  message,
  confirmLabel = 'Delete',
  cancelLabel = 'Cancel',
  danger = true,
  onConfirm,
  onCancel,
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={onCancel}>
      <div className="w-full max-w-sm bg-surface rounded-2xl border border-border shadow-xl p-6 flex flex-col gap-4"
        onClick={e => e.stopPropagation()}>
        <h2 className="text-lg font-bold text-text">{title}</h2>
        <p className="text-sm text-muted leading-relaxed">{message}</p>
        <div className="flex gap-2 justify-end">
          <button onClick={onCancel}
            className="px-4 py-2 rounded-lg border border-border text-sm text-muted hover:text-text transition-colors">
            {cancelLabel}
          </button>
          <button onClick={onConfirm}
            className={`px-4 py-2 rounded-lg text-sm font-semibold text-white transition-colors ${
              danger ? 'bg-red-500 hover:bg-red-600' : 'bg-primary hover:bg-primary-hover'
            }`}>
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  )
}
