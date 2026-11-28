import type { FortuneScope } from '../../../systems/fortune/types';
import type { FortuneCalculatedData } from '../../hooks/fortune-cache';
import { Badge, Card } from '../../../components/ui';
import { cn } from '../../../lib/utils';
import { WEEKDAY_HEADERS, trendBadgeCls, trendBadgeVariant } from './fortune-storage';

export interface FortuneTimelineSectionProps {
  scope: FortuneScope;
  fortuneData: FortuneCalculatedData;
  todayStr: string;
  hiddenOnMobile: boolean;
  monthDayFilter: 'all' | '优选' | '慎用';
  onChangeMonthDayFilter: (filter: 'all' | '优选' | '慎用') => void;
  onSelectDay: (year: number, month: number, day: number) => void;
  onSelectMonth: (year: number, month: number) => void;
}

export function FortuneTimelineSection({
  scope,
  fortuneData,
  todayStr,
  hiddenOnMobile,
  monthDayFilter,
  onChangeMonthDayFilter,
  onSelectDay,
  onSelectMonth,
}: FortuneTimelineSectionProps) {
  return (
    <Card className={cn('grid gap-3 bg-[var(--surface-base)] p-3 sm:p-5', hiddenOnMobile && 'hidden lg:grid')}>
      {scope === 'daily' && fortuneData.timeline.hours ? (
        <>
          <div className="flex items-center justify-between gap-2">
            <h2 className="m-0 text-[15px] font-black text-[var(--text-strong)]">
              十二时辰吉凶表
            </h2>
            <span className="text-[11px] text-[var(--text-muted)]">
              吉 {fortuneData.timeline.hours.filter((h) => h.rating === '吉').length} 辰 · 慎{' '}
              {fortuneData.timeline.hours.filter((h) => h.rating === '慎').length} 辰
            </span>
          </div>
          <div className="grid grid-cols-2 gap-1.5 sm:grid-cols-4 lg:grid-cols-6">
            {fortuneData.timeline.hours.map((h) => (
              <div
                key={h.name}
                className={cn(
                  'grid gap-0.5 rounded-[10px] border px-2.5 py-2 text-[11px]',
                  h.rating === '吉'
                    ? 'border-[color-mix(in_srgb,var(--success-text)_28%,var(--border-soft))] bg-[color-mix(in_srgb,var(--success-text)_5%,var(--surface-elevated-strong))]'
                    : 'border-[var(--border-soft)] bg-[var(--surface-elevated-strong)]',
                )}
              >
                <div className="flex items-center justify-between gap-1">
                  <strong className="text-[12px] text-[var(--text-strong)]">
                    {h.name} · {h.ganzhi}
                  </strong>
                  <span className={cn('rounded-full border px-1.5 py-0.5 text-[10px] font-bold leading-none', trendBadgeCls(h.rating))}>
                    {h.rating}
                  </span>
                </div>
                <span className="font-mono text-[10px] text-[var(--text-muted)]">{h.range}</span>
                <span className="truncate text-[var(--text-secondary)]" title={h.note}>
                  {h.note}
                </span>
              </div>
            ))}
          </div>
        </>
      ) : null}

      {scope === 'monthly' && fortuneData.timeline.days ? (() => {
        const allDays = fortuneData.timeline.days;
        const filteredDays =
          monthDayFilter === 'all' ? allDays : allDays.filter((d) => d.rating === monthDayFilter);
        const firstWeekdayIdx = allDays[0]?.weekdayIndex ?? 1;
        const leadingEmpty = monthDayFilter === 'all' ? (firstWeekdayIdx + 6) % 7 : 0;
        const goodCount = allDays.filter((d) => d.rating === '优选').length;
        const cautionCount = allDays.filter((d) => d.rating === '慎用').length;
        return (
          <>
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h2 className="m-0 text-[15px] font-black text-[var(--text-strong)]">
                本月逐日黄历
              </h2>
              <div className="flex flex-wrap items-center gap-1.5">
                {(['all', '优选', '慎用'] as const).map((filterOpt) => (
                  <button
                    key={filterOpt}
                    type="button"
                    onClick={() => onChangeMonthDayFilter(filterOpt)}
                    className={cn(
                      'rounded-full border px-2.5 py-0.5 text-[11px] font-semibold transition-colors cursor-pointer',
                      monthDayFilter === filterOpt
                        ? 'border-[var(--accent-strong)] bg-[var(--state-selected-surface-strong)] text-[var(--state-selected-text)] font-bold'
                        : 'border-[var(--border-soft)] bg-[var(--surface-elevated-strong)] text-[var(--text-secondary)] hover:border-[var(--border-contrast)]',
                    )}
                  >
                    {filterOpt === 'all'
                      ? `全部(${allDays.length})`
                      : filterOpt === '优选'
                        ? `优选(${goodCount})`
                        : `慎用(${cautionCount})`}
                  </button>
                ))}
              </div>
            </div>
            {fortuneData.timeline.solarTerms?.length ? (
              <div className="text-[11px] text-[var(--text-muted)]">
                本月节气：{fortuneData.timeline.solarTerms.map((s) => `${s.name} ${s.date.slice(5)}`).join(' · ')}
              </div>
            ) : null}
            {monthDayFilter === 'all' ? (
              <div className="hidden md:grid md:grid-cols-7 gap-1.5 text-center text-[11px] font-bold text-[var(--text-muted)]">
                {WEEKDAY_HEADERS.map((w) => (
                  <span key={w} className="py-0.5">
                    周{w}
                  </span>
                ))}
              </div>
            ) : null}
            {filteredDays.length === 0 ? (
              <div className="rounded-[12px] border border-dashed border-[var(--border-soft)] py-6 text-center text-xs text-[var(--text-muted)]">
                本月暂无「{monthDayFilter}」日期
              </div>
            ) : (
              <div
                className={cn(
                  'grid gap-1.5',
                  monthDayFilter === 'all'
                    ? 'grid-cols-3 sm:grid-cols-5 md:grid-cols-7'
                    : 'grid-cols-2 sm:grid-cols-4 md:grid-cols-5',
                )}
              >
                {leadingEmpty > 0
                  ? Array.from({ length: leadingEmpty }, (_, idx) => (
                      <div key={`empty-${idx}`} className="hidden md:block" aria-hidden="true" />
                    ))
                  : null}
                {filteredDays.map((d) => {
                  const isToday = d.date === todayStr;
                  return (
                    <button
                      key={d.date}
                      type="button"
                      onClick={() =>
                        onSelectDay(Number(d.date.slice(0, 4)), Number(d.date.slice(5, 7)), d.day)
                      }
                      className={cn(
                        'group grid gap-0.5 rounded-[10px] border p-2 text-left transition-colors cursor-pointer hover:border-[var(--accent-strong)] hover:bg-[var(--state-selected-surface)]',
                        isToday
                          ? 'border-[var(--accent-strong)] bg-[var(--state-selected-surface)]'
                          : 'border-[var(--border-soft)] bg-[var(--surface-elevated-strong)]',
                      )}
                    >
                      <div className="flex items-center justify-between gap-1">
                        <span className="inline-flex items-center gap-1">
                          <strong className="font-mono text-xs text-[var(--text-strong)]">{d.day}日</strong>
                          {isToday ? (
                            <span className="rounded bg-[var(--accent-strong)] px-1 text-[9px] font-bold text-[var(--accent-contrast)]">
                              今
                            </span>
                          ) : null}
                        </span>
                        <span className={cn('rounded border px-1 py-0.5 text-[9.5px] font-bold leading-none', trendBadgeCls(d.rating))}>
                          {d.rating}
                        </span>
                      </div>
                      <span className="truncate text-[10.5px] font-semibold text-[var(--text-secondary)]">
                        {d.lunarDate} · {d.dayGanZhi}
                      </span>
                      <span className="truncate text-[10px] text-[var(--text-muted)]">
                        {d.dayOfficer}日 · {d.score}分
                      </span>
                    </button>
                  );
                })}
              </div>
            )}
          </>
        );
      })() : null}

      {scope === 'yearly' && fortuneData.timeline.months ? (
        <>
          <h2 className="m-0 text-[15px] font-black text-[var(--text-strong)]">
            十二节气流月
          </h2>
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {fortuneData.timeline.months.map((m) => {
              const isCurrentSolarMonth = todayStr >= m.startDate && todayStr <= m.endDate;
              return (
                <button
                  key={m.monthIndex}
                  type="button"
                  onClick={() => {
                    const ym = /^(\d{4})-(\d{2})/.exec(m.startDate);
                    if (ym) {
                      onSelectMonth(Number(ym[1]), Number(ym[2]));
                    }
                  }}
                  className={cn(
                    'group grid gap-1.5 rounded-[10px] border px-3 py-2.5 text-left transition-colors cursor-pointer hover:border-[var(--accent-strong)] hover:bg-[var(--state-selected-surface)]',
                    isCurrentSolarMonth
                      ? 'border-[var(--accent-strong)] bg-[var(--state-selected-surface)]'
                      : 'border-[var(--border-soft)] bg-[var(--surface-elevated-strong)]',
                  )}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="inline-flex items-center gap-1.5">
                      <strong className="text-[13px] font-bold text-[var(--text-strong)]">
                        {m.jieName} · {m.monthGanZhi}月
                      </strong>
                      {isCurrentSolarMonth ? (
                        <Badge variant="accent">当月</Badge>
                      ) : null}
                    </span>
                    <div className="flex items-center gap-1.5">
                      <span className="font-mono text-[11px] font-bold text-[var(--text-strong)]">
                        {m.score}分
                      </span>
                      <Badge variant={trendBadgeVariant(m.trend)}>{m.trend}</Badge>
                    </div>
                  </div>
                  <div className="h-1.5 w-full overflow-hidden rounded-full bg-[var(--surface-soft)]">
                    <div
                      className="h-full rounded-full bg-[var(--accent-strong)]"
                      style={{ width: `${m.score}%` }}
                    />
                  </div>
                  <span className="text-[11px] text-[var(--text-secondary)]">
                    {m.startDate.slice(5)} ~ {m.endDate.slice(5)} · {m.note}
                  </span>
                </button>
              );
            })}
          </div>
        </>
      ) : null}
    </Card>
  );
}
