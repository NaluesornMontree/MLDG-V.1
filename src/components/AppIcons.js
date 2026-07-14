import React from 'react';

function BaseIcon({ className = '', children, viewBox = '0 0 24 24' }) {
  return (
    <svg
      viewBox={viewBox}
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      aria-hidden="true"
    >
      {children}
    </svg>
  );
}

export function AlertIcon({ className = '' }) {
  return (
    <BaseIcon className={className}>
      <path
        d="M12 8V13"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
      />
      <path
        d="M12 17H12.01"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
      />
      <path
        d="M10.29 3.86L1.82 18A2 2 0 0 0 3.53 21H20.47A2 2 0 0 0 22.18 18L13.71 3.86A2 2 0 0 0 10.29 3.86Z"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </BaseIcon>
  );
}

export function CheckCircleIcon({ className = '' }) {
  return (
    <BaseIcon className={className}>
      <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="2" />
      <path
        d="M8.5 12.5L11 15L15.5 10.5"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </BaseIcon>
  );
}

export function WrenchIcon({ className = '' }) {
  return (
    <BaseIcon className={className}>
      <path
        d="M14 6.5A4.5 4.5 0 0 0 17.5 10L9 18.5A2.12 2.12 0 1 1 6 15.5L14.5 7A4.5 4.5 0 0 1 14 6.5Z"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M16 4L20 8"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
      />
    </BaseIcon>
  );
}

export function UserIcon({ className = '' }) {
  return (
    <BaseIcon className={className}>
      <circle cx="12" cy="8" r="3.5" stroke="currentColor" strokeWidth="2" />
      <path
        d="M5 19C6.5 16.5 9 15.5 12 15.5C15 15.5 17.5 16.5 19 19"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
      />
    </BaseIcon>
  );
}

export function GolfIcon({ className = '' }) {
  return (
    <BaseIcon className={className}>
      <path
        d="M12 4V20"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
      />
      <path
        d="M12 4L17 6.5L12 9"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M8 20H16"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
      />
    </BaseIcon>
  );
}

export function CheckIcon({ className = '' }) {
  return (
    <BaseIcon className={className}>
      <path
        d="M5 12.5L9.5 17L19 7.5"
        stroke="currentColor"
        strokeWidth="2.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </BaseIcon>
  );
}

export function PlusIcon({ className = '' }) {
  return (
    <BaseIcon className={className}>
      <path d="M12 5V19" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      <path d="M5 12H19" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </BaseIcon>
  );
}

export function SaveIcon({ className = '' }) {
  return (
    <BaseIcon className={className}>
      <path
        d="M5 5.5A1.5 1.5 0 0 1 6.5 4H16L19 7V18.5A1.5 1.5 0 0 1 17.5 20H6.5A1.5 1.5 0 0 1 5 18.5V5.5Z"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinejoin="round"
      />
      <path
        d="M9 4V9H15V4"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinejoin="round"
      />
      <path
        d="M9 20V14H15V20"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinejoin="round"
      />
    </BaseIcon>
  );
}

export function StarIcon({ className = '', filled = false }) {
  return (
    <BaseIcon className={className}>
      <path
        d="M12 3.8L14.55 8.96L20.25 9.79L16.12 13.82L17.1 19.5L12 16.82L6.9 19.5L7.88 13.82L3.75 9.79L9.45 8.96L12 3.8Z"
        fill={filled ? 'currentColor' : 'none'}
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </BaseIcon>
  );
}
