import React from 'react';

const iconPaths = {
  dashboard: 'M4 13h7V4H4v9Zm9 7h7V4h-7v16ZM4 20h7v-5H4v5Z',
  user: 'M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8Zm7 8a7 7 0 0 0-14 0',
  users: 'M16 11a3 3 0 1 0 0-6 3 3 0 0 0 0 6Zm-8 0a3 3 0 1 0 0-6 3 3 0 0 0 0 6Zm8 3a5 5 0 0 1 5 5M3 19a5 5 0 0 1 10 0',
  lane: 'M4 19h16M6 16l3-12h6l3 12M8 10h8',
  payment: 'M3 7h18v10H3zM3 10h18M7 15h3',
  booking: 'M7 3v4M17 3v4M4 8h16M5 5h14a1 1 0 0 1 1 1v14H4V6a1 1 0 0 1 1-1z',
  calendar: 'M7 3v4M17 3v4M4 8h16M8 13h3M13 13h3M8 17h3',
  club: 'M15 4c2 2 2 5 0 7l-7 7M8 18l-2 2M13 6l5 5',
  code: 'M8 9l-4 3 4 3M16 9l4 3-4 3M14 5l-4 14',
  star: 'M12 3l2.7 5.5 6.1.9-4.4 4.3 1 6.1L12 17l-5.4 2.8 1-6.1-4.4-4.3 6.1-.9z',
  history: 'M4 12a8 8 0 1 0 2.3-5.7M4 4v5h5M12 8v5l3 2',
  logOut: 'M10 17l5-5-5-5M15 12H3M21 4v16',
};

function NavIcon({ name, className = '' }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      className={className}
    >
      <path d={iconPaths[name] || iconPaths.code} />
    </svg>
  );
}

function ResponsiveNavButton({ active, icon, label, onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={label}
      aria-label={label}
      className={`min-w-[58px] md:min-w-0 md:w-full h-14 md:h-auto px-3 md:px-4 py-2 md:py-3 rounded-2xl font-bold transition-all flex flex-col md:flex-row items-center justify-center md:justify-start gap-1.5 md:gap-3 ${
        active
          ? 'bg-emerald-600 text-white shadow-lg shadow-emerald-950/20'
          : 'text-emerald-50/80 hover:bg-emerald-800 hover:text-white'
      }`}
    >
      <NavIcon name={icon} className="w-5 h-5 shrink-0" />
      <span className="hidden md:inline text-left leading-snug">{label}</span>
    </button>
  );
}

export { NavIcon, ResponsiveNavButton };
