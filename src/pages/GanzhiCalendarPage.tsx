import { useMemo, useState } from 'react';
import {
  getBeijingTodayKey,
  getDefaultGanzhiCalendarMonth,
  getGanzhiCalendarDayDetail,
  getGanzhiCalendarMonth,
  shiftGanzhiCalendarMonth,
  type GanzhiCalendarCell,
  type GanzhiCalendarDayDetail,
} from '@/lib/ganzhi-calendar';
import {
  WorkspaceButton,
  WorkspacePage,
  WorkspaceSurface,
} from '@/components/workspace/WorkspaceUI';
import './GanzhiCalendarPage.css';

const WEEK_LABELS = ['日', '一', '二', '三', '四', '五', '六'];

function monthLabel(monthKey: string): string {
  const [year, month] = monthKey.split('-').map(Number);
  return `${year}年${month}月`;
}

function getDateMonthKey(dateKey: string): string {
  return dateKey.slice(0, 7);
}

function getNextSelectedDate(dateKey: string, targetMonthKey: string): string {
  const day = Number(dateKey.slice(8, 10));
  const [year, month] = targetMonthKey.split('-').map(Number);
  const lastDay = new Date(Date.UTC(year, month, 0)).getUTCDate();
  return `${targetMonthKey}-${String(Math.min(day, lastDay)).padStart(2, '0')}`;
}

function formatTermLabel(term: GanzhiCalendarCell['solarTerms'][number]): string {
  return `${term.name}${term.isJie ? '·节' : ''}`;
}

function valueGodClass(cell: GanzhiCalendarCell): string {
  return cell.valueGodFortune === '黄道' ? 'is-huangdao' : 'is-heidao';
}

function CalendarCell({
  cell,
  selected,
  onSelect,
}: {
  cell: GanzhiCalendarCell;
  selected: boolean;
  onSelect: (dateKey: string) => void;
}) {
  const termLabel = cell.solarTerms.map(formatTermLabel).join('、');
  return (
    <button
      type="button"
      disabled={cell.date < '1900-01-01' || cell.date > '2100-12-31'}
      className={`ganzhi-calendar-cell${cell.isCurrentMonth ? '' : ' is-outside'}${
        cell.isToday ? ' is-today' : ''
      }${selected ? ' is-selected' : ''}`}
      aria-pressed={selected}
      aria-label={`${cell.date} ${cell.weekday}，农历${cell.lunarDate}，${cell.dayGanzhi}日，${cell.valueGod}${cell.valueGodFortune}，${termLabel || '无节气'}`}
      onClick={() => onSelect(cell.date)}
    >
      <span className="ganzhi-cell-topline">
        <strong>{cell.day}</strong>
        {cell.isToday ? <em>今</em> : null}
      </span>
      <span className="ganzhi-cell-lunar">{cell.lunarDate}</span>
      <span className="ganzhi-cell-ganzhi">{cell.dayGanzhi}</span>
      <span className={`ganzhi-cell-god ${valueGodClass(cell)}`}>
        {cell.valueGod}
        <span className="ganzhi-cell-fortune">{cell.valueGodFortune}</span>
      </span>
      {cell.solarTerms.length ? (
        <span className="ganzhi-cell-term">{cell.solarTerms.map(formatTermLabel).join(' ')}</span>
      ) : null}
    </button>
  );
}

function DetailPillarBoundary({
  label,
  boundary,
}: {
  label: string;
  boundary: GanzhiCalendarDayDetail['monthBoundaryBefore'];
}) {
  if (!boundary) return null;
  return (
    <div className="ganzhi-boundary-row">
      <span>{label}</span>
      <div>
        <strong>{boundary.termName}</strong>
        <small>{boundary.chinaDateTime} 中国标准时间</small>
        <p>
          {boundary.beforePillar || '—'} <b>→</b> {boundary.afterPillar}
        </p>
      </div>
    </div>
  );
}

function DayDetail({ detail }: { detail: GanzhiCalendarDayDetail }) {
  const almanac = detail.almanac;
  return (
    <section className="ganzhi-calendar-detail" aria-labelledby="ganzhi-calendar-detail-title">
      <header className="ganzhi-detail-header">
        <div>
          <p className="ganzhi-detail-eyebrow">选中日期 · {detail.weekday}</p>
          <h2 id="ganzhi-calendar-detail-title">
            {detail.year}年{detail.month}月{detail.day}日
          </h2>
          <p>
            {almanac.lunarDate} · <strong>{detail.dayGanzhi}日</strong>
          </p>
        </div>
        <span className={`ganzhi-detail-badge ${valueGodClass(detail)}`}>
          {detail.valueGod} · {detail.valueGodFortune}
        </span>
      </header>

      <div className="ganzhi-detail-facts">
        <div>
          <span>年柱（正午）</span>
          <strong>{almanac.ganzhi.year}</strong>
        </div>
        <div>
          <span>月柱（正午）</span>
          <strong>{detail.monthGanzhi}</strong>
        </div>
        <div>
          <span>建除</span>
          <strong>{detail.dayOfficer}日</strong>
        </div>
        <div>
          <span>冲煞</span>
          <strong>{almanac.clash}</strong>
        </div>
        <div>
          <span>九星</span>
          <strong>{almanac.nineStar}</strong>
        </div>
      </div>

      <section className="ganzhi-detail-section">
        <h3>月令交节</h3>
        <p className="ganzhi-detail-note">只有十二节改变月柱；中气只作为节气资料展示。</p>
        <div className="ganzhi-boundary-list">
          <DetailPillarBoundary label="前一交节" boundary={detail.monthBoundaryBefore} />
          <DetailPillarBoundary label="后一交节" boundary={detail.monthBoundaryAfter} />
        </div>
      </section>

      <section className="ganzhi-detail-section">
        <h3>本日节气</h3>
        {detail.solarTerms.length ? (
          <div className="ganzhi-term-list">
            {detail.solarTerms.map((term) => (
              <div key={`${term.name}:${term.utcTimestamp}`}>
                <strong>{term.name}</strong>
                <span>{term.chinaDateTime} 中国标准时间</span>
                <small>{term.isJie ? '节 · 切月边界' : '中气 · 不切月'}</small>
              </div>
            ))}
          </div>
        ) : (
          <p className="ganzhi-detail-note">本日无节气交接。</p>
        )}
      </section>

      <section className="ganzhi-detail-section">
        <h3>传统宜忌</h3>
        <div className="ganzhi-recommend-grid">
          <div className="is-recommend">
            <span>宜</span>
            <p>{almanac.recommends.length ? almanac.recommends.join('、') : '未列宜项'}</p>
          </div>
          <div className="is-avoid">
            <span>忌</span>
            <p>{almanac.avoids.length ? almanac.avoids.join('、') : '未列忌项'}</p>
          </div>
        </div>
      </section>

      <section className="ganzhi-detail-section">
        <h3>十二时辰</h3>
        <div className="ganzhi-hour-grid">
          {(almanac.hours ?? []).map((hour) => (
            <div key={`${hour.branch}:${hour.ganzhi}`} className="ganzhi-hour-item">
              <strong>{hour.name}</strong>
              <span>{hour.range}</span>
              <b>{hour.ganzhi}</b>
              <small>{hour.twelveStar}</small>
            </div>
          ))}
        </div>
      </section>
    </section>
  );
}

export function GanzhiCalendarPage() {
  const todayKey = useMemo(() => getBeijingTodayKey(), []);
  const todayMonth = useMemo(() => getDefaultGanzhiCalendarMonth(), []);
  const [monthKey, setMonthKey] = useState(todayMonth);
  const [selectedDate, setSelectedDate] = useState(todayKey);
  const month = useMemo(() => getGanzhiCalendarMonth(monthKey, todayKey), [monthKey, todayKey]);
  const detail = useMemo(
    () => getGanzhiCalendarDayDetail(selectedDate, todayKey),
    [selectedDate, todayKey],
  );

  function selectDate(dateKey: string) {
    setSelectedDate(dateKey);
    const nextMonthKey = getDateMonthKey(dateKey);
    if (nextMonthKey !== monthKey) setMonthKey(nextMonthKey);
  }

  function navigateMonth(amount: number) {
    const nextMonthKey = shiftGanzhiCalendarMonth(monthKey, amount);
    setMonthKey(nextMonthKey);
    setSelectedDate(getNextSelectedDate(selectedDate, nextMonthKey));
  }

  function showToday() {
    setMonthKey(todayMonth);
    setSelectedDate(todayKey);
  }

  return (
    <WorkspacePage title="干支日历" width="wide" className="ganzhi-calendar-page">
      <p className="ganzhi-calendar-intro">
        北京时间 · 公历、农历、日干支与黄黑道值神同屏查看；点击日期查看建除、宜忌、冲煞和时辰。
      </p>
      <WorkspaceSurface className="ganzhi-calendar-surface">
        <header className="ganzhi-calendar-toolbar">
          <div className="ganzhi-calendar-month-control">
            <WorkspaceButton
              size="small"
              className="ganzhi-calendar-nav-button"
              aria-label="查看上个月"
              disabled={monthKey === '1900-01'}
              onClick={() => navigateMonth(-1)}
            >
              ‹
            </WorkspaceButton>
            <label className="ganzhi-calendar-month-picker">
              <span>{monthLabel(monthKey)}</span>
              <input
                type="month"
                value={monthKey}
                min="1900-01"
                max="2100-12"
                aria-label="选择月份"
                onChange={(event) => {
                  const next = event.target.value;
                  if (!next || !event.target.validity.valid) return;
                  setMonthKey(next);
                  setSelectedDate(getNextSelectedDate(selectedDate, next));
                }}
              />
            </label>
            <WorkspaceButton
              size="small"
              className="ganzhi-calendar-nav-button"
              aria-label="查看下个月"
              disabled={monthKey === '2100-12'}
              onClick={() => navigateMonth(1)}
            >
              ›
            </WorkspaceButton>
          </div>
          <WorkspaceButton size="small" onClick={showToday}>
            今天
          </WorkspaceButton>
        </header>

        <div className="ganzhi-calendar-legend" aria-label="月历图例">
          <span>
            <i className="is-huangdao" />
            黄道值神
          </span>
          <span>
            <i className="is-heidao" />
            黑道值神
          </span>
          <span>节气标注· 节切月 / 中气不切月</span>
        </div>

        <div className="ganzhi-calendar-layout">
          <section className="ganzhi-calendar-board" aria-label={`${month.label}干支月历`}>
            <div className="ganzhi-calendar-week-row" aria-hidden="true">
              {WEEK_LABELS.map((label, index) => (
                <span key={label} className={index === 0 || index === 6 ? 'is-weekend' : ''}>
                  {label}
                </span>
              ))}
            </div>
            <div className="ganzhi-calendar-grid" role="group" aria-label={`${month.label}日历`}>
              {month.cells.map((cell) => (
                <CalendarCell
                  key={cell.date}
                  cell={cell}
                  selected={selectedDate === cell.date}
                  onSelect={selectDate}
                />
              ))}
            </div>
            <div className="ganzhi-month-terms" aria-label="本月节气交接">
              {month.cells
                .filter((cell) => cell.isCurrentMonth)
                .flatMap((cell) => cell.solarTerms)
                .map((term) => {
                  const boundary = month.monthBoundaries.find(
                    (item) => item.utcTimestamp === term.utcTimestamp,
                  );
                  return (
                    <p key={term.utcTimestamp}>
                      <strong>{term.name}</strong> {term.chinaDateTime.slice(5)}
                      <span>
                        {boundary
                          ? `月柱 ${boundary.beforePillar} → ${boundary.afterPillar}`
                          : '中气'}
                      </span>
                    </p>
                  );
                })}
            </div>
          </section>
          <DayDetail detail={detail} />
        </div>
      </WorkspaceSurface>
    </WorkspacePage>
  );
}
