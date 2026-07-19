'use client';

import { useEffect, useId, useMemo, useRef, useState } from 'react';

export type SearchableComboboxOption = {
  value: string;
  label: string;
};

type SearchableComboboxProps = {
  label: string;
  name: string;
  options: SearchableComboboxOption[];
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  emptyMessage?: string;
  disabled?: boolean;
  required?: boolean;
  error?: string;
  variant?: 'default' | 'light';
};

function normalizeSearch(value: string) {
  return value.trim().toLocaleLowerCase('uk-UA');
}

export function SearchableCombobox({
  label,
  name,
  options,
  value,
  onChange,
  placeholder = 'Оберіть значення',
  emptyMessage = 'Нічого не знайдено',
  disabled = false,
  required = false,
  error,
  variant = 'default'
}: SearchableComboboxProps) {
  const generatedId = useId();
  const inputId = `${generatedId}-input`;
  const listboxId = `${generatedId}-listbox`;
  const rootRef = useRef<HTMLDivElement>(null);
  const selectedOption = useMemo(() => options.find((option) => option.value === value) ?? null, [options, value]);
  const [inputValue, setInputValue] = useState(selectedOption?.label ?? '');
  const [isOpen, setIsOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);
  const filteredOptions = useMemo(() => {
    const query = normalizeSearch(inputValue);

    if (!query) {
      return options;
    }

    return options.filter((option) => normalizeSearch(option.label).includes(query));
  }, [inputValue, options]);
  const activeOption = filteredOptions[activeIndex];
  const activeOptionId = activeOption ? `${listboxId}-option-${activeIndex}` : undefined;
  const isLight = variant === 'light';

  useEffect(() => {
    setInputValue(selectedOption?.label ?? '');
  }, [selectedOption]);

  useEffect(() => {
    setActiveIndex(0);
  }, [inputValue, options]);

  useEffect(() => {
    function handlePointerDown(event: MouseEvent) {
      if (!rootRef.current?.contains(event.target as Node)) {
        setIsOpen(false);
        setInputValue(selectedOption?.label ?? '');
      }
    }

    document.addEventListener('mousedown', handlePointerDown);
    return () => document.removeEventListener('mousedown', handlePointerDown);
  }, [selectedOption]);

  function selectOption(option: SearchableComboboxOption) {
    onChange(option.value);
    setInputValue(option.label);
    setIsOpen(false);
  }

  function handleInputChange(nextValue: string) {
    setInputValue(nextValue);
    setIsOpen(true);

    if (selectedOption?.label !== nextValue) {
      onChange('');
    }
  }

  function handleKeyDown(event: React.KeyboardEvent<HTMLInputElement>) {
    if (disabled) {
      return;
    }

    if (event.key === 'ArrowDown') {
      event.preventDefault();
      setIsOpen(true);
      setActiveIndex((currentIndex) => Math.min(currentIndex + 1, Math.max(filteredOptions.length - 1, 0)));
      return;
    }

    if (event.key === 'ArrowUp') {
      event.preventDefault();
      setIsOpen(true);
      setActiveIndex((currentIndex) => Math.max(currentIndex - 1, 0));
      return;
    }

    if (event.key === 'Enter' && isOpen) {
      event.preventDefault();

      if (activeOption) {
        selectOption(activeOption);
      }
      return;
    }

    if (event.key === 'Escape') {
      setIsOpen(false);
      setInputValue(selectedOption?.label ?? '');
    }
  }

  function handleBlur() {
    window.setTimeout(() => {
      if (!rootRef.current?.contains(document.activeElement)) {
        setIsOpen(false);
        setInputValue(selectedOption?.label ?? '');
      }
    }, 0);
  }

  return (
    <div ref={rootRef} className={`relative grid gap-2 text-sm font-semibold ${isLight ? 'text-foreground' : 'text-public-secondary'}`}>
      <label htmlFor={inputId}>
        {label}
        {required ? <span aria-hidden="true"> *</span> : null}
      </label>
      <input type="hidden" name={name} value={value} />
      <input
        id={inputId}
        type="text"
        value={inputValue}
        disabled={disabled}
        placeholder={placeholder}
        autoComplete="off"
        role="combobox"
        aria-expanded={isOpen}
        aria-controls={listboxId}
        aria-activedescendant={activeOptionId}
        aria-required={required}
        aria-invalid={Boolean(error)}
        onFocus={() => setIsOpen(true)}
        onClick={() => setIsOpen(true)}
        onChange={(event) => handleInputChange(event.target.value)}
        onKeyDown={handleKeyDown}
        onBlur={handleBlur}
        className={`h-11 w-full rounded-md border px-3 text-sm transition disabled:cursor-not-allowed disabled:opacity-60 ${
          isLight
            ? 'border-border bg-card text-foreground placeholder:text-muted focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/20'
            : 'public-field'
        } ${error ? 'border-danger/50 focus-visible:outline-danger' : ''}`}
      />
      {error ? <p className={`text-xs font-medium ${isLight ? 'text-danger' : 'text-public-danger'}`}>{error}</p> : null}
      {isOpen ? (
        <div
          id={listboxId}
          role="listbox"
          className={`absolute left-0 right-0 top-full z-30 mt-1 max-h-64 overflow-y-auto rounded-md border py-1 text-sm shadow-lg ${
            isLight ? 'border-border bg-card' : 'border-public-border bg-public-card'
          }`}
        >
          {filteredOptions.length > 0 ? (
            filteredOptions.map((option, index) => {
              const isActive = index === activeIndex;
              const isSelected = option.value === value;

              return (
                <button
                  key={option.value}
                  id={`${listboxId}-option-${index}`}
                  type="button"
                  role="option"
                  aria-selected={isSelected}
                  onMouseEnter={() => setActiveIndex(index)}
                  onMouseDown={(event) => event.preventDefault()}
                  onClick={() => selectOption(option)}
                  className={`block w-full px-3 py-2 text-left font-medium transition ${
                    isActive || isSelected
                      ? isLight
                        ? 'bg-accent/15 text-foreground'
                        : 'bg-accent/15 text-public-primary'
                      : isLight
                        ? 'text-foreground hover:bg-surface-muted'
                        : 'text-public-secondary hover:bg-public-elevated hover:text-public-primary'
                  }`}
                >
                  {option.label}
                </button>
              );
            })
          ) : (
            <div className={`px-3 py-3 text-sm font-medium ${isLight ? 'text-muted' : 'text-public-muted'}`}>{emptyMessage}</div>
          )}
        </div>
      ) : null}
    </div>
  );
}
