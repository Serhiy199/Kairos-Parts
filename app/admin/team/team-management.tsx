'use client';

import { useActionState, useEffect, useMemo, useRef, useState, useTransition } from 'react';
import { useFormStatus } from 'react-dom';
import { TbCopy, TbLinkPlus, TbLockOff, TbLockOpen, TbUserPlus, TbUsersGroup, TbX } from 'react-icons/tb';

import type { AdminTeamMember, TeamInvitationState } from '@/lib/users/admin-team-queries';
import { TEAM_ROLE_LABELS, TEAM_STATUS_LABELS } from '@/lib/users/admin-team-rules';
import {
  INITIAL_TEAM_ACTION_RESULT,
  type TeamActionResult
} from './action-state';
import {
  createManagerAction,
  disableManagerAction,
  enableManagerAction,
  regenerateManagerInvitationAction
} from './actions';

type ConfirmAction = 'regenerate' | 'disable' | 'enable';

type InvitationResult = NonNullable<TeamActionResult['invitation']>;

const DIALOG_FOCUSABLE = [
  'button:not([disabled])',
  'input:not([disabled])',
  'a[href]',
  '[tabindex]:not([tabindex="-1"])'
].join(',');

const STATUS_TONES = {
  INVITED: 'border-amber-200 bg-amber-50 text-amber-800',
  ACTIVE: 'border-green-200 bg-green-50 text-green-700',
  DISABLED: 'border-border bg-surface-muted text-muted'
} as const;

const INVITATION_LABELS: Record<TeamInvitationState, string> = {
  active: 'Посилання активне',
  expired: 'Строк дії завершився',
  revoked: 'Посилання відкликано',
  used: 'Посилання використано',
  missing: 'Запрошення відсутнє'
};

function useDialogFocus(
  dialogRef: React.RefObject<HTMLElement | null>,
  onClose: () => void,
  closeBlocked = false
) {
  useEffect(() => {
    const previouslyFocused = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const dialog = dialogRef.current;
    dialog?.querySelector<HTMLElement>(DIALOG_FOCUSABLE)?.focus();

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape' && !closeBlocked) {
        event.preventDefault();
        onClose();
        return;
      }

      if (event.key !== 'Tab' || !dialog) return;

      const focusable = Array.from(dialog.querySelectorAll<HTMLElement>(DIALOG_FOCUSABLE));
      const first = focusable[0];
      const last = focusable.at(-1);
      if (!first || !last) return;

      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    }

    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('keydown', onKeyDown);
      previouslyFocused?.focus();
    };
  }, [closeBlocked, dialogRef, onClose]);
}

function SubmitButton() {
  const { pending } = useFormStatus();

  return (
    <button
      type="submit"
      disabled={pending}
      className="inline-flex min-h-11 items-center justify-center gap-2 rounded-md bg-accent px-5 py-2.5 text-sm font-bold text-foreground transition hover:bg-accent-hover disabled:cursor-not-allowed disabled:opacity-60"
    >
      <TbUserPlus aria-hidden="true" className="size-5" />
      {pending ? 'Створення…' : 'Створити менеджера'}
    </button>
  );
}

function StatusBadge({ member }: { member: AdminTeamMember }) {
  return (
    <span className={`inline-flex rounded-full border px-3 py-1 text-xs font-bold ${STATUS_TONES[member.status]}`}>
      {TEAM_STATUS_LABELS[member.status]}
    </span>
  );
}

function InvitationSummary({ member }: { member: AdminTeamMember }) {
  if (member.role !== 'MANAGER' || member.status !== 'INVITED' || !member.invitation) {
    return <span className="text-muted">—</span>;
  }

  return (
    <div className="text-sm">
      <p className="font-semibold text-foreground">{INVITATION_LABELS[member.invitation.state]}</p>
      {member.invitation.expiresAt ? (
        <p className="mt-1 text-xs text-muted">
          До {new Date(member.invitation.expiresAt).toLocaleString('uk-UA')}
        </p>
      ) : null}
    </div>
  );
}

function ManagerActionButton({ member, onConfirm }: {
  member: AdminTeamMember;
  onConfirm: (action: ConfirmAction, member: AdminTeamMember) => void;
}) {
  if (member.role === 'ADMIN') {
    return <span className="text-xs font-semibold text-muted">Лише перегляд</span>;
  }

  if (member.status === 'INVITED') {
    return (
      <button type="button" onClick={() => onConfirm('regenerate', member)} className="inline-flex min-h-10 items-center justify-center gap-2 rounded-md border border-border px-3 py-2 text-xs font-bold transition hover:border-accent hover:text-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent">
        <TbLinkPlus aria-hidden="true" className="size-4" />
        Створити нове посилання
      </button>
    );
  }

  if (member.status === 'ACTIVE') {
    return (
      <button type="button" onClick={() => onConfirm('disable', member)} className="inline-flex min-h-10 items-center justify-center gap-2 rounded-md border border-red-200 px-3 py-2 text-xs font-bold text-red-700 transition hover:bg-red-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-500">
        <TbLockOff aria-hidden="true" className="size-4" />
        Вимкнути доступ
      </button>
    );
  }

  if (!member.hasPassword) {
    return <p className="max-w-56 text-xs leading-5 text-red-700">Немає встановленого пароля. Пряма активація недоступна.</p>;
  }

  return (
    <button type="button" onClick={() => onConfirm('enable', member)} className="inline-flex min-h-10 items-center justify-center gap-2 rounded-md border border-green-200 px-3 py-2 text-xs font-bold text-green-700 transition hover:bg-green-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-green-500">
      <TbLockOpen aria-hidden="true" className="size-4" />
      Увімкнути доступ
    </button>
  );
}

function InvitationDialog({ invitation, onClose }: { invitation: InvitationResult; onClose: () => void }) {
  const dialogRef = useRef<HTMLElement>(null);
  const [copyMessage, setCopyMessage] = useState('');
  useDialogFocus(dialogRef, onClose);

  async function copyInvitation() {
    try {
      await navigator.clipboard.writeText(invitation.url);
      setCopyMessage('Посилання скопійовано.');
    } catch {
      setCopyMessage('Не вдалося скопіювати автоматично. Виділіть посилання вручну.');
    }
  }

  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center bg-black/60 p-4" role="presentation">
      <section ref={dialogRef} role="dialog" aria-modal="true" aria-labelledby="invitation-title" className="w-full max-w-2xl rounded-lg border border-border bg-card p-5 shadow-xl sm:p-6">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-sm font-bold uppercase text-accent">Одноразове посилання</p>
            <h2 id="invitation-title" className="mt-2 text-2xl font-bold text-foreground">Менеджера запрошено</h2>
          </div>
          <button type="button" onClick={onClose} aria-label="Закрити" className="inline-flex size-10 shrink-0 items-center justify-center rounded-md border border-border transition hover:border-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent">
            <TbX aria-hidden="true" className="size-5" />
          </button>
        </div>
        <p className="mt-4 text-sm leading-6 text-muted">
          Передайте посилання менеджеру {invitation.managerName}. Воно діє до {new Date(invitation.expiresAt).toLocaleString('uk-UA')} і після використання стане недійсним.
        </p>
        <label htmlFor="manager-invitation-url" className="mt-5 block text-sm font-bold text-foreground">Посилання для встановлення пароля</label>
        <div className="mt-2 flex flex-col gap-2 sm:flex-row">
          <input id="manager-invitation-url" readOnly value={invitation.url} onFocus={(event) => event.currentTarget.select()} className="min-h-11 min-w-0 flex-1 rounded-md border border-border bg-surface-muted px-3 text-sm text-foreground" />
          <button type="button" onClick={copyInvitation} className="inline-flex min-h-11 items-center justify-center gap-2 rounded-md bg-accent px-4 py-2 text-sm font-bold text-foreground transition hover:bg-accent-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent">
            <TbCopy aria-hidden="true" className="size-5" />
            Скопіювати посилання
          </button>
        </div>
        <p aria-live="polite" className="mt-2 min-h-5 text-sm font-semibold text-muted">{copyMessage}</p>
        <p className="mt-3 text-xs leading-5 text-muted">Після закриття або оновлення сторінки це посилання не можна відновити. Якщо воно втрачено, створіть нове.</p>
      </section>
    </div>
  );
}

function ConfirmationDialog({ action, member, pending, onCancel, onConfirm }: {
  action: ConfirmAction;
  member: AdminTeamMember;
  pending: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  const dialogRef = useRef<HTMLElement>(null);
  const content = {
    regenerate: {
      title: 'Створити нове посилання?',
      description: 'Старі невикористані посилання перестануть працювати.',
      button: 'Створити посилання'
    },
    disable: {
      title: 'Вимкнути доступ менеджеру?',
      description: 'Менеджер втратить доступ до CRM, а його поточні сесії буде анульовано.',
      button: 'Вимкнути доступ'
    },
    enable: {
      title: 'Увімкнути доступ менеджеру?',
      description: 'Менеджер зможе повторно увійти до CRM з поточним паролем.',
      button: 'Увімкнути доступ'
    }
  }[action];

  useDialogFocus(dialogRef, onCancel, pending);

  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center bg-black/60 p-4">
      <section ref={dialogRef} role="alertdialog" aria-modal="true" aria-labelledby="confirm-title" aria-describedby="confirm-description" className="w-full max-w-md rounded-lg border border-border bg-card p-5 shadow-xl">
        <h2 id="confirm-title" className="text-xl font-bold text-foreground">{content.title}</h2>
        <p id="confirm-description" className="mt-3 text-sm leading-6 text-muted">{content.description}</p>
        <p className="mt-2 break-words text-sm font-semibold text-foreground">{member.name || member.email || 'Менеджер'}</p>
        <div className="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <button type="button" disabled={pending} onClick={onCancel} className="min-h-11 rounded-md border border-border px-4 text-sm font-bold transition hover:border-accent disabled:opacity-60">Скасувати</button>
          <button type="button" disabled={pending} onClick={onConfirm} className="min-h-11 rounded-md bg-accent px-4 text-sm font-bold text-foreground transition hover:bg-accent-hover disabled:opacity-60">
            {pending ? 'Виконання…' : content.button}
          </button>
        </div>
      </section>
    </div>
  );
}

export function TeamManagement({ members }: { members: AdminTeamMember[] }) {
  const [createState, createFormAction] = useActionState(createManagerAction, INITIAL_TEAM_ACTION_RESULT);
  const [invitationResult, setInvitationResult] = useState<InvitationResult | null>(null);
  const [confirmation, setConfirmation] = useState<{ action: ConfirmAction; member: AdminTeamMember } | null>(null);
  const [actionMessage, setActionMessage] = useState<TeamActionResult | null>(null);
  const [pending, startTransition] = useTransition();
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (createState.invitation) {
      setInvitationResult(createState.invitation);
      formRef.current?.reset();
    }
  }, [createState.invitation]);

  const summary = useMemo(() => ({
    admins: members.filter((member) => member.role === 'ADMIN').length,
    activeManagers: members.filter((member) => member.role === 'MANAGER' && member.status === 'ACTIVE').length,
    invitedManagers: members.filter((member) => member.role === 'MANAGER' && member.status === 'INVITED').length,
    disabledManagers: members.filter((member) => member.role === 'MANAGER' && member.status === 'DISABLED').length
  }), [members]);

  function executeConfirmedAction() {
    if (!confirmation) return;

    startTransition(async () => {
      const result = confirmation.action === 'regenerate'
        ? await regenerateManagerInvitationAction(confirmation.member.id)
        : confirmation.action === 'disable'
          ? await disableManagerAction(confirmation.member.id)
          : await enableManagerAction(confirmation.member.id);

      setConfirmation(null);
      setActionMessage(result);
      if (result.invitation) setInvitationResult(result.invitation);
    });
  }

  return (
    <div className="cabinet-stack">
      <section className="cabinet-card">
        <div className="flex items-start gap-4">
          <div className="flex size-12 shrink-0 items-center justify-center rounded-md bg-accent/10 text-accent"><TbUsersGroup aria-hidden="true" className="size-7" /></div>
          <div>
            <p className="text-sm font-bold uppercase text-accent">Команда</p>
            <h2 className="mt-2 text-2xl font-bold text-foreground">Керування доступом CRM</h2>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-muted">Переглядайте адміністраторів, запрошуйте менеджерів і керуйте доступом активних облікових записів.</p>
          </div>
        </div>
      </section>

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {[
          ['Адміністратори', summary.admins],
          ['Активні менеджери', summary.activeManagers],
          ['Очікують активації', summary.invitedManagers],
          ['Вимкнені', summary.disabledManagers]
        ].map(([label, value]) => (
          <div key={label} className="rounded-lg border border-border bg-card p-5 shadow-card"><p className="text-sm font-semibold text-muted">{label}</p><p className="mt-3 text-3xl font-bold text-foreground">{value}</p></div>
        ))}
      </section>

      <section className="cabinet-card">
        <h2 className="text-xl font-bold text-foreground">Додати менеджера</h2>
        <p className="mt-2 text-sm leading-6 text-muted">Створіть обліковий запис і передайте менеджеру одноразове посилання для встановлення пароля.</p>
        <form ref={formRef} action={createFormAction} className="mt-5 grid gap-4 lg:grid-cols-[1fr_1fr_auto] lg:items-end">
          <div><label htmlFor="manager-name" className="text-sm font-bold text-foreground">Ім’я</label><input id="manager-name" name="name" required minLength={2} maxLength={120} autoComplete="name" className="mt-2 min-h-11 w-full rounded-md border border-border bg-card px-3 text-sm text-foreground" /></div>
          <div><label htmlFor="manager-email" className="text-sm font-bold text-foreground">Email</label><input id="manager-email" name="email" type="email" required autoComplete="email" className="mt-2 min-h-11 w-full rounded-md border border-border bg-card px-3 text-sm text-foreground" /></div>
          <SubmitButton />
        </form>
        {createState.status === 'error' ? <p role="alert" className="mt-4 rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm font-semibold text-red-700">{createState.message}</p> : null}
      </section>

      {actionMessage ? <p role={actionMessage.status === 'error' ? 'alert' : 'status'} className={`rounded-md border px-4 py-3 text-sm font-semibold ${actionMessage.status === 'error' ? 'border-red-200 bg-red-50 text-red-700' : 'border-green-200 bg-green-50 text-green-700'}`}>{actionMessage.message}</p> : null}

      <section className="overflow-hidden rounded-lg border border-border bg-card shadow-card">
        <div className="border-b border-border px-5 py-4"><h2 className="text-xl font-bold text-foreground">Учасники команди</h2></div>

        <div className="hidden overflow-x-auto xl:block">
          <table className="w-full min-w-[1050px] border-collapse text-left text-sm">
            <thead><tr className="border-b border-border bg-surface-muted text-muted"><th className="px-4 py-3">Ім’я</th><th className="px-4 py-3">Email</th><th className="px-4 py-3">Роль</th><th className="px-4 py-3">Статус</th><th className="px-4 py-3">Створено</th><th className="px-4 py-3">Запрошення</th><th className="px-4 py-3">Дії</th></tr></thead>
            <tbody>{members.map((member) => <tr key={member.id} className="border-b border-border align-top last:border-0"><td className="px-4 py-4 font-bold text-foreground">{member.name || 'Без імені'}</td><td className="max-w-64 break-all px-4 py-4 text-muted">{member.email || '—'}</td><td className="px-4 py-4 font-semibold text-foreground">{TEAM_ROLE_LABELS[member.role]}</td><td className="px-4 py-4"><StatusBadge member={member} /></td><td className="whitespace-nowrap px-4 py-4 text-muted">{new Date(member.createdAt).toLocaleDateString('uk-UA')}</td><td className="px-4 py-4"><InvitationSummary member={member} /></td><td className="px-4 py-4"><ManagerActionButton member={member} onConfirm={(action, target) => setConfirmation({ action, member: target })} /></td></tr>)}</tbody>
          </table>
        </div>

        <div className="grid gap-3 p-4 xl:hidden">
          {members.map((member) => (
            <article key={member.id} className="rounded-lg border border-border p-4">
              <div className="flex flex-wrap items-start justify-between gap-3"><div className="min-w-0"><h3 className="break-words font-bold text-foreground">{member.name || 'Без імені'}</h3><p className="mt-1 break-all text-sm text-muted">{member.email || '—'}</p></div><StatusBadge member={member} /></div>
              <dl className="mt-4 grid gap-3 text-sm sm:grid-cols-2"><div><dt className="font-semibold text-muted">Роль</dt><dd className="mt-1 font-semibold text-foreground">{TEAM_ROLE_LABELS[member.role]}</dd></div><div><dt className="font-semibold text-muted">Створено</dt><dd className="mt-1 text-foreground">{new Date(member.createdAt).toLocaleDateString('uk-UA')}</dd></div><div className="sm:col-span-2"><dt className="font-semibold text-muted">Запрошення</dt><dd className="mt-1"><InvitationSummary member={member} /></dd></div></dl>
              <div className="mt-4 border-t border-border pt-4"><ManagerActionButton member={member} onConfirm={(action, target) => setConfirmation({ action, member: target })} /></div>
            </article>
          ))}
        </div>
      </section>

      {invitationResult ? <InvitationDialog invitation={invitationResult} onClose={() => setInvitationResult(null)} /> : null}
      {confirmation ? <ConfirmationDialog action={confirmation.action} member={confirmation.member} pending={pending} onCancel={() => setConfirmation(null)} onConfirm={executeConfirmedAction} /> : null}
    </div>
  );
}
