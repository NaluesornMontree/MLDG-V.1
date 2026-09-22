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
  menu: 'M4 7h16M4 12h16M4 17h16',
  close: 'M6 6l12 12M18 6L6 18',
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

const sidebarAccentStyles = {
  owner: {
    shell: 'border-blue-200/35 bg-white/16 shadow-blue-950/15 backdrop-blur-xl',
    accent: 'bg-blue-300',
    accentSoft: 'bg-blue-50/14 text-blue-50 border-blue-100/25',
    title: 'text-blue-50',
    menuButton: 'border-blue-100/25 bg-white/10 text-blue-50 hover:bg-white/18'
  },
  staff: {
    shell: 'border-cyan-200/35 bg-white/16 shadow-cyan-950/15 backdrop-blur-xl',
    accent: 'bg-cyan-200',
    accentSoft: 'bg-cyan-50/14 text-cyan-50 border-cyan-100/25',
    title: 'text-cyan-50',
    menuButton: 'border-cyan-100/25 bg-white/10 text-cyan-50 hover:bg-white/18'
  },
  member: {
    shell: 'border-amber-200/35 bg-white/16 shadow-amber-950/15 backdrop-blur-xl',
    accent: 'bg-amber-200',
    accentSoft: 'bg-amber-50/14 text-amber-50 border-amber-100/25',
    title: 'text-amber-50',
    menuButton: 'border-amber-100/25 bg-white/10 text-amber-50 hover:bg-white/18'
  }
};

function SidebarIdentityPanel({
  collapsed = false,
  title = 'MLG',
  name = '',
  pointsLabel = '',
  accent = 'owner',
  onToggleCollapsed
}) {
  const styles = sidebarAccentStyles[accent] || sidebarAccentStyles.owner;
  const displayName = name || 'ผู้ใช้งานระบบ';

  return (
    <div className={`hidden md:block mb-5 ${collapsed ? 'text-center' : ''}`}>
      {collapsed ? (
        <button
          type="button"
          onClick={onToggleCollapsed}
          title="แสดงชื่อเมนู"
          aria-label="แสดงชื่อเมนู"
          className="mx-auto flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl border border-white/15 bg-white/10 text-white transition-all hover:bg-white/20"
        >
          <NavIcon name="menu" className="h-5 w-5" />
        </button>
      ) : (
        <section className={`relative overflow-hidden rounded-2xl border p-4 text-left shadow-sm ${styles.shell}`}>
          <div className="flex items-start gap-3">
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <span className={`h-2.5 w-2.5 shrink-0 rounded-full ${styles.accent}`} />
                <div className={`truncate text-lg font-black leading-6 tracking-normal ${styles.title}`} title={title}>
                  {title}
                </div>
              </div>
              <div className="mt-1 truncate text-sm font-bold leading-5 text-white/78" title={displayName}>
                {displayName}
              </div>
            </div>
            <button
              type="button"
              onClick={onToggleCollapsed}
              title="ซ่อนชื่อเมนู"
              aria-label="ซ่อนชื่อเมนู"
              className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border transition-all ${styles.menuButton}`}
            >
              <NavIcon name="menu" className="h-5 w-5" />
            </button>
          </div>

          {pointsLabel && (
            <div className={`mt-3 inline-flex max-w-full items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-black ${styles.accentSoft}`}>
              <span className="shrink-0 text-[10px] uppercase tracking-wide opacity-75">แต้มสะสม</span>
              <div className="truncate text-sm">
                {pointsLabel}
              </div>
            </div>
          )}
          <div className={`mt-4 h-1 w-full rounded-full ${styles.accent}`} />
        </section>
      )}
    </div>
  );
}

function ResponsiveNavButton({ active, icon, label, onClick, collapsed = false, mobileExpanded = false }) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={label}
      aria-label={label}
      className={`${mobileExpanded ? 'min-w-0 w-full flex-row justify-start gap-3' : 'min-w-[58px] flex-col justify-center gap-1.5'} md:min-w-0 md:w-full h-14 md:h-auto px-3 md:px-4 py-2 md:py-3 rounded-2xl font-bold transition-all flex md:flex-row items-center ${collapsed ? 'md:justify-center md:gap-0' : 'md:justify-start md:gap-3'} ${
        active
          ? 'bg-emerald-600 text-white shadow-lg shadow-emerald-950/20'
          : 'text-emerald-50/80 hover:bg-emerald-800 hover:text-white'
      }`}
    >
      <NavIcon name={icon} className="w-5 h-5 shrink-0" />
      <span className={`${mobileExpanded ? 'inline' : 'hidden'} ${collapsed ? 'md:hidden' : 'md:inline'} text-left leading-snug`}>{label}</span>
    </button>
  );
}

export { NavIcon, ResponsiveNavButton, SidebarIdentityPanel };
