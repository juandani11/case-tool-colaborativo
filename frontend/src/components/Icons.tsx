import type { SVGProps } from 'react';

type IconProps = SVGProps<SVGSVGElement>;

function IconBase({ children, ...props }: IconProps) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
      {...props}
    >
      {children}
    </svg>
  );
}

export function HelpCircleIcon(props: IconProps) {
  return (
    <IconBase {...props}>
      <circle cx="12" cy="12" r="9" />
      <path d="M9.4 9.2a2.9 2.9 0 0 1 5.5 1.4c0 1.9-2.4 2.2-2.4 4" />
      <path d="M12.5 17.2h.01" />
    </IconBase>
  );
}

export function ArrowLeftIcon(props: IconProps) {
  return (
    <IconBase {...props}>
      <path d="M19 12H5" />
      <path d="m11 18-6-6 6-6" />
    </IconBase>
  );
}

export function ArrowRightIcon(props: IconProps) {
  return (
    <IconBase {...props}>
      <path d="M5 12h14" />
      <path d="m13 6 6 6-6 6" />
    </IconBase>
  );
}

export function CloseIcon(props: IconProps) {
  return (
    <IconBase {...props}>
      <path d="M18 6 6 18" />
      <path d="m6 6 12 12" />
    </IconBase>
  );
}

export function BotIcon(props: IconProps) {
  return (
    <IconBase {...props}>
      <rect x="4" y="7" width="16" height="12" rx="3" />
      <path d="M12 3v4" />
      <path d="M8.5 12h.01" />
      <path d="M15.5 12h.01" />
      <path d="M9 16h6" />
    </IconBase>
  );
}

export function WarningIcon(props: IconProps) {
  return (
    <IconBase {...props}>
      <path d="M10.3 4.3 2.8 17.4A2 2 0 0 0 4.5 20h15a2 2 0 0 0 1.7-2.6L13.7 4.3a2 2 0 0 0-3.4 0Z" />
      <path d="M12 9v4" />
      <path d="M12 17h.01" />
    </IconBase>
  );
}

export function BookIcon(props: IconProps) {
  return (
    <IconBase {...props}>
      <path d="M4 5.5A2.5 2.5 0 0 1 6.5 3H20v15H6.5A2.5 2.5 0 0 0 4 20.5Z" />
      <path d="M4 5.5v15" />
      <path d="M8 7h8" />
    </IconBase>
  );
}

export function SquareIcon(props: IconProps) {
  return (
    <IconBase {...props}>
      <rect x="4" y="4" width="16" height="16" rx="1" />
    </IconBase>
  );
}

export function CircleIcon(props: IconProps) {
  return (
    <IconBase {...props}>
      <circle cx="12" cy="12" r="8" />
    </IconBase>
  );
}

export function DiamondIcon(props: IconProps) {
  return (
    <IconBase {...props}>
      <path d="m12 3 9 9-9 9-9-9Z" />
    </IconBase>
  );
}

export function NoteIcon(props: IconProps) {
  return (
    <IconBase {...props}>
      <path d="M5 3h9l5 5v13H5Z" />
      <path d="M14 3v5h5" />
      <path d="M8 12h8" />
      <path d="M8 16h6" />
    </IconBase>
  );
}

export function AssociationIcon(props: IconProps) {
  return (
    <IconBase {...props}>
      <path d="M3 12h18" />
    </IconBase>
  );
}

export function InheritanceIcon(props: IconProps) {
  return (
    <IconBase {...props}>
      <path d="M3 12h11" />
      <path d="m14 8 5 4-5 4Z" />
    </IconBase>
  );
}

export function CompositionIcon(props: IconProps) {
  return (
    <IconBase {...props}>
      <path d="M3 12h12" />
      <path d="m15 12 3-3 3 3-3 3Z" fill="currentColor" stroke="none" />
    </IconBase>
  );
}

export function AggregationIcon(props: IconProps) {
  return (
    <IconBase {...props}>
      <path d="M3 12h12" />
      <path d="m15 12 3-3 3 3-3 3Z" />
    </IconBase>
  );
}
