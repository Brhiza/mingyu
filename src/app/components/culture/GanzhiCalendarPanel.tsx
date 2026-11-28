import * as React from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import '../../../v2-ui/styles/GanzhiCalendarPanel.css';
import { SolarDay, SolarTerm, SolarTime } from 'tyme4ts';
import { getAlmanacSolarDayGods } from '../../../systems/almanac/gods';
import {
  getDayBranchRelations,
  getDayDuty,
  getDayTaboos,
  getDayTwelveStar,
  getDayTwentyEightStar,
  getHourTwelveStar,
  getSolarDayNineStar,
} from '../../../systems/almanac/rules';
import { getSolarYmdHmsPillars } from '../../../systems/calendar';
import { stepSixtyCycle } from '../../../systems/ganzhi-foundation';

interface CalendarTermItem {
  name: string;
  isJie: boolean;
  dateKey: string;
  chinaDateTime: string;
  beforeMonthPillar: string;
  afterMonthPillar: string;
}

interface CalendarCellModel {
  date: string;
  year: number;
  month: number;
  day: number;
  weekdayIndex: number;
  weekday: string;
  isCurrentMonth: boolean;
  isToday: boolean;
  lunarDate: string;
  lunarFull: string;
  yearGanzhi: string;
  monthGanzhi: string;
  dayGanzhi: string;
  noonHourGanzhi: string;
  valueGod: string;
  valueGodFortune: '黄道' | '黑道';
  dayOfficer: string;
  clashText: string;
  nineStar: string;
  twentyEightStar: string;
  recommends: string[];
  avoids: string[];
  luckyGods: string[];
  unluckyGods: string[];
  hours: Array<{
    name: string;
    range: string;
    ganzhi: string;
    twelveStar: string;
    fortune: '黄道' | '黑道';
  }>;
  solarTerms: CalendarTermItem[];
}

const WEEK_LABELS = ['日', '一', '二', '三', '四', '五', '六'] as const;
const HUANGDAO_STARS = new Set(['青龙', '明堂', '天德', '玉堂', '司命', '金匮']);
const JIE_TERM_NAMES = new Set([
  '立春',
  '惊蛰',
  '清明',
  '立夏',
  '芒种',
  '小暑',
  '立秋',
  '白露',
  '寒露',
  '立冬',
  '大雪',
  '小寒',
]);
const HOUR_RANGES = [
  '00:00-01:00',
  '01:00-03:00',
  '03:00-05:00',
  '05:00-07:00',
  '07:00-09:00',
  '09:00-11:00',
  '11:00-13:00',
  '13:00-15:00',
  '15:00-17:00',
  '17:00-19:00',
  '19:00-21:00',
  '21:00-23:00',
  '23:00-24:00',
] as const;

export function getBeijingNowParts() {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Shanghai',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).formatToParts(new Date());
  const map = Object.fromEntries(parts.map((p) => [p.type, p.value]));
  const year = Number(map.year || 2026);
  const dateStr = `${map.year}-${map.month}-${map.day}`;
  const hour = map.hour === '24' ? '00' : map.hour;
  const timeStr = `${hour}:${map.minute}`;
  return { year, dateStr, timeStr };
}

export function parseDateParts(dateStr: string): { year: number; month: number; day: number } {
  const [y, m, d] = dateStr.split('-').map((n) => Number.parseInt(n, 10));
  return {
    year: y || 2026,
    month: m || 1,
    day: d || 1,
  };
}

export function parseTimeParts(timeStr: string): { hour: number; minute: number } {
  const [h, m] = timeStr.split(':').map((n) => Number.parseInt(n, 10));
  return {
    hour: Number.isFinite(h) ? h! : 12,
    minute: Number.isFinite(m) ? m! : 0,
  };
}

function pad2(n: number): string {
  return String(n).padStart(2, '0');
}

function formatDateKey(y: number, m: number, d: number): string {
  return `${y}-${pad2(m)}-${pad2(d)}`;
}

function addDaysUtc(dateKey: string, delta: number): string {
  const { year, month, day } = parseDateParts(dateKey);
  const dt = new Date(Date.UTC(year, month - 1, day + delta));
  return formatDateKey(dt.getUTCFullYear(), dt.getUTCMonth() + 1, dt.getUTCDate());
}

function shiftMonthKey(monthKey: string, delta: number): string {
  const [yStr, mStr] = monthKey.split('-');
  const dt = new Date(Date.UTC(Number(yStr) || 2026, (Number(mStr) || 1) - 1 + delta, 1));
  const y = Math.min(2100, Math.max(1900, dt.getUTCFullYear()));
  return `${y}-${pad2(dt.getUTCMonth() + 1)}`;
}

function collectYearSolarTerms(year: number): CalendarTermItem[] {
  const list: CalendarTermItem[] = [];
  for (const y of [year - 1, year, year + 1]) {
    if (y < 1900 || y > 2100) continue;
    for (let idx = 0; idx < 24; idx++) {
      try {
        const term = SolarTerm.fromIndex(y, idx);
        const st = term.getJulianDay().getSolarTime();
        const ty = st.getYear();
        const tm = st.getMonth();
        const td = st.getDay();
        const dateKey = formatDateKey(ty, tm, td);
        const timeText = `${pad2(st.getHour())}:${pad2(st.getMinute())}:${pad2(st.getSecond())}`;
        const name = term.getName();
        const isJie = JIE_TERM_NAMES.has(name);
        const beforePillars = getSolarYmdHmsPillars(ty, tm, td, 0, 0, 0);
        const afterPillars = getSolarYmdHmsPillars(ty, tm, td, 23, 59, 59);
        list.push({
          name,
          isJie,
          dateKey,
          chinaDateTime: `${dateKey} ${timeText}`,
          beforeMonthPillar: beforePillars.month,
          afterMonthPillar: afterPillars.month,
        });
      } catch {}
    }
  }
  return list;
}

function buildCalendarCellModel(
  dateKey: string,
  currentMonthKey: string,
  todayKey: string,
  termsByDate: Map<string, CalendarTermItem[]>,
): CalendarCellModel {
  const { year, month, day } = parseDateParts(dateKey);
  const solarDay = SolarDay.fromYmd(year, month, day);
  const lunar = solarDay.getLunarDay();
  const noon = SolarTime.fromYmdHms(year, month, day, 12, 0, 0);
  const noonPillars = getSolarYmdHmsPillars(year, month, day, 12, 0, 0);

  const dayGanzhi = noonPillars.day;
  const monthBranch = noonPillars.month[1];
  const dayBranch = dayGanzhi[1];
  const valueGod = getDayTwelveStar(monthBranch, dayBranch);
  const valueGodFortune: '黄道' | '黑道' = HUANGDAO_STARS.has(valueGod) ? '黄道' : '黑道';
  const weekdayIndex = new Date(Date.UTC(year, month - 1, day)).getUTCDay();

  const lunarStr = lunar.toString().replace(/^农历[^年]+年/u, '');
  const lunarDayName = lunar.getName();
  const lunarDate =
    lunar.getDay() === 1
      ? lunarStr.endsWith(lunarDayName)
        ? lunarStr.slice(0, -lunarDayName.length) || lunarDayName
        : lunarStr
      : lunarDayName;

  const branchRel = getDayBranchRelations(dayBranch);
  const clashText = `${branchRel.zodiac}日冲${branchRel.oppositeZodiac}（${dayBranch}${branchRel.oppositeBranch}相冲 · 煞${branchRel.ominous}）`;

  const { recommends, avoids } = getDayTaboos(monthBranch, dayGanzhi);

  let luckyGods: string[] = [];
  let unluckyGods: string[] = [];
  try {
    const gods = getAlmanacSolarDayGods(solarDay, noon);
    luckyGods = gods.filter((g) => g.luck === '吉').map((g) => g.name);
    unluckyGods = gods.filter((g) => g.luck !== '吉').map((g) => g.name);
  } catch {}

  const sourceHours = lunar.getHours();
  const hours = sourceHours.map((h, i) => {
    const gz = h.getSixtyCycle().getName();
    const expectedBranch = [...'子丑寅卯辰巳午未申酉戌亥子'][i] ?? '子';
    const effectiveDayBranch = i === 12 ? stepSixtyCycle(dayGanzhi, 1)[1] : dayBranch;
    const star = getHourTwelveStar(effectiveDayBranch, expectedBranch);
    return {
      name: i === 0 ? '早子时' : i === 12 ? '晚子时' : `${expectedBranch}时`,
      range: HOUR_RANGES[i] ?? '',
      ganzhi: gz,
      twelveStar: star,
      fortune: (HUANGDAO_STARS.has(star) ? '黄道' : '黑道') as '黄道' | '黑道',
    };
  });

  return {
    date: dateKey,
    year,
    month,
    day,
    weekdayIndex,
    weekday: `星期${WEEK_LABELS[weekdayIndex]}`,
    isCurrentMonth: dateKey.slice(0, 7) === currentMonthKey,
    isToday: dateKey === todayKey,
    lunarDate,
    lunarFull: lunar.toString(),
    yearGanzhi: noonPillars.year,
    monthGanzhi: noonPillars.month,
    dayGanzhi,
    noonHourGanzhi: noonPillars.hour,
    valueGod,
    valueGodFortune,
    dayOfficer: getDayDuty(monthBranch, dayBranch),
    clashText,
    nineStar: getSolarDayNineStar(solarDay).fullName,
    twentyEightStar: `${getDayTwentyEightStar(weekdayIndex, dayBranch).name}宿`,
    recommends,
    avoids,
    luckyGods,
    unluckyGods,
    hours,
    solarTerms: termsByDate.get(dateKey) ?? [],
  };
}

export interface GanzhiCalendarPanelProps {
  selectedDate?: string;
  embedded?: boolean;
  onSelectDate?: (dateKey: string) => void;
}

export function GanzhiCalendarPanel({
  selectedDate: externalDate,
  embedded = false,
  onSelectDate,
}: GanzhiCalendarPanelProps) {
  const nowParts = React.useMemo(() => getBeijingNowParts(), []);
  const todayKey = nowParts.dateStr;

  const [selectedDate, setSelectedDate] = React.useState<string>(() =>
    externalDate && /^\d{4}-\d{2}-\d{2}$/.test(externalDate) ? externalDate : todayKey,
  );
  const [monthKey, setMonthKey] = React.useState<string>(() => selectedDate.slice(0, 7));
  const [moreOpen, setMoreOpen] = React.useState<boolean>(() =>
    typeof window !== 'undefined' ? window.innerWidth >= 680 : true,
  );

  React.useEffect(() => {
    if (externalDate && /^\d{4}-\d{2}-\d{2}$/.test(externalDate)) {
      setSelectedDate(externalDate);
      setMonthKey(externalDate.slice(0, 7));
    }
  }, [externalDate]);

  const [yNum, mNum] = monthKey.split('-').map(Number);
  const year = yNum || nowParts.year;
  const month = mNum || 1;

  const { cells, selectedDetail, beforeBoundary, afterBoundary, currentMonthTerms } =
    React.useMemo(() => {
      const allTerms = collectYearSolarTerms(year);
      const termsByDate = new Map<string, CalendarTermItem[]>();
      for (const t of allTerms) {
        const arr = termsByDate.get(t.dateKey) ?? [];
        arr.push(t);
        termsByDate.set(t.dateKey, arr);
      }

      const firstDayKey = formatDateKey(year, month, 1);
      const firstWeekday = new Date(Date.UTC(year, month - 1, 1)).getUTCDay();
      const gridStartKey = addDaysUtc(firstDayKey, -firstWeekday);

      const gridCells: CalendarCellModel[] = Array.from({ length: 42 }, (_, idx) => {
        const dateKey = addDaysUtc(gridStartKey, idx);
        return buildCalendarCellModel(dateKey, monthKey, todayKey, termsByDate);
      });

      const detail =
        gridCells.find((c) => c.date === selectedDate) ??
        buildCalendarCellModel(selectedDate, monthKey, todayKey, termsByDate);

      const jieTerms = allTerms.filter((t) => t.isJie);
      const before = [...jieTerms].reverse().find((t) => t.dateKey <= selectedDate) ?? null;
      const after = jieTerms.find((t) => t.dateKey > selectedDate) ?? null;
      const monthTerms = gridCells.filter((c) => c.isCurrentMonth).flatMap((c) => c.solarTerms);

      return {
        cells: gridCells,
        selectedDetail: detail,
        beforeBoundary: before,
        afterBoundary: after,
        currentMonthTerms: monthTerms,
      };
    }, [month, monthKey, selectedDate, todayKey, year]);

  const updateSelection = (nextDate: string, nextMonth = nextDate.slice(0, 7)) => {
    setSelectedDate(nextDate);
    setMonthKey(nextMonth);
    onSelectDate?.(nextDate);
  };

  const dFortuneCls = selectedDetail.valueGodFortune === '黄道' ? 'is-huangdao' : 'is-heidao';

  return (
    <div className={`ganzhi-calendar-page ganzhi-calendar-panel${embedded ? ' is-embedded' : ''}`}>
      <section className="workspace-ui-surface ganzhi-calendar-surface">
        <header className="ganzhi-calendar-toolbar">
          <div className="ganzhi-calendar-month-control">
            <button
              type="button"
              className="workspace-ui-button is-secondary is-small ganzhi-calendar-nav-button"
              aria-label="查看上个月"
              disabled={monthKey <= '1900-01'}
              onClick={() => {
                const nextMonth = shiftMonthKey(monthKey, -1);
                const dayNum = Math.min(28, Number(selectedDate.slice(8, 10)) || 1);
                updateSelection(`${nextMonth}-${pad2(dayNum)}`, nextMonth);
              }}
            >
              <ChevronLeft className="h-4 w-4" aria-hidden="true" />
            </button>

            <label className="ganzhi-calendar-month-picker">
              <span>{`${year}年${month}月`}</span>
              <input
                type="month"
                min="1900-01"
                max="2100-12"
                value={monthKey}
                aria-label="选择月份"
                onChange={(e) => {
                  if (!e.target.value) return;
                  const nextMonth = e.target.value;
                  const dayNum = Math.min(28, Number(selectedDate.slice(8, 10)) || 1);
                  updateSelection(`${nextMonth}-${pad2(dayNum)}`, nextMonth);
                }}
              />
            </label>

            <button
              type="button"
              className="workspace-ui-button is-secondary is-small ganzhi-calendar-nav-button"
              aria-label="查看下个月"
              disabled={monthKey >= '2100-12'}
              onClick={() => {
                const nextMonth = shiftMonthKey(monthKey, 1);
                const dayNum = Math.min(28, Number(selectedDate.slice(8, 10)) || 1);
                updateSelection(`${nextMonth}-${pad2(dayNum)}`, nextMonth);
              }}
            >
              <ChevronRight className="h-4 w-4" aria-hidden="true" />
            </button>
          </div>

          <button
            type="button"
            className="workspace-ui-button is-secondary is-small"
            onClick={() => updateSelection(todayKey, todayKey.slice(0, 7))}
          >
            今天
          </button>
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
          <span className="ganzhi-legend-note">节气标注· 节切月 / 中气不切月</span>
        </div>

        <div className="ganzhi-calendar-layout">
          <section className="ganzhi-calendar-board" aria-label={`${year}年${month}月干支月历`}>
            <div className="ganzhi-calendar-week-row" aria-hidden="true">
              {WEEK_LABELS.map((w, idx) => (
                <span key={w} className={idx === 0 || idx === 6 ? 'is-weekend' : undefined}>
                  {w}
                </span>
              ))}
            </div>

            <div className="ganzhi-calendar-grid" role="group">
              {cells.map((cell) => {
                const isSelected = cell.date === selectedDate;
                const fortuneCls = cell.valueGodFortune === '黄道' ? 'is-huangdao' : 'is-heidao';
                const termText = cell.solarTerms
                  .map((t) => `${t.name}${t.isJie ? '·节' : ''}`)
                  .join(' ');
                const primaryTerm = cell.solarTerms[0]?.name ?? '';
                const shortLunarDay = cell.lunarDate.endsWith('初一')
                  ? cell.lunarDate.replace(/初一$/, '') || '初一'
                  : cell.lunarDate.slice(-2);
                return (
                  <button
                    key={cell.date}
                    type="button"
                    aria-pressed={isSelected}
                    className={`ganzhi-calendar-cell${cell.isCurrentMonth ? '' : ' is-outside'}${
                      cell.isToday ? ' is-today' : ''
                    }${isSelected ? ' is-selected' : ''}`}
                    onClick={() => updateSelection(cell.date, cell.date.slice(0, 7))}
                  >
                    <span className="ganzhi-cell-topline">
                      <strong>{cell.day}</strong>
                      {cell.isToday ? <em>今</em> : null}
                    </span>
                    <span className={`ganzhi-cell-mobile-sub${primaryTerm ? ' is-term' : ''}`}>
                      {primaryTerm || shortLunarDay}
                    </span>
                    <i
                      className={`ganzhi-cell-dot ${fortuneCls}`}
                      aria-hidden="true"
                    />
                    <span className="ganzhi-cell-lunar">{cell.lunarDate}</span>
                    <span className="ganzhi-cell-ganzhi">{cell.dayGanzhi}</span>
                    <span className={`ganzhi-cell-god ${fortuneCls}`}>
                      {cell.valueGod}
                      <span className="ganzhi-cell-fortune">{cell.valueGodFortune}</span>
                    </span>
                    {termText ? <span className="ganzhi-cell-term">{termText}</span> : null}
                  </button>
                );
              })}
            </div>

            <div className="ganzhi-month-terms" aria-label="本月节气交接">
              {currentMonthTerms.map((term) => (
                <p key={`${term.name}-${term.chinaDateTime}`}>
                  <strong>{term.name}</strong> {term.chinaDateTime.slice(5)}{' '}
                  <span>
                    {term.isJie
                      ? `月柱 ${term.beforeMonthPillar} → ${term.afterMonthPillar}`
                      : '中气 · 不切月'}
                  </span>
                </p>
              ))}
            </div>
          </section>

          <section className="ganzhi-calendar-detail">
            <header className="ganzhi-detail-header">
              <div>
                <p className="ganzhi-detail-eyebrow">{`选中日期 · ${selectedDetail.weekday}`}</p>
                <h2>{`${selectedDetail.year}年${selectedDetail.month}月${selectedDetail.day}日`}</h2>
                <p>
                  {selectedDetail.lunarFull} · <strong>{`${selectedDetail.dayGanzhi}日`}</strong>
                </p>
              </div>
              <span className={`ganzhi-detail-badge ${dFortuneCls}`}>
                {`${selectedDetail.valueGod} · ${selectedDetail.valueGodFortune}`}
              </span>
            </header>

            <section className="ganzhi-detail-section">
              <h3>传统宜忌</h3>
              <div className="ganzhi-recommend-grid">
                <div className="is-recommend">
                  <span>宜</span>
                  <p>{selectedDetail.recommends.length ? selectedDetail.recommends.join('、') : '诸事不宜'}</p>
                </div>
                <div className="is-avoid">
                  <span>忌</span>
                  <p>{selectedDetail.avoids.length ? selectedDetail.avoids.join('、') : '无特别忌项'}</p>
                </div>
              </div>
            </section>

            <div className="ganzhi-detail-facts">
              <div>
                <span>四柱干支</span>
                <strong>{`${selectedDetail.yearGanzhi} · ${selectedDetail.monthGanzhi} · ${selectedDetail.dayGanzhi}`}</strong>
              </div>
              <div>
                <span>建除十二神</span>
                <strong>{`${selectedDetail.dayOfficer}日`}</strong>
              </div>
              <div>
                <span>冲煞</span>
                <strong>{selectedDetail.clashText}</strong>
              </div>
              <div>
                <span>九星 / 廿八宿</span>
                <strong>{`${selectedDetail.nineStar} · ${selectedDetail.twentyEightStar}`}</strong>
              </div>
            </div>

            <details
              className="ganzhi-detail-more"
              open={moreOpen}
              onToggle={(e) => setMoreOpen(e.currentTarget.open)}
            >
              <summary className="ganzhi-detail-more-summary">
                <span>{moreOpen ? '收起当日详历' : '展开当日详历'}</span>
              </summary>

              <div className="ganzhi-detail-more-body">
                <section className="ganzhi-detail-section">
                  <h3>月令交节</h3>
                  <div className="ganzhi-boundary-list">
                    {(
                      [
                        ['前一交节', beforeBoundary],
                        ['后一交节', afterBoundary],
                      ] as const
                    ).map(([label, b]) =>
                      b ? (
                        <div key={label} className="ganzhi-boundary-row">
                          <span>{label}</span>
                          <div>
                            <strong>{b.name}</strong>
                            <small>{`${b.chinaDateTime} 中国标准时间`}</small>
                            <p>
                              {b.beforeMonthPillar} <b>→</b> {b.afterMonthPillar}
                            </p>
                          </div>
                        </div>
                      ) : null,
                    )}
                  </div>
                </section>

                <section className="ganzhi-detail-section">
                  <h3>本日节气</h3>
                  {selectedDetail.solarTerms.length ? (
                    <div className="ganzhi-term-list">
                      {selectedDetail.solarTerms.map((t) => (
                        <div key={`${t.name}-${t.chinaDateTime}`}>
                          <strong>{t.name}</strong>
                          <span>{`${t.chinaDateTime} 中国标准时间`}</span>
                          <small>{t.isJie ? '节 · 切月边界' : '中气 · 不切月'}</small>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="ganzhi-detail-note">本日无节气交接。</p>
                  )}
                </section>

                <section className="ganzhi-detail-section">
                  <h3>吉神凶煞</h3>
                  <div className="ganzhi-recommend-grid">
                    <div className="is-recommend">
                      <span>吉神</span>
                      <p>
                        {selectedDetail.luckyGods.length
                          ? selectedDetail.luckyGods.slice(0, 12).join('、')
                          : '—'}
                      </p>
                    </div>
                    <div className="is-avoid">
                      <span>凶煞</span>
                      <p>
                        {selectedDetail.unluckyGods.length
                          ? selectedDetail.unluckyGods.slice(0, 12).join('、')
                          : '—'}
                      </p>
                    </div>
                  </div>
                </section>

                <section className="ganzhi-detail-section">
                  <h3>十二时辰</h3>
                  <div className="ganzhi-hour-grid">
                    {selectedDetail.hours.map((h) => (
                      <div key={h.name} className="ganzhi-hour-item">
                        <strong>{h.name}</strong>
                        <span>{h.range}</span>
                        <b>{h.ganzhi}</b>
                        <small>{`${h.twelveStar} · ${h.fortune}`}</small>
                      </div>
                    ))}
                  </div>
                </section>
              </div>
            </details>
          </section>
        </div>
      </section>
    </div>
  );
}
