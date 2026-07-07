type ActionIconProps = {
  name: 'login' | 'plus' | 'filter' | 'reset' | 'telegram' | 'send' | 'save' | 'refresh' | 'search' | 'check' | 'comment';
  className?: string;
};

export function ActionIcon({ name, className = 'size-4' }: ActionIconProps) {
  const baseProps = {
    'aria-hidden': true,
    viewBox: '0 0 24 24',
    className,
    fill: 'none',
    stroke: 'currentColor',
    strokeWidth: 2,
    strokeLinecap: 'round' as const,
    strokeLinejoin: 'round' as const
  };

  if (name === 'login') {
    return (
      <svg {...baseProps}>
        <path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4" />
        <path d="m10 17 5-5-5-5" />
        <path d="M15 12H3" />
      </svg>
    );
  }

  if (name === 'plus') {
    return (
      <svg {...baseProps}>
        <path d="M12 5v14" />
        <path d="M5 12h14" />
      </svg>
    );
  }

  if (name === 'filter') {
    return (
      <svg {...baseProps}>
        <path d="M3 5h18" />
        <path d="M6 12h12" />
        <path d="M10 19h4" />
      </svg>
    );
  }

  if (name === 'reset') {
    return (
      <svg {...baseProps}>
        <path d="M3 12a9 9 0 1 0 3-6.7" />
        <path d="M3 4v6h6" />
      </svg>
    );
  }

  if (name === 'telegram' || name === 'send') {
    return (
      <svg {...baseProps}>
        <path d="m22 2-7 20-4-9-9-4z" />
        <path d="M22 2 11 13" />
      </svg>
    );
  }

  if (name === 'save') {
    return (
      <svg {...baseProps}>
        <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2Z" />
        <path d="M17 21v-8H7v8" />
        <path d="M7 3v5h8" />
      </svg>
    );
  }

  if (name === 'refresh') {
    return (
      <svg {...baseProps}>
        <path d="M20 7v5h-5" />
        <path d="M4 17v-5h5" />
        <path d="M18 12a6 6 0 0 0-10-4.5L4 11" />
        <path d="M6 12a6 6 0 0 0 10 4.5l4-3.5" />
      </svg>
    );
  }

  if (name === 'search') {
    return (
      <svg {...baseProps}>
        <circle cx="11" cy="11" r="7" />
        <path d="m20 20-3.5-3.5" />
      </svg>
    );
  }

  if (name === 'comment') {
    return (
      <svg {...baseProps}>
        <path d="M21 15a4 4 0 0 1-4 4H8l-5 3V7a4 4 0 0 1 4-4h10a4 4 0 0 1 4 4z" />
      </svg>
    );
  }

  return (
    <svg {...baseProps}>
      <circle cx="12" cy="12" r="9" />
      <path d="m8 12 2.5 2.5L16 9" />
    </svg>
  );
}
