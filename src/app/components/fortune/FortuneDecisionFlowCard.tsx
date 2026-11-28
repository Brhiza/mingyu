import type { FortuneScope } from '../../../systems/fortune/types';
import type { FortuneDecisionFlow } from '../../../systems/fortune/reading-flow';
import { Card } from '../../../components/ui';
import { cn } from '../../../lib/utils';

export interface FortuneDecisionFlowCardProps {
  scope: FortuneScope;
  mode: 'general' | 'personalized';
  decisionFlow: FortuneDecisionFlow;
  mobileSection: 'overview' | 'almanac' | 'timeline' | 'dimensions';
  onSelectRhythmDate: (year: number, month: number, day: number) => void;
}

export function FortuneDecisionFlowCard({
  scope,
  mode,
  decisionFlow,
  mobileSection,
  onSelectRhythmDate,
}: FortuneDecisionFlowCardProps) {
  return (
    <Card
      data-testid="fortune-decision-flow"
      className={cn(
        'grid gap-4 bg-[var(--surface-base)] p-3 sm:p-5',
        mobileSection === 'almanac' && 'hidden lg:grid',
      )}
    >
      {/* 先做什么 */}
      <div className={cn('grid gap-2.5', mobileSection !== 'overview' && 'hidden lg:grid')}>
        <div className="flex items-center justify-between gap-2">
          <h2 className="m-0 text-[15px] font-black text-[var(--text-strong)]">
            {decisionFlow.actionTitle}
          </h2>
          <span className="text-[11px] text-[var(--text-muted)]">
            {mode === 'personalized' ? '个人定制建议' : '大众顺时参考'}
          </span>
        </div>
        <div className="grid grid-cols-1 gap-2 md:grid-cols-3">
          {decisionFlow.actions.map((item) => {
            const markerTone =
              item.tone === 'good'
                ? 'border-[color-mix(in_srgb,var(--success-text)_28%,transparent)] bg-[color-mix(in_srgb,var(--success-text)_11%,var(--surface-base))] text-[var(--success-text)]'
                : item.tone === 'caution'
                  ? 'border-[color-mix(in_srgb,var(--secondary)_34%,transparent)] bg-[color-mix(in_srgb,var(--secondary)_12%,var(--surface-base))] text-[var(--secondary-strong)]'
                  : 'border-[color-mix(in_srgb,var(--accent)_28%,transparent)] bg-[var(--accent-soft)] text-[var(--accent-strong)]';
            return (
              <div
                key={item.key}
                className="flex items-start gap-2.5 rounded-xl border border-[var(--border-soft)] bg-[var(--surface-elevated-strong)] p-3"
              >
                <span
                  className={cn(
                    'inline-flex size-7 shrink-0 items-center justify-center rounded-lg border text-[12px] font-extrabold',
                    markerTone,
                  )}
                >
                  {item.badge}
                </span>
                <div className="grid min-w-0 gap-1">
                  <strong className="text-[12.5px] font-bold text-[var(--text-strong)]">
                    {item.title}
                  </strong>
                  <p className="m-0 text-[11.5px] leading-relaxed text-[var(--text-secondary)]">
                    {item.detail}
                  </p>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* 关键窗口 */}
      {decisionFlow.keyWindows.length > 0 ? (
        <div className={cn('grid gap-2 border-t border-[var(--border-soft)] pt-3.5', mobileSection !== 'overview' && 'hidden lg:grid')}>
          <h3 className="m-0 text-[13.5px] font-extrabold text-[var(--text-strong)]">
            {decisionFlow.windowsTitle}
          </h3>
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
            {decisionFlow.keyWindows.map((win) => (
              <div
                key={win.key}
                className={cn(
                  'grid gap-1 rounded-xl border px-3 py-2.5',
                  win.tone === 'good'
                    ? 'border-[color-mix(in_srgb,var(--success-text)_24%,var(--border-soft))] bg-[color-mix(in_srgb,var(--success-text)_5%,var(--surface-elevated-strong))]'
                    : 'border-[color-mix(in_srgb,var(--secondary)_28%,var(--border-soft))] bg-[color-mix(in_srgb,var(--secondary)_6%,var(--surface-elevated-strong))]',
                )}
              >
                <div className="flex items-center justify-between gap-2">
                  <strong className="text-[12.5px] font-bold text-[var(--text-strong)]">
                    {win.label}
                  </strong>
                  <span className="font-mono text-[10.5px] font-semibold text-[var(--text-muted)]">
                    {win.range}
                  </span>
                </div>
                <p className="m-0 text-[11.5px] leading-snug text-[var(--text-secondary)]">
                  {win.usage}
                </p>
              </div>
            ))}
          </div>
        </div>
      ) : null}

      {/* 未来 7 天 / 分周 / 四季节奏 */}
      {decisionFlow.rhythmCards.length > 0 ? (
        <div className={cn('grid gap-2 lg:border-t lg:border-[var(--border-soft)] lg:pt-3.5', mobileSection !== 'timeline' && 'hidden lg:grid')}>
          <div className="flex items-center justify-between gap-2">
            <h3 className="m-0 text-[13.5px] font-extrabold text-[var(--text-strong)]">
              {decisionFlow.rhythmTitle}
            </h3>
          </div>
          <div
            className={cn(
              'grid gap-1.5',
              scope === 'daily'
                ? 'grid-cols-2 sm:grid-cols-4 lg:grid-cols-7'
                : scope === 'yearly'
                  ? 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-4'
                  : 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-5',
            )}
          >
            {decisionFlow.rhythmCards.map((card) => {
              const toneCls =
                card.tone === 'good'
                  ? 'border-[color-mix(in_srgb,var(--success-text)_24%,transparent)] bg-[color-mix(in_srgb,var(--success-text)_10%,var(--surface-base))] text-[var(--success-text)]'
                  : card.tone === 'caution'
                    ? 'border-[color-mix(in_srgb,var(--secondary)_30%,transparent)] bg-[color-mix(in_srgb,var(--secondary)_12%,var(--surface-base))] text-[var(--secondary-strong)]'
                    : 'border-[var(--border-soft)] bg-[var(--surface-soft)] text-[var(--text-secondary)]';
              const Tag = card.dateKey ? 'button' : 'div';
              return (
                <Tag
                  key={card.key}
                  {...(card.dateKey
                    ? {
                        type: 'button' as const,
                        onClick: () => {
                          const [yStr, mStr, dStr] = card.dateKey!.split('-');
                          onSelectRhythmDate(Number(yStr), Number(mStr), Number(dStr));
                        },
                      }
                    : {})}
                  className={cn(
                    'grid content-start gap-1 rounded-xl border border-[var(--border-soft)] bg-[var(--surface-elevated-strong)] p-2.5 text-left',
                    card.dateKey &&
                      'cursor-pointer transition-colors hover:border-[var(--accent)] hover:bg-[var(--state-selected-surface)]',
                  )}
                >
                  <div className="flex items-center justify-between gap-1">
                    <strong className="text-[12px] font-bold text-[var(--text-strong)]">
                      {card.title}
                    </strong>
                    <span className={cn('rounded-full border px-1.5 py-0.5 text-[9.5px] font-bold leading-none', toneCls)}>
                      {card.status}
                    </span>
                  </div>
                  <span className="text-[10.5px] font-medium text-[var(--text-muted)]">
                    {card.subLabel}
                  </span>
                  <p className="m-0 text-[11px] leading-snug text-[var(--text-secondary)]">
                    {card.focus}
                  </p>
                </Tag>
              );
            })}
          </div>
        </div>
      ) : null}

      {/* 判断依据（白话双栏） */}
      <div className={cn('grid grid-cols-1 gap-3 md:grid-cols-2 lg:border-t lg:border-[var(--border-soft)] lg:pt-3.5', mobileSection !== 'dimensions' && 'hidden lg:grid')}>
        <div className="grid content-start gap-1.5">
          <span className="text-[12px] font-extrabold text-[var(--success-text)]">
            支持力量
          </span>
          <div className="grid gap-1.5">
            {decisionFlow.evidenceGroups.support.map((ev, idx) => (
              <div
                key={`sup-${idx}`}
                className="rounded-lg border border-[var(--border-soft)] bg-[var(--surface-soft)] px-2.5 py-2 text-[11.5px]"
              >
                <strong className="block text-[var(--text-strong)]">{ev.label}</strong>
                <span className="text-[var(--text-secondary)]">{ev.detail}</span>
              </div>
            ))}
          </div>
        </div>
        <div className="grid content-start gap-1.5">
          <span className="text-[12px] font-extrabold text-[var(--secondary-strong)]">
            需防消耗
          </span>
          <div className="grid gap-1.5">
            {decisionFlow.evidenceGroups.caution.map((ev, idx) => (
              <div
                key={`cau-${idx}`}
                className="rounded-lg border border-[var(--border-soft)] bg-[var(--surface-soft)] px-2.5 py-2 text-[11.5px]"
              >
                <strong className="block text-[var(--text-strong)]">{ev.label}</strong>
                <span className="text-[var(--text-secondary)]">{ev.detail}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </Card>
  );
}
