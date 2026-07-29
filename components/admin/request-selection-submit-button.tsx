'use client';

import { ActionIcon } from '@/components/ui/action-icons';
import { useReactiveActionPending } from '@/components/workflow/reactive-action-form';

export function RequestSelectionSubmitButton({ disabled }: { disabled: boolean }) {
  const pending = useReactiveActionPending();

  return (
    <button
      disabled={disabled || pending}
      className="inline-flex min-h-11 w-full items-center justify-center gap-2 whitespace-normal rounded-md bg-accent px-4 py-3 text-center text-sm font-bold leading-5 text-foreground transition hover:bg-accent-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent disabled:cursor-not-allowed disabled:opacity-50 sm:w-auto"
    >
      <ActionIcon name="send" />
      {pending ? 'Відправляємо…' : 'Відправити на погодження'}
    </button>
  );
}
