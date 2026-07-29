import type { WorkflowFeedback } from '@/lib/actions/workflow-result';

const selectionFeedback = {
  'selection-item-approved': { tone: 'success', message: 'Позицію погоджено. Очікується рішення щодо інших позицій.' },
  'selection-fully-approved': { tone: 'success', message: 'Усі позиції погоджено. Заявка очікує рахунок.' },
  'selection-item-rejected-pending': { tone: 'warning', message: 'Позицію відхилено. Очікується рішення щодо інших позицій.' },
  'selection-partially-approved': { tone: 'warning', message: 'Погодження завершено частково. Рахунок можна сформувати лише за погодженими позиціями.' },
  'selection-fully-rejected': { tone: 'warning', message: 'Усі позиції відхилено. Менеджер підготує оновлену версію підбору.' },
  'selection-decision-noop': { tone: 'warning', message: 'Це рішення вже збережено.' },
  'selection-decision-stale': { tone: 'warning', message: 'Ця версія підбору вже неактуальна. Дані сторінки оновлено.' },
  'selection-decision-conflict': { tone: 'warning', message: 'Рішення для цієї позиції вже зафіксовано й не може бути змінене.' },
  'selection-decision-forbidden': { tone: 'error', message: 'Ця добірка недоступна для вашого кабінету.' },
  'selection-rejection-comment-required': { tone: 'error', message: 'Вкажіть причину відхилення.' },
  'selection-rejection-comment-invalid': { tone: 'error', message: 'Причина має містити від 3 до 500 символів без HTML.' },
  'selection-finalization-invariant-failed': { tone: 'error', message: 'Рішення не збережено: заявка не перейшла до очікування рахунку.' },
  'selection-decision-error': { tone: 'error', message: 'Не вдалося зберегти рішення. Спробуйте ще раз.' }
} as const satisfies Record<string, Omit<WorkflowFeedback, 'code'>>;

export function getClientSelectionFeedback(code: string): WorkflowFeedback {
  const feedback = selectionFeedback[code as keyof typeof selectionFeedback]
    ?? selectionFeedback['selection-decision-error'];
  return { code, ...feedback };
}
