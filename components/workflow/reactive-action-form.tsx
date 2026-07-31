'use client';

import { createContext, useContext, useRef, useTransition } from 'react';
import { useRouter } from 'next/navigation';

import { useToast } from '@/components/ui/toast-provider';
import type { WorkflowActionResult } from '@/lib/actions/workflow-result';

const PendingContext = createContext(false);

export function ReactiveActionForm({
  action,
  children,
  className,
  resetOnSuccess = false
}: {
  action: (formData: FormData) => Promise<WorkflowActionResult>;
  children: React.ReactNode;
  className?: string;
  resetOnSuccess?: boolean;
}) {
  const router = useRouter();
  const { showToast } = useToast();
  const [pending, startTransition] = useTransition();
  const formRef = useRef<HTMLFormElement>(null);

  return (
    <PendingContext.Provider value={pending}>
      <form
        ref={formRef}
        className={className}
        action={(formData) => {
          if (pending) return;
          startTransition(async () => {
            try {
              const result = await action(formData);
              showToast(result.feedback);
              if (result.ok && resetOnSuccess) formRef.current?.reset();
              if (result.refresh !== false) router.refresh();
            } catch {
              showToast({ code: 'network-error', tone: 'error', message: 'Не вдалося виконати дію. Перевірте з’єднання та повторіть спробу.' });
            }
          });
        }}
      >
        {children}
      </form>
    </PendingContext.Provider>
  );
}

export function ReactiveSubmitButton({
  children,
  pendingLabel,
  disabled,
  className
}: {
  children: React.ReactNode;
  pendingLabel: string;
  disabled?: boolean;
  className?: string;
}) {
  const pending = useContext(PendingContext);
  return (
    <button type="submit" disabled={disabled || pending} className={className}>
      {pending ? pendingLabel : children}
    </button>
  );
}

export function useReactiveActionPending() {
  return useContext(PendingContext);
}
