import { Loader2, Trash2, TriangleAlert } from "lucide-react";

export function DeleteInterviewRecordModal({
  open,
  busy,
  error,
  targetLabel,
  onClose,
  onConfirm,
}: {
  open: boolean;
  busy: boolean;
  error?: string;
  targetLabel?: string;
  onClose: () => void;
  onConfirm: () => void;
}) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-[120]">
      <div className="absolute inset-0 bg-slate-950/60 backdrop-blur-sm" onClick={busy ? undefined : onClose} />
      <div className="absolute inset-x-0 top-24 mx-auto w-[min(480px,calc(100%-2rem))]">
        <div className="overflow-hidden rounded-3xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-2xl">
          <div className="p-6">
            <div className="flex items-start gap-4">
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border border-rose-200 dark:border-rose-800 bg-rose-50 dark:bg-rose-950/40 text-rose-600 dark:text-rose-300">
                <TriangleAlert className="h-5 w-5" />
              </div>
              <div className="min-w-0">
                <h2 className="text-lg font-extrabold text-slate-900 dark:text-white">Delete Interview Record</h2>
                <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">
                  Are you sure you want to permanently delete this interview/report?
                </p>
                {targetLabel ? (
                  <p className="mt-2 truncate text-xs font-bold text-slate-500 dark:text-slate-400">{targetLabel}</p>
                ) : null}
                <p className="mt-3 text-xs font-semibold text-rose-600 dark:text-rose-300">This action cannot be undone.</p>
                {error ? <p className="mt-3 text-xs font-semibold text-rose-600 dark:text-rose-300">{error}</p> : null}
              </div>
            </div>
            <div className="mt-6 flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={onClose}
                disabled={busy}
                className="h-10 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-4 text-sm font-semibold text-slate-700 dark:text-slate-200 transition hover:bg-slate-50 dark:hover:bg-slate-800 disabled:opacity-60"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={onConfirm}
                disabled={busy}
                className="inline-flex h-10 items-center gap-2 rounded-xl bg-rose-600 px-4 text-sm font-semibold text-white shadow-sm transition hover:bg-rose-700 disabled:opacity-60"
              >
                {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
                Delete
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
