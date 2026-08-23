type MobileBottomSection = 'home' | 'chart' | 'divination' | 'cases';

type MobileBottomNavProps = {
  activeSection: MobileBottomSection | null;
  onSelect: (section: MobileBottomSection) => void;
};

function MobileNavIcon({ section }: { section: MobileBottomSection }) {
  if (section === 'home') {
    return (
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="M3.5 10.5 12 3.7l8.5 6.8" />
        <path d="M5.5 9.5v10h13v-10M9.5 19.5v-6h5v6" />
      </svg>
    );
  }
  if (section === 'chart') {
    return (
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <circle cx="12" cy="12" r="8.5" />
        <path d="M12 3.5v17M3.5 12h17M6 6l12 12M18 6 6 18" />
      </svg>
    );
  }
  if (section === 'divination') {
    return (
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="M12 3.5 20 8v8l-8 4.5L4 16V8l8-4.5Z" />
        <path d="m12 8 .8 2.1 2.2.2-1.7 1.4.5 2.2-1.8-1.2-1.8 1.2.5-2.2-1.7-1.4 2.2-.2L12 8Z" />
      </svg>
    );
  }
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M3.5 7.5h7l1.7 2h8.3v10h-17v-12Z" />
      <path d="M3.5 7.5v-3h6l1.5 2" />
    </svg>
  );
}

const mobileBottomItems: Array<{
  section: MobileBottomSection;
  label: string;
}> = [
  { section: 'home', label: '首页' },
  { section: 'chart', label: '排盘' },
  { section: 'divination', label: '占问' },
  { section: 'cases', label: '案例' },
];

export function MobileBottomNav({ activeSection, onSelect }: MobileBottomNavProps) {
  return (
    <nav className="workspace-mobile-bottom-nav" aria-label="手机主要导航">
      {mobileBottomItems.map((item) => {
        const isActive = activeSection === item.section;
        return (
          <button
            type="button"
            key={item.section}
            className={isActive ? 'is-active' : ''}
            aria-current={isActive ? 'page' : undefined}
            onClick={() => onSelect(item.section)}
          >
            <MobileNavIcon section={item.section} />
            <span>{item.label}</span>
          </button>
        );
      })}
    </nav>
  );
}
