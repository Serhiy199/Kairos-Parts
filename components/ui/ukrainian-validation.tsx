'use client';

import { useEffect } from 'react';

const REQUIRED_MESSAGE = 'Заповніть це обовʼязкове поле.';
const EMAIL_MESSAGE = 'Введіть коректну email-адресу.';
const MIN_LENGTH_MESSAGE = 'Значення занадто коротке. Перевірте мінімальну кількість символів.';

function setValidationMessage(element: HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement) {
  element.setCustomValidity('');

  if (element.validity.valueMissing) {
    element.setCustomValidity(REQUIRED_MESSAGE);
    return;
  }

  if (element instanceof HTMLInputElement && element.validity.typeMismatch && element.type === 'email') {
    element.setCustomValidity(EMAIL_MESSAGE);
    return;
  }

  if (element.validity.tooShort) {
    element.setCustomValidity(MIN_LENGTH_MESSAGE);
  }
}

function isFormControl(target: EventTarget | null): target is HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement {
  return target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement || target instanceof HTMLSelectElement;
}

export function UkrainianValidation() {
  useEffect(() => {
    function handleInvalid(event: Event) {
      if (!isFormControl(event.target)) {
        return;
      }

      setValidationMessage(event.target);
    }

    function handleInput(event: Event) {
      if (!isFormControl(event.target)) {
        return;
      }

      event.target.setCustomValidity('');
    }

    document.addEventListener('invalid', handleInvalid, true);
    document.addEventListener('input', handleInput, true);
    document.addEventListener('change', handleInput, true);

    return () => {
      document.removeEventListener('invalid', handleInvalid, true);
      document.removeEventListener('input', handleInput, true);
      document.removeEventListener('change', handleInput, true);
    };
  }, []);

  return null;
}
