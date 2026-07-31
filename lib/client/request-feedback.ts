import type { WorkflowFeedback } from '@/lib/actions/workflow-result';

const selectionFeedback = {
  'selection-submit-approved': { tone: 'success', message: 'Усі позиції погоджено. Заявка очікує рахунок.' },
  'selection-submit-partial': { tone: 'success', message: 'Погодження надіслано. Рахунок буде сформовано лише за погодженими позиціями.' },
  'selection-submit-rejected': { tone: 'warning', message: 'Жодної позиції не погоджено. Заявку скасовано.' },
  'selection-submit-noop': { tone: 'warning', message: 'Це погодження вже було надіслано.' },
  'selection-submit-stale': { tone: 'warning', message: 'Менеджер оновив підбір або погодження вже завершене. Дані сторінки оновлено.' },
  'selection-submit-conflict': { tone: 'warning', message: 'Для цієї версії вже зафіксовано інший результат погодження.' },
  'selection-submit-forbidden': { tone: 'error', message: 'Ця добірка недоступна для вашого кабінету.' },
  'selection-submit-validation': { tone: 'error', message: 'Набір позицій некоректний. Оновіть сторінку та повторіть вибір.' },
  'selection-submit-error': { tone: 'error', message: 'Не вдалося надіслати погодження. Ваш локальний вибір збережено — спробуйте ще раз.' }
} as const satisfies Record<string, Omit<WorkflowFeedback, 'code'>>;

export function getClientSelectionFeedback(code: string): WorkflowFeedback {
  const feedback = selectionFeedback[code as keyof typeof selectionFeedback]
    ?? selectionFeedback['selection-submit-error'];
  return { code, ...feedback };
}
