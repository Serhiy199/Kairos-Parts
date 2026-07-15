'use client';

type PrintButtonProps = {
  label?: string;
};

export function PrintButton({ label = 'Друк / Зберегти PDF' }: PrintButtonProps) {
  return (
    <button
      type="button"
      onClick={() => window.print()}
      className="inline-flex items-center justify-center rounded-md bg-accent px-4 py-2 text-sm font-bold text-foreground transition hover:bg-accent-hover"
    >
      {label}
    </button>
  );
}
