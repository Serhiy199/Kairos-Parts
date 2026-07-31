'use client';

import { createContext, useCallback, useContext, useMemo, useState } from 'react';

import type { WorkflowFeedback } from '@/lib/actions/workflow-result';

type Toast = WorkflowFeedback & { id: number };
const ToastContext = createContext<{ showToast: (feedback: WorkflowFeedback) => void } | null>(null);

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const showToast = useCallback((feedback: WorkflowFeedback) => {
    const id = Date.now() + Math.random();
    setToasts((current) => [...current, { ...feedback, id }]);
    const duration = feedback.tone === 'error' ? 9000 : feedback.tone === 'warning' ? 6000 : 4000;
    window.setTimeout(
      () => setToasts((current) => current.filter((toast) => toast.id !== id)),
      duration
    );
  }, []);
  const value = useMemo(() => ({ showToast }), [showToast]);

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div aria-live="polite" aria-atomic="false" className="pointer-events-none fixed inset-x-3 bottom-3 z-[100] grid gap-2 sm:left-auto sm:right-4 sm:w-[min(420px,calc(100vw-2rem))]">
        {toasts.map((toast) => (
          <div
            key={toast.id}
            role={toast.tone === 'error' ? 'alert' : 'status'}
            className={`pointer-events-auto flex min-w-0 items-start gap-3 rounded-md border p-4 text-sm shadow-lg ${
              toast.tone === 'success'
                ? 'border-success/30 bg-[#E7F6EC] text-success'
                : toast.tone === 'warning'
                  ? 'border-accent/40 bg-[#FFF7E0] text-[#8A5B24]'
                  : 'border-danger/30 bg-red-50 text-danger'
            }`}
          >
            <p className="min-w-0 flex-1 break-words font-semibold">{toast.message}</p>
            <button type="button" aria-label="Закрити повідомлення" onClick={() => setToasts((current) => current.filter((item) => item.id !== toast.id))} className="shrink-0 rounded px-1 font-bold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-current">×</button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const value = useContext(ToastContext);
  if (!value) throw new Error('useToast must be used within ToastProvider.');
  return value;
}
