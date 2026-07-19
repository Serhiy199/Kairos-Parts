'use client';

export default function ClientVehiclesError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <section role="alert" className="rounded-lg border border-danger/30 bg-[#FEF3F2] p-6 shadow-card">
      <h2 className="text-lg font-bold text-danger">Не вдалося завантажити парк техніки</h2>
      <p className="mt-2 text-sm leading-6 text-danger">Спробуйте оновити дані. Якщо помилка повториться, зверніться до менеджера Kairos Parts.</p>
      <button type="button" onClick={reset} className="mt-5 inline-flex min-h-11 items-center justify-center rounded-md border border-danger/40 bg-white px-5 py-3 text-sm font-bold text-danger transition hover:bg-[#FEE4E2] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-danger">
        Спробувати ще раз
      </button>
    </section>
  );
}
