'use client';

interface AppLogoProps {
  size?: 'sm' | 'md' | 'lg';
  showSubtitle?: boolean;
}

const SIZES = {
  sm: { icon: 'text-lg', title: 'text-sm', subtitle: 'text-[10px]' },
  md: { icon: 'text-2xl', title: 'text-lg', subtitle: 'text-xs' },
  lg: { icon: 'text-4xl', title: 'text-2xl', subtitle: 'text-sm' },
} as const;

export default function AppLogo({ size = 'md', showSubtitle = true }: AppLogoProps) {
  const s = SIZES[size];

  return (
    <div className="flex items-center gap-2 select-none">
      <svg
        width={size === 'sm' ? 18 : size === 'lg' ? 36 : 24}
        height={size === 'sm' ? 18 : size === 'lg' ? 36 : 24}
        viewBox="0 0 24 24"
        fill="none"
        className="text-blue-600 flex-shrink-0"
      >
        <rect x="2" y="2" width="9" height="9" rx="2" stroke="currentColor" strokeWidth="1.8" />
        <rect x="13" y="13" width="9" height="9" rx="2" stroke="currentColor" strokeWidth="1.8" />
        <line x1="11" y1="6.5" x2="13" y2="17.5" stroke="currentColor" strokeWidth="1.4" />
      </svg>
      <div className="leading-tight">
        <div className={`${s.title} font-bold text-gray-900`}>UML Editor</div>
        {showSubtitle && (
          <div className={`${s.subtitle} text-gray-500`}>CASE Colaborativo</div>
        )}
      </div>
    </div>
  );
}
