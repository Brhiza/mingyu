import * as React from 'react';
import { UnifiedTimeBlock } from './divination-shared';

function RitualCornerOrnament({ position }: { position: 'tl' | 'tr' | 'bl' | 'br' }) {
  return (
    <svg
      className={`ritual-corner-ornament is-${position}`}
      viewBox="0 0 22 22"
      fill="none"
      aria-hidden="true"
    >
      <path
        d="M2 20V5C2 3.343 3.343 2 5 2H20M6 16V7.5C6 6.672 6.672 6 7.5 6H16M6 10.5H10.5V6"
        stroke="currentColor"
        strokeWidth="1.3"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export interface RitualStageShellProps {
  title?: string;
  subtitle?: string;
  headerRight?: React.ReactNode;
  subHeader?: React.ReactNode;
  stepBar?: React.ReactNode;
  actions?: React.ReactNode;
  submitLabel?: string;
  showSubmitButton?: boolean;
  submitDisabled?: boolean;
  isComplete?: boolean;
  className?: string;
  children: React.ReactNode;
}

export function RitualStageShell({
  title,
  subtitle,
  headerRight,
  subHeader,
  stepBar,
  actions,
  submitLabel = '开始占卜',
  showSubmitButton = false,
  submitDisabled = false,
  isComplete = false,
  className = '',
  children,
}: RitualStageShellProps) {
  const hasActions = Boolean(actions) || showSubmitButton;
  const hasTitle = Boolean(title?.trim());

  return (
    <div className={`ritual-sanctuary${className ? ` ${className}` : ''}`}>
      {hasTitle || headerRight ? (
        <div className={`ritual-sanctuary-head${!hasTitle ? ' is-right-only' : ''}`}>
          {hasTitle ? (
            <div className="ritual-brand-text">
              <strong>{title}</strong>
              {subtitle ? <span>{subtitle}</span> : null}
            </div>
          ) : null}
          {headerRight ? <div className="ritual-head-right">{headerRight}</div> : null}
        </div>
      ) : null}

      {subHeader}

      <div className={`ritual-stage-frame${isComplete ? ' is-complete' : ''}`}>
        <RitualCornerOrnament position="tl" />
        <RitualCornerOrnament position="tr" />
        <RitualCornerOrnament position="bl" />
        <RitualCornerOrnament position="br" />

        {stepBar}

        <div className="ritual-stage-body">{children}</div>

        {hasActions ? (
          <div className="ritual-stage-actions is-mobile-action-dock">
            {actions ?? (
              <button
                type="submit"
                disabled={submitDisabled}
                className="workspace-ui-button is-primary ritual-primary-btn"
              >
                {submitLabel}
              </button>
            )}
          </div>
        ) : null}
      </div>
    </div>
  );
}

export interface RitualTimeControlProps {
  fieldLabel?: string;
  actionLabel?: string;
  supportTrueSolar?: boolean;
  timeMode: 'current' | 'custom';
  customDate: string;
  customTime: string;
  nowDateStr: string;
  nowTimeStr: string;
  useTrueSolar: boolean;
  placeDisplayName: string;
  placeLongitude: number;
  onChangeTimeMode: (mode: 'current' | 'custom') => void;
  onChangeCustomDate: (next: string) => void;
  onChangeCustomTime: (next: string) => void;
  onChangeUseTrueSolar: (checked: boolean) => void;
  onChangePlace: (displayName: string, longitude: number, latitude?: number) => void;
  onRefreshCurrent?: () => void;
}

export function RitualTimeControl(props: RitualTimeControlProps) {
  return (
    <div className="ritual-time-wrap">
      <UnifiedTimeBlock {...props} />
    </div>
  );
}
